# Fix Report — Round 3 (swarm/round-3)

Built by a Muse swarm under FORGEWARDEN, per `rizqflow-round3-plan.md` (owner-approved 23 Nov 2026; Phase 2 horizon work dropped by owner decision — the 5-year TCO horizon is untouched). Local commits only; lead reviews, merges and deploys separately.

**Gates at branch tip (independently re-run by the coordinator):** `npm ci` clean · `npm test` **216/216 green** (13 files; baseline was 178) · `npm run build` green · `tests/qa-baseline.test.ts` **byte-unchanged vs 79da2b6** (git diff = 0 lines), its numbers bit-identical.

Commits: `b3ba75f` + `b4e2f41` (Phase 0), `4c46fda` (Phase 1), `8a29615` (Phase 3).

---

## Phase 0 — Wizard Step 5 revert (NOTES #44)

**Trace finding (save vs load, pre-fix):** Steps 1–4 matched (same profile fields both ways). Step 5 plain fields matched. **Step 5 vehicle MISMATCH:** save wrote the current vehicle only into the `vehicles[]` entry flagged `isCurrentVehicle` (`fuelType`, `pricePkr`) and never wrote profile-level `currentVehicleType`/`currentVehicleResalePkr`; load read *neither* — the wizard's initialisers were hard-coded constants `useState('petrol-car')` / `useState(2800000)`. Hence EV → "Petrol Car", Rs 4,800,000 → Rs 2,800,000. **Step 6 goals had the same-pattern mismatch in both directions:** save discarded draft goals in update mode (kept pre-existing `profile.lifeGoals`), load used constants that never read saved goals.

**Fix:** new pure module `src/lib/wizardDraft.ts` — `buildWizardDraft(profile)` (load) and `compileWizardProfile(profile, draft, mode)` (save); the wizard component now calls exactly these, so the tested path is the real path. Single source of truth for Step 5 = profile-level `currentVehicleType`/`currentVehicleResalePkr`, mirrored into the flagged `vehicles[]` entry for the Cars pages; load falls back to deriving from `vehicles[]` for legacy profiles. Step 6: wizard goals merge into `lifeGoals` in both modes, non-wizard goals preserved.

**Files:** `src/lib/wizardDraft.ts` (new), `src/components/onboarding/OnboardingWizardModal.tsx`, `tests/wizard-roundtrip.test.ts` (new, 8 tests: full-field round-trip all 6 steps in both modes, idempotence, the exact Step 5 regression, zero-value round-trip, Step 6 merge, legacy derivation), `NOTES.md` (#44).

**Could not verify:** rendered-UI click-through (no browser in the builder's environment) — mitigated by testing the exact functions the component calls; the planned live Chrome test covers the UI. Legacy `e-scooty` current vehicles derive to `ev-car` (the wizard's type union has no e-scooty option) — lossy by existing design, noted in code.

## Phase 1 — Liabilities, due-date model (NOTES #45)

**Contract conflict found & resolved:** `liabilities` already existed (NOTES #23) as simple `label`/`amountPkr` items, and an existing engine test asserts legacy items move the emergency-fund gap but not final wealth. The rich `Liability` therefore *extends* `LiabilityItem` (alias kept; `label`/`amountPkr` kept as sanitizer-synced mirrors; all schedule fields additive-optional). **Scheduling requires an explicit `kind` + `balancePkr`** — legacy items stay position-only, so no silent migration of anyone's existing data (including the owner's Rs 7.5L debt, which stays in the cash-reserve field).

**Engine:** new pure `src/lib/engine/debtSchedule.ts` (`buildLiabilitySchedule`, `balloonDueMonth`, `summarizeLiability` — the UI reuses the same math). `calculateLifePlan` gained an optional `{ projectionStart }` parameter; the planner page passes today's year/month, the engine never reads the clock. Monthly schedule is aggregated per year inside the existing yearly loop, paid pro-rata from the sleeves before goal checks, as separate outflows never routed through expenses. Balloon shortfalls are recorded in `liabilityShortfalls` instead of silent negatives; negative amortisation sets `negativeAmortization` + a "GROWING" entry in `liabilityWarnings`. Result liability fields attach only when scheduled liabilities exist, so liability-free results keep the exact pre-#45 shape. Due month = `(dueYear − startYear)×12 + (dueMonth − startMonth) + 1` from `dueDateISO`; a balloon with no usable date/start is reported unscheduled, never guessed.

**Acceptance tests (`tests/liabilities.test.ts`, 12 tests, hand-computed):**
- Balloon Rs 1,000,000 @ 0%, due month 60: helper asserts months 1–59 outflow 0, month 60 exactly 1,000,000; engine (yearly snapshots) on a zero-return flat variant of the qa-baseline fixture pattern — years 1–4 identical to no-liability, year-5/final wealth differ by exactly Rs 1,000,000. Shortfall case: Rs 500,000 shortfall at month 60, wealth floors at 0.
- Amortizing Rs 1,200,000 @ 12%, Rs 25,000/mo: payoff month 66, total interest Rs 443,001.80 — matches.
- Revolving Rs 200,000 @ 24%, 10% min: clears month 144, total paid Rs 248,780.27 — matches. (Rs 1 residual-settle rule so a %-of-balance schedule terminates; documented in code + NOTES.)
- Negative amortisation Rs 500,000 @ 24% paying Rs 5,000: balance Rs 567,060.45 after 12 months + warning — matches.
- Absent/empty liabilities deep-equal the base plan; sanitizer clamps/drops malformed entries (NaN/Infinity → 0, unknown kind → schedule dropped, invalid date dropped, missing id regenerated).

**UI:** `HoldingsLiabilitiesCard.tsx` is now a full liability manager (add/edit/delete, category + kind selects, kind-specific fields, FieldInfo on APR/min-%/balloon, per-liability payoff/due line + total interest, negative-amortisation warning); `WealthHeadlineCards.tsx` shows a liabilities line under the net-worth headline; sanitizer support in `src/lib/stateUrl.ts` (the single path — the server portfolio API uses the same `sanitizeProfile`, verified). One-line compile fix in `portfolioTransfer.ts` (`profilesEqual`).

**Could not verify:** UI verified by type-check + build only; live check is the planned Chrome test.

## Phase 3 — AI Assist v2 (NOTES #46)

**Grounding:** `GROUNDED_PREDICTION_TYPES` = {car-price, car-efficiency, car-depreciation}, same pattern/timeout discipline as car-price (#38); prompts demand Pakistani sources and, for efficiency, battery kWh + rated range (EV) / engine + rated mileage (petrol); depreciation compares same-model listings across years, full-cash only. Car-maintenance stays ungrounded per #43 evidence.
**⚠ Live behaviour of the two newly grounded types is UNVERIFIED** — no Groq key exists in the build sandbox (production `.env.server` only), so no live call was run and nothing was narrowed. First post-deploy check: watch for the #43 signal (60s grounded timeouts falling back) on efficiency/depreciation.

**Derivation + bands:** pure `deriveEvEfficiencyKwhPer100Km(kwh, range)`; when a car-efficiency reply carries `batteryKwh`/`ratedRangeKm` (additive fields), code replaces the model's value with battery ÷ range × 100 and records the derivation + source in reasoning. Bands: e-scooty 1–5, EV car 8–30 kWh/100km — out-of-band forces confidence `low` with the reason in the reasoning string (no silent clamp-accept). One flagged spec change: car-efficiency global clamp floor 2 → 1, because the old floor silently clamped the Yadea M3's real 1.725 up to 2.

**Ground-truth table:** `src/lib/vehicleGroundTruth.ts` (DATA_AS_OF 2026-11-23), checked in `predictWithAi` before any model call (and before the API-key check — hits need no key and consume no daily cap); hits are labelled "Sourced Data · <source>" in AiButton, never "AI estimate". Every value was consulted live during the build:
- Nissan Leaf (40 kWh): price 6,245,000; 40 kWh / 275 km → 14.5 — PakWheels new-cars Leaf page + PakWheels used listing (Karachi, 2022).
- Changan Alsvin: price 4,189,000 (base ex-factory); 12 km/L city — PakWheels Alsvin page + PakWheels comparison.
- Yadea M3: price 174,000; 1.38 kWh / 80 km → 1.725 — PakWheels Yadea M3 page.
- Honda City: price 4,737,000 (base 1.2L CVT ex-factory); 14 km/L — PakWheels City page + comparison.
- Toyota Corolla: price 6,099,000 (base Altis X 1.6 ex-factory); 12 km/L — PakWheels Corolla page + comparison.
- Suzuki Alto: price 2,994,861 (VXR ex-factory); 18 km/L — HamariWeb Autos.
- Suzuki Mehran: price 900,000 (used, representative); 16 km/L — DealDone PK + CarMatchAI 2026 guide.
- Honda CG 125: price 238,500; 45 km/L — PakWheels CG 125 page.
- Lifan V16S: price 1,300,000 only, flagged single-listing — PakWheels used listing (Wazirabad, 2022).
**Omissions (deliberate):** depreciation % seeded for NO vehicle (no consulted source publishes a defensible per-model 5-year %); Lifan V16S efficiency (no Pakistani rated-km/L source found).

**Provider abstraction + single-flight:** `AiProvider` interface in `src/lib/server/ai.ts`; `AI_PROVIDER` env (default `groq`), models from existing `GROQ_MODEL`/`GROQ_MODEL_FALLBACK`; Groq the only wired provider; `/api/ai/predict` behaviour unchanged. Single-flight map keyed by the existing 6h cache key — identical concurrent requests share one upstream chain (unit-tested: 2 concurrent = 1 upstream call).

**price_type:** the prior code had no listing aggregation (single model median). Minimal parser awareness added: car-price replies may carry `listings[]` with `priceType` tags; `medianFullCashPrice` medians full-cash listings only (down-payment/installment/lease/booking excluded). Replies without listings behave exactly as before.

**Tests:** `tests/ai-v2.test.ts` (18 tests): derivation, bands, ground-truth hits (Yadea M3 resolves sourced through `predictWithAi` with NO API key configured — proving no model call), misses, price_type median + parser, provider default, single-flight. One existing-test change, flagged: `tests/ai-grounding.test.ts`'s grounded-set assertion updated for the two re-extended types (the #43-era expectation contradicted this phase's brief); all parser expectations unchanged and passing.

## Explicitly untouched
5-year TCO horizon (owner decision) · verified market data (`marketRates.ts`, `marketData.ts`) · theme tokens · golden baseline file and numbers · avalanche/snowball explorer (out of scope) · Inkling/OpenRouter wiring (abstraction only) · production server/DB.
