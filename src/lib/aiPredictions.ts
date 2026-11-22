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
  /**
   * Provenance label (NOTES #46, Gate 6 Amendment 3 discipline):
   * 'sourced' = returned from the curated ground-truth table, NOT a
   * model estimate; 'ai' / undefined = model output ("AI estimate").
   */
  source?: 'ai' | 'sourced';
  /** Short source name for sourced results, e.g. "PakWheels". */
  sourceNote?: string;
  /** EV specs the model supplied for car-efficiency (NOTES #46). */
  batteryKwh?: number;
  ratedRangeKm?: number;
  /** Where the specs came from, as reported by the model. */
  specSource?: string;
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
  'For an EV efficiency prediction also include "batteryKwh": <number> and "ratedRangeKm": <number> with the manufacturer-rated specs you found, plus "specSource": "<site or cycle, e.g. PakWheels / WLTP>". ' +
  'Base every estimate on realistic Pakistan market conditions in 2026 (PKR). ' +
  'Give your best central estimate; when the item is obscure, still estimate and mark confidence "low". ' +
  'No text outside the JSON.';

/**
 * Prediction types whose answers are volatile market prices that a
 * language model cannot know from its weights (Pakistan car prices
 * above all — NOTES #38). The server answers these with Groq's
 * browser_search tool enabled on the primary model so the estimate
 * is grounded in live Pakistani listings; if the grounded call
 * fails, the chain falls back to the plain model, then the fallback
 * model. All other types stay ungrounded (stable knowledge, and the
 * bucket/expense types are deliberately anchored to app baselines).
 * Live evidence (NOTES #43): grounding was initially enabled for
 * car-maintenance and car-depreciation too, but their searches ran
 * into the 60s timeout and fell back anyway — price is the volatile
 * figure that needs the web; the other two keep their improved
 * prompts (mileage scaling, cross-year comparison) ungrounded.
 * Round 3 (NOTES #46): grounding is extended again to car-efficiency
 * (the model must return manufacturer specs — battery kWh + rated
 * range — which code then turns into the value) and car-depreciation
 * (same-model listings across model years), with the same 60s
 * timeout discipline and fallback chain as car-price. Live grounded
 * behaviour for these two types is UNVERIFIED from the build
 * sandbox (no Groq key there); car-maintenance stays ungrounded.
 */
export const GROUNDED_PREDICTION_TYPES: ReadonlySet<PredictionType> = new Set([
  'car-price',
  'car-efficiency',
  'car-depreciation',
]);

export function isGroundedPrediction(type: PredictionType): boolean {
  return GROUNDED_PREDICTION_TYPES.has(type);
}

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
      `Use web search FIRST: look up listings for this SAME model across several model years on Pakistani sites (pakwheels.com, olx.com.pk) and judge from how the asking prices fall across model years how fast it loses value. ` +
      `Vehicle: name "${s(c.name)}", type ${s(c.fuelType)}, current price Rs ${n(c.pricePkr)}. ` +
      `value = the % of today's price the car will LOSE over 5 years (50 means it will sell for half). ` +
      `Compare FULL CASH asking prices only — ignore down-payment / installment listings when comparing years. ` +
      `Consider brand resale strength in Pakistan (Toyota/Honda/Suzuki hold value; Chinese EVs and slow-selling models lose more). ` +
      `End your reply with ONLY the JSON object — no text after it.`,
  },
  'car-maintenance': {
    label: 'Annual maintenance (PKR)',
    min: 3000,
    max: 500000,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict realistic annual routine maintenance cost in PKR for this vehicle in Pakistan: ` +
      `name "${s(c.name)}", type ${s(c.fuelType)}, price Rs ${n(c.pricePkr)}. ` +
      (typeof c.annualKm === 'number' && c.annualKm > 0
        ? `This vehicle is driven about ${n(c.annualKm)} km per year — SCALE the estimate to that usage: an oil + filter service every ~5,000 km, plus brake pads, fluids, tyres amortised and minor repairs at independent workshops (not dealership). A car driven 25,000+ km/yr needs several services a year; never return a low-mileage figure for a high-mileage car. `
        : `Include oil, filters, brakes, tyres amortised and minor repairs at independent workshops (not dealership). `) +
      `EVs and e-scooties cost far less to maintain than petrol cars. ` +
      `End your reply with ONLY the JSON object — no text after it.`,
  },
  'car-efficiency': {
    label: 'Efficiency (km/L or kWh/100km)',
    // Min lowered 2 -> 1 in NOTES #46: real e-scooty consumption
    // (e.g. Yadea M3, derived 1.725 kWh/100km) sits below the old
    // floor and was being silently clamped up to 2.
    min: 1,
    max: 60,
    decimals: 1,
    buildPrompt: (c) =>
      `Use web search FIRST: look up this vehicle's official specifications on Pakistani sources (pakwheels.com, olx.com.pk, the brand's Pakistan page) before answering. ` +
      `Predict the real-world energy efficiency of this vehicle in Pakistani city driving: ` +
      `name "${s(c.name)}", type ${s(c.fuelType)}. ` +
      (s(c.fuelType) === 'petrol'
        ? `value = fuel average in km per litre, based on the rated mileage for its engine size from those Pakistani sources.`
        : `Do NOT do the consumption arithmetic yourself. Instead return the manufacturer-rated specs you found: "batteryKwh" (battery capacity in kWh) and "ratedRangeKm" (rated range in km), plus "specSource" naming the source/cycle (e.g. "PakWheels specs, WLTP"). ` +
          `value = your best estimate of electricity consumption in kWh per 100 km (the app re-derives it from the specs when both are present).`),
  },
  'car-price': {
    label: 'Typical market price (PKR)',
    min: 50000,
    max: 50000000,
    decimals: 0,
    buildPrompt: (c) =>
      `Use web search FIRST: look up current listings for this vehicle on Pakistani sites (pakwheels.com, olx.com.pk) before answering. ` +
      `Vehicle: name "${s(c.name)}", type ${s(c.fuelType)}. ` +
      `value = the typical FULL CASH asking price in Pakistani Rupees (PKR) for a good-condition example of a common recent model year — the MEDIAN of comparable listings (or the new ex-factory price if the model is mainly sold new). ` +
      `IGNORE any figure that is a down payment, installment, lease, booking or advance amount — those are a fraction of the real price and are the most common source of absurdly low estimates. ` +
      `If you cite individual listings, include them as "listings": [{"pricePkr": <number>, "priceType": "full"|"down-payment"|"installment"}] — the app computes the median of full-cash listings itself. ` +
      `NEVER use Indian prices: India quotes in INR, which look about 3x smaller than PKR for the same car; if a source figure looks like Indian rupees, discard it. Pakistani prices only. ` +
      `End your reply with ONLY the JSON object — no text after it.`,
  },
  'bucket-return': {
    label: 'Expected annual return %',
    min: 0,
    max: 30,
    decimals: 1,
    buildPrompt: (c) =>
      `Predict a realistic long-run expected annual return % for this Pakistan investment bucket: "${s(c.bucketLabel)}" (id ${s(c.bucketId)}). ` +
      `Consider PSX historical returns, Sarafa gold trends, Pakistan real-estate appreciation, money-market / Naya Pakistan certificate style rates and savings-account rates as applicable. ` +
      (typeof c.currentReturnPct === 'number'
        ? `The app's current assumption for this bucket is ${n(c.currentReturnPct)}% — a researched baseline. Give a NOMINAL long-run figure (for equities, price growth plus dividends). Stay within about 3 points of the baseline unless you have a strong specific reason to move it; wild swings break the user's plan. `
        : '') +
      `Be sensible — this feeds a retirement plan.`,
  },
  expense: {
    label: 'Monthly expense (PKR)',
    min: 0,
    max: 2000000,
    decimals: 0,
    buildPrompt: (c) =>
      `Predict a realistic monthly spend in PKR for the expense category "${s(c.categoryLabel)}" in Lahore, Pakistan, ` +
      `for a household of ${n(c.familyMembers, 4)} with monthly take-home income Rs ${n(c.monthlyIncomePkr)}. ` +
      (typeof c.currentValuePkr === 'number'
        ? `The user currently spends Rs ${n(c.currentValuePkr)} on this category. If that current spend is 0, return 0 — a zero is deliberate (for example, living in a family home means no rent). Otherwise anchor on their actual spending and adjust modestly; do not replace real spending with a generic average. `
        : '') +
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

/**
 * EV efficiency derivation (NOTES #46): the model supplies rated
 * specs, CODE does the arithmetic — the model's own division is
 * never trusted. Returns kWh per 100 km, or null when the specs are
 * unusable (non-finite, non-positive, or an absurd range).
 */
export function deriveEvEfficiencyKwhPer100Km(
  batteryKwh: unknown,
  ratedRangeKm: unknown
): number | null {
  const kwh = typeof batteryKwh === 'number' ? batteryKwh : Number(batteryKwh);
  const range = typeof ratedRangeKm === 'number' ? ratedRangeKm : Number(ratedRangeKm);
  if (!Number.isFinite(kwh) || !Number.isFinite(range)) return null;
  if (kwh <= 0 || kwh > 500 || range < 10 || range > 3000) return null;
  return (kwh / range) * 100;
}

export interface ValidationBand {
  min: number;
  max: number;
  unit: string;
}

/**
 * Per-fuelType validation bands for vehicle-scoped prediction types
 * (NOTES #46). A value outside its band is NOT silently clamped into
 * place: it is flagged low-confidence with the reason in the
 * reasoning string (the global spec clamp still applies for safety).
 * Petrol km/L behaviour is unchanged (no band — spec range only).
 */
export const EFFICIENCY_BANDS_KWH_PER_100KM: Record<string, ValidationBand> = {
  'e-scooty': { min: 1, max: 5, unit: 'kWh/100km' },
  ev: { min: 8, max: 30, unit: 'kWh/100km' },
};

export function validationBandFor(
  type: PredictionType,
  ctx?: Record<string, unknown>
): ValidationBand | null {
  if (type !== 'car-efficiency' || !ctx) return null;
  const fuel = typeof ctx.fuelType === 'string' ? ctx.fuelType : '';
  return EFFICIENCY_BANDS_KWH_PER_100KM[fuel] ?? null;
}

export interface PriceListing {
  pricePkr: number;
  priceType?: string;
}

/**
 * Median of FULL-CASH listing prices only (NOTES #46): listings
 * tagged down-payment / installment / lease / booking are a fraction
 * of the real price (the NOTES #38 failure mode) and are excluded
 * from the derivation. Returns null when no full-cash listing exists.
 */
export function medianFullCashPrice(listings: unknown): number | null {
  if (!Array.isArray(listings)) return null;
  const prices: number[] = [];
  for (const l of listings) {
    if (!l || typeof l !== 'object') continue;
    const rec = l as Record<string, unknown>;
    const price = typeof rec.pricePkr === 'number' ? rec.pricePkr : Number(rec.pricePkr);
    if (!Number.isFinite(price) || price <= 0) continue;
    const tag = typeof rec.priceType === 'string' ? rec.priceType.toLowerCase() : '';
    if (tag && tag !== 'full' && tag !== 'full-cash' && tag !== 'cash') continue;
    prices.push(price);
  }
  if (prices.length === 0) return null;
  prices.sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  return prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
}

/** All top-level balanced {...} substrings of a reply, in order. */
function extractJsonObjects(text: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = -1;
  let inStr = false;
  let esc = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        out.push(text.slice(start, i + 1));
        start = -1;
      }
      if (depth < 0) depth = 0;
    }
  }
  return out;
}

/** Parse + validate the model's JSON reply into a PredictionResult. */
export function parsePrediction(
  type: PredictionType,
  text: string,
  ctx?: Record<string, unknown>
): PredictionResult | null {
  // Candidates: the legacy whole-span slice first (plain JSON replies),
  // then every balanced object from LAST to FIRST — grounded replies
  // carry search snippets and prose before the final JSON answer.
  const candidates: string[] = [];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  const objects = extractJsonObjects(text);
  for (let i = objects.length - 1; i >= 0; i--) {
    if (!candidates.includes(objects[i])) candidates.push(objects[i]);
  }
  for (const candidate of candidates) {
    const parsed = tryParsePrediction(type, candidate, ctx);
    if (parsed) return parsed;
  }
  return null;
}

function tryParsePrediction(
  type: PredictionType,
  text: string,
  ctx?: Record<string, unknown>
): PredictionResult | null {
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const value = typeof obj.value === 'number' ? obj.value : Number(obj.value);
    if (!Number.isFinite(value)) return null;
    const result: PredictionResult = {
      value: clampPrediction(type, value),
      reasoning:
        typeof obj.reasoning === 'string' ? obj.reasoning.slice(0, 200) : 'AI estimate based on Pakistan market patterns.',
      confidence:
        obj.confidence === 'low' || obj.confidence === 'high' ? obj.confidence : 'medium',
    };
    // Car price (NOTES #46): when the reply carries individual
    // listings, code computes the median of the FULL-CASH ones —
    // down-payment/installment listings never enter the derivation.
    if (type === 'car-price' && obj.listings !== undefined) {
      const median = medianFullCashPrice(obj.listings);
      if (median !== null) result.value = clampPrediction(type, median);
    }
    // EV efficiency (NOTES #46): when the reply carries rated specs,
    // the value is DERIVED in code from battery/range — the model's
    // own arithmetic is never trusted. The source/cycle is recorded
    // in the reasoning string.
    if (type === 'car-efficiency' && (obj.batteryKwh !== undefined || obj.ratedRangeKm !== undefined)) {
      const derived = deriveEvEfficiencyKwhPer100Km(obj.batteryKwh, obj.ratedRangeKm);
      if (derived !== null) {
        const kwh = Number(obj.batteryKwh);
        const range = Number(obj.ratedRangeKm);
        result.value = clampPrediction(type, derived);
        result.batteryKwh = kwh;
        result.ratedRangeKm = range;
        if (typeof obj.specSource === 'string' && obj.specSource.trim()) {
          result.specSource = obj.specSource.trim().slice(0, 80);
        }
        const note =
          ` Derived in code: ${kwh} kWh ÷ ${range} km × 100 = ${result.value} kWh/100km` +
          ` (rated specs${result.specSource ? `, ${result.specSource}` : ''}).`;
        result.reasoning = (result.reasoning.slice(0, Math.max(0, 220 - note.length)) + note).slice(0, 220);
      }
    }
    // Validation bands (NOTES #46): an out-of-band value is flagged
    // low-confidence with the reason stated — never silently clamped
    // into place (the global spec clamp above still applies).
    const band = validationBandFor(type, ctx);
    if (band && (result.value < band.min || result.value > band.max)) {
      result.confidence = 'low';
      const flag =
        ` Flagged: ${result.value} ${band.unit} is outside the expected ${band.min}–${band.max} ${band.unit} band for this vehicle type — treat with caution.`;
      result.reasoning = (result.reasoning + flag).slice(0, 300);
    }
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
