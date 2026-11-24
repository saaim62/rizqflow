/**
 * Spec extraction for AI Assist v3 (NOTES #47 — owner directive,
 * Round 4). SERVER-ONLY: reads provider keys from the server
 * environment; called exclusively from src/lib/server/ai.ts behind
 * POST /api/ai/predict.
 *
 * Job: turn search hits (real pages) into structured numbers. The
 * extractor model READS the hits and copies figures out — it is
 * forbidden from inventing any number, and null is a legal, expected
 * answer for every field. Every figure carries the URL(s) it was
 * copied from, and URLs not present in the hits are dropped during
 * normalisation, so provenance cannot be fabricated either.
 *
 * Providers: Gemini first (GEMINI_API_KEY / GEMINI_MODEL, free tier,
 * JSON response mode); on any Gemini failure the Groq primary model
 * (the existing AI Assist provider seat) gets one attempt.
 */

import {
  ExtractedPricePoint,
  ExtractedVariant,
  SpecExtractionResult,
} from '@/lib/aiPredictions';
import { SearchHit } from '@/lib/webSearch';

export type SpecField = 'price' | 'efficiency' | 'depreciation';

const EXTRACTION_TIMEOUT_MS = 12_000;
const GEMINI_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MAX_HIT_CONTENT_CHARS = 1_500;

function buildExtractionPrompt(
  vehicleName: string,
  field: SpecField,
  hits: SearchHit[]
): string {
  const hitText = hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title}\nURL: ${h.url}\n${h.content.slice(0, MAX_HIT_CONTENT_CHARS)}`
    )
    .join('\n\n');
  return (
    `You extract vehicle specifications from Pakistani web search results. ` +
    `Vehicle: "${vehicleName}". Field wanted: ${field}.\n\n` +
    `SEARCH HITS:\n${hitText}\n\n` +
    `Return STRICT JSON only, exactly this shape:\n` +
    `{"variants":[{"variantNote":<string|null>,"pricePkr":<number|null>,"priceType":<"full-cash"|"installment"|"booking"|null>,"batteryKwh":<number|null>,"rangeKm":<number|null>,"fuelConsumption":<number|null>,"sourceUrls":[<url>,...]}],` +
    `"pricePoints":[{"modelYear":<number|null>,"pricePkr":<number|null>,"priceType":<"full-cash"|"installment"|"booking"|null>,"sourceUrl":<url|null>}]}\n\n` +
    `Rules:\n` +
    `- Copy numbers ONLY from the hits above. Never use your own knowledge. If a figure is not in the hits, use null — null is a correct answer.\n` +
    `- If the vehicle comes in several variants (e.g. battery tiers), return one variants entry PER variant, with its own price/specs.\n` +
    `- priceType: "full-cash" unless the hit presents that exact figure as a down payment ("installment"), booking or advance amount ("booking").\n` +
    `- fuelConsumption: for an EV, consumption in kWh/100km ONLY if a hit states it directly (do NOT divide battery by range yourself); for a petrol vehicle, fuel average in km per litre.\n` +
    `- rangeKm: a single rated range figure; if a hit gives a range like "80-100 km", use the midpoint.\n` +
    `- pricePoints: one entry per model-year asking price you find (for depreciation), each with its modelYear.\n` +
    `- sourceUrls / sourceUrl: copy the hit URL(s) each figure came from, exactly as shown. No other URLs.\n` +
    `- Prices are Pakistani Rupees (PKR). Discard any figure that appears to be Indian Rupees (INR).`
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(prompt: string): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';
  const res = await fetchWithTimeout(
    `${GEMINI_URL_BASE}/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.1 },
      }),
    },
    EXTRACTION_TIMEOUT_MS
  );
  if (!res || !res.ok) return null;
  try {
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const text = parts.map((p) => p.text ?? '').join('');
    return text.trim() ? text : null;
  } catch {
    return null;
  }
}

async function callGroq(prompt: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
  const res = await fetchWithTimeout(
    GROQ_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You are a strict data-extraction engine. Reply with JSON only, exactly the shape the user specifies. Copy numbers only from the provided search hits; use null for anything absent.',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 1200,
      }),
    },
    EXTRACTION_TIMEOUT_MS
  );
  if (!res || !res.ok) return null;
  try {
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    return content && content.trim() ? content : null;
  } catch {
    return null;
  }
}

function numOrNull(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const parsed = Number(v.replace(/,/g, '').trim());
    return Number.isFinite(parsed) && v.trim() !== '' ? parsed : null;
  }
  return null;
}

function priceTypeOrNull(v: unknown): 'full-cash' | 'installment' | 'booking' | null {
  if (v === 'full-cash' || v === 'installment' || v === 'booking') return v;
  if (typeof v === 'string') {
    const t = v.toLowerCase();
    if (t.includes('install')) return 'installment';
    if (t.includes('booking') || t.includes('advance')) return 'booking';
    if (t.includes('full') || t.includes('cash')) return 'full-cash';
  }
  return null;
}

function normaliseExtraction(
  raw: unknown,
  hits: SearchHit[],
  extractor: 'gemini' | 'groq'
): SpecExtractionResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const hitUrls = new Set(hits.map((h) => h.url));
  const cleanUrls = (v: unknown): string[] => {
    if (!Array.isArray(v)) return [];
    return v.filter((u): u is string => typeof u === 'string' && hitUrls.has(u));
  };

  // Accept either the variants shape or the flat single-object shape.
  const rawVariants: unknown[] = Array.isArray(obj.variants)
    ? obj.variants
    : [obj];
  const variants: ExtractedVariant[] = [];
  for (const rv of rawVariants) {
    if (!rv || typeof rv !== 'object') continue;
    const r = rv as Record<string, unknown>;
    const variant: ExtractedVariant = {
      variantNote: typeof r.variantNote === 'string' ? r.variantNote.slice(0, 80) : null,
      pricePkr: numOrNull(r.pricePkr),
      priceType: priceTypeOrNull(r.priceType),
      batteryKwh: numOrNull(r.batteryKwh),
      rangeKm: numOrNull(r.rangeKm),
      fuelConsumption: numOrNull(r.fuelConsumption),
      sourceUrls: cleanUrls(r.sourceUrls),
    };
    if (
      variant.pricePkr !== null ||
      variant.batteryKwh !== null ||
      variant.rangeKm !== null ||
      variant.fuelConsumption !== null
    ) {
      variants.push(variant);
    }
  }

  const pricePoints: ExtractedPricePoint[] = [];
  if (Array.isArray(obj.pricePoints)) {
    for (const rp of obj.pricePoints) {
      if (!rp || typeof rp !== 'object') continue;
      const r = rp as Record<string, unknown>;
      const point: ExtractedPricePoint = {
        modelYear: numOrNull(r.modelYear),
        pricePkr: numOrNull(r.pricePkr),
        priceType: priceTypeOrNull(r.priceType),
        sourceUrl:
          typeof r.sourceUrl === 'string' && hitUrls.has(r.sourceUrl) ? r.sourceUrl : null,
      };
      if (point.pricePkr !== null) pricePoints.push(point);
    }
  }

  if (variants.length === 0 && pricePoints.length === 0) return null;
  return { variants, pricePoints, extractor };
}

function parseExtractionText(
  text: string,
  hits: SearchHit[],
  extractor: 'gemini' | 'groq'
): SpecExtractionResult | null {
  const candidates: string[] = [text];
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) candidates.push(text.slice(start, end + 1));
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const normalised = normaliseExtraction(parsed, hits, extractor);
      if (normalised) return normalised;
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/**
 * Extract structured specs for one vehicle from search hits.
 * Gemini first, Groq fallback; null when neither yields usable,
 * provenance-checked data.
 */
export async function extractVehicleSpecs(
  vehicleName: string,
  field: SpecField,
  hits: SearchHit[]
): Promise<SpecExtractionResult | null> {
  if (hits.length === 0) return null;
  const prompt = buildExtractionPrompt(vehicleName, field, hits);

  const geminiText = await callGemini(prompt);
  if (geminiText) {
    const parsed = parseExtractionText(geminiText, hits, 'gemini');
    if (parsed) return parsed;
  }
  const groqText = await callGroq(prompt);
  if (groqText) {
    const parsed = parseExtractionText(groqText, hits, 'groq');
    if (parsed) return parsed;
  }
  return null;
}
