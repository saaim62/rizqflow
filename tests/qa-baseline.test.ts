import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES } from '@/data/marketData';
import { UserProfile } from '@/types';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { calculateLifePlan } from '@/lib/engine/wealthEngine';

describe('Golden Fixture Baseline Verification', () => {
  const goldenCarsProfile: UserProfile = {
    ...PRESET_PROFILES['solar-commuter'].profile,
    dailyCommuteKm: 25,
    solarTariffMode: 'net-metering-legacy',
    solarKw: 22,
    opportunityCostReturnPct: 10,
    vehicles: [
      {
        id: 'yadea-m3',
        name: 'Yadea M3 E-Scooty',
        fuelType: 'e-scooty',
        pricePkr: 250000,
        kwhPer100Km: 3.5,
        fiveYearDepreciationPct: 25,
        annualMaintenancePkr: 12000,
      },
      {
        id: 'nora-neo',
        name: 'Nora Neo EV',
        fuelType: 'ev',
        pricePkr: 3155000,
        kwhPer100Km: 15.0,
        fiveYearDepreciationPct: 40,
        annualMaintenancePkr: 20000,
      },
      {
        id: 'honri-ve-2',
        name: 'Honri Ve 2.0 (200km EV)',
        fuelType: 'ev',
        pricePkr: 3999000,
        kwhPer100Km: 13.0,
        fiveYearDepreciationPct: 30,
        annualMaintenancePkr: 25000,
      },
      {
        id: 'changan-alsvin',
        name: 'Changan Alsvin (1.3L Petrol)',
        fuelType: 'petrol',
        pricePkr: 3800000,
        kmPerLitre: 14.0,
        fiveYearDepreciationPct: 35,
        annualMaintenancePkr: 60000,
      },
      {
        id: 'nissan-leaf',
        name: 'Nissan Leaf (40kWh EV)',
        fuelType: 'ev',
        pricePkr: 4800000,
        isCurrentVehicle: true,
        kwhPer100Km: 15.0,
        fiveYearDepreciationPct: 40,
        annualMaintenancePkr: 35000,
      },
    ],
  };

  it('verifies exact Cars TCO monthly costs and swap savings for Golden Fixture', () => {
    const decision = evaluateCarDecision(goldenCarsProfile);
    expect(decision.results).toHaveLength(5);

    const yadea = decision.results.find((v) => v.vehicleId === 'yadea-m3')!;
    const nora = decision.results.find((v) => v.vehicleId === 'nora-neo')!;
    const honri = decision.results.find((v) => v.vehicleId === 'honri-ve-2')!;
    const alsvin = decision.results.find((v) => v.vehicleId === 'changan-alsvin')!;
    const leaf = decision.results.find((v) => v.vehicleId === 'nissan-leaf')!;

    expect(yadea.realCostPerMonthPkr).toBe(5277);
    expect(nora.realCostPerMonthPkr).toBe(57768);
    expect(honri.realCostPerMonthPkr).toBe(65339);
    // Changan Alsvin: 83,322/mo (matches within 3 PKR of prompt reference 83,325/mo)
    expect(alsvin.realCostPerMonthPkr).toBe(83322);
    expect(leaf.realCostPerMonthPkr).toBe(86723);

    // Swap banner baseline is the Leaf: switching to Yadea frees Rs 4,550,000 and saves Rs 81,446/mo
    const owned = goldenCarsProfile.vehicles?.find((v) => v.isCurrentVehicle);
    expect(owned).toBeDefined();
    expect(owned?.id).toBe('nissan-leaf');
    expect(leaf.realCostPerMonthPkr).toBe(86723);

    const winning = decision.results[0];
    expect(winning.vehicleId).toBe('yadea-m3');
    expect(winning.realCostPerMonthPkr).toBe(5277);

    const monthlySavings = leaf.realCostPerMonthPkr - winning.realCostPerMonthPkr;
    const capitalFreed = (owned?.pricePkr ?? 0) - (goldenCarsProfile.vehicles?.find((v) => v.id === winning.vehicleId)?.pricePkr ?? 0);
    expect(monthlySavings).toBe(81446);
    expect(capitalFreed).toBe(4550000);
  });

  it('records and verifies Planner headline outputs for Golden Fixture', () => {
    const saimActualProfile: UserProfile = {
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
        { id: 'alsvin-petrol', name: 'Changan Alsvin 1.3L Petrol', fuelType: 'petrol', pricePkr: 3800000, kmPerLitre: 14, annualMaintenancePkr: 60000, fiveYearDepreciationPct: 35 },
        { id: 'honri-ve-2', name: 'Honri Ve 2.0 (200km EV)', fuelType: 'ev', pricePkr: 3999000, kwhPer100Km: 13, annualMaintenancePkr: 25000, fiveYearDepreciationPct: 30 },
        { id: 'nissan-leaf', name: 'Nissan Leaf 40kWh EV', fuelType: 'ev', pricePkr: 4800000, kwhPer100Km: 15, isCurrentVehicle: true, annualMaintenancePkr: 35000, fiveYearDepreciationPct: 40 },
        { id: 'yadea-m3', name: 'Yadea M3 E-Scooty', fuelType: 'e-scooty', pricePkr: 250000, kwhPer100Km: 3.5, annualMaintenancePkr: 12000, fiveYearDepreciationPct: 25 },
        { id: 'veh-1795357128954-709371', name: 'Nora Neo', fuelType: 'ev', pricePkr: 2600000, kwhPer100Km: 2, annualMaintenancePkr: 7000, fiveYearDepreciationPct: 70 },
      ],
      lifeGoals: [
        { id: 'goal-house-custom', name: 'Home Construction / Downpayment', targetAge: 33, costInTodaysPkr: 15000000 },
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

    const plan = calculateLifePlan(saimActualProfile);

    console.log('--- SAIM ACTUAL PORTFOLIO PLANNER BASELINE ---');
    console.log('Final Real Wealth (Today PKR):', plan.finalRealTodaysPkr);
    console.log('Final Nominal Wealth:', plan.finalNominalWealthPkr);
    console.log('Final Wealth USD:', plan.finalWealthUsd);
    console.log('Final Wealth Gold Tolas:', plan.finalWealthGoldTolas);
    console.log('Safe Monthly Income 4% (Today PKR):', plan.safeMonthlyIncome4PctTodaysPkr);
    console.log('Emergency Fund Target:', plan.emergencyFundTargetPkr);
    console.log('Emergency Fund Gap:', plan.emergencyFundGapPkr);
    console.log('Freedom Age:', plan.freedomAge);
    console.log('Freedom Date Label:', plan.freedomDateLabel);
    console.log('Initial Monthly Gross Dividend:', plan.initialMonthlyGrossDividendPkr);
    console.log('Initial Monthly Net Dividend:', plan.initialMonthlyNetDividendPkr);
    console.log('Blended Gross Yield Pct:', plan.blendedGrossYieldPct);
    console.log('Tax Rate Pct:', plan.taxRatePct);
    console.log('Goal Outcomes:', plan.goalOutcomes);

    expect(plan.finalRealTodaysPkr).toBe(11464756);
    expect(plan.finalNominalWealthPkr).toBe(26731671);
    expect(plan.finalWealthUsd).toBe(41464);
    expect(plan.finalWealthGoldTolas).toBe(30.2);
    expect(plan.safeMonthlyIncome4PctTodaysPkr).toBe(38216);
    expect(plan.emergencyFundTargetPkr).toBe(172648);
    expect(plan.emergencyFundGapPkr).toBe(922648);
    expect(plan.initialMonthlyGrossDividendPkr).toBe(0);
    expect(plan.initialMonthlyNetDividendPkr).toBe(0);
    expect(plan.freedomAge).toBeNull();
    expect(plan.freedomDateLabel).toBe('Beyond 11 Years');

    const debtGoal = plan.goalOutcomes.find((g) => g.goalId === 'goal-debt-2027');
    expect(debtGoal?.funded).toBe(true);
    expect(debtGoal?.shortfallPkr).toBe(0);

    const houseGoal = plan.goalOutcomes.find((g) => g.goalId === 'goal-house-custom');
    expect(houseGoal?.funded).toBe(false);
    expect(houseGoal?.shortfallPkr).toBe(14664188);
  });
});
