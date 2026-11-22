/**
 * AI grounding (NOTES #38): volatile market-price predictions are
 * answered with Groq browser_search on the server. These tests pin
 * the registry contract — which types are grounded, the anti-
 * hallucination rules baked into their prompts, and the parser's
 * ability to recover the final JSON from a search-style reply that
 * carries snippets and prose before the answer.
 */
import { describe, expect, it } from 'vitest';
import {
  PREDICTIONS,
  isGroundedPrediction,
  parsePrediction,
} from '@/lib/aiPredictions';

describe('grounded prediction types', () => {
  it('grounds exactly the volatile car-market types', () => {
    expect(isGroundedPrediction('car-price')).toBe(true);
    // NOTES #43 narrowed grounding to price after maintenance/
    // depreciation searches timed out live. Round 3 (NOTES #46)
    // re-extends grounding to car-efficiency (spec-bearing: the
    // model returns battery/range, code derives the value) and
    // car-depreciation, same timeout discipline; live behaviour for
    // the two re-extended types is unverified from the build sandbox.
    expect(isGroundedPrediction('car-maintenance')).toBe(false);
    expect(isGroundedPrediction('car-depreciation')).toBe(true);
    expect(isGroundedPrediction('car-efficiency')).toBe(true);
    expect(isGroundedPrediction('expense')).toBe(false);
    expect(isGroundedPrediction('bucket-return')).toBe(false);
    expect(isGroundedPrediction('stock-price')).toBe(false);
  });

  it('car-price prompt forbids installment figures and INR prices', () => {
    const p = PREDICTIONS['car-price'].buildPrompt({ name: 'Changan Alsvin 1.3L', fuelType: 'petrol' });
    expect(p).toContain('web search');
    expect(p).toContain('down payment');
    expect(p).toContain('INR');
    expect(p).toContain('MEDIAN');
  });

  it('car-maintenance prompt scales by annual kilometres when given', () => {
    const withKm = PREDICTIONS['car-maintenance'].buildPrompt({
      name: 'Changan Alsvin 1.3L', fuelType: 'petrol', pricePkr: 3800000, annualKm: 18250,
    });
    expect(withKm).toContain('18250');
    expect(withKm).toContain('SCALE');
    const without = PREDICTIONS['car-maintenance'].buildPrompt({
      name: 'Changan Alsvin 1.3L', fuelType: 'petrol', pricePkr: 3800000,
    });
    expect(without).not.toContain('SCALE');
  });
});

describe('parsePrediction with search-style replies', () => {
  it('extracts the final JSON after snippets and prose', () => {
    const reply = [
      'Searching pakwheels.com for Changan Alsvin listings…',
      'Found: {"title": "Alsvin 1.3 MT 2022", "price": "Rs 29.5 Lac"} and another {"title": "Alsvin 2021", "price": "Rs 27 Lac"}.',
      'Installment ads show Rs 13 Lac down payment — ignoring those as instructed.',
      'Based on the median of full-cash listings:',
      '{"value": 3850000, "reasoning": "Median of PakWheels full-cash listings for 2021-2023 Alsvin 1.3 MT.", "confidence": "high"}',
    ].join('\n');
    const parsed = parsePrediction('car-price', reply);
    expect(parsed).not.toBeNull();
    expect(parsed!.value).toBe(3850000);
    expect(parsed!.confidence).toBe('high');
  });

  it('still parses a plain JSON-only reply (legacy path)', () => {
    const parsed = parsePrediction('car-price', '{"value": 4200000, "reasoning": "ok", "confidence": "medium"}');
    expect(parsed!.value).toBe(4200000);
  });

  it('returns null when no object carries a numeric value', () => {
    expect(parsePrediction('car-price', 'No listings found {"note": "try later"}')).toBeNull();
  });
});
