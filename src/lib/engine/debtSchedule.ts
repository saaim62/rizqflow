import { Liability, LiabilityPayoffInfo } from '@/types';

/**
 * Monthly debt schedule for scheduled liabilities (NOTES #45).
 *
 * Pure functions of the liability list — no I/O, no Date.now. Time enters
 * only through the explicit `ProjectionStart` parameter: month 1 of the
 * schedule is the start year/month the caller passes in, and a balloon's
 * due month is derived from its `dueDateISO` relative to that start.
 *
 * Semantics per kind (interest accrues on the balance first each month,
 * then the payment applies):
 * - amortizing: fixed `monthlyPaymentPkr` until payoff. If the payment is
 *   below a month's interest the balance GROWS — allowed mathematically,
 *   but flagged on the payoff info and in `warnings`, never silent.
 * - revolving: payment = `minPaymentPctOfBalance` % of the current
 *   (post-interest) balance, until cleared; a residual balance of Rs 1 or
 *   less is settled in full so a % schedule actually terminates.
 * - balloon: no payments; the balance accrues at APR and the FULL balance
 *   is a single outflow in the due month.
 *
 * Legacy NOTES #23 items (no `kind` / no `balancePkr`) are NOT scheduled:
 * they are a position, not a cash-flow schedule (see types/index.ts).
 */

export interface ProjectionStart {
  year: number;
  month: number; // 1–12
}

const EPS = 0.005;

function finitePos(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export function liabilityDisplayName(l: Liability): string {
  return l.name || l.label || 'Liability';
}

/** Effective outstanding balance: scheduled `balancePkr`, else legacy `amountPkr`. */
export function liabilityBalancePkr(l: Liability): number {
  if (typeof l.balancePkr === 'number' && Number.isFinite(l.balancePkr)) {
    return Math.max(0, l.balancePkr);
  }
  return finitePos(l.amountPkr);
}

/** A liability is scheduled only when it carries an explicit kind + balance. */
export function isScheduledLiability(l: Liability): boolean {
  return (
    (l.kind === 'amortizing' || l.kind === 'revolving' || l.kind === 'balloon') &&
    typeof l.balancePkr === 'number' &&
    Number.isFinite(l.balancePkr) &&
    l.balancePkr > 0
  );
}

/**
 * 1-based schedule month in which a balloon falls due, derived from
 * `dueDateISO` relative to the projection start. Returns null when the
 * date is missing/invalid or no start was supplied (the caller then
 * cannot place the balloon in time and must say so — never guess).
 * A due date before the start is due immediately (month 1).
 */
export function balloonDueMonth(
  dueDateISO: string | undefined,
  start: ProjectionStart | undefined
): number | null {
  if (!dueDateISO || !start) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dueDateISO);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  const offset = (year - start.year) * 12 + (month - start.month);
  return Math.max(1, offset + 1);
}

export interface LiabilitySchedule {
  /** Total outflow per schedule month (index 0 = month 1). */
  monthlyOutflows: number[];
  /** Outflow per schedule month, per liability id. */
  outflowsByLiability: Map<string, number[]>;
  /** Total scheduled balance outstanding at each month end. */
  totalBalanceByMonth: number[];
  payoffs: LiabilityPayoffInfo[];
  warnings: string[];
}

export function buildLiabilitySchedule(
  liabilities: Liability[],
  horizonMonths: number,
  start?: ProjectionStart
): LiabilitySchedule {
  const horizon = Math.max(0, Math.floor(horizonMonths) || 0);
  const monthlyOutflows = new Array<number>(horizon).fill(0);
  const totalBalanceByMonth = new Array<number>(horizon).fill(0);
  const outflowsByLiability = new Map<string, number[]>();
  const payoffs: LiabilityPayoffInfo[] = [];
  const warnings: string[] = [];

  for (const l of liabilities ?? []) {
    if (!isScheduledLiability(l)) continue;
    const name = liabilityDisplayName(l);
    const monthlyRate = (typeof l.aprPct === 'number' && Number.isFinite(l.aprPct) ? Math.max(0, l.aprPct) : 0) / 1200;
    const outflows = new Array<number>(horizon).fill(0);
    let balance = liabilityBalancePkr(l);
    let totalInterest = 0;
    let totalPaid = 0;
    let payoffMonth: number | null = null;
    let negativeAmortization = false;

    if (l.kind === 'balloon') {
      const dueMonth = balloonDueMonth(l.dueDateISO, start);
      if (dueMonth === null) {
        warnings.push(
          `Balloon liability "${name}" has no usable due date / projection start, so it is not scheduled in the projection.`
        );
        // Still report its (unscheduled) balance as outstanding.
        for (let m = 0; m < horizon; m++) totalBalanceByMonth[m] += balance;
        outflowsByLiability.set(l.id, outflows);
        payoffs.push({
          liabilityId: l.id,
          name,
          payoffMonth: null,
          totalInterestPkr: 0,
          totalPaidPkr: 0,
          negativeAmortization: false,
        });
        continue;
      }
      for (let m = 1; m <= horizon; m++) {
        const interest = balance * monthlyRate;
        balance += interest;
        totalInterest += interest;
        if (m === dueMonth) {
          outflows[m - 1] = balance;
          totalPaid = balance;
          balance = 0;
          payoffMonth = m;
        }
        totalBalanceByMonth[m - 1] += balance;
        if (payoffMonth !== null) break;
      }
      // Due beyond the horizon: the loop above already accrued interest
      // to the horizon, so the outstanding balance stays honest.
    } else {
      const configuredPayment =
        l.kind === 'amortizing' ? finitePos(l.monthlyPaymentPkr) : 0;
      const minPct =
        l.kind === 'revolving'
          ? typeof l.minPaymentPctOfBalance === 'number' && Number.isFinite(l.minPaymentPctOfBalance)
            ? Math.min(100, Math.max(0, l.minPaymentPctOfBalance))
            : 0
          : 0;
      if (l.kind === 'amortizing' && configuredPayment <= 0) {
        warnings.push(
          `Amortizing liability "${name}" has no monthly payment set, so its balance only grows with interest in the projection.`
        );
      }
      if (l.kind === 'revolving' && minPct <= 0) {
        warnings.push(
          `Revolving liability "${name}" has no minimum-payment % set, so its balance only grows with interest in the projection.`
        );
      }
      for (let m = 1; m <= horizon; m++) {
        if (balance > EPS) {
          const interest = balance * monthlyRate;
          balance += interest;
          totalInterest += interest;
          let payment: number;
          if (l.kind === 'amortizing') {
            payment = Math.min(configuredPayment, balance);
          } else {
            // Revolving: % of the current (post-interest) balance; a
            // residual of Rs 1 or less is settled so the schedule ends.
            payment = balance <= 1 ? balance : Math.min(balance, (minPct / 100) * balance);
          }
          if (payment < interest - EPS && balance - payment > balance - interest) {
            negativeAmortization = true;
          }
          balance -= payment;
          totalPaid += payment;
          outflows[m - 1] = payment;
          if (balance <= EPS) {
            balance = 0;
            payoffMonth = m;
          }
        }
        totalBalanceByMonth[m - 1] += balance;
        if (payoffMonth !== null) break; // later months: zero balance
      }
      if (negativeAmortization) {
        warnings.push(
          `Liability "${name}": the monthly payment is less than the monthly interest, so the balance is GROWING (negative amortisation). Increase the payment to start clearing it.`
        );
      }
    }

    for (let m = 0; m < horizon; m++) monthlyOutflows[m] += outflows[m];
    outflowsByLiability.set(l.id, outflows);
    payoffs.push({
      liabilityId: l.id,
      name,
      payoffMonth,
      totalInterestPkr: Math.round(totalInterest * 100) / 100,
      totalPaidPkr: Math.round(totalPaid * 100) / 100,
      negativeAmortization,
    });
  }

  return { monthlyOutflows, outflowsByLiability, totalBalanceByMonth, payoffs, warnings };
}

/**
 * Standalone payoff summary for one liability (UI per-liability line).
 * Uses the same schedule math as the engine — no duplicated formulas.
 * A generous 600-month horizon is used so payoff dates are not clipped
 * by the planner's retirement horizon.
 */
export function summarizeLiability(
  l: Liability,
  start?: ProjectionStart
): LiabilityPayoffInfo | null {
  if (!isScheduledLiability(l)) return null;
  const schedule = buildLiabilitySchedule([l], 600, start);
  return schedule.payoffs[0] ?? null;
}
