import { describe, expect, it } from 'vitest';
import { formatCompactPkr, formatPct, formatPkr, formatTolas, formatUsd, maskAmount } from '@/lib/format';
import { computeStreakStats, simulateDipStrategy } from '@/lib/engine/streakEngine';
import { GOLD_YEAR_HISTORY, METAL_ASSETS, PRESET_PROFILES, PSX_STOCKS } from '@/data/marketData';
import {
  applyCarSavingsToPlan,
  calculateExecutionSheet,
  calculateLifePlan,
  normalizeAssetSplits,
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
  it('Gold 24k (30-day daily series): 5-day red streak, Nov 20 close Rs 379,836, down 15,400 today, drawdown ~12.8% from the 30-day-window high Rs 435,636', () => {
    const gold = METAL_ASSETS.find((m) => m.id === 'gold-24k');
    expect(gold).toBeDefined();
    if (!gold) return;

    expect(gold.currentPrice).toBe(379836);
    expect(gold.history.length).toBe(30);

    const finalDay = gold.history[gold.history.length - 1];
    const prevDay = gold.history[gold.history.length - 2];
    expect(finalDay.date).toBe('2026-11-20');
    expect(finalDay.price).toBe(379836);
    expect(prevDay.date).toBe('2026-11-19');
    expect(prevDay.price).toBe(395236);

    // Dropped Rs 15,400 on the final day
    expect(gold.streak.changeToday).toBe(-15400);

    // High of the 30-day window on Nov 5 at Rs 435,636 (NOT the all-time
    // peak — that is Rs 572,862 on 29 Jan 2026, see the year-history test)
    const peakPoint = gold.history.find((p) => p.date === '2026-11-05');
    expect(peakPoint?.price).toBe(435636);

    // Active 5-day red streak
    expect(gold.streak.currentStreak).toBe(-5);
    expect(gold.streak.isSipDipZone).toBe(true);

    // Drawdown from the 30-day-window high ~12.8%
    expect(gold.streak.drawdownFromPeakPct).toBeCloseTo(-12.8, 1);
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
    expect(last.date).toBe('2026-11-20');
    expect(last.price).toBe(379836);

    // True drawdown from the all-time peak: about −33.7%
    const drawdown = ((last.price - peak.price) / peak.price) * 100;
    expect(drawdown).toBeCloseTo(-33.7, 1);
  });

  it('Silver 24k: Nov 20 close at Rs 4,708 with an active 3-day down streak', () => {
    const silver = METAL_ASSETS.find((m) => m.id === 'silver-24k');
    expect(silver).toBeDefined();
    if (!silver) return;

    expect(silver.currentPrice).toBe(4708);
    expect(silver.history.length).toBe(30);
    expect(silver.streak.currentStreak).toBe(-3);
    expect(silver.streak.isSipDipZone).toBe(true);
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
    expect(nbp?.dividendYieldPct).toBe(19.9); // 20 Nov 2026: DPS 35.00 one-off special / price 176.03
    expect(nbp?.trapWarning).toContain('pension litigation');

    const kapco = PSX_STOCKS.find((s) => s.ticker === 'KAPCO');
    expect(kapco?.grade).toBe('C');
    expect(kapco?.dividendYieldPct).toBe(11.2);
    expect(kapco?.trapWarning).toContain('PPA');

    const lotchem = PSX_STOCKS.find((s) => s.ticker === 'LOTCHEM');
    // Demoted B -> C in the 21 Nov 2026 fix round: at 20 Nov 2026 prices the
    // trailing yield is ~25% — a cyclical PTA-PX peak artifact, not a payout
    // rate. That is a yield trap by definition.
    expect(lotchem?.grade).toBe('C');
    expect(lotchem?.dividendYieldPct).toBe(25.3);
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
    // at 20 Nov 2026 prices blends to 10.4%
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
    const custom = migrateStaleSeedValues({ petrolPricePerLitre: 330 });
    expect(custom.petrolPricePerLitre).toBe(330);
  });

  it('returns default Nov 21 2026 Pakistan economic defaults', () => {
    const rates = getDefaultMarketRates();
    expect(rates.petrolPricePerLitre).toBe(322);
    expect(rates.goldPerTolaPkr).toBe(379836); // APSGJA 21 Nov 2026 — swarm test had locked the stale 385,000 hero figure
    expect(rates.usdToPkr).toBe(276.51); // SBP interbank close 20 Nov 2026
    expect(rates.gridRatePerKwh).toBe(55);
    expect(rates.kse100Index).toBe(177382);
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
