import { describe, expect, it } from 'vitest';
import { formatCompactPkr, formatPct, formatPkr, formatTolas, formatUsd, maskAmount } from '@/lib/format';
import { computeStreakStats, simulateDipStrategy } from '@/lib/engine/streakEngine';
import { calculateLifePlan } from '@/lib/engine/plannerEngine';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { applyCarSavingsToPlan, calculateExecutionSheet, normalizeAssetSplits } from '@/lib/engine/wealthEngine';
import { applyRatesToProfile, getDefaultMarketRates, loadCustomMarketRates, resetMarketRates, saveCustomMarketRates } from '@/lib/marketRates';
import { decodeProfileFromHash, encodeProfileToHash, sanitizeProfile } from '@/lib/stateUrl';
import { PSX_STOCKS } from '@/data/marketData';
import { AssetBucket, LifeGoal, PricePoint, UserProfile, VehicleCandidate } from '@/types';

/**
 * Standard baseline user profile used as a clean fixture for cloning
 */
const createBaseProfile = (overrides?: Partial<UserProfile>): UserProfile => ({
  role: 'salaried',
  gender: 'male',
  age: 28,
  retirementAge: 60,
  maritalStatus: 'unmarried',
  familyMembers: 1,
  isBreadwinner: true,
  monthlyIncomePkr: 200000,
  annualSalaryRaisePct: 10,
  lumpSumPkr: 3000000,
  monthlyInvestPkr: 50000,
  currentCashReservePkr: 400000,
  expenses: {
    fuelAndCommute: 15000,
    utilitiesAndInternet: 20000,
    groceriesAndFood: 25000,
    rentOrHousing: 20000,
    familyAndOther: 10000,
  },
  taxStatus: 'filer',
  shariahOnly: true,
  includeZakat: false,
  reinvestDividends: true,
  inflationAdjusted: true,
  annualInflationPct: 8,
  dividendGrowthPct: 7,
  solarKw: 0,
  dailyCommuteKm: 40,
  currentVehicleType: 'petrol-car',
  currentVehicleResalePkr: 2000000,
  solarTariffMode: 'net-metering-legacy',
  gridRatePerKwh: 55,
  petrolPricePerLitre: 322,
  opportunityCostReturnPct: 10,
  usdToPkr: 276.5,
  goldPerTolaPkr: 379836,
  lifeGoals: [],
  vehicles: [
    {
      id: 'alvin-petrol',
      name: 'Changan Alsvin 1.5',
      fuelType: 'petrol',
      pricePkr: 4149000,
      kmPerLitre: 14,
      fiveYearDepreciationPct: 35,
      annualMaintenancePkr: 60000,
    },
    {
      id: 'honri-ve-2',
      name: 'Honri Ve 2.0 EV',
      fuelType: 'ev',
      pricePkr: 3599000,
      kwhPer100Km: 14,
      fiveYearDepreciationPct: 30,
      annualMaintenancePkr: 25000,
    },
  ],
  ...overrides,
});

describe('QA Edge Cases: Boundary & Extreme Financial Inputs', () => {
  it('handles 0 lump sum and 0 monthly investment without NaN, division by zero, or crashes', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 0,
      monthlyInvestPkr: 0,
    });

    const plan = calculateLifePlan(profile);

    // Initial dividend must be 0
    expect(plan.initialMonthlyGrossDividendPkr).toBe(0);
    expect(plan.initialMonthlyNetDividendPkr).toBe(0);
    expect(plan.nonFilerTaxPenaltyYearlyPkr).toBe(0);

    // Freedom cannot be achieved within the horizon with 0 capital.
    // Horizon = retirementAge - age = 60 - 28 = 32 years (engine simulates
    // to retirement age since the Forgewarden fix round, not a fixed 15).
    expect(plan.freedomYears).toBeNull();
    expect(plan.freedomDateLabel).toBe('Beyond 32 Years');

    // All 32 timeline years must have 0 portfolio value and 0 dividends
    expect(plan.timeline.length).toBe(32);
    plan.timeline.forEach((year) => {
      expect(year.portfolioValuePkr).toBe(0);
      expect(year.annualNetDividendPkr).toBe(0);
      expect(year.monthlyNetDividendPkr).toBe(0);
      expect(year.realMonthlyDividendPkr).toBe(0);
      expect(Number.isFinite(year.portfolioValuePkr)).toBe(true);
    });

    // Waterfall must have 0% coverage across all categories
    plan.expenseWaterfall.forEach((cat) => {
      expect(cat.coveredPkr).toBe(0);
      expect(cat.coveragePct).toBe(0);
      expect(cat.isFullyCovered).toBe(false);
    });

    // Recommended allocations should show 0 PKR allocation
    plan.recommendedAllocations.forEach((alloc) => {
      expect(alloc.amountPkr).toBe(0);
      expect(alloc.annualNetDivPkr).toBe(0);
    });
  });

  it('handles zero monthly income cleanly (emergency fund depends solely on expenses)', () => {
    const profile = createBaseProfile({
      monthlyIncomePkr: 0,
    });

    const plan = calculateLifePlan(profile);

    // Total monthly expenses: 15 + 20 + 25 + 20 + 10 = 90k
    // 4 months emergency target = 360,000
    expect(plan.emergencyFundTargetPkr).toBe(360000);
    // Reserve is 400,000 -> Gap is 0
    expect(plan.emergencyFundGapPkr).toBe(0);
  });

  it('handles 0 lump sum with positive monthly investment (pure SIP accumulation)', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 0,
      monthlyInvestPkr: 100000, // Rs 1 Lac / month
    });

    const plan = calculateLifePlan(profile);

    // Initial month 0 dividend from lump sum is 0
    expect(plan.initialMonthlyGrossDividendPkr).toBe(0);
    expect(plan.initialMonthlyNetDividendPkr).toBe(0);

    // Year 1 utilizes annual capital base of Rs 1,200,000
    const year1 = plan.timeline[0];
    expect(year1.annualNetDividendPkr).toBeGreaterThan(70000); // ~8.2% * 85% net of 1.2M
    expect(year1.portfolioValuePkr).toBeGreaterThan(1200000);

    // Compounding growth over 15 years
    const year15 = plan.timeline[14];
    expect(year15.portfolioValuePkr).toBeGreaterThan(year1.portfolioValuePkr * 10);
  });

  it('handles High-Net-Worth boundary: Rs 10 Crore (Rs 100,000,000)', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 100000000, // Rs 10 Crore
      monthlyInvestPkr: 0,
      currentCashReservePkr: 10000000, // Rs 1 Crore reserve
    });

    const plan = calculateLifePlan(profile);

    // Gross monthly dividend on Rs 10 Cr @ ~7.6% blended yield (Shariah
    // basket at 20 Nov 2026 prices) is ~Rs 635k/mo
    expect(plan.initialMonthlyGrossDividendPkr).toBeGreaterThan(600000);
    expect(plan.initialMonthlyGrossDividendPkr).toBeLessThan(700000);

    // Net monthly dividend (filer 15%) is ~Rs 539k/mo
    expect(plan.initialMonthlyNetDividendPkr).toBeGreaterThan(500000);
    expect(plan.initialMonthlyNetDividendPkr).toBeLessThan(600000);

    // Immediate freedom achieved today (since net dividend >> total expenses of Rs 90k)
    expect(plan.freedomYears).toBe(0);
    expect(plan.freedomDateLabel).toBe('Freedom Achieved Today!');

    // All waterfall categories 100% covered
    plan.expenseWaterfall.forEach((cat) => {
      expect(cat.coveragePct).toBe(100);
      expect(cat.isFullyCovered).toBe(true);
      expect(cat.coveredPkr).toBe(cat.monthlyCostPkr);
    });

    // Compact format check
    expect(formatCompactPkr(profile.lumpSumPkr)).toBe('Rs 10.0 Cr');
  });
});

describe('QA Edge Cases: Commute Boundaries', () => {
  it('handles 0 km/day commute (work from home / no daily travel)', () => {
    const profile = createBaseProfile({
      dailyCommuteKm: 0,
      currentVehicleType: 'petrol-car',
      currentVehicleResalePkr: 2000000,
    });

    const plan = calculateLifePlan(profile);

    // All EV candidate options should produce 0 monthly fuel savings
    plan.vehicleSwaps.forEach((swap) => {
      expect(swap.monthlyFuelSavingsPkr).toBe(0);
      // Unit rate reflects grid cost when solarKw is 0
      expect(swap.runningCostPerKmPkr).toBeGreaterThan(0);
      // Payback months must safely be 0 without NaN or Infinity
      expect(swap.paybackMonths).toBe(0);
    });
  });

  it('handles 250 km/day commute (extreme heavy super-commuter)', () => {
    const profile = createBaseProfile({
      dailyCommuteKm: 250,
      currentVehicleType: 'petrol-car', // Rs 22/km
      currentVehicleResalePkr: 1000000,
      solarKw: 0, // grid only
    });

    const plan = calculateLifePlan(profile);

    // Baseline petrol car cost: 250 km * 30 days * Rs 22/km = Rs 165,000/mo
    // For Honri Ve 2.0 (grid cost Rs 11.0/km): 250 * 30 * 11 = Rs 82,500/mo
    // Monthly fuel savings = 165,000 - 82,500 = Rs 82,500/mo
    const honri = plan.vehicleSwaps.find((v) => v.name === 'Honri Ve 2.0 EV');
    expect(honri).toBeDefined();
    if (!honri) return;

    expect(honri.monthlyFuelSavingsPkr).toBe(82500);
    // Net cash required = 3,599,000 - 1,000,000 = 2,599,000
    expect(honri.netCashRequiredOrFreedPkr).toBe(2599000);
    // Payback months = Math.round(2,599,000 / 82,500) = 32 months
    expect(honri.paybackMonths).toBe(32);
  });

  it('handles current vehicle type "none" (first-time buyer, 0 resale)', () => {
    const profile = createBaseProfile({
      currentVehicleType: 'none',
      currentVehicleResalePkr: 0,
      dailyCommuteKm: 30,
    });

    const plan = calculateLifePlan(profile);

    plan.vehicleSwaps.forEach((swap) => {
      // Net cash required equals full vehicle purchase price
      expect(swap.netCashRequiredOrFreedPkr).toBe(swap.pricePkr);
      // No baseline fuel consumed previously, so monthly savings is 0
      expect(swap.monthlyFuelSavingsPkr).toBe(0);
      // Payback months should be 0 (no division by zero or NaN)
      expect(swap.paybackMonths).toBe(0);
    });
  });
});

describe('QA Edge Cases: Solar Boundaries & Free-Charging Thresholds', () => {
  it('handles 0 kW solar (grid-only): charging is never free', () => {
    const profile = createBaseProfile({
      solarKw: 0,
      dailyCommuteKm: 40,
    });

    const plan = calculateLifePlan(profile);

    plan.vehicleSwaps.forEach((swap) => {
      expect(swap.solarChargingFree).toBe(false);
      expect(swap.runningCostPerKmPkr).toBeGreaterThan(0);
    });

    const honri = plan.vehicleSwaps.find((v) => v.name === 'Honri Ve 2.0 EV');
    expect(honri?.runningCostPerKmPkr).toBe(11.0); // grid rate for city EV

    const yadea = plan.vehicleSwaps.find((v) => v.name === 'Yadea M3 E-Scooty');
    expect(yadea?.runningCostPerKmPkr).toBe(1.5); // grid rate for e-scooty
  });

  it('handles 20 kW solar (heavy surplus): 100% free charging even for high mileage', () => {
    const profile = createBaseProfile({
      solarKw: 20,
      dailyCommuteKm: 150, // 150 km * 0.14 = 21 kWh daily need
    });

    const plan = calculateLifePlan(profile);

    // Surplus = 20 * 4.2 - 12 = 72 kWh/day > 21 kWh/day
    plan.vehicleSwaps.forEach((swap) => {
      expect(swap.solarChargingFree).toBe(true);
      expect(swap.runningCostPerKmPkr).toBe(0);
    });
  });

  it('verifies exact threshold where solar charging transitions from grid to free', () => {
    // Honri Ve 2.0: 0.14 kWh/km
    // At 50 km/day: daily kWh needed = 50 * 0.14 = 7.0 kWh
    // Surplus equation: surplusSolarKwh = Math.max(0, solarKw * 4.2 - 12)
    // 4.5 kW solar: surplus = 4.5 * 4.2 - 12 = 18.9 - 12 = 6.9 kWh (< 7.0 kWh) -> NOT FREE
    // 4.6 kW solar: surplus = 4.6 * 4.2 - 12 = 19.32 - 12 = 7.32 kWh (>= 7.0 kWh) -> FREE!

    const profileBelow = createBaseProfile({
      solarKw: 4.5,
      dailyCommuteKm: 50,
    });
    const planBelow = calculateLifePlan(profileBelow);
    const honriBelow = planBelow.vehicleSwaps.find((v) => v.name === 'Honri Ve 2.0 EV');
    expect(honriBelow?.solarChargingFree).toBe(false);
    expect(honriBelow?.runningCostPerKmPkr).toBe(11.0);

    const profileAbove = createBaseProfile({
      solarKw: 4.6,
      dailyCommuteKm: 50,
    });
    const planAbove = calculateLifePlan(profileAbove);
    const honriAbove = planAbove.vehicleSwaps.find((v) => v.name === 'Honri Ve 2.0 EV');
    expect(honriAbove?.solarChargingFree).toBe(true);
    expect(honriAbove?.runningCostPerKmPkr).toBe(0);
  });
});

describe('QA Edge Cases: Streak Calculation Engine Boundaries', () => {
  it('handles empty (0-point) price history', () => {
    const stats = computeStreakStats([], true);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestUpStreak).toBe(0);
    expect(stats.longestDownStreak).toBe(0);
    expect(stats.changeToday).toBe(0);
    expect(stats.changeTodayPct).toBe(0);
    expect(stats.drawdownFromPeakPct).toBe(0);
    expect(stats.isSipDipZone).toBe(false);
  });

  it('handles 1-point price history', () => {
    const history: PricePoint[] = [{ date: '2026-11-20', price: 250 }];
    const stats = computeStreakStats(history, true);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestUpStreak).toBe(0);
    expect(stats.longestDownStreak).toBe(0);
    expect(stats.changeToday).toBe(0);
    expect(stats.changeTodayPct).toBe(0);
    expect(stats.drawdownFromPeakPct).toBe(0);
    expect(stats.isSipDipZone).toBe(false);
  });

  it('handles identical consecutive prices (flat price action, streak = 0)', () => {
    const history: PricePoint[] = [
      { date: '2026-11-17', price: 100 },
      { date: '2026-11-18', price: 100 },
      { date: '2026-11-19', price: 100 },
      { date: '2026-11-20', price: 100 },
    ];
    const stats = computeStreakStats(history, true);
    expect(stats.currentStreak).toBe(0);
    expect(stats.longestUpStreak).toBe(0);
    expect(stats.longestDownStreak).toBe(0);
    expect(stats.changeToday).toBe(0);
    expect(stats.changeTodayPct).toBe(0);
    expect(stats.drawdownFromPeakPct).toBe(0);
    expect(stats.isSipDipZone).toBe(false);
  });

  it('handles all-time-high price on final day (0% peak drawdown boundary)', () => {
    const history: PricePoint[] = [
      { date: '2026-11-17', price: 80 },
      { date: '2026-11-18', price: 85 },
      { date: '2026-11-19', price: 90 },
      { date: '2026-11-20', price: 100 }, // Peak
    ];
    const stats = computeStreakStats(history, true);
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestUpStreak).toBe(3);
    expect(stats.longestDownStreak).toBe(0);
    expect(Math.abs(stats.drawdownFromPeakPct)).toBe(0);
    expect(stats.changeToday).toBe(10);
    expect(stats.changeTodayPct).toBeCloseTo(11.11, 2);
    expect(stats.isSipDipZone).toBe(false);
  });

  it('handles all-down sequence (5 consecutive red days, triggering SIP Dip Zone)', () => {
    const history: PricePoint[] = [
      { date: '2026-11-15', price: 150 },
      { date: '2026-11-16', price: 140 },
      { date: '2026-11-17', price: 130 },
      { date: '2026-11-18', price: 120 },
      { date: '2026-11-19', price: 110 },
      { date: '2026-11-20', price: 100 },
    ];
    const statsGradeA = computeStreakStats(history, true);
    expect(statsGradeA.currentStreak).toBe(-5);
    expect(statsGradeA.longestDownStreak).toBe(5);
    expect(statsGradeA.longestUpStreak).toBe(0);
    expect(statsGradeA.drawdownFromPeakPct).toBeCloseTo(-33.33, 1);
    expect(statsGradeA.isSipDipZone).toBe(true);

    // Grade B/C asset must NOT trigger SIP Dip Zone even on down streak
    const statsGradeB = computeStreakStats(history, false);
    expect(statsGradeB.currentStreak).toBe(-5);
    expect(statsGradeB.isSipDipZone).toBe(false);
  });

  it('handles all-up sequence (5 consecutive green days)', () => {
    const history: PricePoint[] = [
      { date: '2026-11-15', price: 100 },
      { date: '2026-11-16', price: 110 },
      { date: '2026-11-17', price: 120 },
      { date: '2026-11-18', price: 130 },
      { date: '2026-11-19', price: 140 },
      { date: '2026-11-20', price: 150 },
    ];
    const stats = computeStreakStats(history, true);
    expect(stats.currentStreak).toBe(5);
    expect(stats.longestUpStreak).toBe(5);
    expect(stats.longestDownStreak).toBe(0);
    expect(stats.isSipDipZone).toBe(false);
  });

  it('sorts unsorted dates chronologically before computing streak statistics', () => {
    const unsorted: PricePoint[] = [
      { date: '2026-11-20', price: 110 },
      { date: '2026-11-18', price: 90 },
      { date: '2026-11-19', price: 100 },
    ];
    const stats = computeStreakStats(unsorted, true);
    // Chronological: 90 -> 100 -> 110 (2 consecutive up days)
    expect(stats.currentStreak).toBe(2);
    expect(stats.changeToday).toBe(10);
    expect(stats.changeTodayPct).toBe(10); // (110 - 100) / 100 * 100
  });
});

describe('QA Edge Cases: Tax, Zakat & DRIP Dynamics', () => {
  it('validates exact net retention across all 4 Tax/Zakat combinations', () => {
    const base = createBaseProfile({ lumpSumPkr: 1000000 });

    // 1. Filer, No Zakat: retention = 1 - 0.15 = 0.85
    const filerNoZakat = calculateLifePlan({ ...base, taxStatus: 'filer', includeZakat: false });
    // 2. Filer, With Zakat: retention = 1 - 0.15 - 0.025 = 0.825
    const filerZakat = calculateLifePlan({ ...base, taxStatus: 'filer', includeZakat: true });
    // 3. Non-Filer, No Zakat: retention = 1 - 0.30 = 0.70
    const nonFilerNoZakat = calculateLifePlan({ ...base, taxStatus: 'non-filer', includeZakat: false });
    // 4. Non-Filer, With Zakat: retention = 1 - 0.30 - 0.025 = 0.675
    const nonFilerZakat = calculateLifePlan({ ...base, taxStatus: 'non-filer', includeZakat: true });

    const gross = filerNoZakat.initialMonthlyGrossDividendPkr;

    expect(filerNoZakat.initialMonthlyNetDividendPkr).toBeCloseTo(gross * 0.85, -1);
    expect(filerZakat.initialMonthlyNetDividendPkr).toBeCloseTo(gross * 0.825, -1);
    expect(nonFilerNoZakat.initialMonthlyNetDividendPkr).toBeCloseTo(gross * 0.70, -1);
    expect(nonFilerZakat.initialMonthlyNetDividendPkr).toBeCloseTo(gross * 0.675, -1);
  });

  it('DRIP compounding: reinvesting dividends yields substantially higher portfolio than cash withdrawal', () => {
    const profileDrip = createBaseProfile({
      lumpSumPkr: 5000000,
      monthlyInvestPkr: 0,
      reinvestDividends: true,
    });
    const profileNoDrip = createBaseProfile({
      lumpSumPkr: 5000000,
      monthlyInvestPkr: 0,
      reinvestDividends: false,
    });

    const planDrip = calculateLifePlan(profileDrip);
    const planNoDrip = calculateLifePlan(profileNoDrip);

    const finalDrip = planDrip.timeline[14].portfolioValuePkr;
    const finalNoDrip = planNoDrip.timeline[14].portfolioValuePkr;

    // Without DRIP and with 0 monthly invest, capital base stays flat at Rs 5,000,000
    expect(finalNoDrip).toBe(5000000);

    // With DRIP, portfolio compounds significantly (> 2x initial capital over 15 years)
    expect(finalDrip).toBeGreaterThan(10000000);
    expect(finalDrip).toBeGreaterThan(finalNoDrip * 2);
  });
});

describe('QA Edge Cases: Expense Waterfall Mechanics', () => {
  it('covers 100% of all expenses when dividend exceeds total living costs', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 50000000, // Rs 5 Crore -> ~Rs 290k net dividend vs 90k expenses
      expenses: {
        fuelAndCommute: 15000,
        utilitiesAndInternet: 20000,
        groceriesAndFood: 25000,
        rentOrHousing: 20000,
        familyAndOther: 10000,
      },
    });

    const plan = calculateLifePlan(profile);

    const totalExpenses = 90000;
    const totalCovered = plan.expenseWaterfall.reduce((sum, s) => sum + s.coveredPkr, 0);

    expect(totalCovered).toBe(totalExpenses);
    plan.expenseWaterfall.forEach((step) => {
      expect(step.coveredPkr).toBe(step.monthlyCostPkr);
      expect(step.coveragePct).toBe(100);
      expect(step.isFullyCovered).toBe(true);
    });
  });

  it('covers 0% of all expenses when dividend is 0', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 0,
      monthlyInvestPkr: 0,
    });

    const plan = calculateLifePlan(profile);

    plan.expenseWaterfall.forEach((step) => {
      expect(step.coveredPkr).toBe(0);
      expect(step.coveragePct).toBe(0);
      expect(step.isFullyCovered).toBe(false);
    });
  });

  it('allocates partial coverage strictly in priority order across waterfall categories', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 4300000,
      expenses: {
        fuelAndCommute: 15000,
        utilitiesAndInternet: 20000,
        groceriesAndFood: 25000,
        rentOrHousing: 20000,
        familyAndOther: 10000,
      },
    });

    const plan = calculateLifePlan(profile);
    const netDiv = plan.initialMonthlyNetDividendPkr;

    // Net dividend should be roughly 23k at 20 Nov 2026 yields (24k-26k on stale data)
    expect(netDiv).toBeGreaterThanOrEqual(22000);
    expect(netDiv).toBeLessThanOrEqual(25000);

    const wf = plan.expenseWaterfall;

    // Step 1: Fuel & Commute (15k) -> 100% covered
    expect(wf[0].label).toBe('Fuel & Commute');
    expect(wf[0].coveredPkr).toBe(15000);
    expect(wf[0].coveragePct).toBe(100);
    expect(wf[0].isFullyCovered).toBe(true);

    // Step 2: Utilities (20k) -> partially covered by remainder (netDiv - 15k)
    expect(wf[1].label).toBe('Utilities & Internet');
    expect(wf[1].coveredPkr).toBe(netDiv - 15000);
    expect(wf[1].isFullyCovered).toBe(false);
    expect(wf[1].coveragePct).toBeCloseTo(((netDiv - 15000) / 20000) * 100, 1);

    // Steps 3, 4, 5: 0% covered
    expect(wf[2].coveredPkr).toBe(0);
    expect(wf[2].coveragePct).toBe(0);
    expect(wf[2].isFullyCovered).toBe(false);

    expect(wf[3].coveredPkr).toBe(0);
    expect(wf[3].coveragePct).toBe(0);
    expect(wf[3].isFullyCovered).toBe(false);

    expect(wf[4].coveredPkr).toBe(0);
    expect(wf[4].coveragePct).toBe(0);
    expect(wf[4].isFullyCovered).toBe(false);

    // Sum of all coveredPkr must equal netDiv
    const totalAllocated = wf.reduce((sum, s) => sum + s.coveredPkr, 0);
    expect(totalAllocated).toBe(netDiv);
  });

  it('handles zero-cost expense category gracefully (e.g. rent = 0 for inherited home)', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 2000000,
      expenses: {
        fuelAndCommute: 15000,
        utilitiesAndInternet: 20000,
        groceriesAndFood: 25000,
        rentOrHousing: 0, // Rent is 0
        familyAndOther: 10000,
      },
    });

    const plan = calculateLifePlan(profile);
    const rentStep = plan.expenseWaterfall.find((s) => s.label === 'Rent / Housing');

    expect(rentStep).toBeDefined();
    if (!rentStep) return;

    expect(rentStep.monthlyCostPkr).toBe(0);
    expect(rentStep.coveredPkr).toBe(0);
    expect(rentStep.coveragePct).toBe(100);
    expect(rentStep.isFullyCovered).toBe(true);
  });
});

describe('QA Edge Cases: Formatting & Privacy Masking Resilience', () => {
  it('formatPkr handles negative numbers, nulls, decimals, and options', () => {
    expect(formatPkr(0)).toBe('Rs 0');
    expect(formatPkr(-50000)).toBe('-Rs 50,000');
    expect(formatPkr(12345.67, { decimals: 2 })).toBe('Rs 12,345.67');
    expect(formatPkr(-12345.67, { decimals: 2, showRs: false })).toBe('-12,345.67');
    expect(formatPkr(NaN as unknown as number)).toBe('Rs 0');
    expect(formatPkr(Infinity as unknown as number)).toBe('Rs 0');
  });

  it('formatCompactPkr handles large and small boundaries across Lac and Crore scales', () => {
    // Crores
    expect(formatCompactPkr(10000000)).toBe('Rs 1.0 Cr');
    expect(formatCompactPkr(100000000)).toBe('Rs 10.0 Cr');
    expect(formatCompactPkr(1000000000)).toBe('Rs 100 Cr');
    expect(formatCompactPkr(-10000000)).toBe('-Rs 1.0 Cr');

    // Lakhs
    expect(formatCompactPkr(100000)).toBe('Rs 1.0 Lac');
    expect(formatCompactPkr(9900000)).toBe('Rs 99.0 Lac');
    expect(formatCompactPkr(-1500000)).toBe('-Rs 15.0 Lac');

    // Thousands
    expect(formatCompactPkr(1000)).toBe('Rs 1.0k');
    expect(formatCompactPkr(50400)).toBe('Rs 50.4k');

    // Sub-thousand
    expect(formatCompactPkr(999)).toBe('Rs 999');
    expect(formatCompactPkr(0)).toBe('Rs 0');
    expect(formatCompactPkr(NaN as unknown as number)).toBe('Rs 0');
  });

  it('formatPct handles signed, zero, negative, and invalid values', () => {
    expect(formatPct(0)).toBe('0.0%');
    expect(formatPct(0, 2)).toBe('0.00%');
    expect(formatPct(15.2, 1, true)).toBe('+15.2%');
    expect(formatPct(-8.45, 2)).toBe('-8.45%');
    expect(formatPct(NaN as unknown as number)).toBe('0.0%');
    expect(formatPct(Infinity as unknown as number)).toBe('0.0%');
  });

  it('maskAmount and formatters respect { hidden: true } privacy toggle across all units', () => {
    expect(formatPkr(150000, { hidden: true })).toBe('Rs •••••');
    expect(formatPkr(-150000, { hidden: true })).toBe('Rs •••••');
    expect(formatUsd(2500, { hidden: true })).toBe('$ •••••');
    expect(formatTolas(12.5, { hidden: true })).toBe('••••• tolas');
    expect(maskAmount('Rs 1,500,000', true)).toBe('Rs •••••');
    expect(maskAmount('$ 5,420', true)).toBe('$ •••••');
    expect(maskAmount('25.4 tolas', true)).toBe('••••• tolas');
    expect(maskAmount('Rs 1,500,000', false)).toBe('Rs 1,500,000');
  });
});

describe('QA Edge Cases: Car Decision Map 5-Year TCO Boundary Matrix', () => {
  it('evaluates tariff switching: Legacy Net Metering (Rs 26) vs 2026 Net Billing (Rs 11) vs Grid (Rs 55)', () => {
    const base = createBaseProfile({
      solarKw: 15, // Has rooftop solar
      dailyCommuteKm: 40,
    });

    // 1. Legacy Net Metering Mode -> Rs 26/kWh opportunity cost
    const legacyDecision = evaluateCarDecision({ ...base, solarTariffMode: 'net-metering-legacy' });
    expect(legacyDecision.effectiveSolarRatePerKwh).toBe(26);

    // 2. 2026 Net Billing Mode -> Rs 11/kWh buyback rate
    const billingDecision = evaluateCarDecision({ ...base, solarTariffMode: 'net-billing-2026' });
    expect(billingDecision.effectiveSolarRatePerKwh).toBe(11);

    // 3. 0 kW Solar (Grid only) -> Rs 55/kWh grid rate
    const gridDecision = evaluateCarDecision({ ...base, solarKw: 0 });
    expect(gridDecision.effectiveSolarRatePerKwh).toBe(55);

    // 5-year EV charging cost under Net Billing (Rs 11) must be strictly less than Legacy (Rs 26) and Grid (Rs 55)
    const evBilling = billingDecision.results.find((r) => r.fuelType === 'ev');
    const evLegacy = legacyDecision.results.find((r) => r.fuelType === 'ev');
    const evGrid = gridDecision.results.find((r) => r.fuelType === 'ev');

    expect(evBilling).toBeDefined();
    expect(evLegacy).toBeDefined();
    expect(evGrid).toBeDefined();

    expect(evBilling!.fiveYearFuelOrChargePkr).toBeLessThan(evLegacy!.fiveYearFuelOrChargePkr);
    expect(evLegacy!.fiveYearFuelOrChargePkr).toBeLessThan(evGrid!.fiveYearFuelOrChargePkr);
  });

  it('enforces 10% capital opportunity cost on equity tied up over 5 years', () => {
    const profile = createBaseProfile({
      opportunityCostReturnPct: 10,
    });
    const decision = evaluateCarDecision(profile);

    const alsvin = decision.results.find((r) => r.name === 'Changan Alsvin 1.5');
    expect(alsvin).toBeDefined();
    if (!alsvin) return;

    // Upfront cash tied up = 4,149,000
    // 5-year compound multiplier @ 10% = (1.10)^5 - 1 = 0.61051
    const expectedOppCost = Math.round(4149000 * (Math.pow(1.10, 5) - 1));
    expect(alsvin.fiveYearOpportunityCostPkr).toBeCloseTo(expectedOppCost, -2);
  });

  it('rejects partial or malformed EMI quotes by setting isQuoteIncomplete flag', () => {
    const testCases: Partial<VehicleCandidate['emiQuote']>[] = [
      { enabled: true, downPaymentPkr: 0, monthlyInstallmentPkr: 50000, tenureMonths: 36 },
      { enabled: true, downPaymentPkr: 500000, monthlyInstallmentPkr: 0, tenureMonths: 36 },
      { enabled: true, downPaymentPkr: 500000, monthlyInstallmentPkr: 50000, tenureMonths: 0 },
      { enabled: true, downPaymentPkr: -100, monthlyInstallmentPkr: 50000, tenureMonths: 36 },
    ];

    testCases.forEach((badQuote) => {
      const profile = createBaseProfile({
        vehicles: [
          {
            id: 'broken-emi',
            name: 'Broken EMI Car',
            fuelType: 'petrol',
            pricePkr: 2000000,
            emiQuote: badQuote as any,
          },
        ],
      });
      const decision = evaluateCarDecision(profile);
      expect(decision.results[0].isQuoteIncomplete).toBe(true);
      // Ensure no NaN in waterfall or monthly cost
      expect(Number.isFinite(decision.results[0].totalFiveYearCostPkr)).toBe(true);
      expect(Number.isFinite(decision.results[0].realCostPerMonthPkr)).toBe(true);
    });
  });

  it('validates 5-step waterfall sums exactly to total 5-year TCO and 60 months breakdown', () => {
    const profile = createBaseProfile();
    const decision = evaluateCarDecision(profile);

    decision.results.forEach((v) => {
      expect(v.waterfall.length).toBe(5);
      const sumOfSteps = v.waterfall.reduce((acc, step) => acc + step.amountPkr, 0);
      expect(sumOfSteps).toBe(v.totalFiveYearCostPkr);
      expect(v.waterfall[4].runningTotalPkr).toBe(v.totalFiveYearCostPkr);
      expect(v.realCostPerMonthPkr).toBe(Math.round(v.totalFiveYearCostPkr / 60));
    });
  });

  it('crossover distance series evaluates across full 5 to 100 km/day spectrum', () => {
    const profile = createBaseProfile();
    const decision = evaluateCarDecision(profile);

    expect(decision.crossoverSeries.length).toBe(20);
    decision.crossoverSeries.forEach((pt, idx) => {
      expect(pt.kmPerDay).toBe((idx + 1) * 5);
      expect(pt['alvin-petrol']).toBeDefined();
      expect(pt['honri-ve-2']).toBeDefined();
      expect(Number.isFinite(pt['alvin-petrol'])).toBe(true);
    });
  });
});

describe('QA Edge Cases: WealthFlow Compounding & Dated Life Goals', () => {
  it('models annual salary raises compounding new annual investment over 15 years', () => {
    const profileWithRaise = createBaseProfile({
      lumpSumPkr: 0,
      monthlyInvestPkr: 100000,
      annualSalaryRaisePct: 15, // 15% raise each year
    });
    const profileNoRaise = createBaseProfile({
      lumpSumPkr: 0,
      monthlyInvestPkr: 100000,
      annualSalaryRaisePct: 0, // Flat investment
    });

    const planRaise = calculateLifePlan(profileWithRaise);
    const planNoRaise = calculateLifePlan(profileNoRaise);

    // Year 1 starts with same base
    expect(planRaise.timeline[0].annualNetDividendPkr).toBeCloseTo(
      planNoRaise.timeline[0].annualNetDividendPkr,
      -2
    );

    // By Year 15, annual salary raises compound dramatically
    const finalRaise = planRaise.timeline[14].portfolioValuePkr;
    const finalNoRaise = planNoRaise.timeline[14].portfolioValuePkr;
    expect(finalRaise).toBeGreaterThan(finalNoRaise * 1.5);
  });

  it('accurately withdraws dated life goals at targetAge and flags opportunity cost', () => {
    const weddingGoal: LifeGoal = {
      id: 'wedding',
      name: 'Wedding Ceremony',
      costInTodaysPkr: 2000000, // Rs 20 Lac today
      targetAge: 30, // 2 years from start age 28
      priority: 'high',
    };
    const houseGoal: LifeGoal = {
      id: 'house',
      name: 'House Downpayment',
      costInTodaysPkr: 5000000, // Rs 50 Lac today
      targetAge: 35, // 7 years from start age 28
      priority: 'critical',
    };

    const profile = createBaseProfile({
      age: 28,
      retirementAge: 60,
      annualInflationPct: 8,
      lifeGoals: [weddingGoal, houseGoal],
    });

    const plan = calculateLifePlan(profile);

    expect(plan.goalOutcomes.length).toBe(2);

    // Wedding at age 30 (Year 2)
    const wedding = plan.goalOutcomes.find((g) => g.goalId === 'wedding');
    expect(wedding).toBeDefined();
    if (!wedding) return;

    // Inflated cost = 2M * (1.08)^2 = 2,332,800
    const expectedWeddingInflated = Math.round(2000000 * Math.pow(1.08, 2));
    expect(wedding.inflatedCostPkr).toBe(expectedWeddingInflated);

    // Years to retirement = 60 - 30 = 30 years
    // Opportunity cost uses the PROFILE's opportunityCostReturnPct (10% in
    // this fixture) — the engine previously hardcoded 12%.
    const expectedOppCost = Math.round(wedding.inflatedCostPkr * Math.pow(1.1, 30));
    expect(wedding.trueOpportunityCostAtRetirementPkr).toBe(expectedOppCost);

    // Check that timeline in year 2 recorded goal withdrawal
    const year2Timeline = plan.timeline.find((t) => t.age === 30);
    expect(year2Timeline?.goalWithdrawnPkr).toBe(expectedWeddingInflated);
  });

  it('deflates nominal wealth to Today Money, converts to USD, Gold Tolas, and 4% rule', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 10000000,
      monthlyInvestPkr: 50000,
      annualInflationPct: 8,
      usdToPkr: 276.5,
      goldPerTolaPkr: 379836,
    });

    const plan = calculateLifePlan(profile);

    // Real Today's PKR must be less than nominal portfolio due to 15 years of 8% inflation
    expect(plan.finalRealTodaysPkr).toBeLessThan(plan.finalNominalWealthPkr);

    // USD wealth = finalRealTodaysPkr / 276.5
    const expectedUsd = Math.round(plan.finalRealTodaysPkr / 276.5);
    expect(plan.finalWealthUsd).toBe(expectedUsd);

    // Gold tolas = finalRealTodaysPkr / 379836
    const expectedTolas = Number((plan.finalRealTodaysPkr / 379836).toFixed(1));
    expect(plan.finalWealthGoldTolas).toBe(expectedTolas);

    // 4% safe monthly withdrawal = (finalRealTodaysPkr * 0.04) / 12
    const expected4PctMonthly = Math.round((plan.finalRealTodaysPkr * 0.04) / 12);
    expect(plan.safeMonthlyIncome4PctTodaysPkr).toBe(expected4PctMonthly);
  });
});

describe('QA Edge Cases: Safe State URL Serialization & Security Defense', () => {
  it('safely handles malformed, corrupted, or non-base64 hash without crashing', () => {
    const fallback = createBaseProfile();
    const corruptedHashes = [
      '#plan=not-a-valid-base64!@#$%',
      '#plan=',
      '#unknown=123',
      '',
      '#plan=e30=', // valid base64 for "{}"
    ];

    corruptedHashes.forEach((hash) => {
      const decoded = decodeProfileFromHash(hash, fallback) ?? fallback;
      expect(decoded).toBeDefined();
      expect(decoded.age).toBe(fallback.age);
      expect(decoded.role).toBe(fallback.role);
    });
  });

  it('prevents prototype pollution and strips __proto__, constructor, and prototype', () => {
    const fallback = createBaseProfile();
    const maliciousHash = encodeProfileToHash({
      ...fallback,
      ['__proto__' as any]: { injectedHacked: true },
      ['constructor' as any]: { prototype: { injectedHacked: true } },
    });

    const decoded = decodeProfileFromHash(maliciousHash, fallback);
    expect((decoded as any).injectedHacked).toBeUndefined();
    expect((Object.prototype as any).injectedHacked).toBeUndefined();
  });

  it('clamps out-of-range numeric inputs to safe bounds', () => {
    const fallback = createBaseProfile();
    const extremePayload = {
      ...fallback,
      age: 150, // Should clamp to <= 85
      annualSalaryRaisePct: 100, // Should clamp to <= 50%
      annualInflationPct: 200, // Should clamp to <= 40%
      monthlyIncomePkr: -500000, // Should clamp to >= 0
    };

    const sanitized = sanitizeProfile(extremePayload, fallback);
    expect(sanitized.age).toBeLessThanOrEqual(85);
    expect(sanitized.annualSalaryRaisePct).toBeLessThanOrEqual(50);
    expect(sanitized.annualInflationPct).toBeLessThanOrEqual(40);
    expect(sanitized.monthlyIncomePkr).toBe(0);
  });
});

describe('QA Edge Cases: Goal Shortfall Honesty (Forgewarden fix round)', () => {
  it('marks a goal FUNDED=false with a real shortfall when the pot cannot pay it', () => {
    const profile = createBaseProfile({
      age: 28,
      retirementAge: 60,
      lumpSumPkr: 100000,
      monthlyInvestPkr: 0,
      annualInflationPct: 8,
      lifeGoals: [
        { id: 'big-house', name: 'House Downpayment', targetAge: 30, costInTodaysPkr: 5000000 },
      ],
    });

    const plan = calculateLifePlan(profile);
    const outcome = plan.goalOutcomes.find((g) => g.goalId === 'big-house');
    expect(outcome).toBeDefined();
    if (!outcome) return;

    // Inflated cost is reported in full...
    expect(outcome.inflatedCostPkr).toBe(Math.round(5000000 * Math.pow(1.08, 2)));
    // ...but the goal is NOT marked funded, and the shortfall is real.
    expect(outcome.funded).toBe(false);
    expect(outcome.shortfallPkr).toBeGreaterThan(5000000);

    // Only what actually exists leaves the pot that year.
    const year2 = plan.timeline.find((t) => t.age === 30);
    expect(year2?.goalWithdrawnPkr).toBeGreaterThan(0);
    expect(year2?.goalWithdrawnPkr).toBeLessThan(outcome.inflatedCostPkr);
  });
});

describe('QA Edge Cases: Asset Split Normalization & Boundary Hardening', () => {
  it('handles empty buckets list gracefully', () => {
    expect(normalizeAssetSplits([])).toEqual([]);
  });

  it('normalizes single bucket to 100%', () => {
    const single: AssetBucket[] = [
      { id: 'psx-dividends', label: 'Equities', currentValuePkr: 0, monthlySplitPct: 40, expectedAnnualReturnPct: 14 },
    ];
    const normalized = normalizeAssetSplits(single);
    expect(normalized.length).toBe(1);
    expect(normalized[0].monthlySplitPct).toBe(100);
  });

  it('treats negative or NaN split percentages as zero and redistributes', () => {
    const buckets: AssetBucket[] = [
      { id: 'psx-dividends', label: 'Equities', currentValuePkr: 0, monthlySplitPct: -20, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: 'Gold', currentValuePkr: 0, monthlySplitPct: NaN as any, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate', currentValuePkr: 0, monthlySplitPct: 50, expectedAnnualReturnPct: 13 },
    ];
    const normalized = normalizeAssetSplits(buckets);
    const sum = normalized.reduce((acc, b) => acc + b.monthlySplitPct, 0);
    expect(Math.round(sum)).toBe(100);
    expect(normalized[0].monthlySplitPct).toBe(0);
    expect(normalized[1].monthlySplitPct).toBe(0);
    expect(normalized[2].monthlySplitPct).toBe(100);
  });

  it('normalizes over-allocated buckets (>100%) to sum exactly to 100.0%', () => {
    const buckets: AssetBucket[] = [
      { id: 'psx-dividends', label: 'Equities', currentValuePkr: 0, monthlySplitPct: 60, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: 'Gold', currentValuePkr: 0, monthlySplitPct: 60, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate', currentValuePkr: 0, monthlySplitPct: 40, expectedAnnualReturnPct: 13 },
    ]; // Sum = 160%
    const normalized = normalizeAssetSplits(buckets);
    const sum = normalized.reduce((acc, b) => acc + b.monthlySplitPct, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it('normalizes under-allocated buckets (<100%) to sum exactly to 100.0%', () => {
    const buckets: AssetBucket[] = [
      { id: 'psx-dividends', label: 'Equities', currentValuePkr: 0, monthlySplitPct: 15, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: 'Gold', currentValuePkr: 0, monthlySplitPct: 15, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate', currentValuePkr: 0, monthlySplitPct: 10, expectedAnnualReturnPct: 13 },
    ]; // Sum = 40%
    const normalized = normalizeAssetSplits(buckets);
    const sum = normalized.reduce((acc, b) => acc + b.monthlySplitPct, 0);
    expect(Math.round(sum)).toBe(100);
  });
});

describe('QA Edge Cases: Car Savings to Wealth Plan Bridging Edge Cases', () => {
  it('prevents negative freed equity when winning vehicle is more expensive than baseline', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 2000000,
      monthlyInvestPkr: 50000,
      vehicles: [
        {
          id: 'cheap-bike',
          name: 'Used Petrol Bike',
          fuelType: 'petrol',
          pricePkr: 150000,
          kmPerLitre: 40,
        },
        {
          id: 'expensive-ev',
          name: 'Luxury City EV',
          fuelType: 'ev',
          pricePkr: 4000000,
          kwhPer100Km: 14,
        },
      ],
    });

    const winningResult = {
      vehicleId: 'expensive-ev',
      name: 'Luxury City EV',
      fuelType: 'ev' as const,
      isQuoteIncomplete: false,
      fiveYearFuelOrChargePkr: 100000,
      fiveYearDepreciationPkr: 1200000,
      fiveYearMaintenancePkr: 100000,
      fiveYearBankInterestPkr: 0,
      fiveYearOpportunityCostPkr: 400000,
      totalFiveYearCostPkr: 1800000,
      realCostPerMonthPkr: 30000,
      waterfall: [],
    };

    const baselineResult = {
      vehicleId: 'cheap-bike',
      name: 'Used Petrol Bike',
      fuelType: 'petrol' as const,
      isQuoteIncomplete: false,
      fiveYearFuelOrChargePkr: 200000,
      fiveYearDepreciationPkr: 50000,
      fiveYearMaintenancePkr: 30000,
      fiveYearBankInterestPkr: 0,
      fiveYearOpportunityCostPkr: 15000,
      totalFiveYearCostPkr: 295000,
      realCostPerMonthPkr: 4917,
      waterfall: [],
    };

    const updated = applyCarSavingsToPlan(profile, winningResult, baselineResult);
    // Freed equity must never be negative
    expect(updated.freedEquityPkr).toBe(0);
    expect(updated.lumpSumPkr).toBe(profile.lumpSumPkr);
  });

  it('applies positive freed equity and monthly operating savings to boost freedom timeline', () => {
    const profile = createBaseProfile({
      lumpSumPkr: 1000000,
      monthlyInvestPkr: 30000,
      vehicles: [
        {
          id: 'old-suv',
          name: 'Petrol SUV',
          fuelType: 'petrol',
          pricePkr: 6000000, // Rs 60 Lac
          kmPerLitre: 8,
        },
        {
          id: 'honri-ve',
          name: 'Honri Ve 2.0 EV',
          fuelType: 'ev',
          pricePkr: 3599000, // Rs 36 Lac
          kwhPer100Km: 14,
        },
      ],
    });

    const winningResult = {
      vehicleId: 'honri-ve',
      name: 'Honri Ve 2.0 EV',
      fuelType: 'ev' as const,
      isQuoteIncomplete: false,
      fiveYearFuelOrChargePkr: 150000,
      fiveYearDepreciationPkr: 1000000,
      fiveYearMaintenancePkr: 125000,
      fiveYearBankInterestPkr: 0,
      fiveYearOpportunityCostPkr: 350000,
      totalFiveYearCostPkr: 1625000,
      realCostPerMonthPkr: 27083,
      waterfall: [],
    };

    const baselineResult = {
      vehicleId: 'old-suv',
      name: 'Petrol SUV',
      fuelType: 'petrol' as const,
      isQuoteIncomplete: false,
      fiveYearFuelOrChargePkr: 1200000,
      fiveYearDepreciationPkr: 2000000,
      fiveYearMaintenancePkr: 400000,
      fiveYearBankInterestPkr: 0,
      fiveYearOpportunityCostPkr: 600000,
      totalFiveYearCostPkr: 4200000,
      realCostPerMonthPkr: 70000,
      waterfall: [],
    };

    const updated = applyCarSavingsToPlan(profile, winningResult, baselineResult);

    // Freed equity: 6,000,000 - 3,599,000 = 2,401,000
    expect(updated.freedEquityPkr).toBe(2401000);
    expect(updated.lumpSumPkr).toBe(profile.lumpSumPkr + 2401000);

    // Monthly savings: 70,000 - 27,083 = 42,917
    expect(updated.monthlyCarSavingsPkr).toBe(70000 - 27083);
    expect(updated.monthlyInvestPkr).toBe(profile.monthlyInvestPkr + (70000 - 27083));

    // Months shaved off should be non-negative and finite
    expect(updated.monthsShavedOffFreedom).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(updated.monthsShavedOffFreedom)).toBe(true);
  });
});

describe('QA Edge Cases: PSX Execution Sheet Friction & Whole Shares Boundaries', () => {
  it('handles zero or negative portfolio budget safely without crashes or NaN', () => {
    const allocations = [
      { stock: PSX_STOCKS.find((s) => s.ticker === 'FFC')!, weightPct: 60 },
      { stock: PSX_STOCKS.find((s) => s.ticker === 'MEBL')!, weightPct: 40 },
    ];

    const sheetZero = calculateExecutionSheet(allocations, 0);
    expect(sheetZero.totalTargetPkr).toBe(0);
    expect(sheetZero.totalSpentPkr).toBe(0);
    expect(sheetZero.totalFeesPkr).toBe(0);
    expect(sheetZero.totalShares).toBe(0);
    expect(sheetZero.items.every((i) => i.shares === 0)).toBe(true);

    const sheetNeg = calculateExecutionSheet(allocations, -50000);
    expect(sheetNeg.totalTargetPkr).toBe(0);
    expect(sheetNeg.totalSpentPkr).toBe(0);
  });

  it('handles micro-budget smaller than stock price (0 shares bought, remainder equals target)', () => {
    const allocations = [
      { stock: PSX_STOCKS.find((s) => s.ticker === 'POL')!, weightPct: 100 }, // POL price ~Rs 520
    ];
    const sheet = calculateExecutionSheet(allocations, 300); // Rs 300 budget < Rs 520 price

    expect(sheet.items.length).toBe(1);
    expect(sheet.items[0].shares).toBe(0);
    expect(sheet.items[0].actualSpentPkr).toBe(0);
    expect(sheet.items[0].feePkr).toBe(0);
    expect(sheet.items[0].remainderPkr).toBe(300);
    expect(sheet.totalSpentPkr).toBe(0);
    expect(sheet.totalRemainderPkr).toBe(300);
  });

  it('strictly enforces whole integer shares and total cost (spent + fees) <= target budget', () => {
    const allocations = [
      { stock: PSX_STOCKS.find((s) => s.ticker === 'FFC')!, weightPct: 35 },
      { stock: PSX_STOCKS.find((s) => s.ticker === 'HUBC')!, weightPct: 25 },
      { stock: PSX_STOCKS.find((s) => s.ticker === 'MEBL')!, weightPct: 25 },
      { stock: PSX_STOCKS.find((s) => s.ticker === 'OGDC')!, weightPct: 15 },
    ];

    // High Net Worth test: Rs 5 Crore (50,000,000)
    const sheet = calculateExecutionSheet(allocations, 50000000);

    expect(sheet.items.length).toBe(4);
    sheet.items.forEach((item) => {
      expect(Number.isInteger(item.shares)).toBe(true);
      expect(item.shares).toBeGreaterThan(0);
      expect(item.actualSpentPkr).toBe(item.shares * item.price);
      expect(item.feePkr).toBeCloseTo(item.actualSpentPkr * 0.0025, 0);
      expect(item.actualSpentPkr + item.feePkr).toBeLessThanOrEqual(item.targetAmountPkr);
      expect(item.remainderPkr).toBeGreaterThanOrEqual(0);
    });

    expect(sheet.totalSpentPkr + sheet.totalFeesPkr).toBeLessThanOrEqual(50000000);
    expect(sheet.totalSpentPkr + sheet.totalFeesPkr + sheet.totalRemainderPkr).toBeCloseTo(50000000, 0);
  });
});

describe('QA Edge Cases: Dip-Buy Strategy Simulator Boundaries', () => {
  it('handles invalid inputs (0 budget, negative months, empty history) gracefully', () => {
    const ffc = PSX_STOCKS.find((s) => s.ticker === 'FFC')!;

    const zeroBudget = simulateDipStrategy(ffc, 0, 6);
    expect(zeroBudget.dcaShares).toBe(0);
    expect(zeroBudget.dipShares).toBe(0);
    expect(zeroBudget.verdict).toContain('Insufficient');

    const negBudget = simulateDipStrategy(ffc, -10000, 6);
    expect(negBudget.dcaShares).toBe(0);
    expect(negBudget.dipShares).toBe(0);

    const emptyHistoryStock = { ...ffc, history: [] };
    const emptySim = simulateDipStrategy(emptyHistoryStock, 50000, 6);
    expect(emptySim.dcaShares).toBe(0);
    expect(emptySim.verdict).toContain('Insufficient');
  });

  it('clamps simulation duration within [1, 24] months', () => {
    const ffc = PSX_STOCKS.find((s) => s.ticker === 'FFC')!;

    // 0 months should clamp to 1 month
    const sim0 = simulateDipStrategy(ffc, 50000, 0);
    expect(sim0.dcaShares).toBeGreaterThan(0);

    // 100 months should clamp to 24 months
    const sim100 = simulateDipStrategy(ffc, 50000, 100);
    expect(sim100.dcaShares).toBeGreaterThan(0);
  });

  it('demonstrates opportunistic dip buying produces >= shares and <= avg cost vs blind DCA', () => {
    const ffc = PSX_STOCKS.find((s) => s.ticker === 'FFC')!;
    const sim = simulateDipStrategy(ffc, 100000, 6);

    expect(sim.dipShares).toBeGreaterThanOrEqual(sim.dcaShares);
    expect(sim.dipAvgCost).toBeLessThanOrEqual(sim.dcaAvgCost);
    expect(sim.sharesLiftPct).toBeGreaterThanOrEqual(0);
    expect(sim.costBasisReductionPct).toBeGreaterThanOrEqual(0);
  });
});

describe('QA Edge Cases: Market Rates Live Overrides & Defaults Matrix', () => {
  it('verifies exact Nov 21 2026 Pakistan economic defaults benchmark rates', () => {
    const defaults = getDefaultMarketRates();
    expect(defaults.petrolPricePerLitre).toBe(322);
    expect(defaults.goldPerTolaPkr).toBe(379836); // APSGJA 21 Nov 2026 — swarm test had locked the stale 385,000 hero figure
    expect(defaults.usdToPkr).toBe(276.51); // SBP interbank close 20 Nov 2026
    expect(defaults.gridRatePerKwh).toBe(55);
    expect(defaults.kse100Index).toBe(177382);
    expect(defaults.solarNetMeteringLegacyRate).toBe(26);
    expect(defaults.solarNetBilling2026Rate).toBe(11);
    expect(defaults.lastUpdated).toBe('2026-11-21');
  });

  it('applyRatesToProfile cleanly updates economic rates without modifying other profile fields', () => {
    const profile = createBaseProfile({
      monthlyIncomePkr: 300000,
      age: 32,
      shariahOnly: true,
    });

    const customRates = {
      ...getDefaultMarketRates(),
      petrolPricePerLitre: 360,
      goldPerTolaPkr: 410000,
      usdToPkr: 280.0,
      gridRatePerKwh: 65,
    };

    const updated = applyRatesToProfile(profile, customRates);
    // Updated rates
    expect(updated.petrolPricePerLitre).toBe(360);
    expect(updated.goldPerTolaPkr).toBe(410000);
    expect(updated.usdToPkr).toBe(280.0);
    expect(updated.gridRatePerKwh).toBe(65);

    // Preserved fields
    expect(updated.monthlyIncomePkr).toBe(300000);
    expect(updated.age).toBe(32);
    expect(updated.shariahOnly).toBe(true);
  });
});
