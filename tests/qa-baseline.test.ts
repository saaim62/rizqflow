import { describe, expect, it } from 'vitest';
import { PRESET_PROFILES } from '@/data/marketData';
import type { UserProfile } from '@/types';
import { sanitizeProfile } from '@/lib/stateUrl';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { calculateLifePlan } from '@/lib/engine/wealthEngine';

/**
 * Golden Fixture baseline — the owner's REAL active portfolio
 * ("Saim Portfolio", exported verbatim from production 22 Nov 2026).
 *
 * CORRECTED at owner review (NOTES #37): the original version of this
 * test ran against the `solar-commuter` PRESET (Rs 1.5M lump sum,
 * Rs 150k/mo SIP, 22 kW solar) and asserted almost nothing, so the
 * "baseline" published in QA-REPORT.md was a preset's numbers, not
 * the owner's. This version loads the actual fixture and asserts the
 * exact outputs the audited engines produce for it.
 */
const FIXTURE_RAW = {
  "age": 29,
  "role": "freelancer",
  "gender": "male",
  "solarKw": 11,
  "expenses": {
    "rentOrHousing": 0,
    "familyAndOther": 5000,
    "fuelAndCommute": 8162,
    "groceriesAndFood": 25000,
    "utilitiesAndInternet": 5000
  },
  "usdToPkr": 276.5,
  "vehicles": [
    {
      "id": "alsvin-petrol",
      "name": "Changan Alsvin 1.3L Petrol",
      "fuelType": "petrol",
      "pricePkr": 3800000,
      "kmPerLitre": 14,
      "annualMaintenancePkr": 60000,
      "fiveYearDepreciationPct": 35
    },
    {
      "id": "honri-ve-2",
      "name": "Honri Ve 2.0 (200km EV)",
      "fuelType": "ev",
      "pricePkr": 3999000,
      "kwhPer100Km": 13,
      "annualMaintenancePkr": 25000,
      "fiveYearDepreciationPct": 30
    },
    {
      "id": "nissan-leaf",
      "name": "Nissan Leaf 40kWh EV",
      "fuelType": "ev",
      "pricePkr": 4800000,
      "kwhPer100Km": 15,
      "isCurrentVehicle": true,
      "annualMaintenancePkr": 35000,
      "fiveYearDepreciationPct": 40
    },
    {
      "id": "yadea-m3",
      "name": "Yadea M3 E-Scooty",
      "fuelType": "e-scooty",
      "pricePkr": 250000,
      "kwhPer100Km": 3.5,
      "annualMaintenancePkr": 12000,
      "fiveYearDepreciationPct": 25
    },
    {
      "id": "veh-1795357128954-709371",
      "name": "Nora Neo",
      "fuelType": "ev",
      "pricePkr": 2600000,
      "kwhPer100Km": 2,
      "annualMaintenancePkr": 7000,
      "fiveYearDepreciationPct": 70
    }
  ],
  "lifeGoals": [
    {
      "id": "goal-house-custom",
      "name": "Home Construction / Downpayment",
      "targetAge": 33,
      "costInTodaysPkr": 15000000
    },
    {
      "id": "goal-debt-2027",
      "name": "Debt Clearance (installments, due 2027)",
      "targetAge": 30,
      "costInTodaysPkr": 750000
    }
  ],
  "taxStatus": "filer",
  "lumpSumPkr": 0,
  "shariahOnly": true,
  "assetBuckets": [
    {
      "id": "psx-dividends",
      "label": "PSX Dividend Equities",
      "currentValuePkr": 0,
      "monthlySplitPct": 50,
      "expectedAnnualReturnPct": 14
    },
    {
      "id": "gold",
      "label": "24K Physical Gold",
      "currentValuePkr": 0,
      "monthlySplitPct": 20,
      "expectedAnnualReturnPct": 12
    },
    {
      "id": "real-estate",
      "label": "Real Estate / Land",
      "currentValuePkr": 0,
      "monthlySplitPct": 15,
      "expectedAnnualReturnPct": 13
    },
    {
      "id": "money-market",
      "label": "Shariah Money Market",
      "currentValuePkr": 0,
      "monthlySplitPct": 10,
      "expectedAnnualReturnPct": 11
    },
    {
      "id": "cash",
      "label": "Emergency Cash",
      "currentValuePkr": 200000,
      "monthlySplitPct": 5,
      "expectedAnnualReturnPct": 8
    }
  ],
  "includeZakat": false,
  "familyMembers": 2,
  "isBreadwinner": true,
  "maritalStatus": "unmarried",
  "retirementAge": 40,
  "dailyCommuteKm": 25,
  "goldPerTolaPkr": 379836,
  "gridRatePerKwh": 55,
  "solarTariffMode": "net-metering-legacy",
  "monthlyIncomePkr": 300000,
  "monthlyInvestPkr": 100000,
  "dividendGrowthPct": 10,
  "inflationAdjusted": false,
  "reinvestDividends": true,
  "annualInflationPct": 8,
  "currentVehicleType": "petrol-bike",
  "petrolPricePerLitre": 322,
  "annualSalaryRaisePct": 12,
  "currentCashReservePkr": -750000,
  "currentVehicleResalePkr": 1000000,
  "opportunityCostReturnPct": 10
};

const fallback = (PRESET_PROFILES[0] as any).profile as UserProfile;
const fixture: UserProfile = sanitizeProfile(FIXTURE_RAW as any, fallback);

describe('Golden Fixture Baseline Verification (owner portfolio, 22 Nov 2026)', () => {
  it('cars: exact true-cost figures for the real fleet', () => {
    const decision = evaluateCarDecision(fixture);
    expect(decision.results).toHaveLength(5);
    const by = (id: string) => decision.results.find((v) => v.vehicleId === id)!;
    expect(by('yadea-m3').realCostPerMonthPkr).toBe(5277);
    expect(by('veh-1795357128954-709371').realCostPerMonthPkr).toBe(57768); // Nora Neo
    expect(by('honri-ve-2').realCostPerMonthPkr).toBe(65339);
    expect(by('alsvin-petrol').realCostPerMonthPkr).toBe(83322);
    expect(by('nissan-leaf').realCostPerMonthPkr).toBe(86723);
    // Winner + swap math against the owned Leaf
    expect(decision.results[0].vehicleId).toBe('yadea-m3');
    const leaf = by('nissan-leaf');
    const winner = by('yadea-m3');
    expect(leaf.realCostPerMonthPkr - winner.realCostPerMonthPkr).toBe(81446);
    const owned = fixture.vehicles.find((v) => v.isCurrentVehicle)!;
    expect(owned.id).toBe('nissan-leaf');
    expect(owned.pricePkr - fixture.vehicles.find((v) => v.id === 'yadea-m3')!.pricePkr).toBe(4550000);
  });

  // Re-baselined 24 Nov 2026 (NOTES #53): the three wealth figures moved
  // with the Shariah basket blend (8.675% -> 8.625%) after the 24 Nov yield
  // refresh — a data-driven move, no engine code changed.
  it('planner: exact audited headline outputs for the real fixture', () => {
    const plan = calculateLifePlan(fixture);
    expect(plan.finalRealTodaysPkr).toBe(11464734);
    expect(plan.finalNominalWealthPkr).toBe(26731621);
    expect(plan.safeMonthlyIncome4PctTodaysPkr).toBe(38216);
    expect(plan.emergencyFundTargetPkr).toBe(172648);
    expect(plan.initialMonthlyNetDividendPkr).toBe(0);
    const debt = plan.goalOutcomes.find((g) => g.targetAge === 30)!;
    const home = plan.goalOutcomes.find((g) => g.targetAge === 33)!;
    expect(debt.funded).toBe(true);
    expect(debt.shortfallPkr).toBe(0);
    expect(home.funded).toBe(false);
    expect(home.inflatedCostPkr).toBe(20407334);
    expect(home.shortfallPkr).toBe(14664674);
  });
});
