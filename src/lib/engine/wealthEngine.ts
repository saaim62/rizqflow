import {
  AssetBucket,
  CarDecisionSummary,
  ExpenseCoverageStep,
  GoalOutcome,
  PlanSummary,
  PsxExecutionItem,
  PsxExecutionSheet,
  PsxStock,
  UserProfile,
  VehicleCandidate,
  VehicleTcoResult,
  WealthTimelinePoint,
} from '@/types';
import { PSX_STOCKS } from '@/data/marketData';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';

export interface VehicleSwapOption {
  name: string;
  category: 'e-scooty' | 'micro-ev' | 'city-ev';
  pricePkr: number;
  runningCostPerKmPkr: number;
  netCashRequiredOrFreedPkr: number;
  monthlyFuelSavingsPkr: number;
  paybackMonths: number;
  solarChargingFree: boolean;
  extraMonthlyDividendFromSwapPkr: number;
  monthsShavedOffFreedom: number;
}

interface StockAllocation {
  stock: PsxStock;
  weightPct: number;
}

/**
 * Select a balanced, diversified Grade-A dividend portfolio.
 * Respects Shariah-only filtering and covers core high-cash-flow sectors.
 */
export function selectStockPortfolio(shariahOnly: boolean): StockAllocation[] {
  // Data-driven selection (owner audit, 21 Nov 2026 — NOTES #21). The old
  // version used two frozen hand-picked lists whose weights were calibrated
  // to yields from an older data stamp; it excluded BIPL (11.3%, grade A,
  // Shariah) entirely while carrying 5.4–6.0% names. The basket is now
  // DERIVED from the current stamped data on every call:
  //   1. Universe: grade-A payers only (the reliability grade in the data
  //      layer), Shariah-flagged only when the user asked for Shariah.
  //   2. Rank by current dividend yield, take the top 8.
  //   3. Equal weights — deliberately NOT yield-proportional: weighting
  //      by yield concentrates the basket in the single highest payer
  //      and chases exactly the yields most likely to be one-off.
  const pool = PSX_STOCKS.filter((s) => s.grade === 'A' && (!shariahOnly || s.isShariah));
  const top = [...pool].sort((a, b) => b.dividendYieldPct - a.dividendYieldPct).slice(0, 8);
  if (top.length === 0) return [];
  const weightPct = Number((100 / top.length).toFixed(1));
  return top.map((stock) => ({ stock, weightPct }));
}

/**
 * Normalizes monthly asset bucket allocation percentages so they sum cleanly to 100%.
 */
export function normalizeAssetSplits(buckets: AssetBucket[]): AssetBucket[] {
  if (!buckets || buckets.length === 0) return [];

  const validBuckets = buckets.map((b) => ({
    ...b,
    monthlySplitPct:
      typeof b.monthlySplitPct === 'number' && !isNaN(b.monthlySplitPct) && b.monthlySplitPct > 0
        ? b.monthlySplitPct
        : 0,
  }));

  const sum = validBuckets.reduce((acc, b) => acc + b.monthlySplitPct, 0);

  if (sum === 0) {
    const even = Math.floor((100 / validBuckets.length) * 10) / 10;
    const remainder = Math.round((100 - even * validBuckets.length) * 10) / 10;
    return validBuckets.map((b, i) => ({
      ...b,
      monthlySplitPct: i === 0 ? Number((even + remainder).toFixed(1)) : even,
    }));
  }

  const normalized = validBuckets.map((b) => ({
    ...b,
    monthlySplitPct: Math.round(((b.monthlySplitPct / sum) * 100) * 10) / 10,
  }));

  const currentSum = normalized.reduce((acc, b) => acc + b.monthlySplitPct, 0);
  const diff = Math.round((100 - currentSum) * 10) / 10;

  if (diff !== 0 && normalized.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < normalized.length; i++) {
      if (normalized[i].monthlySplitPct > normalized[maxIdx].monthlySplitPct) {
        maxIdx = i;
      }
    }
    normalized[maxIdx].monthlySplitPct = Number((normalized[maxIdx].monthlySplitPct + diff).toFixed(1));
  }

  return normalized;
}

/**
 * Computes exact PSX execution sheet: shares to buy (Math.floor(amount / price)),
 * cash remainder, and realistic 0.25% brokerage + CDC transaction fee.
 */
export function calculateExecutionSheet(
  allocations: { stock: PsxStock; weightPct: number }[],
  portfolioPkr: number
): PsxExecutionSheet {
  const safePortfolio = Math.max(0, portfolioPkr || 0);
  let totalSpent = 0;
  let totalFees = 0;
  let totalRemainder = 0;
  let totalShares = 0;

  const items: PsxExecutionItem[] = (allocations || []).map((a) => {
    const targetAmountPkr = Math.round(safePortfolio * (Math.max(0, a.weightPct || 0) / 100));
    const price = a.stock && a.stock.price > 0 ? a.stock.price : 100;
    // Account for 0.25% fee so total purchase does not exceed target amount
    let shares = Math.floor(targetAmountPkr / (price * 1.0025));
    let actualSpentPkr = shares * price;
    let feePkr = Math.round(actualSpentPkr * 0.0025 * 100) / 100; // 0.25% brokerage + CDC fee

    while (actualSpentPkr + feePkr > targetAmountPkr && shares > 0) {
      shares -= 1;
      actualSpentPkr = shares * price;
      feePkr = Math.round(actualSpentPkr * 0.0025 * 100) / 100;
    }

    const remainderPkr = Math.max(0, Math.round((targetAmountPkr - actualSpentPkr - feePkr) * 100) / 100);

    totalSpent += actualSpentPkr;
    totalFees += feePkr;
    totalRemainder += remainderPkr;
    totalShares += shares;

    return {
      ticker: a.stock.ticker,
      name: a.stock.name,
      price,
      weightPct: a.weightPct,
      targetAmountPkr,
      shares,
      actualSpentPkr,
      feePkr,
      remainderPkr,
      effectiveYieldPct: a.stock.dividendYieldPct || 8.0,
    };
  });

  return {
    items,
    totalTargetPkr: safePortfolio,
    totalSpentPkr: totalSpent,
    totalFeesPkr: totalFees,
    totalRemainderPkr: totalRemainder,
    totalShares,
  };
}

/**
 * Default multi-asset bucket distribution if not provided in user profile.
 */
function getDefaultAssetBuckets(): AssetBucket[] {
  return [
    {
      id: 'psx-dividends',
      label: 'PSX Dividend Equities',
      currentValuePkr: 0,
      monthlySplitPct: 40,
      expectedAnnualReturnPct: 14,
    },
    {
      id: 'gold',
      label: '24K Physical Gold',
      currentValuePkr: 0,
      monthlySplitPct: 20,
      expectedAnnualReturnPct: 12,
    },
    {
      id: 'real-estate',
      label: 'Real Estate / Land',
      currentValuePkr: 0,
      monthlySplitPct: 20,
      expectedAnnualReturnPct: 13,
    },
    {
      id: 'money-market',
      label: 'Shariah / Money Market Funds',
      currentValuePkr: 0,
      monthlySplitPct: 15,
      expectedAnnualReturnPct: 11,
    },
    {
      id: 'cash',
      label: 'Cash Reserve / Bank Balance',
      currentValuePkr: 0,
      monthlySplitPct: 5,
      expectedAnnualReturnPct: 8,
    },
  ];
}

/** Total declared liabilities (NOTES #23). Missing list = zero. */
export function totalLiabilitiesPkr(profile: UserProfile): number {
  return (profile.liabilities ?? []).reduce(
    (sum, l) => sum + (typeof l.amountPkr === 'number' && l.amountPkr > 0 ? l.amountPkr : 0),
    0
  );
}

/** Net liquid position: cash reserve minus declared liabilities. */
export function netLiquidReservePkr(profile: UserProfile): number {
  return profile.currentCashReservePkr - totalLiabilitiesPkr(profile);
}

/** Total itemised holdings value (NOTES #23). Missing list = zero. */
export function totalHoldingsPkr(profile: UserProfile): number {
  return (profile.holdings ?? []).reduce(
    (sum, h) => sum + (typeof h.valuePkr === 'number' && h.valuePkr > 0 ? h.valuePkr : 0),
    0
  );
}

/**
 * Master Life & Wealth Planner Engine.
 * Evaluates month-by-month multi-asset compounding, dated life goal withdrawals,
 * PSX dividend yield and income waterfall, emergency fund buffer, and car TCO decision.
 */
export function calculateLifePlan(profile: UserProfile): PlanSummary {
  // 1. Total monthly expenses
  const totalMonthlyExpenses =
    profile.expenses.fuelAndCommute +
    profile.expenses.utilitiesAndInternet +
    profile.expenses.groceriesAndFood +
    profile.expenses.rentOrHousing +
    profile.expenses.familyAndOther;

  // 2. Emergency fund target (4 months of total living expenses).
  // The gap is measured against the NET liquid position: cash reserve
  // minus declared liabilities (NOTES #23 — before liabilities existed,
  // a debt could only be smuggled in as a negative cash reserve, which
  // the local sanitize path clamps away).
  const emergencyFundTargetPkr = Math.round(totalMonthlyExpenses * 4);
  const emergencyFundGapPkr = Math.max(0, emergencyFundTargetPkr - netLiquidReservePkr(profile));

  // 3. PSX Stock portfolio selection & blended yield
  const stockAllocations = selectStockPortfolio(profile.shariahOnly);
  const totalStockWeight = stockAllocations.reduce((sum, a) => sum + a.weightPct, 0);
  const normalizedAllocations = stockAllocations.map((a) => ({
    ...a,
    weightPct: totalStockWeight > 0 ? (a.weightPct / totalStockWeight) * 100 : 0,
  }));

  const blendedGrossYieldPct = normalizedAllocations.reduce((acc, curr) => {
    return acc + (curr.weightPct / 100) * curr.stock.dividendYieldPct;
  }, 0);

  // 3b. Asset-bucket split (owner audit, 21 Nov 2026 — NOTES #21).
  // Dividends are earned ONLY on the PSX sleeve of the user's allocation;
  // the old engine silently invested 100% of the lump sum and every SIP
  // into the stock basket even when the user's buckets said 50%. Other
  // sleeves compound at their own declared expected returns. The PSX
  // sleeve is modelled in total-return terms: its market value appreciates
  // at (bucket expected return − cash yield), and its dividends are paid
  // at the CURRENT stamped yield — the yield rate itself is never grown
  // (the old engine escalated it 10%/yr, which manufactured the freedom
  // date; see NOTES #21).
  const buckets = normalizeAssetSplits(profile.assetBuckets || []);
  const psxBucket = buckets.find((b) => b.id === 'psx-dividends' || /psx/i.test(b.label));
  const psxShare = psxBucket ? psxBucket.monthlySplitPct / 100 : 1;
  const psxCapitalPkr = profile.lumpSumPkr * psxShare;
  const psxExpectedReturnPct = psxBucket?.expectedAnnualReturnPct ?? blendedGrossYieldPct;
  const appreciationPct = Math.max(0, psxExpectedReturnPct - blendedGrossYieldPct);

  // 4. Tax and Zakat rates
  const taxRate = profile.taxStatus === 'filer' ? 0.15 : 0.30;
  const taxRatePct = profile.taxStatus === 'filer' ? 15 : 30;
  const zakatRate = profile.includeZakat ? 0.025 : 0.0;
  const netRetentionRate = Math.max(0, 1 - taxRate - zakatRate);

  // Initial Monthly Dividends — on the PSX sleeve only (see 3b)
  const initialMonthlyGrossDividendPkr =
    (psxCapitalPkr * (blendedGrossYieldPct / 100)) / 12;
  const initialMonthlyNetDividendPkr =
    initialMonthlyGrossDividendPkr * netRetentionRate;

  // Non-filer tax penalty yearly (difference between 30% and 15% tax)
  const penaltyCapitalBase =
    psxCapitalPkr > 0
      ? psxCapitalPkr
      : profile.monthlyInvestPkr > 0
      ? profile.monthlyInvestPkr * psxShare * 12
      : 0;
  const nonFilerTaxPenaltyYearlyPkr =
    penaltyCapitalBase * (blendedGrossYieldPct / 100) * (0.30 - 0.15);

  // 5. Recommended Allocations list
  const recommendedAllocations = normalizedAllocations.map((alloc) => {
    const amountPkr = Math.round(psxCapitalPkr * (alloc.weightPct / 100));
    const annualNetDivPkr = Math.round(
      amountPkr * (alloc.stock.dividendYieldPct / 100) * netRetentionRate
    );
    return {
      stock: alloc.stock,
      weightPct: Number(alloc.weightPct.toFixed(1)),
      amountPkr,
      annualNetDivPkr,
    };
  });

  // 6. 12-Month Chunky Payout Calendar
  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const calendarMonths = monthNames.map((m) => ({ month: m, amountPkr: 0 }));
  const calendarBasePkr =
    psxCapitalPkr > 0
      ? psxCapitalPkr
      : profile.monthlyInvestPkr > 0
      ? profile.monthlyInvestPkr * psxShare * 12
      : 1_000_000;

  normalizedAllocations.forEach((alloc) => {
    const stockPortfolioPkr = calendarBasePkr * (alloc.weightPct / 100);
    const stockNetDivYear =
      stockPortfolioPkr * (alloc.stock.dividendYieldPct / 100) * netRetentionRate;
    const payoutsCount = alloc.stock.payoutMonths.length;
    if (payoutsCount > 0) {
      const perPayout = stockNetDivYear / payoutsCount;
      alloc.stock.payoutMonths.forEach((monthNum) => {
        if (monthNum >= 1 && monthNum <= 12) {
          calendarMonths[monthNum - 1].amountPkr += perPayout;
        }
      });
    }
  });

  const monthlyPayoutCalendar = calendarMonths.map((m) => ({
    month: m.month,
    amountPkr: Math.round(m.amountPkr),
  }));

  // 7. Expense Waterfall
  const waterfallCategories: { label: string; cost: number }[] = [
    { label: 'Fuel & Commute', cost: profile.expenses.fuelAndCommute },
    { label: 'Utilities & Internet', cost: profile.expenses.utilitiesAndInternet },
    { label: 'Groceries & Food', cost: profile.expenses.groceriesAndFood },
    { label: 'Rent / Housing', cost: profile.expenses.rentOrHousing },
    { label: 'Family & Other', cost: profile.expenses.familyAndOther },
  ];

  let remainingDividend = initialMonthlyNetDividendPkr;
  const expenseWaterfall: ExpenseCoverageStep[] = waterfallCategories.map((cat) => {
    const covered = Math.min(cat.cost, remainingDividend);
    remainingDividend -= covered;
    const coveragePct = cat.cost > 0 ? Math.min(100, (covered / cat.cost) * 100) : 100;
    const isFullyCovered = covered >= cat.cost;
    return {
      label: cat.label,
      monthlyCostPkr: Math.round(cat.cost),
      coveredPkr: Math.round(covered),
      coveragePct: Number(coveragePct.toFixed(1)),
      isFullyCovered,
    };
  });

  // 8. Timeline Simulation — runs to the user's retirement age (bounded
  // 10–45 years) so figures labelled "at retirement" are truly at retirement,
  // not silently truncated at year 15.
  const yearsToRetirement = (profile.retirementAge || 60) - (profile.age || 30);
  const simulationYears = Math.min(45, Math.max(10, yearsToRetirement || 15));
  const timeline: (WealthTimelinePoint & { portfolioValuePkr: number; annualNetDividendPkr: number })[] = [];
  const annualNewCapital = profile.monthlyInvestPkr * 12;

  // Sleeve state (see 3b): the PSX pot pays the dividends; every other
  // bucket is its own pot compounding at its declared expected return.
  let psxPot = psxCapitalPkr;
  let otherPots = (psxBucket ? buckets.filter((b) => b !== psxBucket) : []).map((b) => ({
    share: b.monthlySplitPct / 100,
    returnPct: b.expectedAnnualReturnPct || 0,
    value: profile.lumpSumPkr * (b.monthlySplitPct / 100),
  }));
  let currentPortfolio = profile.lumpSumPkr;

  // Track Goals
  const goals = profile.lifeGoals || [];
  const goalOutcomes: GoalOutcome[] = [];

  for (let year = 1; year <= simulationYears; year++) {
    const currentAge = profile.age + year;

    const raiseMultiplier = Math.pow(1 + (profile.annualSalaryRaisePct || 0) / 100, year - 1);
    const newCapitalThisYear = annualNewCapital * raiseMultiplier;

    // PSX sleeve: dividends at the FLAT current stamped yield on the
    // sleeve's market value; the value appreciates at (bucket expected
    // total return − yield). The yield rate is never escalated.
    // Contributions arrive monthly through the year, so they earn on
    // average half a year of dividends (the old engine credited a full
    // year on money that had not yet been invested).
    const annualGrossDiv =
      (psxPot + 0.5 * newCapitalThisYear * psxShare) * (blendedGrossYieldPct / 100);
    const annualNetDiv = annualGrossDiv * netRetentionRate;
    const monthlyNetDiv = annualNetDiv / 12;

    psxPot =
      psxPot * (1 + appreciationPct / 100) +
      (profile.reinvestDividends ? annualNetDiv : 0) +
      newCapitalThisYear * psxShare;
    otherPots = otherPots.map((p) => ({
      ...p,
      value: p.value * (1 + p.returnPct / 100) + newCapitalThisYear * p.share,
    }));
    currentPortfolio = psxPot + otherPots.reduce((acc, p) => acc + p.value, 0);

    const inflationFactor = Math.pow(1 + profile.annualInflationPct / 100, year - 1);
    const monthlyExpenses = totalMonthlyExpenses * inflationFactor;
    const realMonthlyDiv = monthlyNetDiv / inflationFactor;

    // Check goals for this year. A goal is only "funded" if the pot can
    // actually pay it — otherwise record the honest shortfall and withdraw
    // only what exists. Withdrawals come out of every sleeve pro-rata.
    let goalWithdrawnThisYear = 0;
    for (const g of goals) {
      if (g.targetAge === currentAge) {
        const inflatedCost = g.costInTodaysPkr * Math.pow(1 + profile.annualInflationPct / 100, year);
        const yearsToRetire = Math.max(0, (profile.retirementAge || 60) - g.targetAge);
        const oppRate = (profile.opportunityCostReturnPct ?? 10) / 100;
        const opportunityCost = inflatedCost * Math.pow(1 + oppRate, yearsToRetire);
        const fundedAmountPkr = Math.min(Math.max(0, currentPortfolio), inflatedCost);
        const shortfallPkr = Math.max(0, inflatedCost - fundedAmountPkr);
        if (fundedAmountPkr > 0 && currentPortfolio > 0) {
          const psxFrac = psxPot / currentPortfolio;
          psxPot -= fundedAmountPkr * psxFrac;
          otherPots = otherPots.map((p) => ({
            ...p,
            value: p.value - fundedAmountPkr * (p.value / currentPortfolio),
          }));
          currentPortfolio -= fundedAmountPkr;
        }
        goalWithdrawnThisYear += fundedAmountPkr;
        goalOutcomes.push({
          goalId: g.id,
          name: g.name,
          targetAge: g.targetAge,
          inflatedCostPkr: Math.round(inflatedCost),
          trueOpportunityCostAtRetirementPkr: Math.round(opportunityCost),
          funded: shortfallPkr <= 0,
          shortfallPkr: Math.round(shortfallPkr),
        });
      }
    }

    currentPortfolio = Math.max(0, currentPortfolio);
    psxPot = Math.max(0, psxPot);

    const yearInflation = Math.pow(1 + profile.annualInflationPct / 100, year);
    const realTodaysPkr = currentPortfolio / yearInflation;

    timeline.push({
      age: currentAge,
      year,
      nominalPortfolioPkr: Math.round(currentPortfolio),
      portfolioValuePkr: Math.round(currentPortfolio),
      realTodaysPkr: Math.round(realTodaysPkr),
      monthlyNetDividendPkr: Math.round(monthlyNetDiv),
      annualNetDividendPkr: Math.round(annualNetDiv),
      realMonthlyDividendPkr: Math.round(realMonthlyDiv),
      monthlyExpensesPkr: Math.round(monthlyExpenses),
      goalWithdrawnPkr: Math.round(goalWithdrawnThisYear),
    });
  }

  // 9. Freedom Date & Years/Age Calculation
  let freedomDateLabel = `Beyond ${simulationYears} Years`;
  let freedomYears: number | null = null;
  let freedomAge: number | null = null;

  if (profile.lumpSumPkr > 0 && initialMonthlyNetDividendPkr >= totalMonthlyExpenses) {
    freedomDateLabel = 'Freedom Achieved Today!';
    freedomYears = 0;
    freedomAge = profile.age;
  } else {
    for (let i = 0; i < timeline.length; i++) {
      const item = timeline[i];
      const div = profile.inflationAdjusted
        ? item.realMonthlyDividendPkr
        : item.monthlyNetDividendPkr;
      const exp = profile.inflationAdjusted
        ? totalMonthlyExpenses
        : item.monthlyExpensesPkr;

      if (div >= exp) {
        if (i === 0) {
          freedomDateLabel = 'Year 1';
          freedomYears = 1;
          freedomAge = profile.age + 1;
        } else {
          const prev = timeline[i - 1];
          const prevDiv = profile.inflationAdjusted
            ? prev.realMonthlyDividendPkr
            : prev.monthlyNetDividendPkr;
          const prevExp = profile.inflationAdjusted
            ? totalMonthlyExpenses
            : prev.monthlyExpensesPkr;

          const gapPrev = prevExp - prevDiv;
          const gapCurr = exp - div;
          const frac = gapPrev > 0 && gapPrev - gapCurr > 0 ? gapPrev / (gapPrev - gapCurr) : 0;
          const totalY = i + frac;

          freedomYears = Number(totalY.toFixed(1));
          freedomAge = Math.round(profile.age + totalY);

          const additionalMonths = Math.round(totalY * 12);
          const nowDate = new Date();
          const startYear = nowDate.getFullYear();
          const startMonth = nowDate.getMonth();
          const totalMonths = startYear * 12 + startMonth + additionalMonths;
          const targetYear = Math.floor(totalMonths / 12);
          const targetMonthIdx = totalMonths % 12;
          const fullMonthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
          ];
          freedomDateLabel = `${fullMonthNames[targetMonthIdx]} ${targetYear}`;
        }
        break;
      }
    }
  }

  // Final wealth and retirement KPIs
  const lastPoint = timeline[timeline.length - 1];
  const finalNominalWealthPkr = lastPoint ? lastPoint.nominalPortfolioPkr : Math.round(profile.lumpSumPkr);
  const finalRealTodaysPkr = lastPoint ? lastPoint.realTodaysPkr : Math.round(profile.lumpSumPkr);
  const finalWealthUsd = Math.round(finalRealTodaysPkr / (profile.usdToPkr || 276.5));
  const finalWealthGoldTolas = Number(
    (finalRealTodaysPkr / (profile.goldPerTolaPkr || 379836)).toFixed(1)
  );
  const safeMonthlyIncome4PctTodaysPkr = Math.round((finalRealTodaysPkr * 0.04) / 12);

  // 10. Vehicle Swaps (Backward-compatible support for tests)
  const surplusSolarKwh = Math.max(0, profile.solarKw * 4.2 - 12);
  const currentVehicleType = (profile as any).currentVehicleType || 'petrol-car';
  const currentVehicleResalePkr = (profile as any).currentVehicleResalePkr || 0;
  const baselineCostPerKm =
    currentVehicleType === 'petrol-bike'
      ? 8
      : currentVehicleType === 'petrol-car'
      ? 22
      : 0;
  const monthlyBaselineFuel = profile.dailyCommuteKm * 30 * baselineCostPerKm;

  const SWAP_CANDIDATES = [
    { name: 'Yadea M3 E-Scooty', category: 'e-scooty' as const, pricePkr: 174000, gridCost: 1.5, kwhPerKm: 0.035 },
    { name: 'Crown Firefly E-Scooty', category: 'e-scooty' as const, pricePkr: 235000, gridCost: 1.5, kwhPerKm: 0.035 },
    { name: 'Alektra MINI X2', category: 'micro-ev' as const, pricePkr: 1095000, gridCost: 4.5, kwhPerKm: 0.10 },
    { name: 'Honri Ve 2.0 EV', category: 'city-ev' as const, pricePkr: 3599000, gridCost: 11.0, kwhPerKm: 0.14 },
    { name: 'Honri Ve 3.0 EV', category: 'city-ev' as const, pricePkr: 4399000, gridCost: 11.0, kwhPerKm: 0.14 },
  ];

  const vehicleSwaps: VehicleSwapOption[] = SWAP_CANDIDATES.map((opt) => {
    const dailyKwh = opt.kwhPerKm * profile.dailyCommuteKm;
    const solarChargingFree = surplusSolarKwh >= dailyKwh && profile.solarKw > 0;
    const runningCostPerKmPkr = solarChargingFree ? 0 : opt.gridCost;
    const monthlyRunningCost = profile.dailyCommuteKm * 30 * runningCostPerKmPkr;
    const monthlyFuelSavingsPkr = Math.max(0, monthlyBaselineFuel - monthlyRunningCost);
    const netCashRequiredOrFreedPkr = opt.pricePkr - currentVehicleResalePkr;

    let paybackMonths = 0;
    if (netCashRequiredOrFreedPkr > 0 && monthlyFuelSavingsPkr > 0) {
      paybackMonths = Math.round(netCashRequiredOrFreedPkr / monthlyFuelSavingsPkr);
    }

    const freedCash = Math.max(0, -netCashRequiredOrFreedPkr);
    const extraDivFromFreedCash =
      (freedCash * (blendedGrossYieldPct / 100) * netRetentionRate) / 12;
    const extraMonthlyDividendFromSwapPkr = Math.round(
      extraDivFromFreedCash + monthlyFuelSavingsPkr
    );

    return {
      name: opt.name,
      category: opt.category,
      pricePkr: opt.pricePkr,
      runningCostPerKmPkr,
      netCashRequiredOrFreedPkr,
      monthlyFuelSavingsPkr: Math.round(monthlyFuelSavingsPkr),
      paybackMonths,
      solarChargingFree,
      extraMonthlyDividendFromSwapPkr,
      monthsShavedOffFreedom: 0,
    };
  });

  // 11. Full Car Decision Map TCO Evaluation
  const carDecision: CarDecisionSummary = evaluateCarDecision(profile);

  const result: any = {
    emergencyFundTargetPkr,
    emergencyFundGapPkr,
    blendedGrossYieldPct: Number(blendedGrossYieldPct.toFixed(2)),
    taxRatePct,
    initialMonthlyGrossDividendPkr: Math.round(initialMonthlyGrossDividendPkr),
    initialMonthlyNetDividendPkr: Math.round(initialMonthlyNetDividendPkr),
    nonFilerTaxPenaltyYearlyPkr: Math.round(nonFilerTaxPenaltyYearlyPkr),
    freedomDateLabel,
    freedomAge,
    freedomYears,
    finalNominalWealthPkr,
    finalRealTodaysPkr,
    finalWealthUsd,
    finalWealthGoldTolas,
    safeMonthlyIncome4PctTodaysPkr,
    goalOutcomes,
    monthlyPayoutCalendar,
    expenseWaterfall,
    timeline,
    recommendedAllocations,
    carDecision,
    vehicleSwaps,
  };

  return result as PlanSummary;
}

/**
 * Bridges a winning car decision into the user's wealth plan:
 * 1. Adds freed equity (from selling higher-priced vehicle) to lumpSumPkr
 * 2. Adds monthly fuel/total savings to monthlyInvestPkr
 * 3. Calculates months shaved off freedom date
 */
export function applyCarSavingsToPlan(
  profile: UserProfile,
  winningVehicle: VehicleTcoResult,
  baselineVehicle?: VehicleTcoResult
): UserProfile & { monthsShavedOffFreedom: number; freedEquityPkr: number; monthlyCarSavingsPkr: number } {
  const vehicles = profile.vehicles || [];

  const baselineCandidate =
    baselineVehicle ||
    (vehicles.find((v) => v.isCurrentVehicle)
      ? {
          vehicleId: vehicles.find((v) => v.isCurrentVehicle)!.id,
          name: vehicles.find((v) => v.isCurrentVehicle)!.name,
          realCostPerMonthPkr: 0,
          fiveYearFuelOrChargePkr: 0,
        }
      : vehicles[0]);

  const winningVehicleSpec = vehicles.find((v) => v.id === winningVehicle.vehicleId);
  const baselineVehicleSpec = baselineCandidate
    ? vehicles.find((v) => v.id === (baselineCandidate as any).vehicleId)
    : null;

  let monthlySavings = 0;
  if (baselineVehicle && baselineVehicle.realCostPerMonthPkr > 0) {
    monthlySavings = Math.max(0, baselineVehicle.realCostPerMonthPkr - winningVehicle.realCostPerMonthPkr);
  } else if (baselineVehicle && baselineVehicle.fiveYearFuelOrChargePkr > 0) {
    monthlySavings = Math.max(
      0,
      Math.round((baselineVehicle.fiveYearFuelOrChargePkr - winningVehicle.fiveYearFuelOrChargePkr) / 60)
    );
  }

  const baselinePrice = baselineVehicleSpec ? baselineVehicleSpec.pricePkr : 0;
  const winningPrice = winningVehicleSpec ? winningVehicleSpec.pricePkr : 0;
  const freedEquity = Math.max(0, baselinePrice - winningPrice);

  const updatedProfile: UserProfile = {
    ...profile,
    lumpSumPkr: profile.lumpSumPkr + freedEquity,
    monthlyInvestPkr: profile.monthlyInvestPkr + monthlySavings,
  };

  const planBefore = calculateLifePlan(profile);
  const planAfter = calculateLifePlan(updatedProfile);

  const yearsBefore =
    (planBefore as any).freedomYears !== undefined && (planBefore as any).freedomYears !== null
      ? (planBefore as any).freedomYears
      : planBefore.freedomAge !== null
      ? planBefore.freedomAge - profile.age
      : 15;
  const yearsAfter =
    (planAfter as any).freedomYears !== undefined && (planAfter as any).freedomYears !== null
      ? (planAfter as any).freedomYears
      : planAfter.freedomAge !== null
      ? planAfter.freedomAge - profile.age
      : 15;
  const monthsShavedOff = Math.max(0, Math.round((yearsBefore - yearsAfter) * 12));

  return {
    ...updatedProfile,
    monthsShavedOffFreedom: monthsShavedOff,
    freedEquityPkr: freedEquity,
    monthlyCarSavingsPkr: monthlySavings,
  };
}
