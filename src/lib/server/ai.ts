/**
 * Server-side Groq client for AI Assist (NOTES #27 — Gate 6 Amendment 3).
 *
 * The API key exists ONLY in the server's environment (.env.server on
 * the host, never in git, never sent to the browser). Every prediction
 * goes browser -> POST /api/ai/predict -> here -> Groq. Primary model
 * first (GROQ_MODEL, default openai/gpt-oss-120b); on any failure the
 * fallback model (GROQ_MODEL_FALLBACK, default qwen/qwen3.8-27b) gets
 * one attempt. Results are cached in memory for 6 hours per unique
 * (type, context) and each caller IP is softly capped per day, so a
 * busy UI cannot burn the quota.
 */

import {
  AI_SYSTEM_PROMPT,
  PREDICTIONS,
  PredictionResult,
  PredictionType,
  parsePrediction,
  isGroundedPrediction,
} from '@/lib/aiPredictions';
import { ForeignMappingResult } from '@/types';
import {
  getDefaultFallbackProfile,
  getProfileSchemaPromptString,
} from '@/lib/portfolioTransfer';
import { sanitizeProfile } from '@/lib/stateUrl';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DAILY_CAP_PER_IP = 300;
const TIMEOUT_MS = 20_000;

interface AiConfig {
  apiKey: string;
  model: string;
  fallbackModel: string;
}

export function getAiConfig(): AiConfig | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
    fallbackModel: process.env.GROQ_MODEL_FALLBACK || 'qwen/qwen3.8-27b',
  };
}

const cache = new Map<string, { at: number; result: PredictionResult & { model: string } }>();
const dailyCounts = new Map<string, { day: string; count: number }>();

function cacheKey(type: PredictionType, context: Record<string, unknown>): string {
  const stable = Object.keys(context)
    .sort()
    .map((k) => `${k}=${String(context[k])}`)
    .join('|');
  return `${type}::${stable}`;
}

function underCap(ip: string): boolean {
  const day = new Date().toISOString().slice(0, 10);
  const entry = dailyCounts.get(ip);
  if (!entry || entry.day !== day) {
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
  const grounded = opts?.grounded === true;
  const controller = new AbortController();
  // Browser search browses live pages server-side — it needs far
  // longer than a plain completion (NOTES #38).
  const timer = setTimeout(() => controller.abort(), grounded ? 60_000 : TIMEOUT_MS);
  try {
    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
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
    const parsed = parsePrediction(type, content);
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

export async function predictWithAi(
  type: PredictionType,
  context: Record<string, unknown>,
  ip: string
): Promise<PredictOutcome> {
  const cfg = getAiConfig();
  if (!cfg) return { ok: false, reason: 'not_configured' };

  const key = cacheKey(type, context);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return { ok: true, result: hit.result, cached: true };
  }

  if (!underCap(ip)) return { ok: false, reason: 'rate_limited' };

  // Grounded types (volatile market prices): browser-search call on
  // the primary model first, then the plain primary, then fallback.
  let result: (PredictionResult & { model: string }) | null = null;
  if (isGroundedPrediction(type)) {
    result = await callGroq(cfg, cfg.model, type, context, { grounded: true });
  }
  if (!result) result = await callGroq(cfg, cfg.model, type, context);
  if (!result) result = await callGroq(cfg, cfg.fallbackModel, type, context);
  if (!result) return { ok: false, reason: 'unavailable' };

  cache.set(key, { at: Date.now(), result });
  return { ok: true, result, cached: false };
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

async function callGroqForMapping(
  cfg: AiConfig,
  model: string,
  foreignPayload: string
): Promise<(ForeignMappingResult & { model: string }) | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
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

    const res = await fetch(GROQ_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${cfg.apiKey}`,
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

    return {
      profile,
      mapping,
      unmapped,
      model,
    };
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
    return { ok: true, result: hit.result, cached: true };
  }

  if (!underCap(ip)) return { ok: false, reason: 'rate_limited' };

  const primary = await callGroqForMapping(cfg, cfg.model, foreignPayload);
  const result = primary ?? (await callGroqForMapping(cfg, cfg.fallbackModel, foreignPayload));
  if (!result) return { ok: false, reason: 'unavailable' };

  mappingCache.set(key, { at: Date.now(), result });
  return { ok: true, result, cached: false };
}

