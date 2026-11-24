/**
 * Web-search layer for AI Assist v3 (NOTES #47 — owner directive,
 * Round 4). SERVER-ONLY: this module reads provider keys from the
 * server environment and must never be imported by client code. It
 * is called exclusively from src/lib/server/ai.ts behind the
 * same-origin POST /api/ai/predict route (Gate 6 Amendment 3 terms,
 * extended by the Round 4 brief to these free-tier providers).
 *
 * Providers, in order:
 *  1. Tavily (free tier) — steered to TRUSTED_PK_DOMAINS first, one
 *     open pass if the steered pass returns nothing.
 *  2. Serper (free tier, Google results) — fallback on Tavily
 *     timeout / error / quota / zero hits / unusable extraction.
 * Every call has an 8s AbortController timeout so a hung provider
 * degrades to the next one instead of hanging the button. A missing
 * key silently disables that provider. Zero cost is a hard
 * constraint: no paid tier is configured anywhere.
 */

import { PredictionType } from '@/lib/aiPredictions';

export interface SearchHit {
  title: string;
  url: string;
  content: string;
}

export type SearchProviderId = 'tavily' | 'serper';

export interface WebSearchOutcome {
  hits: SearchHit[];
  provider: SearchProviderId | null;
}

/**
 * Pakistani vehicle sources the steered Tavily pass is restricted
 * to. One-line editable by design: add a domain here and both the
 * steering and (via aiPredictions) the corroboration set see it.
 */
export const TRUSTED_PK_DOMAINS: string[] = [
  'pakwheels.com',
  'olx.com.pk',
  'evdecisions.com',
  'alektragroup.com',
  'priceoye.pk',
  'hamariweb.com',
  'changan.com.pk',
  'toyota-indus.com',
  'honda.com.pk',
  'suzuki.com.pk',
  'kia.com.pk',
  'hyundai-nishat.com',
  'yadea.com.pk',
  'shalimarmotors.com.pk',
];

const SEARCH_TIMEOUT_MS = 8_000;
const PAGE_TIMEOUT_MS = 8_000;
const MAX_HIT_CONTENT_CHARS = 4_000;
const MAX_PAGE_TEXT_CHARS = 12_000;

function tavilyKey(): string | null {
  return process.env.TAVILY_API_KEY || null;
}

function serperKey(): string | null {
  return process.env.SERPER_API_KEY || null;
}

/** Search is usable only with a search key AND an extraction key. */
export function isWebSearchConfigured(): boolean {
  const hasSearch = Boolean(tavilyKey() || serperKey());
  const hasExtractor = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
  return hasSearch && hasExtractor;
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

async function tavilySearch(
  query: string,
  includeDomains: string[] | null
): Promise<SearchHit[] | null> {
  const key = tavilyKey();
  if (!key) return null;
  const body: Record<string, unknown> = {
    query,
    search_depth: 'basic',
    max_results: 5,
  };
  if (includeDomains && includeDomains.length > 0) body.include_domains = includeDomains;
  const res = await fetchWithTimeout(
    'https://api.tavily.com/search',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
    SEARCH_TIMEOUT_MS
  );
  if (!res || !res.ok) return null;
  try {
    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string }[];
    };
    if (!Array.isArray(data.results)) return null;
    return data.results
      .filter((r) => typeof r.url === 'string' && r.url.length > 0)
      .map((r) => ({
        title: typeof r.title === 'string' ? r.title : r.url as string,
        url: r.url as string,
        content: (typeof r.content === 'string' ? r.content : '').slice(0, MAX_HIT_CONTENT_CHARS),
      }));
  } catch {
    return null;
  }
}

async function serperSearch(query: string): Promise<SearchHit[] | null> {
  const key = serperKey();
  if (!key) return null;
  const res = await fetchWithTimeout(
    'https://google.serper.dev/search',
    {
      method: 'POST',
      headers: {
        'X-API-KEY': key,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    },
    SEARCH_TIMEOUT_MS
  );
  if (!res || !res.ok) return null;
  try {
    const data = (await res.json()) as {
      organic?: { title?: string; link?: string; snippet?: string }[];
    };
    if (!Array.isArray(data.organic)) return null;
    return data.organic
      .filter((r) => typeof r.link === 'string' && r.link.length > 0)
      .map((r) => ({
        title: typeof r.title === 'string' ? r.title : (r.link as string),
        url: r.link as string,
        content: (typeof r.snippet === 'string' ? r.snippet : '').slice(0, MAX_HIT_CONTENT_CHARS),
      }));
  } catch {
    return null;
  }
}

/** Run one named provider; returns null on failure, [] on empty. */
export async function searchWithProvider(
  provider: SearchProviderId,
  query: string
): Promise<SearchHit[] | null> {
  if (provider === 'tavily') {
    const steered = await tavilySearch(query, TRUSTED_PK_DOMAINS);
    if (steered === null) return null;
    if (steered.length > 0) return steered;
    return tavilySearch(query, null);
  }
  return serperSearch(query);
}

/**
 * The provider chain at hit level: Tavily (steered, then open) →
 * Serper. Falls through on timeout, non-200 (incl. quota/credit
 * errors), or zero hits. Extraction-level fallback lives in the
 * caller (server/ai.ts), which retries with the other provider when
 * these hits yield nothing usable.
 */
export async function searchVehicleWebDetailed(query: string): Promise<WebSearchOutcome> {
  if (tavilyKey()) {
    const hits = await searchWithProvider('tavily', query);
    if (hits && hits.length > 0) return { hits, provider: 'tavily' };
  }
  if (serperKey()) {
    const hits = await serperSearch(query);
    if (hits && hits.length > 0) return { hits, provider: 'serper' };
  }
  return { hits: [], provider: null };
}

/** Work-order signature: just the hits from the chain above. */
export async function searchVehicleWeb(query: string): Promise<SearchHit[]> {
  return (await searchVehicleWebDetailed(query)).hits;
}

/** Fetch one page and reduce it to plain text (server-side). */
export async function fetchPageText(url: string): Promise<string | null> {
  const res = await fetchWithTimeout(
    url,
    { headers: { 'User-Agent': 'RizqFlow/1.0 (vehicle spec lookup)' } },
    PAGE_TIMEOUT_MS
  );
  if (!res || !res.ok) return null;
  try {
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ')
      .trim();
    return text ? text.slice(0, MAX_PAGE_TEXT_CHARS) : null;
  } catch {
    return null;
  }
}

/**
 * Replace the top-n hits' snippet content with fetched page text —
 * the Serper retry path, for when snippets carry no usable numbers
 * but the pages themselves do.
 */
export async function enrichHitsWithPageText(hits: SearchHit[], topN = 2): Promise<SearchHit[]> {
  const out = [...hits];
  const n = Math.min(topN, out.length);
  // Fetch the pages in PARALLEL (NOTES #52): sequentially this step
  // alone could stack 2 × PAGE_TIMEOUT_MS onto a cold request.
  const texts = await Promise.all(
    Array.from({ length: n }, (_, i) => fetchPageText(out[i].url))
  );
  texts.forEach((text, i) => {
    if (text) out[i] = { ...out[i], content: text };
  });
  return out;
}

/** Per-field query templates for the vehicle pipeline. */
export function buildVehicleSearchQuery(
  type: PredictionType,
  context: Record<string, unknown>
): string {
  const name = typeof context.name === 'string' ? context.name.trim() : 'vehicle';
  const fuel = typeof context.fuelType === 'string' ? context.fuelType : '';
  if (type === 'car-price') {
    return `${name} price in Pakistan full cash`;
  }
  if (type === 'car-efficiency') {
    if (fuel === 'petrol') return `${name} fuel average km per litre specifications Pakistan`;
    return `${name} battery capacity kWh range km specifications Pakistan`;
  }
  // car-depreciation: same-model asking prices across model years.
  const year = new Date().getFullYear();
  return `${name} used price ${year - 2} vs ${year} model Pakistan`;
}
