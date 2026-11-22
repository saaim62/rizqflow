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
  /**
   * Web-search provenance (NOTES #47): the actual pages a
   * search-backed result was derived from, shown as links under the
   * value in the UI. Present only for search-backed results.
   */
  sources?: { title: string; url: string }[];
  /** Which search provider produced the hits (NOTES #47). */
  searchProvider?: 'tavily' | 'serper';
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
        // NOTES #47 labelling fix (the Alektra incident): in the
        // MODEL path the specs themselves are model-reported, so the
        // note must not present the derivation as sourced fact —
        // "Derived in code" provenance is reserved for inputs that
        // were extracted from real pages (search pipeline / ground
        // truth). The arithmetic is still done in code; the inputs
        // are labelled unverified.
        const note =
          ` Derived in code from model-reported specs: ${kwh} kWh ÷ ${range} km × 100 = ${result.value} kWh/100km` +
          ` (rated specs${result.specSource ? `, ${result.specSource}` : ''}; not independently verified).`;
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

/* ------------------------------------------------------------------ */
/* Search-backed derivation (NOTES #47 — AI Assist v3).                */
/*                                                                     */
/* The web-search pipeline (src/lib/webSearch.ts +                     */
/* src/lib/specExtraction.ts) hands this module an extraction: the     */
/* numbers a model READ OFF real search-result pages, each tied to     */
/* the URLs it came from. Everything below is pure code — variant      */
/* picking, EV arithmetic, price medians, cross-year depreciation —    */
/* so a search-backed number is derived from cited pages, never from   */
/* model memory. "Derived in code" wording is used ONLY here and in    */
/* the ground-truth table, where the inputs are genuinely sourced.     */
/* ------------------------------------------------------------------ */

/** Prediction types the web-search pipeline can resolve (NOTES #47). */
export const SEARCH_BACKED_PREDICTION_TYPES: ReadonlySet<PredictionType> = new Set([
  'car-price',
  'car-efficiency',
  'car-depreciation',
]);

export function isSearchBackedPrediction(type: PredictionType): boolean {
  return SEARCH_BACKED_PREDICTION_TYPES.has(type);
}

/** One vehicle variant as extracted from search hits. */
export interface ExtractedVariant {
  variantNote: string | null;
  pricePkr: number | null;
  priceType: 'full-cash' | 'installment' | 'booking' | null;
  batteryKwh: number | null;
  rangeKm: number | null;
  /** Directly-stated consumption: kWh/100km for EV, km/L for petrol. */
  fuelConsumption: number | null;
  sourceUrls: string[];
}

/** One year-tagged asking price, for cross-year depreciation. */
export interface ExtractedPricePoint {
  modelYear: number | null;
  pricePkr: number | null;
  priceType: 'full-cash' | 'installment' | 'booking' | null;
  sourceUrl: string | null;
}

export interface SpecExtractionResult {
  variants: ExtractedVariant[];
  pricePoints: ExtractedPricePoint[];
  extractor: 'gemini' | 'groq';
}

/** Minimal search-hit shape the derivation needs (webSearch.SearchHit). */
export interface DerivationHit {
  title: string;
  url: string;
  content: string;
}

/** Hostname of a URL, lowercased, without a leading "www.". */
export function domainOfUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Domains whose spec/price pages count as authoritative for the
 * sourced-confidence rule: the official Pakistan brand sites plus
 * PakWheels and EV Decisions (structured spec databases). Listing
 * marketplaces and aggregators are corroborating, not authoritative.
 */
export const AUTHORITATIVE_DOMAINS: ReadonlySet<string> = new Set([
  'pakwheels.com',
  'evdecisions.com',
  'alektragroup.com',
  'changan.com.pk',
  'toyota-indus.com',
  'honda.com.pk',
  'suzuki.com.pk',
  'kia.com.pk',
  'hyundai-nishat.com',
  'yadea.com.pk',
]);

const NON_CASH_TOKEN = /down[ -]?payment|installment|instalment|booking|advance|easy monthly/i;

/**
 * A price is tainted when its own source page presents a figure of
 * the same size as a down-payment / installment / booking amount —
 * the NOTES #38 failure mode, guarded in code even if the extractor
 * mis-tags the priceType. Checks a ±90-char window around each
 * non-cash token for the price's digits.
 */
export function contextTaintsPrice(content: string, pricePkr: number): boolean {
  if (!content || !Number.isFinite(pricePkr) || pricePkr <= 0) return false;
  const digits = String(Math.round(pricePkr));
  const withCommas = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const re = new RegExp(NON_CASH_TOKEN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) {
    const from = Math.max(0, m.index - 90);
    const to = Math.min(content.length, m.index + m[0].length + 90);
    const window = content.slice(from, to).replace(/,/g, '');
    if (window.includes(digits) || window.includes(withCommas.replace(/,/g, ''))) return true;
  }
  return false;
}

function hitByUrl(hits: DerivationHit[], url: string): DerivationHit | undefined {
  return hits.find((h) => h.url === url);
}

/** A variant/point price survives only as a clean full-cash figure. */
function priceIsClean(
  pricePkr: number | null,
  priceType: string | null,
  sourceUrls: string[],
  hits: DerivationHit[]
): pricePkr is number {
  if (pricePkr === null || !Number.isFinite(pricePkr) || pricePkr <= 0) return false;
  if (priceType === 'installment' || priceType === 'booking') return false;
  for (const url of sourceUrls) {
    const hit = hitByUrl(hits, url);
    if (hit && contextTaintsPrice(hit.content, pricePkr)) return false;
  }
  return true;
}

function sourcesFor(urls: string[], hits: DerivationHit[]): { title: string; url: string }[] {
  const out: { title: string; url: string }[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (seen.has(url)) continue;
    seen.add(url);
    const hit = hitByUrl(hits, url);
    out.push({ title: hit?.title || domainOfUrl(url), url });
  }
  return out.slice(0, 3);
}

function domainsOf(urls: string[]): string[] {
  return [...new Set(urls.map(domainOfUrl).filter(Boolean))];
}

/**
 * Sourced-confidence rule (NOTES #47): HIGH when an authoritative
 * domain supplied the inputs, or when two independent domains agree
 * within 10%; a single non-authoritative source is MEDIUM.
 */
function sourcedConfidence(domains: string[], agreesAcrossDomains: boolean): 'high' | 'medium' {
  if (domains.some((d) => AUTHORITATIVE_DOMAINS.has(d)) || agreesAcrossDomains) return 'high';
  return 'medium';
}

export interface PickedVariant {
  variant: ExtractedVariant;
  index: number;
  matchedByPrice: boolean;
}

/**
 * Variant picking (NOTES #47): (a) the variant whose clean full-cash
 * price matches the vehicle's known card price within ±5%, else
 * (b) the base variant — smallest battery tier, else cheapest clean
 * price, else the first variant with any data.
 */
export function pickVariant(
  variants: ExtractedVariant[],
  knownPricePkr: unknown,
  hits: DerivationHit[]
): PickedVariant | null {
  const usable = variants
    .map((variant, index) => ({ variant, index }))
    .filter(
      ({ variant }) =>
        variant.pricePkr !== null ||
        variant.batteryKwh !== null ||
        variant.rangeKm !== null ||
        variant.fuelConsumption !== null
    );
  if (usable.length === 0) return null;

  const known = typeof knownPricePkr === 'number' && knownPricePkr > 0 ? knownPricePkr : null;
  if (known !== null) {
    // Closest clean price within ±5% wins (bands of neighbouring
    // variants can overlap; first-match would pick arbitrarily).
    let best: { variant: ExtractedVariant; index: number } | null = null;
    let bestDiff = Infinity;
    for (const u of usable) {
      if (!priceIsClean(u.variant.pricePkr, u.variant.priceType, u.variant.sourceUrls, hits)) {
        continue;
      }
      const diff = Math.abs((u.variant.pricePkr as number) - known) / known;
      if (diff <= 0.05 && diff < bestDiff) {
        best = u;
        bestDiff = diff;
      }
    }
    if (best) return { variant: best.variant, index: best.index, matchedByPrice: true };
  }

  const withBattery = usable.filter((u) => u.variant.batteryKwh !== null);
  if (withBattery.length > 0) {
    const base = withBattery.reduce((a, b) =>
      (b.variant.batteryKwh as number) < (a.variant.batteryKwh as number) ? b : a
    );
    return { variant: base.variant, index: base.index, matchedByPrice: false };
  }
  const withPrice = usable.filter((u) =>
    priceIsClean(u.variant.pricePkr, u.variant.priceType, u.variant.sourceUrls, hits)
  );
  if (withPrice.length > 0) {
    const base = withPrice.reduce((a, b) =>
      (b.variant.pricePkr as number) < (a.variant.pricePkr as number) ? b : a
    );
    return { variant: base.variant, index: base.index, matchedByPrice: false };
  }
  return { variant: usable[0].variant, index: usable[0].index, matchedByPrice: false };
}

function applyBand(
  type: PredictionType,
  ctx: Record<string, unknown> | undefined,
  result: PredictionResult
): PredictionResult {
  const band = validationBandFor(type, ctx);
  if (band && (result.value < band.min || result.value > band.max)) {
    result.confidence = 'low';
    const flag =
      ` Flagged: ${result.value} ${band.unit} is outside the expected ${band.min}–${band.max} ${band.unit} band for this vehicle type — treat with caution.`;
    result.reasoning = (result.reasoning + flag).slice(0, 300);
  }
  return result;
}

function buildSearchEfficiency(
  ctx: Record<string, unknown>,
  extraction: SpecExtractionResult,
  hits: DerivationHit[],
  provider: 'tavily' | 'serper'
): PredictionResult | null {
  const fuel = typeof ctx.fuelType === 'string' ? ctx.fuelType : '';
  const picked = pickVariant(extraction.variants, ctx.pricePkr, hits);
  if (!picked) return null;
  const v = picked.variant;
  const name = typeof ctx.name === 'string' ? ctx.name : 'This vehicle';
  const variantLabel = v.variantNote ? ` (${v.variantNote})` : '';
  const domains = domainsOf(v.sourceUrls);
  const sources = sourcesFor(v.sourceUrls, hits);

  if (fuel === 'petrol') {
    if (v.fuelConsumption === null || v.fuelConsumption <= 0) return null;
    // Cross-domain agreement: another variant from a different
    // domain stating a km/L within 10% of the picked figure.
    const agrees = extraction.variants.some(
      (o) =>
        o !== v &&
        o.fuelConsumption !== null &&
        o.fuelConsumption > 0 &&
        domainsOf(o.sourceUrls).some((d) => !domains.includes(d)) &&
        Math.abs(o.fuelConsumption - (v.fuelConsumption as number)) / (v.fuelConsumption as number) <= 0.1
    );
    const result: PredictionResult = {
      value: clampPrediction('car-efficiency', v.fuelConsumption),
      reasoning:
        `Sourced data (${domains.join(', ') || 'web search'}): ${name}${variantLabel} rated fuel average ` +
        `${v.fuelConsumption} km/L from the cited Pakistani source.`,
      confidence: sourcedConfidence(domains, agrees),
      source: 'sourced',
      sourceNote: domains[0] ?? 'Web search',
      specSource: domains.join(', '),
      sources,
      searchProvider: provider,
    };
    return applyBand('car-efficiency', ctx, result);
  }

  // EV / e-scooty: derive from extracted rated specs when present.
  const derived = deriveEvEfficiencyKwhPer100Km(v.batteryKwh, v.rangeKm);
  if (derived !== null) {
    const agrees = extraction.variants.some((o) => {
      if (o === v) return false;
      const od = deriveEvEfficiencyKwhPer100Km(o.batteryKwh, o.rangeKm);
      if (od === null) return false;
      return (
        domainsOf(o.sourceUrls).some((d) => !domains.includes(d)) &&
        Math.abs(od - derived) / derived <= 0.1
      );
    });
    const value = clampPrediction('car-efficiency', derived);
    const result: PredictionResult = {
      value,
      reasoning:
        `Sourced data (${domains.join(', ') || 'web search'}): ${name}${variantLabel} rated specs ` +
        `${v.batteryKwh} kWh / ${v.rangeKm} km. ` +
        `Derived in code: ${v.batteryKwh} kWh ÷ ${v.rangeKm} km × 100 = ${value} kWh/100km.`,
      confidence: sourcedConfidence(domains, agrees),
      source: 'sourced',
      sourceNote: domains[0] ?? 'Web search',
      batteryKwh: v.batteryKwh as number,
      ratedRangeKm: v.rangeKm as number,
      specSource: domains.join(', '),
      sources,
      searchProvider: provider,
    };
    return applyBand('car-efficiency', ctx, result);
  }
  // No specs, but the source states consumption directly.
  if (v.fuelConsumption !== null && v.fuelConsumption > 0) {
    const result: PredictionResult = {
      value: clampPrediction('car-efficiency', v.fuelConsumption),
      reasoning:
        `Sourced data (${domains.join(', ') || 'web search'}): ${name}${variantLabel} rated consumption ` +
        `${v.fuelConsumption} kWh/100km from the cited source (no battery/range specs published to derive from).`,
      confidence: sourcedConfidence(domains, false),
      source: 'sourced',
      sourceNote: domains[0] ?? 'Web search',
      specSource: domains.join(', '),
      sources,
      searchProvider: provider,
    };
    return applyBand('car-efficiency', ctx, result);
  }
  return null;
}

function buildSearchPrice(
  ctx: Record<string, unknown>,
  extraction: SpecExtractionResult,
  hits: DerivationHit[],
  provider: 'tavily' | 'serper'
): PredictionResult | null {
  const candidates: { price: number; urls: string[] }[] = [];
  for (const v of extraction.variants) {
    if (priceIsClean(v.pricePkr, v.priceType, v.sourceUrls, hits)) {
      candidates.push({ price: v.pricePkr, urls: v.sourceUrls });
    }
  }
  for (const p of extraction.pricePoints) {
    const urls = p.sourceUrl ? [p.sourceUrl] : [];
    if (priceIsClean(p.pricePkr, p.priceType, urls, hits)) {
      candidates.push({ price: p.pricePkr, urls });
    }
  }
  if (candidates.length === 0) return null;

  const prices = candidates.map((c) => c.price).sort((a, b) => a - b);
  const mid = Math.floor(prices.length / 2);
  const median = prices.length % 2 === 1 ? prices[mid] : (prices[mid - 1] + prices[mid]) / 2;
  const value = clampPrediction('car-price', median);

  const allUrls = [...new Set(candidates.flatMap((c) => c.urls))];
  const domains = domainsOf(allUrls);
  const nearMedian = candidates.filter((c) => Math.abs(c.price - median) / median <= 0.1);
  const agrees =
    new Set(nearMedian.flatMap((c) => domainsOf(c.urls))).size >= 2;
  const name = typeof ctx.name === 'string' ? ctx.name : 'This vehicle';

  const tiers = extraction.variants
    .filter((v) => v.batteryKwh !== null)
    .map((v) => v.batteryKwh as number)
    .sort((a, b) => a - b);
  const variantNote =
    tiers.length >= 2
      ? ` Across variants (${tiers[0]}–${tiers[tiers.length - 1]} kWh): Rs ${prices[0].toLocaleString('en-US')}–${prices[prices.length - 1].toLocaleString('en-US')}; median Rs ${Math.round(median).toLocaleString('en-US')}.`
      : '';

  return {
    value,
    reasoning:
      `Sourced data (${domains.join(', ') || 'web search'}): median of ${candidates.length} full-cash ` +
      `price${candidates.length === 1 ? '' : 's'} found for ${name}.${variantNote}`,
    confidence: sourcedConfidence(domains, agrees),
    source: 'sourced',
    sourceNote: domains[0] ?? 'Web search',
    sources: sourcesFor(allUrls, hits),
    searchProvider: provider,
  };
}

function buildSearchDepreciation(
  ctx: Record<string, unknown>,
  extraction: SpecExtractionResult,
  hits: DerivationHit[],
  provider: 'tavily' | 'serper'
): PredictionResult | null {
  const points = extraction.pricePoints.filter((p) => {
    const urls = p.sourceUrl ? [p.sourceUrl] : [];
    return p.modelYear !== null && priceIsClean(p.pricePkr, p.priceType, urls, hits);
  });
  if (points.length < 2) return null;
  const byYear = [...points].sort((a, b) => (a.modelYear as number) - (b.modelYear as number));
  const oldest = byYear[0];
  const newest = byYear[byYear.length - 1];
  const gap = (newest.modelYear as number) - (oldest.modelYear as number);
  if (gap < 1) return null;
  const newPrice = newest.pricePkr as number;
  const oldPrice = oldest.pricePkr as number;
  if (oldPrice >= newPrice) return null; // no defensible drop — model path decides
  const dropPct = (1 - oldPrice / newPrice) * 100;
  const fiveYearPct = dropPct * (5 / gap);
  const value = clampPrediction('car-depreciation', fiveYearPct);
  const allUrls = [...new Set(points.map((p) => p.sourceUrl).filter(Boolean) as string[])];
  const domains = domainsOf(allUrls);
  const name = typeof ctx.name === 'string' ? ctx.name : 'This vehicle';
  return {
    value,
    reasoning:
      `Sourced data (${domains.join(', ') || 'web search'}): ${name} asking prices fall from ` +
      `Rs ${newPrice.toLocaleString('en-US')} (${newest.modelYear}) to Rs ${oldPrice.toLocaleString('en-US')} ` +
      `(${oldest.modelYear}) — a ${dropPct.toFixed(1)}% drop over ${gap} year${gap === 1 ? '' : 's'}, ` +
      `scaled to a 5-year figure in code.`,
    confidence: sourcedConfidence(domains, false),
    source: 'sourced',
    sourceNote: domains[0] ?? 'Web search',
    sources: sourcesFor(allUrls, hits),
    searchProvider: provider,
  };
}

/**
 * Turn an extraction (numbers read off real pages) into a validated
 * PredictionResult, or null when the extraction carries nothing
 * usable for this type — the caller then falls back (page-text retry,
 * the other provider, or the model path). Pure: no I/O, no clock.
 */
export function buildSearchBackedResult(
  type: PredictionType,
  ctx: Record<string, unknown>,
  extraction: SpecExtractionResult,
  hits: DerivationHit[],
  provider: 'tavily' | 'serper'
): PredictionResult | null {
  if (type === 'car-efficiency') return buildSearchEfficiency(ctx, extraction, hits, provider);
  if (type === 'car-price') return buildSearchPrice(ctx, extraction, hits, provider);
  if (type === 'car-depreciation') return buildSearchDepreciation(ctx, extraction, hits, provider);
  return null;
}
