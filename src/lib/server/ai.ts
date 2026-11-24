/**
 * Server-side LLM client for AI Assist (NOTES #27 — Gate 6 Amendment 3).
 *
 * API keys exist ONLY in the server's environment (.env.server on the
 * host, never in git, never sent to the browser). Every prediction
 * goes browser -> POST /api/ai/predict -> here -> the model chain.
 *
 * Provider order (NOTES #52 — owner directive, 24 Nov 2026): Gemini
 * (GEMINI_MODEL, default gemini-flash-lite-latest) is the PRIMARY
 * model for regular predictions; Groq (GROQ_MODEL, default
 * openai/gpt-oss-120b) is the FALLBACK. Grounded (live-price) types
 * still get Groq's browser_search attempt first — it is the only
 * live-data mechanism for those types — then Gemini, then plain Groq.
 * Results are cached in memory for 6 hours per unique (type, context)
 * and each caller IP is softly capped per day, so a busy UI cannot
 * burn the quota.
 *
 * NOTES #47: vehicle fields first resolve through the web-search
 * pipeline (src/lib/webSearch.ts + src/lib/specExtraction.ts —
 * Tavily/Serper search, Gemini/Groq extraction, code derivation,
 * 14-day cache) before this model chain is consulted as the
 * last-resort guess. NOTES #52 also caps that pipeline with an
 * overall time budget (SEARCH_PIPELINE_BUDGET_MS) so a cold cache
 * miss degrades to the model chain in seconds instead of walking a
 * multi-minute sequential timeout waterfall (measured live: 48.8s
 * for one cold field before the budget).
 */

import {
  AI_SYSTEM_PROMPT,
  PREDICTIONS,
  PredictionResult,
  PredictionType,
  parsePrediction,
  isGroundedPrediction,
  buildSearchBackedResult,
  isSearchBackedPrediction,
} from '@/lib/aiPredictions';
import { findGroundTruth } from '@/lib/vehicleGroundTruth';
import {
  buildVehicleSearchQuery,
  enrichHitsWithPageText,
  isWebSearchConfigured,
  searchVehicleWebDetailed,
  searchWithProvider,
} from '@/lib/webSearch';
import { extractVehicleSpecs, SpecField } from '@/lib/specExtraction';
import { ForeignMappingResult } from '@/types';
import {
  getDefaultFallbackProfile,
  getProfileSchemaPromptString,
} from '@/lib/portfolioTransfer';
import { sanitizeProfile } from '@/lib/stateUrl';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DAILY_CAP_PER_IP = 300;
const TIMEOUT_MS = 20_000;
const GEMINI_TIMEOUT_MS = 15_000;
const GROUNDED_TIMEOUT_MS = 30_000;

interface AiConfig {
  groqApiKey: string | null;
  groqModel: string;
  geminiApiKey: string | null;
  geminiModel: string;
  provider: string;
}

export function getAiConfig(): AiConfig | null {
  const groqApiKey = process.env.GROQ_API_KEY || null;
  const geminiApiKey = process.env.GEMINI_API_KEY || null;
  if (!groqApiKey && !geminiApiKey) return null;
  return {
    groqApiKey,
    groqModel: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    geminiApiKey,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-flash-lite-latest',
    provider: process.env.AI_PROVIDER || 'gemini',
  };
}

/**
 * Thin provider layer (NOTES #46, order swapped in #52): Gemini is
 * the primary seat, Groq the fallback seat. Provider + model are
 * chosen by env (AI_PROVIDER names the primary seat; GEMINI_MODEL /
 * GROQ_MODEL pick the models). The grounded (browser_search) option
 * exists only on the Groq seat — Gemini's plain free-tier API has no
 * equivalent, and search grounding is paywalled (verified 23 Nov).
 */
export interface AiProvider {
  id: string;
  chat: (
    cfg: AiConfig,
    model: string,
    type: PredictionType,
    context: Record<string, unknown>,
    opts?: { grounded?: boolean }
  ) => Promise<(PredictionResult & { model: string }) | null>;
}

const groqProvider: AiProvider = {
  id: 'groq',
  chat: (cfg, model, type, context, opts) => callGroq(cfg, model, type, context, opts),
};

const geminiProvider: AiProvider = {
  id: 'gemini',
  chat: (cfg, model, type, context) => callGemini(cfg, model, type, context),
};

const AI_PROVIDERS: Record<string, AiProvider> = { gemini: geminiProvider, groq: groqProvider };

export function getAiProvider(cfg?: AiConfig): AiProvider {
  const id = cfg?.provider || process.env.AI_PROVIDER || 'gemini';
  return AI_PROVIDERS[id] ?? geminiProvider;
}

/** Primary-seat call: Gemini generateContent in JSON mode. */
async function callGemini(
  cfg: AiConfig,
  model: string,
  type: PredictionType,
  context: Record<string, unknown>
): Promise<(PredictionResult & { model: string }) | null> {
  if (!cfg.geminiApiKey) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_URL_BASE}/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-goog-api-key': cfg.geminiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: AI_SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: PREDICTIONS[type].buildPrompt(context) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.3,
          maxOutputTokens: 400,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('');
    if (!text.trim()) return null;
    const parsed = parsePrediction(type, text, context);
    return parsed ? { ...parsed, model } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export const MAX_CACHE_ENTRIES = 500;
export const MAX_DAILY_ENTRIES = 500;

const cache = new Map<string, { at: number; result: PredictionResult & { model: string } }>();
const dailyCounts = new Map<string, { day: string; count: number }>();
let lastDayString = new Date().toISOString().slice(0, 10);

export function stableStringify(val: unknown): string {
  if (val === null || typeof val !== 'object') {
    return JSON.stringify(val);
  }
  if (Array.isArray(val)) {
    return '[' + val.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(val as Record<string, unknown>).sort();
  return '{' + keys.map((k) => `${JSON.stringify(k)}:${stableStringify((val as Record<string, unknown>)[k])}`).join(',') + '}';
}

export function cacheKey(type: PredictionType, context: Record<string, unknown>): string {
  return `${type}::${stableStringify(context)}`;
}

function setBoundedEntry<T>(map: Map<string, T>, key: string, value: T, max = MAX_CACHE_ENTRIES): void {
  if (map.has(key)) {
    map.delete(key);
  } else if (map.size >= max) {
    const oldest = map.keys().next().value;
    if (oldest !== undefined) map.delete(oldest);
  }
  map.set(key, value);
}

function checkDayRollover(overrideToday?: string): void {
  const today = overrideToday || new Date().toISOString().slice(0, 10);
  if (today !== lastDayString) {
    dailyCounts.clear();
    lastDayString = today;
  }
}

function underCap(ip: string, overrideDate?: string): boolean {
  checkDayRollover(overrideDate);
  const day = lastDayString;
  const entry = dailyCounts.get(ip);
  if (!entry || entry.day !== day) {
    if (dailyCounts.size >= MAX_DAILY_ENTRIES) {
      const oldest = dailyCounts.keys().next().value;
      if (oldest !== undefined) dailyCounts.delete(oldest);
    }
    dailyCounts.set(ip, { day, count: 1 });
    return true;
  }
  entry.count += 1;
  return entry.count <= DAILY_CAP_PER_IP;
}

async function callGroq(
  cfg: AiConfig,
  model: string,
  type: PredictionType,
  context: Record<string, unknown>,
  opts?: { grounded?: boolean }
): Promise<(PredictionResult & { model: string }) | null> {
  if (!cfg.groqApiKey) return null;
  const grounded = opts?.grounded === true;
  const controller = new AbortController();
  // Browser search browses live pages server-side — it needs longer
  // than a plain completion, but the old 60s allowance let one hung
  // grounded call dominate the whole request (NOTES #52): 30s cap.
  const timer = setTimeout(() => controller.abort(), grounded ? GROUNDED_TIMEOUT_MS : TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        grounded
          ? {
              // Groq built-in browser_search (gpt-oss models only).
              // NOT compatible with response_format / structured
              // outputs — the prompt demands the JSON as the final
              // block and parsePrediction extracts the last object.
              model,
              messages: [
                { role: 'system', content: AI_SYSTEM_PROMPT },
                { role: 'user', content: PREDICTIONS[type].buildPrompt(context) },
              ],
              tools: [{ type: 'browser_search' }],
              tool_choice: 'required',
              reasoning_effort: 'low',
              max_completion_tokens: 3000,
            }
          : {
              model,
              messages: [
                { role: 'system', content: AI_SYSTEM_PROMPT },
                { role: 'user', content: PREDICTIONS[type].buildPrompt(context) },
              ],
              response_format: { type: 'json_object' },
              temperature: 0.3,
              max_tokens: 400,
            }
      ),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = parsePrediction(type, content, context);
    return parsed ? { ...parsed, model: grounded ? `${model} + browser_search` : model } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type PredictOutcome =
  | { ok: true; result: PredictionResult & { model: string }; cached: boolean }
  | { ok: false; reason: 'not_configured' | 'rate_limited' | 'unavailable' };

/* ------------------------------------------------------------------ */
/* Web-search pipeline (NOTES #47 — AI Assist v3).                     */
/*                                                                     */
/* For vehicle fields the resolution order is: ground truth → this     */
/* pipeline → the Groq guess. The pipeline searches the web (Tavily,   */
/* Serper fallback), has an extractor model read the hits, and         */
/* derives the value in code from the extracted, cited figures.        */
/* Search-backed results are cached for 14 days per vehicle+field:     */
/* a cache hit consumes zero provider quota.                           */
/* ------------------------------------------------------------------ */

const SEARCH_CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

const searchCache = new Map<
  string,
  { at: number; result: PredictionResult & { model: string } }
>();

/** Cache-key normalisation: case/punctuation-insensitive vehicle name. */
export function normalizeVehicleName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function searchCacheKey(
  type: PredictionType,
  context: Record<string, unknown>
): string {
  return `${type}::${normalizeVehicleName(context.name)}`;
}

const SEARCH_FIELD_FOR_TYPE: Partial<Record<PredictionType, SpecField>> = {
  'car-price': 'price',
  'car-efficiency': 'efficiency',
  'car-depreciation': 'depreciation',
};

/**
 * Overall budget for one search-pipeline attempt (NOTES #52). The
 * stages below are sequential provider calls, each with its own
 * timeout; without a budget a cold miss could stack them into
 * minutes (measured 48.8s live, timeouts allow far worse). When the
 * budget is spent the pipeline gives up and the model chain answers
 * instead — a labelled guess now beats a sourced answer in a minute.
 */
const SEARCH_PIPELINE_BUDGET_MS = 25_000;

async function trySearchPipeline(
  type: PredictionType,
  context: Record<string, unknown>
): Promise<(PredictionResult & { model: string }) | null> {
  const field = SEARCH_FIELD_FOR_TYPE[type];
  if (!field) return null;
  const name = typeof context.name === 'string' ? context.name : '';
  const query = buildVehicleSearchQuery(type, context);
  const startedAt = Date.now();
  const overBudget = () => Date.now() - startedAt > SEARCH_PIPELINE_BUDGET_MS;

  let outcome = await searchVehicleWebDetailed(query);
  let extraction =
    outcome.hits.length > 0 ? await extractVehicleSpecs(name, field, outcome.hits) : null;
  let built =
    extraction && outcome.provider
      ? buildSearchBackedResult(type, context, extraction, outcome.hits, outcome.provider)
      : null;

  // Extraction-level fallback: Tavily's hits yielded nothing usable
  // → give Serper's Google index a shot at the same query.
  if (!built && outcome.provider === 'tavily' && !overBudget()) {
    const serperHits = await searchWithProvider('serper', query);
    if (serperHits && serperHits.length > 0) {
      const ex2 = await extractVehicleSpecs(name, field, serperHits);
      const built2 = ex2
        ? buildSearchBackedResult(type, context, ex2, serperHits, 'serper')
        : null;
      if (built2) {
        built = built2;
        extraction = ex2;
        outcome = { hits: serperHits, provider: 'serper' };
      }
    }
  }

  // Serper snippets carried no usable numbers → fetch the top pages
  // and extract from their full text once.
  if (!built && outcome.provider === 'serper' && outcome.hits.length > 0 && !overBudget()) {
    const enriched = await enrichHitsWithPageText(outcome.hits, 2);
    const ex3 = await extractVehicleSpecs(name, field, enriched);
    const built3 = ex3
      ? buildSearchBackedResult(type, context, ex3, enriched, 'serper')
      : null;
    if (built3) {
      built = built3;
      extraction = ex3;
    }
  }

  if (!built || !extraction || !outcome.provider) return null;
  return {
    ...built,
    model: `Web search · ${outcome.provider} + ${extraction.extractor}`,
  };
}

/**
 * Single-flight de-duplication (NOTES #46): identical in-flight
 * prediction requests share ONE upstream call chain, keyed by the
 * same cache key as the 6h cache. Bulk fills stay sequential; this
 * only collapses concurrent duplicates, never parallelises.
 */
const inFlight = new Map<string, Promise<PredictOutcome>>();

export async function predictWithAi(
  type: PredictionType,
  context: Record<string, unknown>,
  ip: string
): Promise<PredictOutcome> {
  // Ground truth first (NOTES #46): a table hit returns instantly,
  // labelled as sourced data — no model call, no API key needed, no
  // daily-cap consumption.
  const sourced = findGroundTruth(type, context);
  if (sourced) return { ok: true, result: sourced, cached: false };

  // Search cache (NOTES #47): a vehicle+field resolved from the web
  // in the last 14 days returns instantly and consumes no quota —
  // checked before any provider configuration, like ground truth.
  const searchBacked = isSearchBackedPrediction(type);
  const sKey = searchBacked ? searchCacheKey(type, context) : null;
  if (sKey) {
    const sHit = searchCache.get(sKey);
    if (sHit && Date.now() - sHit.at < SEARCH_CACHE_TTL_MS) {
      searchCache.delete(sKey);
      searchCache.set(sKey, sHit);
      return { ok: true, result: sHit.result, cached: true };
    }
  }

  const cfg = getAiConfig();
  const searchReady = searchBacked && isWebSearchConfigured();
  if (!cfg && !searchReady) return { ok: false, reason: 'not_configured' };

  const key = cacheKey(type, context);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    cache.delete(key);
    cache.set(key, hit);
    return { ok: true, result: hit.result, cached: true };
  }

  const pending = inFlight.get(key);
  if (pending) return pending;

  const promise = (async (): Promise<PredictOutcome> => {
    if (!underCap(ip)) return { ok: false, reason: 'rate_limited' };

    // Web-search pipeline (NOTES #47): vehicle fields resolve from
    // real pages before any model guess is attempted.
    let searchAttempted = false;
    if (searchReady && sKey) {
      searchAttempted = true;
      const resolved = await trySearchPipeline(type, context);
      if (resolved) {
        setBoundedEntry(searchCache, sKey, { at: Date.now(), result: resolved });
        return { ok: true, result: resolved, cached: false };
      }
    }
    if (!cfg) return { ok: false, reason: 'unavailable' };

    // Model chain (NOTES #52): Gemini primary for regular types.
    // Grounded (live-price) types get Groq's browser_search attempt
    // first — the only live-data mechanism for those types — then
    // Gemini, then plain Groq GPT-OSS 120B as the fallback seat.
    let result: (PredictionResult & { model: string }) | null = null;
    if (isGroundedPrediction(type) && cfg.groqApiKey) {
      result = await callGroq(cfg, cfg.groqModel, type, context, { grounded: true });
    }
    if (!result && cfg.geminiApiKey) {
      result = await callGemini(cfg, cfg.geminiModel, type, context);
    }
    if (!result && cfg.groqApiKey) {
      result = await callGroq(cfg, cfg.groqModel, type, context);
    }
    if (!result) return { ok: false, reason: 'unavailable' };

    if (searchAttempted) {
      // The search ran and found nothing usable: this model guess is
      // a last resort and is labelled as such — unverified, low
      // confidence, never "sourced", never "derived in code".
      result = {
        ...result,
        confidence: 'low',
        reasoning: (
          result.reasoning +
          ' Web search found no sourced data for this vehicle — treat this as an unverified model estimate.'
        ).slice(0, 300),
      };
    }

    setBoundedEntry(cache, key, { at: Date.now(), result });
    return { ok: true, result, cached: false };
  })();

  inFlight.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(key);
  }
}

const mappingCache = new Map<string, { at: number; result: ForeignMappingResult & { model: string } }>();

function mappingCacheKey(payload: string): string {
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }
  return `map::${payload.length}::${hash}`;
}

function buildMappingPrompts(foreignPayload: string): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = `You are RizqFlow's AI Portfolio Field Mapping Assistant.
RizqFlow is a Pakistani personal finance and wealth planning application.
Your goal is to parse and map foreign financial data (from CSV, JSON, Wealthsimple, Mint, YNAB, bank statements, salary slips) into the RizqFlow UserProfile schema.

RizqFlow UserProfile Schema:
${getProfileSchemaPromptString()}

Return a strict JSON object with this EXACT structure:
{
  "profile": { ...extracted UserProfile fields... },
  "mapping": [
    { "source": "foreign field name or path", "target": "UserProfile field name", "confidence": "high" | "medium" | "low", "note": "brief explanation" }
  ],
  "unmapped": ["foreign_field_1", "foreign_field_2", ...]
}
Rules:
1. Normalize numbers (remove commas, currency symbols, handle Lac = 100,000, Crore = 10,000,000, k = 1,000).
2. Clean all text, keep values realistic within the specified schema ranges.
3. Every unmapped key in the foreign input must be listed in "unmapped".
4. Output MUST be strictly valid JSON, no markdown formatting or extra text outside the JSON.`;
  const userPrompt = `Here is the foreign financial payload to map:\n${foreignPayload}`;
  return { systemPrompt, userPrompt };
}

function parseMappingContent(
  content: string,
  model: string
): (ForeignMappingResult & { model: string }) | null {
  try {
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object') return null;

    const fallback = getDefaultFallbackProfile();
    const profile = sanitizeProfile(parsed.profile, fallback);
    const mapping = Array.isArray(parsed.mapping)
      ? parsed.mapping.map((m: any) => ({
          source: String(m?.source || ''),
          target: String(m?.target || ''),
          confidence: ['high', 'medium', 'low'].includes(m?.confidence) ? m.confidence : 'medium',
          note: String(m?.note || ''),
        }))
      : [];
    const unmapped = Array.isArray(parsed.unmapped)
      ? parsed.unmapped.map((u: any) => String(u))
      : [];

    return { profile, mapping, unmapped, model };
  } catch {
    return null;
  }
}

/** Mapping, primary seat (NOTES #52): Gemini in JSON mode. */
async function callGeminiForMapping(
  cfg: AiConfig,
  model: string,
  foreignPayload: string
): Promise<(ForeignMappingResult & { model: string }) | null> {
  if (!cfg.geminiApiKey) return null;
  const { systemPrompt, userPrompt } = buildMappingPrompts(foreignPayload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GEMINI_URL_BASE}/${model}:generateContent`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'x-goog-api-key': cfg.geminiApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userPrompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 1500,
        },
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('');
    if (!text.trim()) return null;
    return parseMappingContent(text, model);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGroqForMapping(
  cfg: AiConfig,
  model: string,
  foreignPayload: string
): Promise<(ForeignMappingResult & { model: string }) | null> {
  if (!cfg.groqApiKey) return null;
  const { systemPrompt, userPrompt } = buildMappingPrompts(foreignPayload);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.groqApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return parseMappingContent(content, model);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type MapPortfolioOutcome =
  | { ok: true; result: ForeignMappingResult & { model: string }; cached: boolean }
  | { ok: false; reason: 'not_configured' | 'rate_limited' | 'unavailable' };

export async function mapPortfolioWithAi(
  foreignPayload: string,
  ip: string
): Promise<MapPortfolioOutcome> {
  const cfg = getAiConfig();
  if (!cfg) return { ok: false, reason: 'not_configured' };

  const key = mappingCacheKey(foreignPayload);
  const hit = mappingCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    mappingCache.delete(key);
    mappingCache.set(key, hit);
    return { ok: true, result: hit.result, cached: true };
  }

  if (!underCap(ip)) return { ok: false, reason: 'rate_limited' };

  // Mapping chain (NOTES #52): Gemini primary, Groq GPT-OSS 120B fallback.
  const primary = await callGeminiForMapping(cfg, cfg.geminiModel, foreignPayload);
  const result = primary ?? (await callGroqForMapping(cfg, cfg.groqModel, foreignPayload));
  if (!result) return { ok: false, reason: 'unavailable' };

  setBoundedEntry(mappingCache, key, { at: Date.now(), result });
  return { ok: true, result, cached: false };
}

export function _resetAiStateForTesting(): void {
  cache.clear();
  mappingCache.clear();
  searchCache.clear();
  dailyCounts.clear();
  inFlight.clear();
  lastDayString = new Date().toISOString().slice(0, 10);
}

export function _getSearchCacheSizeForTesting(): number {
  return searchCache.size;
}

export function _getInFlightSizeForTesting(): number {
  return inFlight.size;
}

export function _getAiCacheSizeForTesting(): number {
  return cache.size;
}

export function _getMappingCacheSizeForTesting(): number {
  return mappingCache.size;
}

export function _getDailyCountsSizeForTesting(): number {
  return dailyCounts.size;
}

export function _triggerDayRolloverForTesting(nextDay: string): void {
  checkDayRollover(nextDay);
}

export function _insertCacheForTesting(key: string, result: any): void {
  setBoundedEntry(cache, key, { at: Date.now(), result });
}

export function _testUnderCap(ip: string, overrideDate?: string): boolean {
  return underCap(ip, overrideDate);
}

