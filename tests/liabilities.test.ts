import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES } from '@/data/marketData';
import type { Liability, UserProfile } from '@/types';
import { sanitizeProfile } from '@/lib/stateUrl';
import { calculateLifePlan } from '@/lib/engine/wealthEngine';
import {
  balloonDueMonth,
  buildLiabilitySchedule,
  summarizeLiability,
} from '@/lib/engine/debtSchedule';

/**
 * NOTES #45 — Liabilities that actually bite (due-date model).
 *
 * The fixture pattern is copied from tests/qa-baseline.test.ts (the
 * owner's audited fixture, sanitized against the first preset as
 * fallback) — qa-baseline.test.ts itself is NOT modified.
 *
 * For exact engine arithmetic, `flatProfile` zeroes every bucket return
 * and stops contributions/reinvestment, so the portfolio is a constant
 * Rs 5,000,000 until a liability outflow lands: any movement in the
 * wealth path is then attributable to the debt schedule alone.
 */
const FIXTURE_RAW = {
  age: 29,
  role: 'freelancer',
  gender: 'male',
  solarKw: 11,
  expenses: {
    rentOrHousing: 0,
    familyAndOther: 5000,
    fuelAndCommute: 8162,
    groceriesAndFood: 25000,
    utilitiesAndInternet: 5000,
  },
  usdToPkr: 276.5,
  vehicles: [
    {
      id: 'nissan-leaf',
      name: 'Nissan Leaf 40kWh EV',
      fuelType: 'ev',
      pricePkr: 4800000,
      kwhPer100Km: 15,
      isCurrentVehicle: true,
      annualMaintenancePkr: 35000,
      fiveYearDepreciationPct: 40,
    },
  ],
  lifeGoals: [
    { id: 'goal-debt-2027', name: 'Debt Clearance (installments, due 2027)', targetAge: 30, costInTodaysPkr: 750000 },
  ],
  taxStatus: 'filer',
  lumpSumPkr: 0,
  shariahOnly: true,
  assetBuckets: [
    { id: 'psx-dividends', label: 'PSX Dividend Equities', currentValuePkr: 0, monthlySplitPct: 50, expectedAnnualReturnPct: 14 },
    { id: 'gold', label: '24K Physical Gold', currentValuePkr: 0, monthlySplitPct: 20, expectedAnnualReturnPct: 12 },
    { id: 'real-estate', label: 'Real Estate / Land', currentValuePkr: 0, monthlySplitPct: 15, expectedAnnualReturnPct: 13 },
    { id: 'money-market', label: 'Shariah Money Market', currentValuePkr: 0, monthlySplitPct: 10, expectedAnnualReturnPct: 11 },
    { id: 'cash', label: 'Emergency Cash', currentValuePkr: 200000, monthlySplitPct: 5, expectedAnnualReturnPct: 8 },
  ],
  includeZakat: false,
  familyMembers: 2,
  isBreadwinner: true,
  maritalStatus: 'unmarried',
  retirementAge: 40,
  dailyCommuteKm: 25,
  goldPerTolaPkr: 379836,
  gridRatePerKwh: 55,
  solarTariffMode: 'net-metering-legacy',
  monthlyIncomePkr: 300000,
  monthlyInvestPkr: 100000,
  dividendGrowthPct: 10,
  inflationAdjusted: false,
  reinvestDividends: true,
  annualInflationPct: 8,
  currentVehicleType: 'petrol-bike',
  petrolPricePerLitre: 322,
  annualSalaryRaisePct: 12,
  currentCashReservePkr: -750000,
  currentVehicleResalePkr: 1000000,
  opportunityCostReturnPct: 10,
};

const fallback = (PRESET_PROFILES[0] as any).profile as UserProfile;
const fixture: UserProfile = sanitizeProfile(FIXTURE_RAW as any, fallback);

/** Constant-portfolio variant: Rs 5,000,000 that neither grows nor is added to. */
const flatProfile: UserProfile = {
  ...fixture,
  lumpSumPkr: 5_000_000,
  monthlyInvestPkr: 0,
  lifeGoals: [],
  reinvestDividends: false,
  includeZakat: false,
  assetBuckets: fixture.assetBuckets.map((b) => ({ ...b, expectedAnnualReturnPct: 0 })),
};

const START = { year: 2026, month: 1 }; // month 1 = Jan 2026

const balloon1M: Liability = {
  id: 'fam-loan',
  name: 'Family loan — return in 5 years',
  category: 'family-loan',
  kind: 'balloon',
  balancePkr: 1_000_000,
  aprPct: 0,
  dueDateISO: '2030-12-01', // (2030-2026)*12 + (12-1) = 59 months after Jan 2026 → due in month 60
};

describe('NOTES #45 (a): balloon — Rs 1,000,000, 0% APR, due exactly 60 months out', () => {
  it('schedule helper: nothing leaves for 59 months, exactly Rs 1,000,000 at month 60', () => {
    expect(balloonDueMonth(balloon1M.dueDateISO, START)).toBe(60);
    const s = buildLiabilitySchedule([balloon1M], 132, START);
    for (let m = 0; m < 59; m++) expect(s.monthlyOutflows[m]).toBe(0);
    expect(s.monthlyOutflows[59]).toBe(1_000_000);
    expect(s.payoffs[0].payoffMonth).toBe(60);
    expect(s.payoffs[0].totalInterestPkr).toBe(0);
    expect(s.totalBalanceByMonth[58]).toBe(1_000_000);
    expect(s.totalBalanceByMonth[59]).toBe(0);
  });

  it('engine: wealth path identical for years 1–4, exactly Rs 1,000,000 leaves in year 5', () => {
    // The engine exposes yearly snapshots, so month-60 precision is
    // asserted on the schedule helper above; here the year-5 snapshot
    // (months 49–60) must carry the full balloon and nothing else moves.
    const base = calculateLifePlan(flatProfile, { projectionStart: START });
    const withDebt = calculateLifePlan(
      { ...flatProfile, liabilities: [balloon1M] },
      { projectionStart: START }
    );
    expect(base.finalNominalWealthPkr).toBe(5_000_000);
    for (let y = 0; y < 4; y++) {
      expect(withDebt.timeline[y].nominalPortfolioPkr).toBe(base.timeline[y].nominalPortfolioPkr);
    }
    expect(base.timeline[4].nominalPortfolioPkr - withDebt.timeline[4].nominalPortfolioPkr).toBe(1_000_000);
    expect(base.finalNominalWealthPkr - withDebt.finalNominalWealthPkr).toBe(1_000_000);
    expect(withDebt.timeline[4].liabilityPaidPkr).toBe(1_000_000);
    expect(withDebt.timeline[3].liabilityBalancePkr).toBe(1_000_000);
    expect(withDebt.timeline[4].liabilityBalancePkr).toBe(0);
    expect(withDebt.liabilityShortfalls).toEqual([]);
    // Liability payments are NOT routed through expenses (no double-count):
    expect(withDebt.timeline[4].monthlyExpensesPkr).toBe(base.timeline[4].monthlyExpensesPkr);
  });

  it('engine: a balloon the portfolio cannot cover records an explicit shortfall, never a silent negative', () => {
    const poor = { ...flatProfile, lumpSumPkr: 500_000 };
    const plan = calculateLifePlan(
      { ...poor, liabilities: [balloon1M] },
      { projectionStart: START }
    );
    expect(plan.finalNominalWealthPkr).toBe(0);
    expect(plan.liabilityShortfalls).toHaveLength(1);
    expect(plan.liabilityShortfalls![0]).toMatchObject({
      liabilityId: 'fam-loan',
      month: 60,
      duePkr: 1_000_000,
      shortfallPkr: 500_000, // 1,000,000 due − 500,000 available
    });
  });
});

describe('NOTES #45 (b): amortizing — hand-computed payoff month and total interest', () => {
  // Rs 1,200,000 at 12% APR (1%/month), Rs 25,000/month.
  // Standard amortisation: n = −ln(1 − r·PV/P) / ln(1+r)
  //   = −ln(1 − 0.01·1,200,000/25,000) / ln(1.01) = −ln(0.52)/ln(1.01) ≈ 65.72
  // → 66 monthly payments, the 66th partial. Month-by-month simulation of
  // (interest accrues, then payment applies) gives:
  //   total interest ≈ Rs 443,001.80, total paid ≈ Rs 1,643,001.80.
  const loan: Liability = {
    id: 'car-loan',
    name: 'Vehicle loan',
    category: 'vehicle-loan',
    kind: 'amortizing',
    balancePkr: 1_200_000,
    aprPct: 12,
    monthlyPaymentPkr: 25_000,
  };

  it('schedule: payoff at month 66 with the hand-computed total interest', () => {
    const s = buildLiabilitySchedule([loan], 240, START);
    expect(s.payoffs[0].payoffMonth).toBe(66);
    expect(s.payoffs[0].totalInterestPkr).toBeCloseTo(443001.8, 0);
    expect(s.payoffs[0].totalPaidPkr).toBeCloseTo(1643001.8, 0);
    expect(s.payoffs[0].negativeAmortization).toBe(false);
    expect(s.totalBalanceByMonth[65]).toBe(0);
    expect(s.warnings).toEqual([]);
  });

  it('engine: payments stop at payoff (month 66 = year 6) and total paid matches', () => {
    const plan = calculateLifePlan(
      { ...flatProfile, lumpSumPkr: 2_000_000, liabilities: [loan] },
      { projectionStart: START }
    );
    expect(plan.totalLiabilityPaymentsPkr).toBeCloseTo(1643002, -1); // ±10 rounding
    expect(plan.timeline[5].liabilityBalancePkr).toBe(0); // end of year 6
    expect(plan.timeline[6].liabilityPaidPkr).toBe(0); // nothing after payoff
    expect(plan.liabilityPayoffs![0].payoffMonth).toBe(66);
  });

  it('summarizeLiability (UI line) agrees with the schedule', () => {
    const info = summarizeLiability(loan, START)!;
    expect(info.payoffMonth).toBe(66);
    expect(info.totalInterestPkr).toBeCloseTo(443001.8, 0);
  });
});

describe('NOTES #45 (c): revolving — % minimum payment clears the balance', () => {
  // Rs 200,000 at 24% APR (2%/month), minimum payment 10% of the current
  // balance each month. Balance multiplier per month = 1.02 × 0.90 = 0.918,
  // so it decays geometrically; with the Rs 1 residual settle rule the
  // month-by-month simulation gives payoff at month 144,
  // total interest ≈ Rs 48,780.27, total paid ≈ Rs 248,780.27.
  const card: Liability = {
    id: 'card',
    name: 'Credit card',
    category: 'credit-card',
    kind: 'revolving',
    balancePkr: 200_000,
    aprPct: 24,
    minPaymentPctOfBalance: 10,
  };

  it('reaches zero, and total paid exceeds the principal', () => {
    const s = buildLiabilitySchedule([card], 600, START);
    expect(s.payoffs[0].payoffMonth).toBe(144);
    expect(s.totalBalanceByMonth[143]).toBe(0);
    expect(s.payoffs[0].totalPaidPkr).toBeCloseTo(248780.27, 0);
    expect(s.payoffs[0].totalPaidPkr).toBeGreaterThan(200_000);
    expect(s.payoffs[0].totalInterestPkr).toBeCloseTo(48780.27, 0);
  });
});

describe('NOTES #45 (d): negative amortisation — balance grows AND a warning is emitted', () => {
  // Rs 500,000 at 24% APR → monthly interest starts at Rs 10,000, but the
  // payment is only Rs 5,000. Balance after 12 months:
  //   500,000·1.02^12 − 5,000·((1.02^12 − 1)/0.02) ≈ Rs 567,060.45.
  const loan: Liability = {
    id: 'neg-am',
    name: 'Underpaid loan',
    category: 'personal-loan',
    kind: 'amortizing',
    balancePkr: 500_000,
    aprPct: 24,
    monthlyPaymentPkr: 5_000,
  };

  it('balance grows month over month and the warning fires', () => {
    const s = buildLiabilitySchedule([loan], 12, START);
    expect(s.totalBalanceByMonth[11]).toBeCloseTo(567060.45, 0);
    expect(s.totalBalanceByMonth[11]).toBeGreaterThan(500_000);
    expect(s.payoffs[0].negativeAmortization).toBe(true);
    expect(s.payoffs[0].payoffMonth).toBeNull();
    expect(s.warnings.some((w) => /GROWING/.test(w))).toBe(true);
  });

  it('engine surfaces the same warning on the plan result', () => {
    const plan = calculateLifePlan(
      { ...flatProfile, liabilities: [loan] },
      { projectionStart: START }
    );
    expect(plan.liabilityWarnings!.some((w) => /GROWING/.test(w))).toBe(true);
  });
});

describe('NOTES #45 (e): empty/absent liabilities ⇒ identical engine output', () => {
  it('deep-equals the same profile without the field', () => {
    const base = calculateLifePlan(fixture);
    const empty = calculateLifePlan({ ...fixture, liabilities: [] });
    const absent = calculateLifePlan({ ...fixture, liabilities: undefined });
    expect(empty).toEqual(base);
    expect(absent).toEqual(base);
  });

  it('legacy NOTES #23 items (no schedule fields) stay position-only', () => {
    const legacy: Liability = { id: 'l1', label: 'Splitwise balance owed', amountPkr: 3_544_611 };
    const base = calculateLifePlan(fixture);
    const withLegacy = calculateLifePlan({ ...fixture, liabilities: [legacy] });
    expect(withLegacy.finalNominalWealthPkr).toBe(base.finalNominalWealthPkr);
    expect(withLegacy.liabilityWarnings).toBeUndefined();
    // …but the position still counts against the emergency-fund gap:
    expect(withLegacy.emergencyFundGapPkr).toBe(base.emergencyFundGapPkr + 3_544_611);
  });
});

describe('NOTES #45 (f): sanitizer — malformed liabilities are clamped/dropped safely', () => {
  it('no NaN/Infinity survives; unknown kind loses its schedule; missing id is replaced', () => {
    const cleaned = sanitizeProfile(
      {
        ...fallback,
        liabilities: [
          { id: 'bad1', name: 'Card', kind: 'revolving', balancePkr: NaN, aprPct: -5, minPaymentPctOfBalance: 5 },
          { name: 'Mystery debt', kind: 'bogus-kind', balancePkr: 5000, aprPct: 12 },
          { label: 'No id legacy', amountPkr: Infinity },
          { id: 'ok', name: 'Family loan', kind: 'balloon', balancePkr: 100000, aprPct: 0, dueDateISO: '2031-13-40' },
        ],
      },
      fallback
    );
    const ls = cleaned.liabilities!;
    expect(ls).toHaveLength(4);
    // NaN balance → 0; negative APR → clamped to 0; valid kind kept.
    expect(ls[0].balancePkr).toBe(0);
    expect(ls[0].amountPkr).toBe(0);
    expect(ls[0].aprPct).toBe(0);
    expect(ls[0].kind).toBe('revolving');
    expect(ls[0].minPaymentPctOfBalance).toBe(5);
    // Unknown kind → schedule dropped (kind undefined), balance kept as a
    // position, canonical + legacy mirrors synced.
    expect(ls[1].kind).toBeUndefined();
    expect(ls[1].balancePkr).toBe(5000);
    expect(ls[1].amountPkr).toBe(5000);
    expect(ls[1].name).toBe('Mystery debt');
    // Missing id → generated; Infinity amount → 0.
    expect(ls[2].id).toBe('liability-2');
    expect(ls[2].amountPkr).toBe(0);
    // Invalid calendar date → dueDateISO dropped, the rest intact.
    expect(ls[3].kind).toBe('balloon');
    expect(ls[3].dueDateISO).toBeUndefined();
    expect(ls[3].balancePkr).toBe(100000);
    // Nothing non-finite anywhere in the cleaned list.
    for (const l of ls) {
      for (const v of Object.values(l)) {
        if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
      }
    }
  });
});
