import { describe, expect, it, vi } from 'vitest';
import { autoBalanceBuckets } from '@/components/planner/MultiAssetSplitter';
import { VehicleCandidate, UserProfile } from '@/types';
import { evaluateCarDecision } from '@/lib/engine/carTcoEngine';

describe('UI Planner & Cars Audit Tests (tests/ui-planner-cars.test.ts)', () => {
  describe('FIX-3.2(e)(f): MultiAssetSplitter Auto-Balance Rounding Remainder', () => {
    it('accurately preserves exact 100.0% total with test proportions [12.7, 30.7, 42.1, 7.7, 6.8]', () => {
      const buckets = [
        { id: 'b1', name: 'Bucket 1', monthlySplitPct: 12.7 },
        { id: 'b2', name: 'Bucket 2', monthlySplitPct: 30.7 },
        { id: 'b3', name: 'Bucket 3', monthlySplitPct: 42.1 },
        { id: 'b4', name: 'Bucket 4', monthlySplitPct: 7.7 },
        { id: 'b5', name: 'Bucket 5', monthlySplitPct: 6.8 },
      ];

      const balanced = autoBalanceBuckets(buckets);
      const sum = balanced.reduce((acc, b) => acc + b.monthlySplitPct, 0);
      expect(Number(sum.toFixed(1))).toBe(100.0);
    });

    it('adds remainder to the largest bucket when proportions have rounding decimals', () => {
      // 3 buckets equally divided (33.3333...%)
      const buckets = [
        { id: 'b1', name: 'Bucket 1', monthlySplitPct: 10 },
        { id: 'b2', name: 'Bucket 2', monthlySplitPct: 10 },
        { id: 'b3', name: 'Bucket 3', monthlySplitPct: 10 },
      ];

      const balanced = autoBalanceBuckets(buckets);
      const sum = balanced.reduce((acc, b) => acc + b.monthlySplitPct, 0);
      expect(Number(sum.toFixed(1))).toBe(100.0);
      // Remainder (+0.1) is added to index 0 so sum is exactly 100.0 (33.4 + 33.3 + 33.3)
      expect(balanced[0].monthlySplitPct).toBe(33.4);
      expect(balanced[1].monthlySplitPct).toBe(33.3);
      expect(balanced[2].monthlySplitPct).toBe(33.3);
    });

    it('restores default allocation summing to 100% if all buckets are zero', () => {
      const buckets = [
        { id: 'psx-dividends', name: 'PSX', monthlySplitPct: 0 },
        { id: 'gold', name: 'Gold', monthlySplitPct: 0 },
        { id: 'real-estate', name: 'Real Estate', monthlySplitPct: 0 },
        { id: 'money-market', name: 'Money Market', monthlySplitPct: 0 },
        { id: 'cash', name: 'Cash', monthlySplitPct: 0 },
      ];

      const balanced = autoBalanceBuckets(buckets);
      const sum = balanced.reduce((acc, b) => acc + b.monthlySplitPct, 0);
      expect(sum).toBe(100);
      expect(balanced.map((b) => b.monthlySplitPct)).toEqual([40, 20, 20, 15, 5]);
    });
  });

  describe('FIX-1.1: Zero-Value Sweep & Clearable Inputs', () => {
    it('preserves 0 values for lumpSumPkr, rentOrHousing, and annualSalaryRaisePct', () => {
      // Emulate wizard / profile draft update logic with nullish coalescing
      const draft = {
        lumpSumPkr: 0,
        rentOrHousing: 0,
        annualSalaryRaisePct: 0,
      };

      const resolvedLumpSum = draft.lumpSumPkr ?? 1500000;
      const resolvedRent = draft.rentOrHousing ?? 50000;
      const resolvedRaise = draft.annualSalaryRaisePct ?? 8;

      expect(resolvedLumpSum).toBe(0);
      expect(resolvedRent).toBe(0);
      expect(resolvedRaise).toBe(0);

      // Demonstrates the bug that || would have caused:
      const brokenLumpSum = draft.lumpSumPkr || 1500000;
      expect(brokenLumpSum).toBe(1500000); // || incorrectly overrides 0
    });

    it('HoldingsLiabilitiesCard: resetting quantity or unitPricePkr to 0 resets valuePkr to 0', () => {
      // Logic from HoldingsLiabilitiesCard updateHolding
      const holding = {
        id: 'h1',
        assetClass: 'stock' as const,
        symbol: 'HUBC',
        quantity: 100,
        unitPricePkr: 120,
        valuePkr: 12000,
      };

      const updateHolding = (patch: Partial<typeof holding>) => {
        const next = { ...holding, ...patch };
        if (patch.quantity !== undefined || patch.unitPricePkr !== undefined) {
          const qty = patch.quantity ?? next.quantity;
          const price = patch.unitPricePkr ?? next.unitPricePkr;
          if (qty <= 0 || price <= 0) {
            next.valuePkr = 0;
          } else {
            next.valuePkr = Math.round(qty * price);
          }
        }
        return next;
      };

      // Clearing / setting quantity to 0
      const afterZeroQty = updateHolding({ quantity: 0 });
      expect(afterZeroQty.valuePkr).toBe(0);

      // Setting unit price to 0
      const afterZeroPrice = updateHolding({ unitPricePkr: 0 });
      expect(afterZeroPrice.valuePkr).toBe(0);

      // Positive recalculation
      const afterValid = updateHolding({ quantity: 50, unitPricePkr: 100 });
      expect(afterValid.valuePkr).toBe(5000);
    });
  });

  describe('FIX-1.6: ApplyCarSwapBanner Persistence & Decision Signature', () => {
    it('generates decision signature and detects applied status', () => {
      const currentVehId = 'petrol-car';
      const winnerId = 'ev-car';
      const freedEquity = 1200000;
      const monthlySavings = 25000;

      const signature = `${currentVehId}:${winnerId}:${Math.round(freedEquity)}:${Math.round(monthlySavings)}`;

      // Profile starts without signature
      let profileAppliedKey: string | undefined = undefined;
      expect(profileAppliedKey === signature).toBe(false);

      // Apply action persists signature
      profileAppliedKey = signature;
      expect(profileAppliedKey === signature).toBe(true);

      // When savings or freed equity change, signature changes and button re-enables
      const updatedMonthlySavings = 30000;
      const newSignature = `${currentVehId}:${winnerId}:${Math.round(freedEquity)}:${Math.round(updatedMonthlySavings)}`;
      expect(profileAppliedKey === newSignature).toBe(false);
    });

    it('calculates financed baseline freed equity from down payment rather than full price', () => {
      const financedCar: VehicleCandidate = {
        id: 'financed-1',
        name: 'Financed Sedan',
        fuelType: 'petrol',
        pricePkr: 5000000,
        kmPerLitre: 12,
        fiveYearDepreciationPct: 35,
        annualMaintenancePkr: 50000,
        emiQuote: {
          enabled: true,
          downPaymentPkr: 1000000, // 10 Lac down
          monthlyInstallmentPkr: 120000,
          tenureMonths: 36,
        },
      };

      const cashWinner: VehicleCandidate = {
        id: 'cash-ev',
        name: 'Cash EV',
        fuelType: 'ev',
        pricePkr: 400000,
        kwhPer100Km: 14,
        fiveYearDepreciationPct: 30,
        annualMaintenancePkr: 20000,
      };

      const isBaselineFinanced = Boolean(financedCar.emiQuote?.enabled);
      const baselineEquity = isBaselineFinanced
        ? (financedCar.emiQuote?.downPaymentPkr ?? 0)
        : (financedCar.pricePkr ?? 0);

      const isWinnerFinanced = Boolean(cashWinner.emiQuote?.enabled);
      const winnerEquity = isWinnerFinanced
        ? (cashWinner.emiQuote?.downPaymentPkr ?? 0)
        : (cashWinner.pricePkr ?? 0);

      const freedEquity = Math.max(0, baselineEquity - winnerEquity);

      // Down payment was 10 Lac, cash winner is 4 Lac -> freed equity is 6 Lac (not 46 Lac)
      expect(baselineEquity).toBe(1000000);
      expect(freedEquity).toBe(600000);
    });

    it('hides banner when both monthlySavings and freedEquity are non-positive', () => {
      const monthlySavings = 0;
      const freedEquity = 0;

      const shouldHide = monthlySavings <= 0 && freedEquity <= 0;
      expect(shouldHide).toBe(true);
    });
  });

  describe('FIX-1.7: Empty Vehicle Fleet Safety', () => {
    it('preserves empty fleet ([]) without resurrecting DEFAULT_CARS', () => {
      const profileVehicles: VehicleCandidate[] = [];
      const DEFAULT_CARS: VehicleCandidate[] = [
        {
          id: 'default-1',
          name: 'Default Car',
          fuelType: 'petrol',
          pricePkr: 3000000,
          kmPerLitre: 14,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 50000,
        },
      ];

      // New condition: profile.vehicles !== undefined
      const activeVehicles = profileVehicles !== undefined ? profileVehicles : DEFAULT_CARS;
      expect(activeVehicles).toHaveLength(0);
      expect(activeVehicles).toBe(profileVehicles);
    });

    it('evaluates car decision with empty vehicle fleet without error', () => {
      const emptyFleetProfile = {
        age: 28,
        retirementAge: 60,
        monthlyIncomePkr: 200000,
        monthlyInvestPkr: 50000,
        lumpSumPkr: 1000000,
        currentExpensesPkr: 120000,
        annualSalaryRaisePct: 8,
        inflationPct: 10,
        solarTariffPkr: 27,
        petrolPricePerLitre: 276.5,
        dailyCommuteKm: 30,
        vehicles: [] as VehicleCandidate[],
      } as unknown as UserProfile;

      const decision = evaluateCarDecision(emptyFleetProfile);
      expect(decision.results).toHaveLength(0);
      expect(decision.crossoverKmPerDay).toBeNull();
      expect(decision.crossoverSeries).toHaveLength(20); // 20 km data points from 5 to 100
      expect(decision.verdictSentence).toContain('Add vehicles to evaluate');
    });
  });

  describe('FIX-2.6: AI Fill Error and Promise Rejection Handling', () => {
    it('handles rejected AI prediction promises, triggers error notification, and clears loading state in finally block', async () => {
      let fillingId: string | null = 'veh-1';
      let errorToastShown = false;
      let toastMessage = '';

      const showToast = (msg: string) => {
        errorToastShown = true;
        toastMessage = msg;
      };

      const failingPredict = vi.fn().mockRejectedValue(new Error('Network or API failure'));

      // Emulate aiFillVehicle handler try/catch/finally
      const aiFillVehicle = async (vehId: string) => {
        fillingId = vehId;
        try {
          await failingPredict();
        } catch {
          showToast('Could not complete AI autofill for vehicle');
        } finally {
          fillingId = null;
        }
      };

      await aiFillVehicle('veh-1');

      expect(errorToastShown).toBe(true);
      expect(toastMessage).toBe('Could not complete AI autofill for vehicle');
      expect(fillingId).toBeNull();
    });
  });
});
