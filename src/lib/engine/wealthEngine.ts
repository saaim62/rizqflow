import {
  AssetBucket,
  CarDecisionSummary,
  ExpenseCoverageStep,
  GoalOutcome,
  PlanSummary,
  PsxStock,
  UserProfile,
  VehicleCandidate,
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
  const gradeA = PSX_STOCKS.filter((s) => s.grade === 'A');

  if (shariahOnly) {
    // 8 Shariah Grade-A stocks balanced across Fertilizer, Power, Islamic Bank, O&G, Auto
    // Calibrated to produce ~8.2% - 8.3% blended yield
    const shariahCandidates: { ticker: string; weight: number }[] = [
      { ticker: 'FFC', weight: 12 }, // 9.2%
      { ticker: 'HUBC', weight: 12 }, // 9.5%
      { ticker: 'MEBL', weight: 18 }, // 7.6%
      { ticker: 'EFERT', weight: 14 }, // 8.5%
      { ticker: 'POL', weight: 10 }, // 10.8%
      { ticker: 'OGDC', weight: 16 }, // 7.2%
      { ticker: 'PPL', weight: 10 }, // 6.8%
      { ticker: 'MTL', weight: 8 }, // 7.9%
    ];

    const allocations: StockAllocation[] = [];
    for (const item of shariahCandidates) {
      const stock = gradeA.find((s) => s.ticker === item.ticker && s.isShariah);
      if (stock) {
        allocations.push({ stock, weightPct: item.weight });
      }
    }
    return allocations;
  }

  // Conventional + Shariah Blend (8 core Grade-A stocks)
  // Calibrated to produce ~8.24% blended yield
  const conventionalCandidates: { ticker: string; weight: number }[] = [
    { ticker: 'MCB', weight: 14 }, // 8.8%
    { ticker: 'UBL', weight: 14 }, // 8.4%
    { ticker: 'HBL', weight: 12 }, // 8.0%
    { ticker: 'MEBL', weight: 14 }, // 7.6%
    { ticker: 'FFC', weight: 12 }, // 9.2%
    { ticker: 'HUBC', weight: 10 }, // 9.5%
    { ticker: 'OGDC', weight: 14 }, // 7.2%
    { ticker: 'INDU', weight: 10 }, // 7.5%
  ];

  const allocations: StockAllocation[] = [];
  for (const item of conventionalCandidates) {
    const stock = gradeA.find((s) => s.ticker === item.ticker);
    if (stock) {
      allocations.push({ stock, weightPct: item.weight });
    }
  }
  return allocations;
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

  // 2. Emergency fund target (4 months of total living expenses)
  const emergencyFundTargetPkr = Math.round(totalMonthlyExpenses * 4);
  const emergencyFundGapPkr = Math.max(0, emergencyFundTargetPkr - profile.currentCashReservePkr);

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

  // 4. Tax and Zakat rates
  const taxRate = profile.taxStatus === 'filer' ? 0.15 : 0.30;
  const taxRatePct = profile.taxStatus === 'filer' ? 15 : 30;
  const zakatRate = profile.includeZakat ? 0.025 : 0.0;
  const netRetentionRate = Math.max(0, 1 - taxRate - zakatRate);

  // Initial Monthly Dividends
  const initialMonthlyGrossDividendPkr =
    (profile.lumpSumPkr * (blendedGrossYieldPct / 100)) / 12;
  const initialMonthlyNetDividendPkr =
    initialMonthlyGrossDividendPkr * netRetentionRate;

  // Non-filer tax penalty yearly (difference between 30% and 15% tax)
  const penaltyCapitalBase =
    profile.lumpSumPkr > 0
      ? profile.lumpSumPkr
      : profile.monthlyInvestPkr > 0
      ? profile.monthlyInvestPkr * 12
      : 0;
  const nonFilerTaxPenaltyYearlyPkr =
    penaltyCapitalBase * (blendedGrossYieldPct / 100) * (0.30 - 0.15);

  // 5. Recommended Allocations list
  const recommendedAllocations = normalizedAllocations.map((alloc) => {
    const amountPkr = Math.round(profile.lumpSumPkr * (alloc.weightPct / 100));
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
    profile.lumpSumPkr > 0
      ? profile.lumpSumPkr
      : profile.monthlyInvestPkr > 0
      ? profile.monthlyInvestPkr * 12
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
  let currentPortfolio = profile.lumpSumPkr;
  const annualNewCapital = profile.monthlyInvestPkr * 12;

  // Track Goals
  const goals = profile.lifeGoals || [];
  const goalOutcomes: GoalOutcome[] = [];

  for (let year = 1; year <= simulationYears; year++) {
    const currentAge = profile.age + year;
    const capitalBase = year === 1 && currentPortfolio === 0 ? annualNewCapital : currentPortfolio;

    const raiseMultiplier = Math.pow(1 + (profile.annualSalaryRaisePct || 0) / 100, year - 1);
    const newCapitalThisYear = annualNewCapital * raiseMultiplier;

    const yieldMultiplier = Math.pow(1 + profile.dividendGrowthPct / 100, year - 1);
    const yieldForYear = blendedGrossYieldPct * yieldMultiplier;

    const annualGrossDiv = capitalBase * (yieldForYear / 100);
    const annualNetDiv = annualGrossDiv * netRetentionRate;
    const monthlyNetDiv = annualNetDiv / 12;

    const inflationFactor = Math.pow(1 + profile.annualInflationPct / 100, year - 1);
    const monthlyExpenses = totalMonthlyExpenses * inflationFactor;
    const realMonthlyDiv = monthlyNetDiv / inflationFactor;

    // Check goals for this year. A goal is only "funded" if the pot can
    // actually pay it — otherwise record the honest shortfall and withdraw
    // only what exists (the old engine marked every goal FUNDED).
    let goalWithdrawnThisYear = 0;
    let availableForGoalsPkr =
      capitalBase + newCapitalThisYear + (profile.reinvestDividends ? annualNetDiv : 0);
    for (const g of goals) {
      if (g.targetAge === currentAge) {
        const inflatedCost = g.costInTodaysPkr * Math.pow(1 + profile.annualInflationPct / 100, year);
        const yearsToRetire = Math.max(0, (profile.retirementAge || 60) - g.targetAge);
        const oppRate = (profile.opportunityCostReturnPct ?? 10) / 100;
        const opportunityCost = inflatedCost * Math.pow(1 + oppRate, yearsToRetire);
        const fundedAmountPkr = Math.min(Math.max(0, availableForGoalsPkr), inflatedCost);
        const shortfallPkr = Math.max(0, inflatedCost - fundedAmountPkr);
        availableForGoalsPkr -= fundedAmountPkr;
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

    if (profile.reinvestDividends) {
      currentPortfolio =
        capitalBase +
        annualNetDiv +
        (year === 1 && profile.lumpSumPkr === 0 ? 0 : newCapitalThisYear) -
        goalWithdrawnThisYear;
    } else {
      currentPortfolio =
        capitalBase +
        (year === 1 && profile.lumpSumPkr === 0 ? 0 : newCapitalThisYear) -
        goalWithdrawnThisYear;
    }

    currentPortfolio = Math.max(0, currentPortfolio);

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
          const startYear = 2026;
          const startMonth = 10;
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
