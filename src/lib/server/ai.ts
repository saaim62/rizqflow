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
} from '@/lib/aiPredictions';

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
  context: Record<string, unknown>
): Promise<(PredictionResult & { model: string }) | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
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
          { role: 'system', content: AI_SYSTEM_PROMPT },
          { role: 'user', content: PREDICTIONS[type].buildPrompt(context) },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 400,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = parsePrediction(type, content);
    return parsed ? { ...parsed, model } : null;
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

  const primary = await callGroq(cfg, cfg.model, type, context);
  const result = primary ?? (await callGroq(cfg, cfg.fallbackModel, type, context));
  if (!result) return { ok: false, reason: 'unavailable' };

  cache.set(key, { at: Date.now(), result });
  return { ok: true, result, cached: false };
}
