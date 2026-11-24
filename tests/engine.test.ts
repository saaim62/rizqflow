import { describe, expect, it } from 'vitest';
import { formatCompactPkr, formatPct, formatPkr, formatPkrWords, formatTolas, formatUsd, maskAmount } from '@/lib/format';
import { computeStreakStats, simulateDipStrategy } from '@/lib/engine/streakEngine';
import { GOLD_YEAR_HISTORY, METAL_ASSETS, PRESET_PROFILES, PSX_STOCKS } from '@/data/marketData';
import {
  applyCarSavingsToPlan,
  calculateExecutionSheet,
  calculateLifePlan,
  netLiquidReservePkr,
  normalizeAssetSplits,
  totalHoldingsPkr,
  totalLiabilitiesPkr,
} from '@/lib/engine/plannerEngine';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';
import { decodeProfileFromHash, encodeProfileToHash, sanitizeProfile } from '@/lib/stateUrl';
import {
  applyRatesToProfile,
  getDefaultMarketRates,
  loadCustomMarketRates,
  resetMarketRates,
  saveCustomMarketRates,
} from '@/lib/marketRates';
import { AssetBucket, PricePoint, UserProfile } from '@/types';
import { PREDICTIONS, clampPrediction, isPredictionType, parsePrediction } from '@/lib/aiPredictions';

describe('Formatting Utilities (src/lib/format.ts)', () => {
  it('formats Pakistani Rupee with standard commas and Rs prefix', () => {
    expect(formatPkr(379836)).toBe('Rs 379,836');
    expect(formatPkr(0)).toBe('Rs 0');
    expect(formatPkr(15400)).toBe('Rs 15,400');
    expect(formatPkr(-15400)).toBe('-Rs 15,400');
    expect(formatPkr(4708, { showRs: false })).toBe('4,708');
  });

  it('formats compact PKR in Lakhs and Crores', () => {
    // Crores
    expect(formatCompactPkr(12500000)).toBe('Rs 1.25 Cr');
    expect(formatCompactPkr(10000000)).toBe('Rs 1.0 Cr');
    // Lakhs
    expect(formatCompactPkr(3000000)).toBe('Rs 30.0 Lac');
    expect(formatCompactPkr(1500000)).toBe('Rs 15.0 Lac');
    // Thousands
    expect(formatCompactPkr(20400)).toBe('Rs 20.4k');
    expect(formatCompactPkr(500)).toBe('Rs 500');
    expect(formatCompactPkr(-3000000)).toBe('-Rs 30.0 Lac');
  });

  it('formats percentages cleanly with optional sign', () => {
    expect(formatPct(9.2, 1, true)).toBe('+9.2%');
    expect(formatPct(-12.8, 1)).toBe('-12.8%');
    expect(formatPct(8.5, 1)).toBe('8.5%');
    expect(formatPct(0, 1)).toBe('0.0%');
  });
});

describe('Streak Calculation Engine (src/lib/engine/streakEngine.ts)', () => {
  it('computes positive and negative streaks accurately', () => {
    const upHistory: PricePoint[] = [
      { date: '2026-11-15', price: 100 },
      { date: '2026-11-16', price: 102 },
      { date: '2026-11-17', price: 105 },
      { date: '2026-11-18', price: 107 },
    ];
    const upStats = computeStreakStats(upHistory, true);
    expect(upStats.currentStreak).toBe(3);
    expect(upStats.longestUpStreak).toBe(3);
    expect(upStats.longestDownStreak).toBe(0);
    expect(upStats.changeToday).toBe(2);
    expect(upStats.isSipDipZone).toBe(false);

    const downHistory: PricePoint[] = [
      { date: '2026-11-15', price: 110 },
      { date: '2026-11-16', price: 107 },
      { date: '2026-11-17', price: 104 },
      { date: '2026-11-18', price: 101 },
      { date: '2026-11-19', price: 98 },
    ];
    const downStats = computeStreakStats(downHistory, true);
    expect(downStats.currentStreak).toBe(-4);
    expect(downStats.longestDownStreak).toBe(4);
    expect(downStats.changeToday).toBe(-3);
    expect(downStats.isSipDipZone).toBe(true); // Grade A and <= -3
  });

  it('flags SIP Dip Zone only for Grade A assets with currentStreak <= -3', () => {
    const downHistory: PricePoint[] = [
      { date: '2026-11-15', price: 100 },
      { date: '2026-11-16', price: 95 },
      { date: '2026-11-17', price: 90 },
      { date: '2026-11-18', price: 85 },
    ];
    // Grade A -> true
    expect(computeStreakStats(downHistory, true).isSipDipZone).toBe(true);
    // Grade B/C -> false
    expect(computeStreakStats(downHistory, false).isSipDipZone).toBe(false);
  });
});

describe('Market Data Layer (src/data/marketData.ts)', () => {
  it('Gold 24k (30-day daily series): rebound extended to a 2-day streak, Nov 24 close Rs 385,436, up 1,300 today, drawdown ~11.5% from the 30-day-window high Rs 435,636', () => {
    const gold = METAL_ASSETS.find((m) => m.id === 'gold-24k');
    expect(gold).toBeDefined();
    if (!gold) return;

    expect(gold.currentPrice).toBe(385436);
    expect(gold.history.length).toBe(30);

    const finalDay = gold.history[gold.history.length - 1];
    const prevDay = gold.history[gold.history.length - 2];
    expect(finalDay.date).toBe('2026-11-24');
    expect(finalDay.price).toBe(385436);
    expect(prevDay.date).toBe('2026-11-23');
    expect(prevDay.price).toBe(384136);

    // Rose Rs 1,300 on the final day
    expect(gold.streak.changeToday).toBe(1300);

    // High of the 30-day window on Nov 5 at Rs 435,636 (NOT the all-time
    // peak — that is Rs 572,862 on 29 Jan 2026, see the year-history test)
    const peakPoint = gold.history.find((p) => p.date === '2026-11-05');
    expect(peakPoint?.price).toBe(435636);

    // 2-day green streak after the Nov 23 rebound
    expect(gold.streak.currentStreak).toBe(2);
    expect(gold.streak.isSipDipZone).toBe(false);

    // Drawdown from the 30-day-window high ~11.5%
    expect(gold.streak.drawdownFromPeakPct).toBeCloseTo(-11.5, 1);
  });

  it('Gold year history: spans a full year and carries the real all-time peak (Rs 572,862, 29 Jan 2026)', () => {
    expect(GOLD_YEAR_HISTORY.length).toBe(14);

    // Ascending dates, spanning at least 360 days (Nov 2025 → Nov 2026)
    const first = GOLD_YEAR_HISTORY[0];
    const last = GOLD_YEAR_HISTORY[GOLD_YEAR_HISTORY.length - 1];
    const spanDays =
      (new Date(last.date + 'T00:00:00').getTime() - new Date(first.date + 'T00:00:00').getTime()) / 86400000;
    expect(spanDays).toBeGreaterThanOrEqual(360);
    for (let i = 1; i < GOLD_YEAR_HISTORY.length; i++) {
      expect(GOLD_YEAR_HISTORY[i].date > GOLD_YEAR_HISTORY[i - 1].date).toBe(true);
    }

    // The maximum is the APSGJA all-time peak — not the 30-day high
    const peak = GOLD_YEAR_HISTORY.reduce((a, b) => (b.price > a.price ? b : a), GOLD_YEAR_HISTORY[0]);
    expect(peak.price).toBe(572862);
    expect(peak.date).toBe('2026-01-29');

    // Final point agrees with the daily series' latest close
    expect(last.date).toBe('2026-11-24');
    expect(last.price).toBe(385436);

    // True drawdown from the all-time peak: about −32.7%
    const drawdown = ((last.price - peak.price) / peak.price) * 100;
    expect(drawdown).toBeCloseTo(-32.7, 1);
  });

  it('Silver 24k: Nov 24 close at Rs 4,687, down Rs 49 after the Nov 23 rebound', () => {
    const silver = METAL_ASSETS.find((m) => m.id === 'silver-24k');
    expect(silver).toBeDefined();
    if (!silver) return;

    expect(silver.currentPrice).toBe(4687);
    expect(silver.history.length).toBe(30);
    expect(silver.streak.currentStreak).toBe(-1);
    expect(silver.streak.isSipDipZone).toBe(false);
  });

  it('PSX_STOCKS: contains 18 realistic stocks with 30-day histories and valid streaks', () => {
    expect(PSX_STOCKS.length).toBe(18);

    const gradeAStocks = PSX_STOCKS.filter((s) => s.grade === 'A');
    expect(gradeAStocks.length).toBe(15);

    const traps = PSX_STOCKS.filter((s) => s.grade !== 'A');
    expect(traps.length).toBe(3);

    // Verify all yield traps have explicit warnings
    traps.forEach((trap) => {
      expect(trap.trapWarning).toBeDefined();
      expect(trap.trapWarning!.length).toBeGreaterThan(20);
    });

    // Check specific traps
    const nbp = PSX_STOCKS.find((s) => s.ticker === 'NBP');
    expect(nbp?.grade).toBe('C');
    expect(nbp?.dividendYieldPct).toBe(19.3); // 24 Nov 2026: DPS 35.00 one-off special / price 180.89
    expect(nbp?.trapWarning).toContain('pension litigation');

    const kapco = PSX_STOCKS.find((s) => s.ticker === 'KAPCO');
    expect(kapco?.grade).toBe('C');
    expect(kapco?.dividendYieldPct).toBe(11.1);
    expect(kapco?.trapWarning).toContain('PPA');

    const lotchem = PSX_STOCKS.find((s) => s.ticker === 'LOTCHEM');
    // Demoted B -> C in the 21 Nov 2026 fix round: at 20 Nov 2026 prices the
    // trailing yield is ~25% — a cyclical PTA-PX peak artifact, not a payout
    // rate. That is a yield trap by definition.
    expect(lotchem?.grade).toBe('C');
    expect(lotchem?.dividendYieldPct).toBe(25.2);
    expect(lotchem?.trapWarning).toContain('PTA-PX');
  });

  it('Shariah filter excludes MCB/HBL/UBL/BAHL/BAFL/INDU, retains FFC/HUBC/MEBL/POL/OGDC/PPL', () => {
    const shariahOnlyStocks = PSX_STOCKS.filter((s) => s.isShariah);
    const nonShariahStocks = PSX_STOCKS.filter((s) => !s.isShariah);

    const excludedTickers = ['MCB', 'HBL', 'UBL', 'BAHL', 'BAFL', 'INDU'];
    const retainedTickers = ['FFC', 'HUBC', 'MEBL', 'POL', 'OGDC', 'PPL', 'BIPL', 'MTL'];

    excludedTickers.forEach((t) => {
      expect(shariahOnlyStocks.some((s) => s.ticker === t)).toBe(false);
      expect(nonShariahStocks.some((s) => s.ticker === t)).toBe(true);
    });

    retainedTickers.forEach((t) => {
      expect(shariahOnlyStocks.some((s) => s.ticker === t)).toBe(true);
    });
  });

  it('PRESET_PROFILES contains all 3 required presets', () => {
    const junior = PRESET_PROFILES['junior-engineer'];
    expect(junior).toBeDefined();
    expect(junior.role).toBe('salaried');
    expect(junior.lumpSumPkr).toBe(0);
    expect(junior.monthlyInvestPkr).toBe(100000);
    expect(junior.shariahOnly).toBe(true);

    const lumpSum30 = PRESET_PROFILES['lump-sum-30lac'];
    expect(lumpSum30).toBeDefined();
    expect(lumpSum30.lumpSumPkr).toBe(3000000);
    expect(lumpSum30.monthlyInvestPkr).toBe(0);
    expect(lumpSum30.taxStatus).toBe('filer');

    const solarCommuter = PRESET_PROFILES['solar-commuter'];
    expect(solarCommuter).toBeDefined();
    expect(solarCommuter.solarKw).toBe(10);
    expect(solarCommuter.dailyCommuteKm).toBe(45);
    expect((solarCommuter as any).currentVehicleType).toBe('petrol-car');
  });
});

describe('Dividend Life Planner Engine (src/lib/engine/plannerEngine.ts)', () => {
  it('Rs 30 Lac Lump Sum: dividends on the 70% PSX sleeve — gross ~Rs 18.2k/mo, net filer ~Rs 15.5k/mo', () => {
    const profile = PRESET_PROFILES['lump-sum-30lac'].profile;
    const plan = calculateLifePlan(profile);

    // Data-driven conventional basket (top-8 grade-A yields, equal weight)
    // at 24 Nov 2026 prices blends to ~10.35%
    expect(plan.blendedGrossYieldPct).toBeGreaterThanOrEqual(10.0);
    expect(plan.blendedGrossYieldPct).toBeLessThanOrEqual(10.8);

    // Dividends are earned on the PSX sleeve only: 70% of Rs 30 lac =
    // Rs 21 lac at 10.4% -> ~Rs 18.2k/mo gross (bucket-aware engine,
    // NOTES #21; the old engine wrongly paid dividends on the full lump)
    expect(plan.initialMonthlyGrossDividendPkr).toBeGreaterThanOrEqual(17500);
    expect(plan.initialMonthlyGrossDividendPkr).toBeLessThanOrEqual(19000);

    // Net dividend for filer (15% WHT) ~Rs 15.5k/mo
    expect(plan.initialMonthlyNetDividendPkr).toBeGreaterThanOrEqual(14800);
    expect(plan.initialMonthlyNetDividendPkr).toBeLessThanOrEqual(16200);
  });

  it('Non-filer tax penalty is exactly double filer tax (30% vs 15%)', () => {
    const baseProfile = PRESET_PROFILES['lump-sum-30lac'].profile;
    const filerProfile: UserProfile = { ...baseProfile, taxStatus: 'filer' };
    const nonFilerProfile: UserProfile = { ...baseProfile, taxStatus: 'non-filer' };

    const filerPlan = calculateLifePlan(filerProfile);
    const nonFilerPlan = calculateLifePlan(nonFilerProfile);

    // Filer tax: 15%, Non-filer tax: 30%
    expect(filerPlan.taxRatePct).toBe(15);
    expect(nonFilerPlan.taxRatePct).toBe(30);

    const filerTaxMonthly =
      filerPlan.initialMonthlyGrossDividendPkr - filerPlan.initialMonthlyNetDividendPkr;
    const nonFilerTaxMonthly =
      nonFilerPlan.initialMonthlyGrossDividendPkr - nonFilerPlan.initialMonthlyNetDividendPkr;

    // Non-filer tax is exactly double filer tax
    expect(nonFilerTaxMonthly).toBeCloseTo(filerTaxMonthly * 2, -1);

    // Non-filer penalty is the excess tax
    expect(filerPlan.nonFilerTaxPenaltyYearlyPkr).toBeCloseTo(
      (nonFilerTaxMonthly - filerTaxMonthly) * 12,
      -2
    );
  });

  it('Emergency fund correctly targets 4 months of expenses and identifies gap', () => {
    const profile = PRESET_PROFILES['junior-engineer'].profile;
    const totalExpenses =
      profile.expenses.fuelAndCommute +
      profile.expenses.utilitiesAndInternet +
      profile.expenses.groceriesAndFood +
      profile.expenses.rentOrHousing +
      profile.expenses.familyAndOther; // 15 + 20 + 25 + 15 + 10 = 85k

    const plan = calculateLifePlan(profile);
    expect(plan.emergencyFundTargetPkr).toBe(totalExpenses * 4); // 340,000
    // Current reserve: 200,000 -> Gap: 140,000
    expect(plan.emergencyFundGapPkr).toBe(340000 - 200000);
  });

  it('12-Month Chunky Payout Calendar distributes dividends quarterly', () => {
    const profile = PRESET_PROFILES['lump-sum-30lac'].profile;
    const plan = calculateLifePlan(profile);

    expect(plan.monthlyPayoutCalendar.length).toBe(12);
    // Payouts arrive in chunky quarterly bursts, not flat every month
    const amounts = plan.monthlyPayoutCalendar.map((m) => m.amountPkr);
    const minAmount = Math.min(...amounts);
    const maxAmount = Math.max(...amounts);
    // There should be noticeable difference between high payout months (e.g. Mar/Aug) and others
    expect(maxAmount).toBeGreaterThan(minAmount);
  });

  it('Expense waterfall allocates monthly net dividend sequentially across 5 categories', () => {
    const profile = PRESET_PROFILES['lump-sum-30lac'].profile;
    const plan = calculateLifePlan(profile);

    expect(plan.expenseWaterfall.length).toBe(5);
    expect(plan.expenseWaterfall[0].label).toBe('Fuel & Commute');
    expect(plan.expenseWaterfall[1].label).toBe('Utilities & Internet');
    expect(plan.expenseWaterfall[2].label).toBe('Groceries & Food');
    expect(plan.expenseWaterfall[3].label).toBe('Rent / Housing');
    expect(plan.expenseWaterfall[4].label).toBe('Family & Other');

    // Total covered cannot exceed initial net monthly dividend
    const totalCovered = plan.expenseWaterfall.reduce((sum, step) => sum + step.coveredPkr, 0);
    expect(totalCovered).toBeLessThanOrEqual(plan.initialMonthlyNetDividendPkr + 1);
  });

  it('Solar EV swap math: with 10 kW solar, car daily charge is 100% free; saves Rs 22/km vs petrol', () => {
    const profile = PRESET_PROFILES['solar-commuter'].profile;
    const plan = calculateLifePlan(profile);

    // Honri Ve 2.0 EV
    const honri2 = (plan as any).vehicleSwaps.find((v: any) => v.name === 'Honri Ve 2.0 EV');
    expect(honri2).toBeDefined();
    if (!honri2) return;

    // 10 kW solar produces surplus 30 kWh/day (10*4.2 - 12 = 30), whereas 45 km requires 6.3 kWh (0.14*45)
    // Charging is 100% free
    expect(honri2.solarChargingFree).toBe(true);
    expect(honri2.runningCostPerKmPkr).toBe(0);

    // Baseline petrol car is Rs 22/km. Running cost is Rs 0/km -> Saves Rs 22/km
    // Monthly fuel savings: 45 km * 30 days * Rs 22/km = Rs 29,700/mo
    expect(honri2.monthlyFuelSavingsPkr).toBe(29700);

    // Resale value of existing petrol car is Rs 3.8M, Honri 2.0 price is Rs 3.599M
    // Net cash freed up = 3,599,000 - 3,800,000 = -201,000 (negative means cash freed)
    expect(honri2.netCashRequiredOrFreedPkr).toBe(-201000);
    expect(honri2.paybackMonths).toBe(0);

    // Extra monthly dividend + fuel savings is positive
    expect(honri2.extraMonthlyDividendFromSwapPkr).toBeGreaterThan(29700);
  });
});

describe('Phase 2: Privacy Masking & Format Extensions', () => {
  it('maskAmount masks amounts when isHidden is true and preserves formatted text when false', () => {
    expect(maskAmount('Rs 379,836', false)).toBe('Rs 379,836');
    expect(maskAmount('Rs 379,836', true)).toBe('Rs •••••');
    expect(maskAmount('-Rs 15,400', true)).toBe('-Rs •••••');
    expect(maskAmount('$ 1,350', true)).toBe('$ •••••');
    expect(maskAmount('14.2 tolas', true)).toBe('••••• tolas');
    expect(maskAmount('30.0 Lac', true)).toBe('•••••');
  });

  it('formatPkr with compact option formats appropriately', () => {
    expect(formatPkr(3000000, { compact: true })).toBe('Rs 30.0 Lac');
    expect(formatPkr(12500000, { compact: true })).toBe('Rs 1.25 Cr');
    expect(formatPkr(3000000, { compact: true, showRs: false })).toBe('30.0 Lac');
    expect(formatPkr(3000000, { hidden: true })).toBe('Rs •••••');
  });

  it('formatUsd and formatTolas handle standard and hidden formatting', () => {
    expect(formatUsd(1350)).toBe('$ 1,350');
    expect(formatUsd(1350, { hidden: true })).toBe('$ •••••');
    expect(formatTolas(14.2)).toBe('14.2 tolas');
    expect(formatTolas(14.2, { hidden: true })).toBe('••••• tolas');
  });
});

describe('Phase 2: Safe State URL Serialization & Prototype Pollution Defense', () => {
  it('roundtrips a profile via URL hash safely', () => {
    const original = PRESET_PROFILES['junior-engineer'].profile;
    const hash = encodeProfileToHash(original);
    expect(hash).toContain('#plan=');

    const decoded = decodeProfileFromHash(hash, original);
    expect(decoded).toBeDefined();
    expect(decoded?.monthlyIncomePkr).toBe(original.monthlyIncomePkr);
    expect(decoded?.age).toBe(original.age);
    expect(decoded?.shariahOnly).toBe(original.shariahOnly);
  });

  it('sanitizes and strips prototype pollution attempts and clamps invalid values', () => {
    const maliciousPayload = JSON.parse(`{
      "__proto__": { "polluted": true },
      "constructor": { "prototype": { "polluted": true } },
      "age": 9999,
      "monthlyIncomePkr": -50000,
      "role": "hacker"
    }`);

    const fallback = PRESET_PROFILES['junior-engineer'].profile;
    const cleaned = sanitizeProfile(maliciousPayload, fallback);

    expect((cleaned as any).polluted).toBeUndefined();
    expect((Object.prototype as any).polluted).toBeUndefined();
    // Clamped age
    expect(cleaned.age).toBeLessThanOrEqual(85);
    // Clamped income
    expect(cleaned.monthlyIncomePkr).toBe(0);
    // Fallback role for invalid input
    expect(cleaned.role).toBe(fallback.role);
  });
});

describe('Phase 2: Car Decision Map 5-Year TCO Engine', () => {
  it('evaluates 5-year TCO with non-zero solar charging opportunity cost, depreciation, and opportunity cost', () => {
    const profile = PRESET_PROFILES['solar-commuter'].profile;
    const decision = evaluateCarDecision(profile);

    expect(decision.results.length).toBeGreaterThan(0);
    expect(decision.cheapestVehicleId).toBeDefined();
    expect(decision.verdictSentence).toContain('TCO');

    // Solar tariff opportunity cost is modeled (e.g. Rs 26/kWh under net-metering-legacy)
    expect(decision.effectiveSolarRatePerKwh).toBe(26);

    // Verify 5-step waterfall for the cheapest vehicle
    const best = decision.results.find((r) => r.vehicleId === decision.cheapestVehicleId);
    expect(best).toBeDefined();
    if (!best) return;

    expect(best.waterfall.length).toBe(5);
    expect(best.waterfall[0].label).toContain('Charging');
    expect(best.waterfall[1].label).toContain('Depreciation');
    expect(best.waterfall[2].label).toContain('Maintenance');
    expect(best.waterfall[3].label).toContain('Financing');
    expect(best.waterfall[4].label).toContain('Opportunity Cost');

    // Distance crossover series spans 5 to 100 km/day
    expect(decision.crossoverSeries.length).toBe(20);
    expect(decision.crossoverSeries[0].kmPerDay).toBe(5);
    expect(decision.crossoverSeries[19].kmPerDay).toBe(100);
  });

  it('flags incomplete EMI quotes when required financing fields are missing', () => {
    const base = PRESET_PROFILES['junior-engineer'].profile;
    const profileWithIncompleteQuote: UserProfile = {
      ...base,
      vehicles: [
        {
          id: 'partial-emi-car',
          name: 'Partial EMI Car',
          fuelType: 'petrol',
          pricePkr: 2000000,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 40000,
          emiQuote: {
            enabled: true,
            downPaymentPkr: 500000,
            monthlyInstallmentPkr: 0, // Missing installment!
            tenureMonths: 36,
          },
        },
      ],
    };

    const decision = evaluateCarDecision(profileWithIncompleteQuote);
    expect(decision.results[0].isQuoteIncomplete).toBe(true);
  });
});

describe('Phase 2: WealthFlow Multi-Asset Compounding & Life Goals Engine', () => {
  it('calculates final wealth deflated into Today PKR, USD, Gold Tolas, and 4% monthly income', () => {
    const profile = PRESET_PROFILES['junior-engineer'].profile;
    const plan = calculateLifePlan(profile);

    expect(plan.finalNominalWealthPkr).toBeGreaterThan(0);
    expect(plan.finalRealTodaysPkr).toBeGreaterThan(0);
    expect(plan.finalWealthUsd).toBeGreaterThan(0);
    expect(plan.finalWealthGoldTolas).toBeGreaterThan(0);

    // 4% safe withdrawal rule: monthly income = (Final Real Wealth * 0.04) / 12
    const expectedIncome = Math.round((plan.finalRealTodaysPkr * 0.04) / 12);
    expect(plan.safeMonthlyIncome4PctTodaysPkr).toBeCloseTo(expectedIncome, -1);
  });

  it('models dated life goals as real withdrawals with true opportunity cost at retirement', () => {
    const profile = PRESET_PROFILES['junior-engineer'].profile;
    const plan = calculateLifePlan(profile);

    expect(plan.goalOutcomes.length).toBe(2);

    const wedding = plan.goalOutcomes.find((g) => g.name === 'Wedding Ceremony');
    expect(wedding).toBeDefined();
    if (!wedding) return;

    expect(wedding.targetAge).toBe(28);
    // Inflated cost must be higher than base cost of Rs 2.5M after 4 years of 8% inflation
    expect(wedding.inflatedCostPkr).toBeGreaterThan(2500000);
    // Opportunity cost at retirement must be significantly higher than inflated cost
    expect(wedding.trueOpportunityCostAtRetirementPkr).toBeGreaterThan(wedding.inflatedCostPkr);
  });
});

describe('Phase 3: Asset Split Normalization & Car Savings Bridge', () => {
  it('normalizeAssetSplits normalizes percentages cleanly to sum to exactly 100%', () => {
    const buckets: AssetBucket[] = [
      { id: 'psx-dividends', label: 'Equities', currentValuePkr: 0, monthlySplitPct: 40, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: 'Gold', currentValuePkr: 0, monthlySplitPct: 30, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate', currentValuePkr: 0, monthlySplitPct: 10, expectedAnnualReturnPct: 13 },
    ];
    // Sum is 80% -> normalize to 100%
    const normalized = normalizeAssetSplits(buckets);
    const sum = normalized.reduce((acc, b) => acc + b.monthlySplitPct, 0);
    expect(Math.round(sum)).toBe(100);
    expect(normalized[0].monthlySplitPct).toBe(50);
    expect(normalized[1].monthlySplitPct).toBe(37.5);
    expect(normalized[2].monthlySplitPct).toBe(12.5);
  });

  it('normalizeAssetSplits handles all zero percentages by distributing evenly to 100%', () => {
    const buckets: AssetBucket[] = [
      { id: 'psx-dividends', label: 'Equities', currentValuePkr: 0, monthlySplitPct: 0, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: 'Gold', currentValuePkr: 0, monthlySplitPct: 0, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate', currentValuePkr: 0, monthlySplitPct: 0, expectedAnnualReturnPct: 13 },
    ];
    const normalized = normalizeAssetSplits(buckets);
    const sum = normalized.reduce((acc, b) => acc + b.monthlySplitPct, 0);
    expect(Math.round(sum)).toBe(100);
  });

  it('applyCarSavingsToPlan bridges winning car decision into wealth plan', () => {
    const profile = PRESET_PROFILES['junior-engineer'].profile;
    const carDecision = evaluateCarDecision(profile);

    const winning = carDecision.results[0];
    const baseline = carDecision.results.find((r) => r.vehicleId === 'owned-bike') || carDecision.results[0];

    const updated = applyCarSavingsToPlan(profile, winning, baseline);
    expect(updated).toBeDefined();
    expect(updated.lumpSumPkr).toBeGreaterThanOrEqual(profile.lumpSumPkr);
    expect(updated.monthlyInvestPkr).toBeGreaterThanOrEqual(profile.monthlyInvestPkr);
    expect(typeof updated.monthsShavedOffFreedom).toBe('number');
  });
});

describe('Phase 3: PSX Execution Sheet & Dip-Buy Strategy Simulator', () => {
  it('calculateExecutionSheet computes exact whole shares, 0.25% fee, and remainder', () => {
    const allocations = [
      { stock: PSX_STOCKS.find((s) => s.ticker === 'FFC')!, weightPct: 60 },
      { stock: PSX_STOCKS.find((s) => s.ticker === 'HUBC')!, weightPct: 40 },
    ];
    const sheet = calculateExecutionSheet(allocations, 1000000); // Rs 10 Lac

    expect(sheet.items.length).toBe(2);
    expect(sheet.totalTargetPkr).toBe(1000000);
    expect(sheet.totalSpentPkr).toBeGreaterThan(950000);
    expect(sheet.totalFeesPkr).toBeGreaterThan(0);
    // Total spent + fees must never exceed target budget
    expect(sheet.totalSpentPkr + sheet.totalFeesPkr).toBeLessThanOrEqual(1000000);

    const ffc = sheet.items.find((i) => i.ticker === 'FFC');
    expect(ffc).toBeDefined();
    if (!ffc) return;

    // Shares must be a non-negative whole integer
    expect(Number.isInteger(ffc.shares)).toBe(true);
    expect(ffc.shares).toBeGreaterThan(0);
    expect(ffc.actualSpentPkr).toBe(ffc.shares * ffc.price);
    // Fee is ~0.25% of spent
    expect(ffc.feePkr).toBeCloseTo(ffc.actualSpentPkr * 0.0025, -1);
  });

  it('simulateDipStrategy compares DCA vs buying on red dip zones', () => {
    const ffc = PSX_STOCKS.find((s) => s.ticker === 'FFC')!;
    const sim = simulateDipStrategy(ffc, 50000, 6);

    expect(sim.dcaShares).toBeGreaterThan(0);
    expect(sim.dipShares).toBeGreaterThan(0);
    expect(sim.dcaAvgCost).toBeGreaterThan(0);
    expect(sim.dipAvgCost).toBeGreaterThan(0);
    expect(sim.verdict).toBeDefined();
    expect(sim.verdict.length).toBeGreaterThan(10);
  });
});

describe('Phase 3: Live & Custom Market Rates Layer', () => {
  it('heals exact stale seed values and leaves deliberate user values untouched', async () => {
    const { migrateStaleSeedValues, DEFAULT_MARKET_RATES } = await import('@/lib/marketRates');
    const healed = migrateStaleSeedValues({
      petrolPricePerLitre: 265,
      goldPerTolaPkr: 385000,
      usdToPkr: 276.28,
      gridRatePerKwh: 55,
    });
    expect(healed.petrolPricePerLitre).toBe(DEFAULT_MARKET_RATES.petrolPricePerLitre);
    expect(healed.goldPerTolaPkr).toBe(DEFAULT_MARKET_RATES.goldPerTolaPkr);
    expect(healed.usdToPkr).toBe(DEFAULT_MARKET_RATES.usdToPkr);
    expect(healed.gridRatePerKwh).toBe(55);
    // The superseded 21 Nov gold default also heals to the new default
    const healedPrevGold = migrateStaleSeedValues({ goldPerTolaPkr: 379836 });
    expect(healedPrevGold.goldPerTolaPkr).toBe(DEFAULT_MARKET_RATES.goldPerTolaPkr);
    // The superseded 22 Nov gold default heals too
    const healedPrevGold2 = migrateStaleSeedValues({ goldPerTolaPkr: 376336 });
    expect(healedPrevGold2.goldPerTolaPkr).toBe(DEFAULT_MARKET_RATES.goldPerTolaPkr);
    // The superseded 23 Nov gold default heals too
    const healedPrevGold3 = migrateStaleSeedValues({ goldPerTolaPkr: 384136 });
    expect(healedPrevGold3.goldPerTolaPkr).toBe(DEFAULT_MARKET_RATES.goldPerTolaPkr);
    // The superseded 23 Nov USD default heals too
    const healedPrevUsd = migrateStaleSeedValues({ usdToPkr: 276.51 });
    expect(healedPrevUsd.usdToPkr).toBe(DEFAULT_MARKET_RATES.usdToPkr);
    const custom = migrateStaleSeedValues({ petrolPricePerLitre: 330 });
    expect(custom.petrolPricePerLitre).toBe(330);
    // The superseded 21–23 Nov petrol default heals to the new default
    const healedPrevPetrol = migrateStaleSeedValues({ petrolPricePerLitre: 322 });
    expect(healedPrevPetrol.petrolPricePerLitre).toBe(DEFAULT_MARKET_RATES.petrolPricePerLitre);
    // The superseded 24 Nov petrol default heals to the new default
    const healedPrevPetrol2 = migrateStaleSeedValues({ petrolPricePerLitre: 319 });
    expect(healedPrevPetrol2.petrolPricePerLitre).toBe(DEFAULT_MARKET_RATES.petrolPricePerLitre);
  });

  it('returns default Nov 24 2026 Pakistan economic defaults', () => {
    const rates = getDefaultMarketRates();
    expect(rates.petrolPricePerLitre).toBe(318); // OGRA notification 24 Nov 2026, effective 25 Nov
    expect(rates.goldPerTolaPkr).toBe(385436); // APSGJA Tue 24 Nov 2026 close, verified 24 Nov 2026
    expect(rates.usdToPkr).toBe(276.47); // SBP M2M revaluation rate, 24 Nov 2026
    expect(rates.gridRatePerKwh).toBe(55);
    expect(rates.kse100Index).toBe(178542);
    expect(rates.solarNetMeteringLegacyRate).toBe(26);
    expect(rates.solarNetBilling2026Rate).toBe(11);
  });

  it('applies custom market rates into user profile cleanly', () => {
    const profile = PRESET_PROFILES['junior-engineer'].profile;
    const customRates = {
      ...getDefaultMarketRates(),
      petrolPricePerLitre: 350,
      usdToPkr: 285.0,
      goldPerTolaPkr: 400000,
    };

    const updatedProfile = applyRatesToProfile(profile, customRates);
    expect(updatedProfile.petrolPricePerLitre).toBe(350);
    expect(updatedProfile.usdToPkr).toBe(285.0);
    expect(updatedProfile.goldPerTolaPkr).toBe(400000);
  });
});

describe('NOTES #23: decimal splits, holdings, liabilities, EV car', () => {
  it('liabilities widen the emergency-fund gap rupee-for-rupee (Splitwise example)', () => {
    const base = PRESET_PROFILES['junior-engineer'].profile;
    const basePlan = calculateLifePlan(base);
    expect(totalLiabilitiesPkr(base)).toBe(0);
    expect(netLiquidReservePkr(base)).toBe(base.currentCashReservePkr);

    const withDebt: UserProfile = {
      ...base,
      liabilities: [{ id: 'l1', label: 'Splitwise balance owed', amountPkr: 3544611 }],
    };
    expect(totalLiabilitiesPkr(withDebt)).toBe(3544611);
    expect(netLiquidReservePkr(withDebt)).toBe(base.currentCashReservePkr - 3544611);

    const debtPlan = calculateLifePlan(withDebt);
    expect(debtPlan.emergencyFundGapPkr).toBe(basePlan.emergencyFundGapPkr + 3544611);
    // Nothing else in the plan moves: liabilities are a position, not an investment
    expect(debtPlan.finalNominalWealthPkr).toBe(basePlan.finalNominalWealthPkr);
  });

  it('decimal bucket splits (12.7/30.7/42.1/7.7/6.8) drive the PSX sleeve exactly', () => {
    const base = PRESET_PROFILES['junior-engineer'].profile;
    const mkBuckets = (psxPct: number): AssetBucket[] => [
      { id: 'psx-dividends', label: 'PSX Dividend Equities', currentValuePkr: 0, monthlySplitPct: psxPct, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: '24K Physical Gold', currentValuePkr: 0, monthlySplitPct: 30.7, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate / Land', currentValuePkr: 0, monthlySplitPct: 42.1, expectedAnnualReturnPct: 13 },
      { id: 'money-market', label: 'Shariah / Money Market', currentValuePkr: 0, monthlySplitPct: 7.7, expectedAnnualReturnPct: 11 },
      { id: 'cash', label: 'Cash Reserve / Bank Balance', currentValuePkr: 0, monthlySplitPct: 6.8, expectedAnnualReturnPct: 8 },
    ];

    const decimalPlan = calculateLifePlan({ ...base, lumpSumPkr: 3000000, assetBuckets: mkBuckets(12.7) });
    // Comparison profile: PSX at 50% with the other buckets scaled to keep
    // the total at 100 (the engine normalizes non-100 sums, which would
    // change the effective share and invalidate the ratio).
    const fiftyBuckets: AssetBucket[] = [
      { id: 'psx-dividends', label: 'PSX Dividend Equities', currentValuePkr: 0, monthlySplitPct: 50, expectedAnnualReturnPct: 14 },
      { id: 'gold', label: '24K Physical Gold', currentValuePkr: 0, monthlySplitPct: 20, expectedAnnualReturnPct: 12 },
      { id: 'real-estate', label: 'Real Estate / Land', currentValuePkr: 0, monthlySplitPct: 15, expectedAnnualReturnPct: 13 },
      { id: 'money-market', label: 'Shariah / Money Market', currentValuePkr: 0, monthlySplitPct: 10, expectedAnnualReturnPct: 11 },
      { id: 'cash', label: 'Cash Reserve / Bank Balance', currentValuePkr: 0, monthlySplitPct: 5, expectedAnnualReturnPct: 8 },
    ];
    const fiftyPlan = calculateLifePlan({ ...base, lumpSumPkr: 3000000, assetBuckets: fiftyBuckets });

    // Dividends scale with the PSX sleeve share: 12.7 / 50 = 0.254
    const ratio = decimalPlan.initialMonthlyGrossDividendPkr / fiftyPlan.initialMonthlyGrossDividendPkr;
    expect(ratio).toBeCloseTo(0.254, 2);
    expect(decimalPlan.timeline.length).toBeGreaterThan(0);
    expect(decimalPlan.timeline.every((p) => Number.isFinite(p.nominalPortfolioPkr))).toBe(true);
  });

  it('sanitizeProfile preserves itemised holdings and liabilities, clamped', () => {
    const fallback = PRESET_PROFILES['junior-engineer'].profile;
    const cleaned = sanitizeProfile(
      {
        ...fallback,
        holdings: [
          { id: 'h1', kind: 'gold', label: '21K jewellery', valuePkr: 2400000, quantity: 7.2, unitLabel: 'tola', unitPricePkr: 333333, purityKarat: 21, details: 'Bridal set' },
          { id: 'h2', kind: 'fund', label: 'KMIF', valuePkr: 850000, quantity: 10200, unitLabel: 'units', unitPricePkr: 83.3 },
          { id: 'h3', kind: 'spaceship', label: 'Bad kind', valuePkr: -50 },
        ],
        liabilities: [
          { id: 'l1', label: 'Splitwise balance owed', amountPkr: 3544611 },
          { id: 'l2', label: 'Negative nonsense', amountPkr: -100 },
        ],
      },
      fallback
    );

    expect(cleaned.holdings?.length).toBe(3);
    expect(cleaned.holdings?.[0].purityKarat).toBe(21);
    expect(cleaned.holdings?.[0].quantity).toBe(7.2);
    expect(cleaned.holdings?.[1].unitPricePkr).toBe(83.3);
    expect(cleaned.holdings?.[2].kind).toBe('other'); // unknown kind coerced
    expect(cleaned.holdings?.[2].valuePkr).toBe(0); // negative clamped
    expect(totalHoldingsPkr(cleaned)).toBe(3250000);

    expect(cleaned.liabilities?.length).toBe(2);
    expect(cleaned.liabilities?.[0].amountPkr).toBe(3544611);
    expect(cleaned.liabilities?.[1].amountPkr).toBe(0);
  });

  it('an EV car (Nissan Leaf class) gets real charging costs, not petrol math', () => {
    const base = PRESET_PROFILES['solar-commuter'].profile;
    const leafProfile: UserProfile = {
      ...base,
      dailyCommuteKm: 25,
      solarKw: 0,
      solarTariffMode: 'none',
      gridRatePerKwh: 55,
      vehicles: [
        {
          id: 'leaf',
          name: 'Nissan Leaf',
          fuelType: 'ev',
          pricePkr: 6000000,
          isCurrentVehicle: true,
          kwhPer100Km: 16.5,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 35000,
        },
      ],
    };
    const decision = evaluateCarDecision(leafProfile);
    const leaf = decision.results.find((r) => r.vehicleId === 'leaf');
    expect(leaf).toBeDefined();
    // 25 km/day × 1825 days = 45,625 km → 456.25 × 16.5 kWh × Rs 55 grid
    expect(leaf!.fiveYearFuelOrChargePkr).toBeCloseTo(414047, -2);
    expect(leaf!.totalFiveYearCostPkr).toBeGreaterThan(leaf!.fiveYearFuelOrChargePkr);
  });
});

describe('NOTES #25: formatPkrWords input hints', () => {
  it('spells amounts in Lac / Crore / Arab exactly as users say them', () => {
    expect(formatPkrWords(100000)).toBe('1 Lac');
    expect(formatPkrWords(1000000)).toBe('10 Lac');
    expect(formatPkrWords(10000000)).toBe('1 Crore');
    expect(formatPkrWords(12500000)).toBe('1 Crore 25 Lac');
    expect(formatPkrWords(10000000000)).toBe('10 Arab');
    expect(formatPkrWords(3544611)).toBe('35 Lac 44 Thousand 611');
    expect(formatPkrWords(300000)).toBe('3 Lac');
    expect(formatPkrWords(25000)).toBe('25 Thousand');
  });

  it('stays silent where digits are already easy to read', () => {
    expect(formatPkrWords(0)).toBe('');
    expect(formatPkrWords(500)).toBe('');
    expect(formatPkrWords(999)).toBe('');
    expect(formatPkrWords(NaN)).toBe('');
  });

  it('marks negatives (a debt entered as a negative reserve)', () => {
    expect(formatPkrWords(-750000)).toBe('−7 Lac 50 Thousand');
  });
});

describe('NOTES #27: AI prediction registry (pure)', () => {
  it('builds prompts that carry the field context', () => {
    const p = PREDICTIONS['car-depreciation'].buildPrompt({
      name: 'Nissan Leaf 40kWh EV',
      fuelType: 'ev',
      pricePkr: 4800000,
    });
    expect(p).toContain('Nissan Leaf');
    expect(p).toContain('4800000');
    expect(p).toContain('LOSE');
  });

  it('clamps predictions into sane ranges', () => {
    expect(clampPrediction('car-depreciation', 140)).toBe(90);
    expect(clampPrediction('car-depreciation', -3)).toBe(5);
    expect(clampPrediction('car-efficiency', 13.37)).toBe(13.4);
    expect(clampPrediction('bucket-return', 12.34)).toBe(12.3);
  });

  it('parses model JSON, tolerates fences and swaps a reversed range', () => {
    const ok = parsePrediction(
      'car-maintenance',
      '{"value": 42000, "reasoning": "Leaf has minimal moving parts.", "confidence": "high"}'
    );
    expect(ok?.value).toBe(42000);
    expect(ok?.confidence).toBe('high');

    const range = parsePrediction(
      'stock-outlook',
      '```json\n{"value": 700, "valueHigh": 550, "reasoning": "range", "confidence": "low"}\n```'
    );
    expect(range?.value).toBe(550);
    expect(range?.valueHigh).toBe(700);

    expect(parsePrediction('car-price', 'not json at all')).toBeNull();
    expect(parsePrediction('car-price', '{"value": "abc"}')).toBeNull();
  });

  it('recognises only registered prediction types', () => {
    expect(isPredictionType('car-depreciation')).toBe(true);
    expect(isPredictionType('delete-everything')).toBe(false);
    expect(isPredictionType(42)).toBe(false);
  });
});

describe('Round 2 Engine Math & Sanitizer Hardening Verification', () => {
  it('FIX-1.2: compounds gold-only asset bucket with closed-form P*(1+r)^t, zero PSX dividends and zero PSX pot', () => {
    const base = PRESET_PROFILES['junior-engineer'].profile;
    const goldProfile: UserProfile = {
      ...base,
      age: 30,
      retirementAge: 40,
      lumpSumPkr: 1_000_000,
      monthlyInvestPkr: 0,
      annualSalaryRaisePct: 0,
      annualInflationPct: 0,
      includeZakat: false,
      lifeGoals: [],
      assetBuckets: [
        {
          id: 'gold',
          label: '24K Physical Gold',
          currentValuePkr: 1_000_000,
          monthlySplitPct: 100,
          expectedAnnualReturnPct: 10,
        },
      ],
    };

    const plan = calculateLifePlan(goldProfile);
    expect(plan.initialMonthlyGrossDividendPkr).toBe(0);
    expect(plan.initialMonthlyNetDividendPkr).toBe(0);
    expect(plan.monthlyPayoutCalendar.every((m) => m.amountPkr === 0)).toBe(true);

    // 10 years at 10% annual return: P_t = 1,000,000 * (1.10)^t
    expect(plan.timeline).toHaveLength(10);
    for (let t = 1; t <= 10; t++) {
      const point = plan.timeline[t - 1];
      const expectedNominal = Math.round(1_000_000 * Math.pow(1.10, t));
      expect(point.nominalPortfolioPkr).toBe(expectedNominal);
      expect(point.monthlyNetDividendPkr).toBe(0);
    }
    // At year 10: 1,000,000 * (1.1)^10 = 2,593,742
    expect(plan.finalNominalWealthPkr).toBe(2593742);
    expect(plan.finalRealTodaysPkr).toBe(2593742);
  });

  it('FIX-1.3: deducts 2.5% Zakat annually from wealth across 3 years with hand-computed closed-form verification', () => {
    const base = PRESET_PROFILES['junior-engineer'].profile;
    const profileZakatOff: UserProfile = {
      ...base,
      age: 30,
      retirementAge: 33, // 3 years -> clamped to minimum 10 simulation years
      lumpSumPkr: 1_000_000,
      monthlyInvestPkr: 0,
      annualSalaryRaisePct: 0,
      annualInflationPct: 0,
      includeZakat: false,
      taxStatus: 'filer',
      lifeGoals: [],
      assetBuckets: [
        {
          id: 'gold',
          label: '24K Physical Gold',
          currentValuePkr: 1_000_000,
          monthlySplitPct: 100,
          expectedAnnualReturnPct: 10,
        },
      ],
    };

    const profileZakatOn: UserProfile = {
      ...profileZakatOff,
      includeZakat: true,
    };

    const planOff = calculateLifePlan(profileZakatOff);
    const planOn = calculateLifePlan(profileZakatOn);

    // Hand-computed step-by-step for 10% annual return and 2.5% annual Zakat deduction:
    // Year 0: 1,000,000
    // Year 1:
    //   Before Zakat: 1,000,000 * 1.10 = 1,100,000
    //   Zakat (2.5%): 1,100,000 * 0.025 = 27,500
    //   After Zakat:  1,100,000 - 27,500 = 1,072,500
    expect(planOff.timeline[0].nominalPortfolioPkr).toBe(1100000);
    expect(planOn.timeline[0].nominalPortfolioPkr).toBe(1072500);

    // Year 2:
    //   Before Zakat: 1,072,500 * 1.10 = 1,179,750
    //   Zakat (2.5%): 1,179,750 * 0.025 = 29,493.75
    //   After Zakat:  1,179,750 - 29,493.75 = 1,150,256.25 -> rounded: 1,150,256
    expect(planOff.timeline[1].nominalPortfolioPkr).toBe(1210000);
    expect(planOn.timeline[1].nominalPortfolioPkr).toBe(1150256);

    // Year 3:
    //   Before Zakat: 1,150,256.25 * 1.10 = 1,265,281.875
    //   Zakat (2.5%): 1,265,281.875 * 0.025 = 31,632.046875
    //   After Zakat:  1,265,281.875 - 31,632.046875 = 1,233,649.828125 -> rounded: 1,233,650
    expect(planOff.timeline[2].nominalPortfolioPkr).toBe(1331000);
    expect(planOn.timeline[2].nominalPortfolioPkr).toBe(1233650);

    // Net dividend retention rate is based on 1 - taxRate only (not reduced by zakat)
    expect(planOn.taxRatePct).toBe(15);
  });

  it('FIX-1.4: simulateDipStrategy executes at first 3-day red streak close without hindsight look-ahead bias', () => {
    // Crafted price history in a single 6-day window:
    // Day 0: 100
    // Day 1: 95 (down 1)
    // Day 2: 90 (down 2)
    // Day 3: 85 (down 3) <- First close completing >= 3-day down streak! Executable rule MUST buy here @ 85.
    // Day 4: 70 (down 4) <- Lower price
    // Day 5: 50 (down 5) <- Lowest price in window (50). Hindsight reduce(min) would have bought here.
    const mockStock: PsxStock = {
      ticker: 'TEST',
      name: 'Test Stock',
      sector: 'Test',
      price: 50,
      dividendYieldPct: 10,
      payoutMonths: [3, 6, 9, 12],
      isShariah: true,
      grade: 'A',
      gradeReason: 'Test',
      beginnerSummary: 'Test',
      history: [
        { date: '2026-11-01', price: 100 },
        { date: '2026-11-02', price: 95 },
        { date: '2026-11-03', price: 90 },
        { date: '2026-11-04', price: 85 },
        { date: '2026-11-05', price: 70 },
        { date: '2026-11-06', price: 50 },
      ],
      streak: {
        currentStreak: -5,
        longestUpStreak: 0,
        longestDownStreak: 5,
        changeToday: -20,
        changeTodayPct: -28.57,
        drawdownFromPeakPct: -50,
        isSipDipZone: true,
      },
    };

    // Run 1-month simulation with Rs 85,000 budget
    const sim = simulateDipStrategy(mockStock, 85000, 1);
    // DCA buys at day 0 (price: 100) -> 850 shares
    expect(sim.dcaShares).toBe(850);
    expect(sim.dcaAvgCost).toBe(100);

    // Executable Dip Strategy buys at Day 3 (price: 85) -> exactly 1000 shares!
    // If it had look-ahead bias (bought at minimum day 5 @ 50), it would have bought 1700 shares.
    expect(sim.dipShares).toBe(1000);
    expect(sim.dipAvgCost).toBe(85);

    // Short history (length 3 < safeMonths 6): reduces windowCount to 3 instead of repeatedly buying last day
    const shortStock: PsxStock = {
      ...mockStock,
      history: [
        { date: '2026-11-01', price: 100 },
        { date: '2026-11-02', price: 95 },
        { date: '2026-11-03', price: 90 },
      ],
    };
    const shortSim = simulateDipStrategy(shortStock, 10000, 6);
    expect(shortSim.dcaShares).toBeGreaterThan(0);
    // 3 distinct windows bought 10000/100=100, 10000/95=105, 10000/90=111 -> 316 shares
    expect(shortSim.dcaShares).toBe(100 + 105 + 111);
  });

  it('FIX-2.7: evaluates 0% down-payment financing as valid and prorates interest for 84-month tenure', () => {
    const base = PRESET_PROFILES['solar-commuter'].profile;
    const testVehicles: VehicleCandidate[] = [
      {
        id: 'zero-down-car',
        name: 'Zero Down 100% Financed Car',
        fuelType: 'petrol',
        pricePkr: 3_000_000,
        kmPerLitre: 14,
        fiveYearDepreciationPct: 35,
        annualMaintenancePkr: 50000,
        emiQuote: {
          enabled: true,
          downPaymentPkr: 0, // 100% financing
          monthlyInstallmentPkr: 70000,
          tenureMonths: 60,
        },
      },
      {
        id: 'eighty-four-month-car',
        name: '84-Month Financed Car',
        fuelType: 'petrol',
        pricePkr: 3_000_000,
        kmPerLitre: 14,
        fiveYearDepreciationPct: 35,
        annualMaintenancePkr: 50000,
        emiQuote: {
          enabled: true,
          downPaymentPkr: 600000,
          monthlyInstallmentPkr: 50000,
          tenureMonths: 84, // 7-year loan (>60 months)
        },
      },
    ];

    const decision = evaluateCarDecision({ ...base, vehicles: testVehicles });
    const zeroDown = decision.results.find((r) => r.vehicleId === 'zero-down-car')!;
    const longTenure = decision.results.find((r) => r.vehicleId === 'eighty-four-month-car')!;

    // 1. Zero down payment quote is COMPLETE, not incomplete
    expect(zeroDown.isQuoteIncomplete).toBe(false);
    // Total paid = 0 + 70000 * 60 = 4,200,000 -> interest = 1,200,000
    expect(zeroDown.fiveYearBankInterestPkr).toBe(1200000);
    // Opportunity cost on 0 equity tied up is 0
    expect(zeroDown.fiveYearOpportunityCostPkr).toBe(0);

    // 2. 84-month loan: total interest = 600000 + 50000 * 84 - 3000000 = 1,800,000
    // Prorated to 60 months: 1,800,000 * (60 / 84) = 1,285,714.28... -> 1285714
    expect(longTenure.isQuoteIncomplete).toBe(false);
    expect(longTenure.fiveYearBankInterestPkr).toBe(1285714);
  });

  it('FIX-3.1: parses booleans strictly and round-trips owner golden fixture field-for-field unchanged', () => {
    const fallback = PRESET_PROFILES['junior-engineer'].profile;

    // 1. Strict boolean parsing defense
    const strictClean = sanitizeProfile(
      {
        shariahOnly: 'false',
        includeZakat: 'false',
        reinvestDividends: 'false',
        inflationAdjusted: 'false',
        isBreadwinner: 'false',
      },
      fallback
    );
    expect(strictClean.shariahOnly).toBe(false);
    expect(strictClean.includeZakat).toBe(false);
    expect(strictClean.reinvestDividends).toBe(false);
    expect(strictClean.inflationAdjusted).toBe(false);
    expect(strictClean.isBreadwinner).toBe(false);

    // 2. Owner's golden fixture round-trips field-for-field unchanged
    const fixtureRaw = {
      age: 29,
      role: 'freelancer' as const,
      gender: 'male' as const,
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
          id: 'alsvin-petrol',
          name: 'Changan Alsvin 1.3L Petrol',
          fuelType: 'petrol' as const,
          pricePkr: 3800000,
          kmPerLitre: 14,
          annualMaintenancePkr: 60000,
          fiveYearDepreciationPct: 35,
        },
        {
          id: 'honri-ve-2',
          name: 'Honri Ve 2.0 (200km EV)',
          fuelType: 'ev' as const,
          pricePkr: 3999000,
          kwhPer100Km: 13,
          annualMaintenancePkr: 25000,
          fiveYearDepreciationPct: 30,
        },
        {
          id: 'nissan-leaf',
          name: 'Nissan Leaf 40kWh EV',
          fuelType: 'ev' as const,
          pricePkr: 4800000,
          kwhPer100Km: 15,
          isCurrentVehicle: true,
          annualMaintenancePkr: 35000,
          fiveYearDepreciationPct: 40,
        },
        {
          id: 'yadea-m3',
          name: 'Yadea M3 E-Scooty',
          fuelType: 'e-scooty' as const,
          pricePkr: 250000,
          kwhPer100Km: 3.5,
          annualMaintenancePkr: 12000,
          fiveYearDepreciationPct: 25,
        },
        {
          id: 'veh-1795357128954-709371',
          name: 'Nora Neo',
          fuelType: 'ev' as const,
          pricePkr: 2600000,
          kwhPer100Km: 2,
          annualMaintenancePkr: 7000,
          fiveYearDepreciationPct: 70,
        },
      ],
      lifeGoals: [
        {
          id: 'goal-house-custom',
          name: 'Home Construction / Downpayment',
          targetAge: 33,
          costInTodaysPkr: 15000000,
        },
        {
          id: 'goal-debt-2027',
          name: 'Debt Clearance (installments, due 2027)',
          targetAge: 30,
          costInTodaysPkr: 750000,
        },
      ],
      taxStatus: 'filer' as const,
      lumpSumPkr: 0,
      shariahOnly: true,
      assetBuckets: [
        {
          id: 'psx-dividends' as const,
          label: 'PSX Dividend Equities',
          currentValuePkr: 0,
          monthlySplitPct: 50,
          expectedAnnualReturnPct: 14,
        },
        {
          id: 'gold' as const,
          label: '24K Physical Gold',
          currentValuePkr: 0,
          monthlySplitPct: 20,
          expectedAnnualReturnPct: 12,
        },
        {
          id: 'real-estate' as const,
          label: 'Real Estate / Land',
          currentValuePkr: 0,
          monthlySplitPct: 15,
          expectedAnnualReturnPct: 13,
        },
        {
          id: 'money-market' as const,
          label: 'Shariah Money Market',
          currentValuePkr: 0,
          monthlySplitPct: 10,
          expectedAnnualReturnPct: 11,
        },
        {
          id: 'cash' as const,
          label: 'Emergency Cash',
          currentValuePkr: 200000,
          monthlySplitPct: 5,
          expectedAnnualReturnPct: 8,
        },
      ],
      includeZakat: false,
      familyMembers: 2,
      isBreadwinner: true,
      maritalStatus: 'unmarried' as const,
      retirementAge: 40,
      dailyCommuteKm: 25,
      goldPerTolaPkr: 379836,
      gridRatePerKwh: 55,
      solarTariffMode: 'net-metering-legacy' as const,
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

    const sanitized = sanitizeProfile(fixtureRaw, fallback);
    expect(sanitized.currentCashReservePkr).toBe(-750000);
    expect(sanitized.age).toBe(29);
    expect(sanitized.role).toBe('freelancer');
    expect(sanitized.assetBuckets).toHaveLength(5);
    expect(sanitized.assetBuckets[0].monthlySplitPct).toBe(50);
    expect(sanitized.assetBuckets[0].id).toBe('psx-dividends');
    expect(sanitized.lifeGoals).toHaveLength(2);
    expect(sanitized.lifeGoals[0].costInTodaysPkr).toBe(15000000);
    expect(sanitized.vehicles).toHaveLength(5);
    expect(sanitized.vehicles[0].pricePkr).toBe(3800000);
    expect(sanitized.currentVehicleType).toBe('petrol-bike');
    expect(sanitized.currentVehicleResalePkr).toBe(1000000);

    // Full round-trip via hash encode/decode
    const hash = encodeProfileToHash(sanitized);
    const decoded = decodeProfileFromHash(hash, fallback);
    expect(decoded).toBeDefined();
    expect(decoded?.currentCashReservePkr).toBe(-750000);
    expect(decoded?.assetBuckets).toEqual(sanitized.assetBuckets);
    expect(decoded?.lifeGoals).toEqual(sanitized.lifeGoals);
    expect(decoded?.vehicles).toEqual(sanitized.vehicles);
  });
});
