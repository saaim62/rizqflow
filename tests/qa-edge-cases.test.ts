import { describe, expect, it } from 'vitest';
import { formatCompactPkr, formatPct, formatPkr, formatTolas, formatUsd, maskAmount } from '@/lib/format';
import { computeStreakStats } from '@/lib/engine/streakEngine';
import { calculateLifePlan } from '@/lib/engine/plannerEngine';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { decodeProfileFromHash, encodeProfileToHash, sanitizeProfile } from '@/lib/stateUrl';
import { LifeGoal, PricePoint, UserProfile, VehicleCandidate } from '@/types';

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

    // Freedom cannot be achieved in 15 years with 0 capital
    expect(plan.freedomYears).toBeNull();
    expect(plan.freedomDateLabel).toBe('Beyond 15 Years');

    // All 15 timeline years must have 0 portfolio value and 0 dividends
    expect(plan.timeline.length).toBe(15);
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

    // Gross monthly dividend on Rs 10 Cr @ ~8.24% blended yield is ~Rs 680k/mo
    expect(plan.initialMonthlyGrossDividendPkr).toBeGreaterThan(650000);
    expect(plan.initialMonthlyGrossDividendPkr).toBeLessThan(750000);

    // Net monthly dividend (filer 15%) is ~Rs 580k/mo
    expect(plan.initialMonthlyNetDividendPkr).toBeGreaterThan(550000);
    expect(plan.initialMonthlyNetDividendPkr).toBeLessThan(640000);

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

    // Net dividend should be roughly 25k (between 24k and 26k)
    expect(netDiv).toBeGreaterThanOrEqual(24000);
    expect(netDiv).toBeLessThanOrEqual(26500);

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
    // Opportunity cost = inflatedCost * (1.12)^30
    const expectedOppCost = Math.round(wedding.inflatedCostPkr * Math.pow(1.12, 30));
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
