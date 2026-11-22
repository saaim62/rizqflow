# Fix Report — Round 4 (swarm/round-4)

Built per `swarm-round4-work-order.md` (owner directive 23 Nov 2026: the AI Assist button itself must search the web; zero cost, free tiers only) under FORGEWARDEN. Local commits only; the lead reviews, merges, deploys and live-tests separately. **Nothing was pushed, deployed, or run against the EC2 server.**

**Gates at branch tip (run by the coordinator):** `npm ci` clean · `npm test` **227/227 green** (14 files; baseline was 216) · `npm run build` green · `tests/qa-baseline.test.ts` **byte-unchanged** (md5 `c157a240c985fa3044ea207cab1a1883` before and after) · `src/types/index.ts` **untouched** (no contract change needed — `PredictionResult` lives in `aiPredictions.ts` and gained only additive-optional fields) · no dependency changes (`package.json` / lockfile untouched).

Commits: `5bf0bfc` (implementation + tests + NOTES #47), this report.

---

## What was built

**Resolution order** for vehicle fields (`car-price`, `car-efficiency`, `car-depreciation`) inside the existing `POST /api/ai/predict` flow: curated ground truth (#46, unchanged) → **web-search pipeline** → Groq guess as labelled last resort. Non-vehicle fields are byte-for-byte the old behaviour.

### Search layer — `src/lib/webSearch.ts` (new, server-only)
- `searchVehicleWeb(query)` / `searchVehicleWebDetailed(query)`: **Tavily first** — steered pass with `include_domains: TRUSTED_PK_DOMAINS` (exported const, one-line editable: pakwheels.com, olx.com.pk, evdecisions.com, alektragroup.com, priceoye.pk, hamariweb.com, changan.com.pk, toyota-indus.com, honda.com.pk, suzuki.com.pk, kia.com.pk, hyundai-nishat.com, yadea.com.pk, shalimarmotors.com.pk), one open pass if the steered pass returns zero hits. **Serper fallback** (`google.serper.dev/search`, organic results mapped to hits).
- Every call has an **8s AbortController timeout**. Fallback triggers at hit level: timeout, any non-200 (incl. quota/credit errors), zero hits. A missing env key silently disables that provider; `isWebSearchConfigured()` requires a search key AND an extraction key.
- `enrichHitsWithPageText(hits, 2)`: plain server fetch of the top pages, tag-stripped, capped ~12k chars — the Serper snippet-retry path.
- `buildVehicleSearchQuery(type, ctx)`: per-field templates, incl. the depreciation cross-year template (`<vehicle> used price <year-2> vs <year> model Pakistan`).

### Extraction — `src/lib/specExtraction.ts` (new, server-only)
- **Gemini first** (`GEMINI_MODEL`, default `gemini-flash-latest`, `x-goog-api-key` header, `responseMimeType: application/json`), **Groq primary as fallback** (same env seat as AI Assist). 20s timeout each.
- Prompt forbids invention: numbers copied only from the hits, null is a legal answer, one entry per variant, priceType tagged from context, no arithmetic by the model. Normalisation coerces values, accepts both the `variants[]` shape and the work order's flat shape, and **drops any sourceUrl not present in the actual hits** — provenance cannot be fabricated.

### Derivation + labelling — `src/lib/aiPredictions.ts` (extended, pure)
- `buildSearchBackedResult(type, ctx, extraction, hits, provider)`:
  - **Efficiency (EV/e-scooty):** `batteryKwh ÷ rangeKm × 100` via the existing `deriveEvEfficiencyKwhPer100Km`, from extracted specs only; direct stated consumption used only when no specs exist. Petrol: rated km/L from the picked variant. Existing per-fuelType bands still flag out-of-band values low with the reason stated.
  - **Variant picking** (`pickVariant`): closest clean full-cash price within ±5% of the known card price, else base variant (smallest battery tier → cheapest clean price → first with data); the choice is named in the reasoning.
  - **Price:** median of clean full-cash prices across variants + year-tagged points; multi-tier vehicles get a variant-range note in the reasoning.
  - **Depreciation:** cross-year drop scaled to 5 years, only from ≥2 clean year-tagged points ≥1 year apart with an actual price fall; otherwise null → model path (never forced, per the work order).
  - **Installment guard:** `contextTaintsPrice` excludes a price when its own source page presents a same-size figure within ±90 chars of a down-payment/installment/booking token — even if the extractor mis-tagged it (test proves this with a deliberately mis-tagged fixture).
  - **Sourced-confidence rule:** HIGH only with an authoritative domain among the inputs (official brand sites, pakwheels.com, evdecisions.com) or two independent domains agreeing within 10%; single non-authoritative source → MEDIUM.
  - Response contract extended additively: `sources?: {title, url}[]`, `searchProvider?: 'tavily' | 'serper'`; search-backed results carry `source: 'sourced'` + `sourceNote` like ground truth.
- **"Derived in code" labelling fix (the Alektra defect):** in the model path, `parsePrediction`'s note now reads *"Derived in code from model-reported specs: … (rated specs, …; not independently verified)"*. The unqualified claim is produced only by ground truth and the search pipeline, where inputs are genuinely sourced.

### Server wiring — `src/lib/server/ai.ts`
- `trySearchPipeline`: search → extract → derive; on Tavily hits that extract to nothing, Serper gets the same query; on Serper snippet misses, top-2 pages are fetched and extraction retries once on page text.
- **14-day search cache** keyed `${type}::${normalizedVehicleName}` (separate bounded map; cleared by `_resetAiStateForTesting`; `_getSearchCacheSizeForTesting` added). A hit consumes zero provider quota.
- When the pipeline ran and found nothing, the Groq last-resort result is forced to **LOW confidence** with *"Web search found no sourced data for this vehicle — treat this as an unverified model estimate"* appended — never sourced, never "derived".
- Search works even when no Groq key is configured (pipeline needs only its own keys); `not_configured` is returned only when neither path is available.

### UI — `src/components/ui/AiButton.tsx`
- The popover renders a **Sources** list (up to 3 links, new tab) under the reasoning whenever a result carries `sources` — i.e. exactly for search-backed values.

### NOTES.md
- Entry **#47** in the same change (Gate 8): directive, architecture, confidence/labelling rules, fixture evidence, and the standing live-verification caveat.

---

## Fixture outcomes (`tests/ai-search.test.ts`, 11 new tests, all mocked fetch — no live calls, dummy env keys only)

| # | Fixture | Outcome |
|---|---------|---------|
| 1 | Alektra MINI X2 efficiency (Serper payload recorded 23 Nov) | **8.0 kWh/100km** (base variant 7.2 kWh ÷ 90 km), inside the required **7.2–8.2 band**, **HIGH**, `source: 'sourced'`, `searchProvider: 'serper'`, sources include evdecisions.com, reasoning carries "Derived in code" + variant note — never 14.3, never "50 kWh" |
| 2 | Alektra MINI X2 price | **Rs 1,145,000** = median of the three full-cash tiers (1,095,000 / 1,145,000 / 1,195,000), variant-range note in reasoning, sourced |
| 3 | Yadea M3 (builder level) | Raw derivation **exactly 1.725** (1.38 ÷ 80 × 100, asserted ±0.01); displayed value 1.7 at the spec's 1-decimal rounding — identical to the #46 ground-truth behaviour; HIGH (PakWheels authoritative) |
| 4 | Tavily timeout (AbortError mock) | Serper path used, `searchProvider: 'serper'`, value 8.0 |
| 5 | Tavily quota error (HTTP 432 mock) | Serper path used, value 8.0 |
| 6 | Both providers empty | Groq guess path: value passes through, confidence forced **low**, `sources`/`searchProvider` absent, reasoning says "unverified model estimate", no "Derived in code" |
| 7 | Gemini 500 | Groq extraction fallback resolves from the same hits (model label `Web search · serper + groq`), value 8.0 |
| 8 | Installment token in hits | Dealer figure Rs 250,000 ("down payment") excluded **despite a deliberate full-cash mis-tag**; median of the two clean prices = **Rs 1,120,000** |
| 9 | Variant picking | Known price Rs 1,190,000 → closest match 12.96 kWh tier (matchedByPrice); no known price → base 7.2 kWh tier |
| 10 | Depreciation pair | 2026 Rs 4,200,000 vs 2024 Rs 3,800,000 → **24%** 5-year figure, sourced; single point → null (model path) |
| 11 | 14-day search cache | Two identical `predictWithAi` calls → **1 Serper call total**, second returns `cached: true` |

Existing suites unchanged and green, including `ai-v2` (its "Derived in code" assertions still pass — the model-path note retains the phrase, now qualified) and `ai-grounding`.

---

## Deviations from the work order

1. **Alektra price = median (Rs 1,145,000), not the base-variant figure.** The work order's fixture explicitly allows "base variant Rs 1,095,000 (or median with variant note)"; the median follows the order's stated derivation rule ("Price: median of extracted full-cash prices") and the reasoning carries the variant range.
2. **Variant price-match picks the CLOSEST price within ±5%**, not the first within ±5%. My first implementation was first-match; fixture 9 exposed that neighbouring Alektra tiers both fall within ±5% of Rs 1,190,000, making first-match arbitrary. Closest-match is the deterministic reading of the rule.
3. **Extraction schema is a superset of the work order's flat shape**: the extractor returns `variants[]` (required by the order's own per-variant rule) plus `pricePoints[]` (required for depreciation). The flat shape from the order is still accepted by the normaliser.
4. **Orchestration lives in `server/ai.ts`** (`trySearchPipeline`) rather than inside `webSearch.ts`; the search module exposes the primitives (`searchWithProvider`, `enrichHitsWithPageText`, `searchVehicleWebDetailed`) and the extraction module stays single-purpose. No behavioural difference.
5. **`src/types/index.ts` untouched** — the order permitted additive-optional changes there, but none were needed: the response contract lives in `aiPredictions.ts`.

## Could not verify (lead's steps)
- **Live provider behaviour** — the build sandbox holds no Tavily/Serper/Gemini keys (they live only in production `.env.server`), so all provider traffic here is mocked from the recorded 23 Nov payloads. First live check after deploy: Alektra efficiency + price through the real button; watch for Tavily timeouts (the #43 signal) and Serper credit burn.
- **Rendered UI** — popover source links verified by type-check + build only; the lead's live Chrome test covers the click-through.
