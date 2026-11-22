/**
 * AI Assist v3 (NOTES #47): the web-search pipeline — Tavily →
 * Serper fallback, Gemini/Groq extraction, code-side derivation from
 * cited hits, sourced-confidence rules, installment rejection, and
 * the 14-day search cache. All provider traffic is mocked fetch with
 * payloads recorded from the verified 23 Nov 2026 live responses;
 * no live calls, no real keys (dummy env values only).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  SpecExtractionResult,
  buildSearchBackedResult,
  contextTaintsPrice,
  deriveEvEfficiencyKwhPer100Km,
  pickVariant,
} from '@/lib/aiPredictions';
import { SearchHit } from '@/lib/webSearch';
import { _resetAiStateForTesting, predictWithAi } from '@/lib/server/ai';

/* ---------------- recorded fixtures (23 Nov 2026) ---------------- */

const EVD_URL = 'https://evdecisions.com/ev_models/alektra-mini-x2/';

const ALEKTRA_ORGANIC = [
  {
    title: 'Alektra MINI X2 - EV Decisions Pakistan',
    link: EVD_URL,
    snippet:
      "It's offered in three battery tiers: a 7.2 kWh pack for 80-100 km of range (starting at Rs. 1,095,000), a 10.8 kWh pack for 130-140 km (Rs. 1,145,000), and a 12.96 kWh pack for 170-180 km (Rs. 1,195,000).",
  },
  {
    title: "ALEKTRA's Updated Price List (As of July 2026)",
    link: 'https://www.scribd.com/document/1068103584/alektra-price-list',
    snippet:
      'MINI X2 7.2 kWh 80 to 100 Rs. 1,095,000 · MINI X2 10.8 kWh 130 to 140 Rs. 1,145,000 · MINI X2 12.96 kWh 170 to 180 Rs. 1,195,000',
  },
  {
    title: 'Choose from our innovative range of electric vehicles',
    link: 'https://www.alektragroup.com/models',
    snippet:
      'Fully electric, eco-friendly city vehicle. Lithium battery: up to 10 years life, 4,000-5,000 charge cycles. Estimated range: 150 to 180 km.',
  },
];

const ALEKTRA_EXTRACTION = {
  variants: [
    {
      variantNote: 'MINI X2 7.2 kWh',
      pricePkr: 1095000,
      priceType: 'full-cash',
      batteryKwh: 7.2,
      rangeKm: 90,
      fuelConsumption: null,
      sourceUrls: [EVD_URL],
    },
    {
      variantNote: 'MINI X2 10.8 kWh',
      pricePkr: 1145000,
      priceType: 'full-cash',
      batteryKwh: 10.8,
      rangeKm: 135,
      fuelConsumption: null,
      sourceUrls: [EVD_URL],
    },
    {
      variantNote: 'MINI X2 12.96 kWh',
      pricePkr: 1195000,
      priceType: 'full-cash',
      batteryKwh: 12.96,
      rangeKm: 175,
      fuelConsumption: null,
      sourceUrls: [EVD_URL],
    },
  ],
  pricePoints: [],
};

/* ---------------- fetch mock plumbing ---------------- */

function res(body: unknown, opts: { ok?: boolean; status?: number } = {}): Response {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

type Handler = (url: string, init?: RequestInit) => Promise<Response>;
let tavilyHandler: Handler | undefined;
let serperHandler: Handler | undefined;
let geminiHandler: Handler | undefined;
let groqHandler: Handler | undefined;
let serperCalls = 0;

const originalFetch = globalThis.fetch;

function geminiOk(extraction: unknown): Handler {
  return async () =>
    res({
      candidates: [
        { content: { parts: [{ text: JSON.stringify(extraction) }] } },
      ],
    });
}

function serperAlektra(): Handler {
  return async () => {
    serperCalls += 1;
    return res({ organic: ALEKTRA_ORGANIC });
  };
}

beforeEach(() => {
  _resetAiStateForTesting();
  tavilyHandler = undefined;
  serperHandler = undefined;
  geminiHandler = undefined;
  groqHandler = undefined;
  serperCalls = 0;
  process.env.TAVILY_API_KEY = 'test-tavily-not-real';
  process.env.SERPER_API_KEY = 'test-serper-not-real';
  process.env.GEMINI_API_KEY = 'test-gemini-not-real';
  process.env.GROQ_API_KEY = 'test-groq-not-real';
  globalThis.fetch = vi.fn(async (url: unknown, init?: RequestInit) => {
    const u = String(url);
    if (u.startsWith('https://api.tavily.com/')) {
      return tavilyHandler ? tavilyHandler(u, init) : res({ results: [] });
    }
    if (u.startsWith('https://google.serper.dev/')) {
      return serperHandler ? serperHandler(u, init) : res({ organic: [] });
    }
    if (u.startsWith('https://generativelanguage.googleapis.com/')) {
      return geminiHandler ? geminiHandler(u, init) : res({}, { ok: false, status: 500 });
    }
    if (u.startsWith('https://api.groq.com/')) {
      return groqHandler
        ? groqHandler(u, init)
        : res({}, { ok: false, status: 500 });
    }
    return res({}, { ok: false, status: 404 });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  delete process.env.TAVILY_API_KEY;
  delete process.env.SERPER_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.GROQ_API_KEY;
  vi.restoreAllMocks();
});

/* ---------------- pipeline fixtures ---------------- */

describe('web-search pipeline (predictWithAi)', () => {
  it('Alektra MINI X2 efficiency: derived in code from Serper hits, in the 7.2–8.2 band, HIGH, sourced', async () => {
    delete process.env.TAVILY_API_KEY; // Serper carries this fixture
    serperHandler = serperAlektra();
    geminiHandler = geminiOk(ALEKTRA_EXTRACTION);

    const outcome = await predictWithAi(
      'car-efficiency',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      '203.0.113.10'
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = outcome.result;
    expect(r.value).toBeGreaterThanOrEqual(7.2);
    expect(r.value).toBeLessThanOrEqual(8.2);
    expect(r.value).toBe(8.0); // base variant: 7.2 kWh ÷ 90 km × 100
    expect(r.confidence).toBe('high');
    expect(r.source).toBe('sourced');
    expect(r.searchProvider).toBe('serper');
    expect(r.batteryKwh).toBe(7.2);
    expect(r.ratedRangeKm).toBe(90);
    expect(r.sources?.some((s) => s.url === EVD_URL)).toBe(true);
    expect(r.reasoning).toContain('Derived in code');
    expect(r.reasoning).not.toContain('14.3');
    expect(r.reasoning).not.toContain('50 kWh');
  });

  it('Alektra MINI X2 price: median of the full-cash variant prices, with variant note', async () => {
    delete process.env.TAVILY_API_KEY;
    serperHandler = serperAlektra();
    geminiHandler = geminiOk(ALEKTRA_EXTRACTION);

    const outcome = await predictWithAi(
      'car-price',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      '203.0.113.11'
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = outcome.result;
    expect(r.value).toBe(1145000); // median of 1,095,000 / 1,145,000 / 1,195,000
    expect(r.source).toBe('sourced');
    expect(r.searchProvider).toBe('serper');
    expect(r.reasoning).toContain('Across variants');
    expect(r.sources?.some((s) => s.url === EVD_URL)).toBe(true);
  });

  it('Tavily timeout → Serper path is used', async () => {
    tavilyHandler = async () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      throw err;
    };
    serperHandler = serperAlektra();
    geminiHandler = geminiOk(ALEKTRA_EXTRACTION);

    const outcome = await predictWithAi(
      'car-efficiency',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      '203.0.113.12'
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.searchProvider).toBe('serper');
    expect(outcome.result.value).toBe(8.0);
  });

  it('Tavily quota error (432) → Serper path is used', async () => {
    tavilyHandler = async () => res({ error: 'quota exceeded' }, { ok: false, status: 432 });
    serperHandler = serperAlektra();
    geminiHandler = geminiOk(ALEKTRA_EXTRACTION);

    const outcome = await predictWithAi(
      'car-efficiency',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      '203.0.113.13'
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.searchProvider).toBe('serper');
    expect(outcome.result.value).toBe(8.0);
  });

  it('both providers empty → Groq guess path, LOW confidence, no sources, no "derived" claim', async () => {
    tavilyHandler = async () => res({ results: [] });
    serperHandler = async () => res({ organic: [] });
    groqHandler = async () =>
      res({
        choices: [
          {
            message: {
              content:
                '{"value": 15, "reasoning": "Typical compact EV consumption.", "confidence": "medium"}',
            },
          },
        ],
      });

    const outcome = await predictWithAi(
      'car-efficiency',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      '203.0.113.14'
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const r = outcome.result;
    expect(r.value).toBe(15);
    expect(r.confidence).toBe('low');
    expect(r.source).not.toBe('sourced');
    expect(r.sources).toBeUndefined();
    expect(r.searchProvider).toBeUndefined();
    expect(r.reasoning).toContain('unverified model estimate');
    expect(r.reasoning).not.toContain('Derived in code');
  });

  it('Gemini extraction failure → Groq extraction fallback still resolves from hits', async () => {
    delete process.env.TAVILY_API_KEY;
    serperHandler = serperAlektra();
    geminiHandler = async () => res({}, { ok: false, status: 500 });
    groqHandler = async (_url, init) => {
      const body = typeof init?.body === 'string' ? init.body : '';
      if (body.includes('SEARCH HITS')) {
        return res({
          choices: [
            { message: { content: JSON.stringify(ALEKTRA_EXTRACTION) } },
          ],
        });
      }
      return res({}, { ok: false, status: 500 });
    };

    const outcome = await predictWithAi(
      'car-efficiency',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      '203.0.113.15'
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.result.value).toBe(8.0);
    expect(outcome.result.source).toBe('sourced');
    expect(outcome.result.model).toContain('groq');
  });

  it('14-day search cache: a repeat lookup consumes zero provider quota', async () => {
    delete process.env.TAVILY_API_KEY;
    serperHandler = serperAlektra();
    geminiHandler = geminiOk(ALEKTRA_EXTRACTION);
    const ctx = { name: 'Alektra MINI X2', fuelType: 'ev' };

    const first = await predictWithAi('car-efficiency', ctx, '203.0.113.16');
    const second = await predictWithAi('car-efficiency', ctx, '203.0.113.16');
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.cached).toBe(false);
    expect(second.cached).toBe(true);
    expect(second.result.value).toBe(8.0);
    expect(serperCalls).toBe(1);
  });
});

/* ---------------- derivation fixtures (builder level) ---------------- */

describe('search-backed derivation (pure builder)', () => {
  it('Yadea M3: 1.38 kWh ÷ 80 km derives exactly 1.725 kWh/100km', () => {
    const hits: SearchHit[] = [
      {
        title: 'Yadea M3 Price in Pakistan, Pictures & Specs',
        url: 'https://www.pakwheels.com/bikes/yadea/m3/',
        content: 'Yadea M3 · Battery 1.38 Kwh · Range 80 km · Price Rs 174,000',
      },
    ];
    const extraction: SpecExtractionResult = {
      variants: [
        {
          variantNote: 'Yadea M3',
          pricePkr: 174000,
          priceType: 'full-cash',
          batteryKwh: 1.38,
          rangeKm: 80,
          fuelConsumption: null,
          sourceUrls: [hits[0].url],
        },
      ],
      pricePoints: [],
      extractor: 'gemini',
    };
    const r = buildSearchBackedResult(
      'car-efficiency',
      { name: 'Yadea M3', fuelType: 'e-scooty' },
      extraction,
      hits,
      'tavily'
    );
    expect(r).not.toBeNull();
    expect(r!.batteryKwh).toBe(1.38);
    expect(r!.ratedRangeKm).toBe(80);
    // The raw derivation is exactly 1.725 (±0.01); the displayed
    // value rounds to the spec's 1 decimal, like ground truth.
    expect(
      Math.abs(
        deriveEvEfficiencyKwhPer100Km(r!.batteryKwh, r!.ratedRangeKm)! - 1.725
      )
    ).toBeLessThan(0.01);
    expect(r!.value).toBe(1.7);
    expect(r!.confidence).toBe('high'); // PakWheels is authoritative
    expect(r!.source).toBe('sourced');
    expect(r!.searchProvider).toBe('tavily');
    expect(r!.reasoning).toContain('Derived in code');
  });

  it('installment-tainted price in the hits is rejected from the median', () => {
    const olxUrl = 'https://www.olx.com.pk/item/alektra-mini-x2-iid-123';
    const hits: SearchHit[] = [
      {
        title: 'Alektra MINI X2 — dealer ad',
        url: olxUrl,
        content:
          'Alektra MINI X2 for sale. Rs 250,000 down payment only, easy monthly installments available.',
      },
      {
        title: 'Alektra MINI X2 - EV Decisions Pakistan',
        url: EVD_URL,
        content: ALEKTRA_ORGANIC[0].snippet,
      },
    ];
    // Even with the extractor mis-tagging the dealer figure as
    // full-cash, the hit's own context taints it out of the median.
    expect(contextTaintsPrice(hits[0].content, 250000)).toBe(true);
    const extraction: SpecExtractionResult = {
      variants: [
        {
          variantNote: 'Dealer installment offer',
          pricePkr: 250000,
          priceType: 'full-cash',
          batteryKwh: null,
          rangeKm: null,
          fuelConsumption: null,
          sourceUrls: [olxUrl],
        },
        {
          variantNote: 'MINI X2 7.2 kWh',
          pricePkr: 1095000,
          priceType: 'full-cash',
          batteryKwh: 7.2,
          rangeKm: 90,
          fuelConsumption: null,
          sourceUrls: [EVD_URL],
        },
        {
          variantNote: 'MINI X2 10.8 kWh',
          pricePkr: 1145000,
          priceType: 'full-cash',
          batteryKwh: 10.8,
          rangeKm: 135,
          fuelConsumption: null,
          sourceUrls: [EVD_URL],
        },
      ],
      pricePoints: [],
      extractor: 'gemini',
    };
    const r = buildSearchBackedResult(
      'car-price',
      { name: 'Alektra MINI X2', fuelType: 'ev' },
      extraction,
      hits,
      'serper'
    );
    expect(r).not.toBeNull();
    expect(r!.value).toBe(1120000); // median of 1,095,000 + 1,145,000 only
  });

  it('variant picking matches the known card price within ±5% before the base variant', () => {
    const hits: SearchHit[] = [
      { title: 'EV Decisions', url: EVD_URL, content: ALEKTRA_ORGANIC[0].snippet },
    ];
    const extraction: SpecExtractionResult = {
      variants: ALEKTRA_EXTRACTION.variants.map((v) => ({
        variantNote: v.variantNote,
        pricePkr: v.pricePkr,
        priceType: 'full-cash' as const,
        batteryKwh: v.batteryKwh,
        rangeKm: v.rangeKm,
        fuelConsumption: null,
        sourceUrls: [EVD_URL],
      })),
      pricePoints: [],
      extractor: 'gemini',
    };
    const picked = pickVariant(extraction.variants, 1190000, hits);
    expect(picked?.matchedByPrice).toBe(true);
    expect(picked?.variant.batteryKwh).toBe(12.96);
    const base = pickVariant(extraction.variants, undefined, hits);
    expect(base?.matchedByPrice).toBe(false);
    expect(base?.variant.batteryKwh).toBe(7.2);
  });

  it('depreciation derives from a cross-year price pair; a single point is not defensible', () => {
    const pwUrl = 'https://www.pakwheels.com/used-cars/toyota-corolla/';
    const hits: SearchHit[] = [
      {
        title: 'Toyota Corolla used listings',
        url: pwUrl,
        content: 'Corolla 2026 models around Rs 4,200,000; 2024 models around Rs 3,800,000.',
      },
    ];
    const extraction: SpecExtractionResult = {
      variants: [],
      pricePoints: [
        { modelYear: 2026, pricePkr: 4200000, priceType: 'full-cash', sourceUrl: pwUrl },
        { modelYear: 2024, pricePkr: 3800000, priceType: 'full-cash', sourceUrl: pwUrl },
      ],
      extractor: 'gemini',
    };
    const r = buildSearchBackedResult(
      'car-depreciation',
      { name: 'Toyota Corolla', fuelType: 'petrol', pricePkr: 4200000 },
      extraction,
      hits,
      'tavily'
    );
    expect(r).not.toBeNull();
    // (1 − 3.8/4.2) × 100 × (5/2) = 23.8 → 24
    expect(r!.value).toBe(24);
    expect(r!.source).toBe('sourced');

    const single: SpecExtractionResult = {
      variants: [],
      pricePoints: [extraction.pricePoints[0]],
      extractor: 'gemini',
    };
    expect(
      buildSearchBackedResult(
        'car-depreciation',
        { name: 'Toyota Corolla', fuelType: 'petrol' },
        single,
        hits,
        'tavily'
      )
    ).toBeNull();
  });
});
