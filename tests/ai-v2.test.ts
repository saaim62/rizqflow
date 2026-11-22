/**
 * AI Assist v2 (NOTES #46): code-side EV derivation, per-fuelType
 * validation bands, the curated ground-truth table, price_type
 * filtering, the provider layer, and single-flight de-duplication.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deriveEvEfficiencyKwhPer100Km,
  medianFullCashPrice,
  parsePrediction,
} from '@/lib/aiPredictions';
import {
  VEHICLE_GROUND_TRUTH,
  findGroundTruth,
} from '@/lib/vehicleGroundTruth';
import {
  _resetAiStateForTesting,
  getAiProvider,
  predictWithAi,
} from '@/lib/server/ai';

describe('EV efficiency derivation (code does the arithmetic)', () => {
  it('derives kWh/100km from rated specs', () => {
    expect(deriveEvEfficiencyKwhPer100Km(40, 250)).toBe(16.0);
    expect(deriveEvEfficiencyKwhPer100Km(1.38, 80)).toBeCloseTo(1.725, 10);
  });

  it('rejects unusable specs', () => {
    expect(deriveEvEfficiencyKwhPer100Km(0, 250)).toBeNull();
    expect(deriveEvEfficiencyKwhPer100Km(40, 0)).toBeNull();
    expect(deriveEvEfficiencyKwhPer100Km('x', 250)).toBeNull();
    expect(deriveEvEfficiencyKwhPer100Km(undefined, undefined)).toBeNull();
  });

  it("overrides the model's own value when specs are present", () => {
    // Model claims 99 (its arithmetic is never trusted); specs say 16.0.
    const parsed = parsePrediction(
      'car-efficiency',
      '{"value": 99, "reasoning": "Leaf EV estimate.", "confidence": "high", "batteryKwh": 40, "ratedRangeKm": 250, "specSource": "PakWheels specs, WLTP"}',
      { name: 'Nissan Leaf', fuelType: 'ev' }
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.value).toBe(16.0);
    expect(parsed!.batteryKwh).toBe(40);
    expect(parsed!.ratedRangeKm).toBe(250);
    expect(parsed!.reasoning).toContain('Derived in code');
    expect(parsed!.reasoning).toContain('PakWheels specs, WLTP');
  });

  it('falls back to the model value when specs are absent', () => {
    const parsed = parsePrediction(
      'car-efficiency',
      '{"value": 18.5, "reasoning": "Typical EV car.", "confidence": "medium"}',
      { name: 'Some EV', fuelType: 'ev' }
    );
    expect(parsed!.value).toBe(18.5);
    expect(parsed!.reasoning).not.toContain('Derived in code');
  });
});

describe('validation bands (flag, never silently clamp)', () => {
  it('flags a 7 kWh/100km e-scooty answer as low-confidence with the reason', () => {
    const parsed = parsePrediction(
      'car-efficiency',
      '{"value": 7, "reasoning": "Estimate.", "confidence": "high"}',
      { name: 'Generic Scooty', fuelType: 'e-scooty' }
    );
    expect(parsed!.value).toBe(7);
    expect(parsed!.confidence).toBe('low');
    expect(parsed!.reasoning).toContain('outside the expected 1–5');
  });

  it('passes an in-band EV-car value unflagged', () => {
    const parsed = parsePrediction(
      'car-efficiency',
      '{"value": 16, "reasoning": "Typical EV car.", "confidence": "high"}',
      { name: 'Generic EV', fuelType: 'ev' }
    );
    expect(parsed!.value).toBe(16);
    expect(parsed!.confidence).toBe('high');
    expect(parsed!.reasoning).not.toContain('outside the expected');
  });

  it('flags an out-of-band EV-car value too', () => {
    const parsed = parsePrediction(
      'car-efficiency',
      '{"value": 45, "reasoning": "Estimate.", "confidence": "medium"}',
      { name: 'Generic EV', fuelType: 'ev' }
    );
    expect(parsed!.confidence).toBe('low');
    expect(parsed!.reasoning).toContain('outside the expected 8–30');
  });

  it('leaves petrol km/L behaviour unchanged (no band)', () => {
    const parsed = parsePrediction(
      'car-efficiency',
      '{"value": 45, "reasoning": "Bike average.", "confidence": "high"}',
      { name: 'Honda CG 125', fuelType: 'petrol' }
    );
    expect(parsed!.confidence).toBe('high');
    expect(parsed!.reasoning).not.toContain('outside the expected');
  });
});

describe('ground-truth table', () => {
  it('resolves Yadea M3 efficiency from the table, derived in code, labelled sourced', () => {
    const hit = findGroundTruth('car-efficiency', { name: 'Yadea M3', fuelType: 'e-scooty' });
    expect(hit).not.toBeNull();
    expect(hit!.source).toBe('sourced');
    expect(hit!.value).toBe(1.7); // 1.38/80×100 = 1.725, spec rounds to 1 decimal
    expect(hit!.reasoning).toContain('Sourced data');
    expect(hit!.reasoning).toContain('Derived in code');
  });

  it('resolves prices for seeded vehicles', () => {
    const leaf = findGroundTruth('car-price', { name: 'Nissan Leaf 40kWh', fuelType: 'ev' });
    expect(leaf!.value).toBe(6245000);
    expect(leaf!.source).toBe('sourced');
    const alto = findGroundTruth('car-price', { name: 'Suzuki Alto VXR', fuelType: 'petrol' });
    expect(alto!.value).toBe(2994861);
  });

  it('misses cleanly for unknown vehicles and unseeded fields', () => {
    expect(findGroundTruth('car-price', { name: 'Nonexistent ZZZ 9000', fuelType: 'petrol' })).toBeNull();
    // Depreciation is deliberately unseeded (no sourced % exists).
    expect(findGroundTruth('car-depreciation', { name: 'Toyota Corolla', fuelType: 'petrol' })).toBeNull();
    // Lifan V16S efficiency omitted — no Pakistani source found.
    expect(findGroundTruth('car-efficiency', { name: 'Lifan V16S', fuelType: 'petrol' })).toBeNull();
    // Non-vehicle types never hit the table.
    expect(findGroundTruth('expense', { name: 'Yadea M3' })).toBeNull();
  });

  it('every seeded value carries a source and URL', () => {
    for (const e of VEHICLE_GROUND_TRUTH) {
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.sourceUrl).toMatch(/^https:\/\//);
      expect(
        e.pricePkr !== undefined ||
          e.efficiencyKmPerLitre !== undefined ||
          e.batteryKwh !== undefined ||
          e.efficiencyKwhPer100Km !== undefined ||
          e.depreciationPct !== undefined
      ).toBe(true);
    }
  });

  it('predictWithAi serves a ground-truth hit with NO model call (no API key configured)', async () => {
    delete process.env.GROQ_API_KEY;
    _resetAiStateForTesting();
    const outcome = await predictWithAi(
      'car-efficiency',
      { name: 'Yadea M3', fuelType: 'e-scooty' },
      '203.0.113.1'
    );
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result.source).toBe('sourced');
      expect(outcome.result.value).toBe(1.7);
    }
  });
});

describe('price_type filtering', () => {
  it('excludes down-payment/installment listings from the median', () => {
    const median = medianFullCashPrice([
      { pricePkr: 1300000, priceType: 'down-payment' },
      { pricePkr: 900000, priceType: 'installment' },
      { pricePkr: 3800000, priceType: 'full' },
      { pricePkr: 3900000 },
    ]);
    expect(median).toBe(3850000);
  });

  it('returns null when only non-full listings exist', () => {
    expect(medianFullCashPrice([{ pricePkr: 1300000, priceType: 'down-payment' }])).toBeNull();
    expect(medianFullCashPrice('nope')).toBeNull();
  });

  it('parser derives car-price from full-cash listings when present', () => {
    const parsed = parsePrediction(
      'car-price',
      JSON.stringify({
        value: 1300000,
        reasoning: 'Listings found.',
        confidence: 'medium',
        listings: [
          { pricePkr: 1300000, priceType: 'down-payment' },
          { pricePkr: 3800000, priceType: 'full' },
          { pricePkr: 4000000, priceType: 'full' },
        ],
      })
    );
    expect(parsed!.value).toBe(3900000);
  });
});

describe('provider layer + single-flight', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    _resetAiStateForTesting();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GROQ_API_KEY;
    vi.restoreAllMocks();
  });

  it('defaults to the Groq provider', () => {
    expect(getAiProvider().id).toBe('groq');
  });

  it('collapses identical concurrent requests into one upstream call', async () => {
    process.env.GROQ_API_KEY = 'test-key-not-real';
    let calls = 0;
    globalThis.fetch = vi.fn(async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 25));
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              message: {
                content: '{"value": 5000, "reasoning": "Stubbed.", "confidence": "medium"}',
              },
            },
          ],
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const ctx = { categoryLabel: 'Groceries', familyMembers: 4, monthlyIncomePkr: 300000 };
    const [a, b] = await Promise.all([
      predictWithAi('expense', ctx, '203.0.113.2'),
      predictWithAi('expense', ctx, '203.0.113.2'),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(calls).toBe(1);
  });
});
