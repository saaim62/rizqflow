/**
 * AI Assist prediction registry (NOTES #27 — Gate 6 Amendment 3).
 *
 * Pure module: for every predictable field in the app it defines the
 * prompt the server sends to the LLM and the sane range the returned
 * number is validated against. The engines never see this module — AI
 * fills INPUT fields only, and every prediction is a labelled estimate
 * the user can accept, edit or dismiss. Verified market data
 * (src/data/marketData.ts) is never a prediction target.
 */

export type PredictionType =
  | 'car-depreciation'
  | 'car-maintenance'
  | 'car-efficiency'
  | 'car-price'
  | 'bucket-return'
  | 'expense'
  | 'salary-raise'
  | 'goal-cost'
  | 'gold-rate'
  | 'fund-nav'
  | 'stock-price'
  | 'stock-yield'
  | 'stock-outlook';

export interface PredictionResult {
  value: number;
  /** Upper end of a predicted range (stock outlook only). */
  valueHigh?: number;
  reasoning: string;
  confidence: 'low' | 'medium' | 'high';
}

export interface PredictionSpec {
  label: string;
  min: number;
  max: number;
  decimals: number;
  buildPrompt: (ctx: Record<string, unknown>) => string;
}

export const AI_SYSTEM_PROMPT =
  'You are the prediction engine inside RizqFlow, a Pakistan personal-finance app. ' +
  'Reply with JSON only, exactly: {"value": <number>, "reasoning": "<one short sentence>", "confidence": "low"|"medium"|"high"}. ' +
  'For a range prediction also include "valueHigh": <number>. ' +
  'Base every estimate on realistic Pakistan market conditions in 2026 (PKR). ' +
  'Give your best central estimate; when the item is obscure, still estimate and mark confidence "low". ' +
  'No text outside the JSON.';

/** Short, prompt-safe rendering of a context value. */
function s(v: unknown, fallback = 'unknown'): string {
  if (typeof v === 'string' && v.trim()) return v.trim().slice(0, 80);
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return fallback;
}

function n(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

export const PREDICTIONS: Record<PredictionType, PredictionSpec> = {
  'car-depreciation': {
    label: '5-year depreciation %',
    min: 5,
    max: 90,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict the 5-year depreciation percentage for this vehicle in Pakistan's used-car market: ` +
      `name "${s(c.name)}", type ${s(c.fuelType)}, current price Rs ${n(c.pricePkr)}. ` +
      `value = the % of today's price the car will LOSE over 5 years (50 means it will sell for half). ` +
      `Consider brand resale strength in Pakistan (Toyota/Honda/Suzuki hold value; Chinese EVs and slow-selling models lose more).`,
  },
  'car-maintenance': {
    label: 'Annual maintenance (PKR)',
    min: 3000,
    max: 500000,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict realistic annual routine maintenance cost in PKR for this vehicle in Pakistan: ` +
      `name "${s(c.name)}", type ${s(c.fuelType)}, price Rs ${n(c.pricePkr)}. ` +
      `Include oil, filters, brakes, tyres amortised and minor repairs at independent workshops (not dealership). ` +
      `EVs and e-scooties cost far less to maintain than petrol cars.`,
  },
  'car-efficiency': {
    label: 'Efficiency (km/L or kWh/100km)',
    min: 2,
    max: 60,
    decimals: 1,
    buildPrompt: (c) =>
      `Predict the real-world energy efficiency of this vehicle in Pakistani city driving: ` +
      `name "${s(c.name)}", type ${s(c.fuelType)}. ` +
      (s(c.fuelType) === 'petrol'
        ? `value = fuel average in km per litre.`
        : `value = electricity consumption in kWh per 100 km.`),
  },
  'car-price': {
    label: 'Typical market price (PKR)',
    min: 50000,
    max: 50000000,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict the typical current asking price in PKR for this vehicle in Pakistan's market (PakWheels-style listings, good condition, common model year): ` +
      `name "${s(c.name)}", type ${s(c.fuelType)}.`,
  },
  'bucket-return': {
    label: 'Expected annual return %',
    min: 0,
    max: 30,
    decimals: 1,
    buildPrompt: (c) =>
      `Predict a realistic long-run expected annual return % for this Pakistan investment bucket: "${s(c.bucketLabel)}" (id ${s(c.bucketId)}). ` +
      `Consider PSX historical returns, Sarafa gold trends, Pakistan real-estate appreciation, money-market / Naya Pakistan certificate style rates and savings-account rates as applicable. ` +
      `Be conservative — this feeds a retirement plan.`,
  },
  expense: {
    label: 'Monthly expense (PKR)',
    min: 0,
    max: 2000000,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict a realistic monthly spend in PKR for the expense category "${s(c.categoryLabel)}" in Lahore, Pakistan, ` +
      `for a household of ${n(c.familyMembers, 4)} with monthly take-home income Rs ${n(c.monthlyIncomePkr)}. ` +
      `value = one month's typical spend on that category only.`,
  },
  'salary-raise': {
    label: 'Annual salary raise %',
    min: 0,
    max: 40,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict a realistic average annual salary raise % for a "${s(c.roleLabel)}" working in Pakistan over the next decade, ` +
      `considering inflation, sector norms and seniority growth.`,
  },
  'goal-cost': {
    label: "Goal cost today (PKR)",
    min: 10000,
    max: 1000000000,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict what this goal costs TODAY in PKR in Pakistan: "${s(c.goalName)}". ` +
      `Use realistic current market prices (e.g. construction per sq ft in Lahore for a house, current car prices, current university fees, Hajj package prices) and give the total one-time cost today.`,
  },
  'gold-rate': {
    label: 'Gold rate per tola (PKR)',
    min: 10000,
    max: 2000000,
    decimals: 0,
    buildPrompt: (c) =>
      `The current 24K gold rate in Pakistan is Rs ${n(c.rate24kPerTola)} per tola. ` +
      `Predict the per-tola rate for ${n(c.purityKarat, 24)}K gold. Pure metal value scales with purity (rate x karat/24); jewellery making charges are excluded.`,
  },
  'fund-nav': {
    label: 'Fund NAV per unit (PKR)',
    min: 1,
    max: 10000,
    decimals: 2,
    buildPrompt: (c) =>
      `Predict the approximate current NAV per unit in PKR of this Pakistani mutual fund: "${s(c.fundName)}". ` +
      `If you are unsure of the exact fund, estimate from similar Pakistani funds and mark confidence low.`,
  },
  'stock-price': {
    label: 'Stock price estimate (PKR)',
    min: 1,
    max: 100000,
    decimals: 2,
    buildPrompt: (c) =>
      `Predict the approximate current share price in PKR of this Pakistan Stock Exchange (PSX) stock: ` +
      `ticker ${s(c.ticker)}, company "${s(c.companyName)}". Estimate from your knowledge of PSX prices and mark confidence honestly.`,
  },
  'stock-yield': {
    label: 'Dividend yield %',
    min: 0,
    max: 30,
    decimals: 1,
    buildPrompt: (c) =>
      `Predict the current trailing dividend yield % of this Pakistan Stock Exchange (PSX) stock: ` +
      `ticker ${s(c.ticker)}, company "${s(c.companyName)}". Base it on the company's recent dividend history and payout consistency.`,
  },
  'stock-outlook': {
    label: '12-month price outlook (PKR)',
    min: 1,
    max: 100000,
    decimals: 2,
    buildPrompt: (c) =>
      `Predict a realistic 12-month price RANGE for this Pakistan Stock Exchange (PSX) stock: ` +
      `ticker ${s(c.ticker)}, company "${s(c.companyName)}", current price Rs ${n(c.currentPrice)}. ` +
      `Return value = low end of the range and valueHigh = high end, considering sector outlook, rates and valuation. ` +
      `This is a forecast, not a guarantee.`,
  },
};

export function isPredictionType(v: unknown): v is PredictionType {
  return typeof v === 'string' && v in PREDICTIONS;
}

/** Clamp + round a raw model value into the spec's sane range. */
export function clampPrediction(type: PredictionType, raw: number): number {
  const spec = PREDICTIONS[type];
  const clamped = Math.min(spec.max, Math.max(spec.min, raw));
  const f = Math.pow(10, spec.decimals);
  return Math.round(clamped * f) / f;
}

/** Parse + validate the model's JSON reply into a PredictionResult. */
export function parsePrediction(type: PredictionType, text: string): PredictionResult | null {
  try {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const value = typeof obj.value === 'number' ? obj.value : Number(obj.value);
    if (!Number.isFinite(value)) return null;
    const result: PredictionResult = {
      value: clampPrediction(type, value),
      reasoning:
        typeof obj.reasoning === 'string' ? obj.reasoning.slice(0, 200) : 'AI estimate based on Pakistan market patterns.',
      confidence:
        obj.confidence === 'low' || obj.confidence === 'high' ? obj.confidence : 'medium',
    };
    if (typeof obj.valueHigh === 'number' && Number.isFinite(obj.valueHigh)) {
      let high = clampPrediction(type, obj.valueHigh);
      if (high < result.value) {
        const t = result.value;
        result.value = high;
        high = t;
      }
      result.valueHigh = high;
    }
    return result;
  } catch {
    return null;
  }
}
