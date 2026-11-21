# NOTES.md — Error Catalog (Forgewarden rule E)

Every repeated error is recorded here: symptom, root cause, fix, and the
gate that should have caught it. Check this file before working in an area.
New entries are added in the same change that fixes the error.

---

## 2026-11-21 — Fix round (external audit)

### 1. `npm ci` failed on a fresh clone; tests could not run at all
- **Symptom:** `npm ci` → ERESOLVE (vitest@5.1.1 wants `@types/node`
  ^22/≥24; project pinned ^20). No `test` script and no vitest config were
  committed, so even a manual install could not resolve the `@/` alias.
- **Root cause:** dev-dependency versions drifted; nobody ever ran the
  suite from a clean clone.
- **Fix:** `@types/node` → ^22, committed `vitest.config.ts` (alias +
  node env), added `"test": "vitest run"`. Verified: clean `npm ci` +
  72 tests green.
- **Gate:** Warden Gate 1 (fresh-clone gate).

### 2. Seeded production account with a hardcoded password
- **Symptom:** first launch auto-created `saaim62@gmail.com` /
  `password123` with the owner's real financial profile, plus a 1-click
  sign-in button in the shipped UI with the password in component code.
- **Root cause:** demo convenience shipped as production behaviour.
- **Fix:** zero seeded users; sign-up is the only way an account exists;
  salted iterated v2 password hashes with transparent legacy upgrade;
  auth modal states plainly that accounts live only in this browser.
  Tests rewritten to fictional users and per-user portfolio isolation.
- **Gate:** Warden Gate 3 (no seeds, no secrets, no real people).

### 3. Market data ~2 years stale, presented as "Live"
- **Symptom:** FFC priced Rs 310 vs ~Rs 538 actual; yields inflated
  (FFC 9.2% shown vs ~6.9% real); every projection flattered 15–25%;
  header badge read "Sarafa & PSX Live" over static seeded data.
- **Root cause:** prices were hardcoded at build time with no as-of date,
  no source, and no refresh process.
- **Fix:** data refreshed from named sources with `DATA_AS_OF` /
  `DATA_SOURCES` stamped in `marketData.ts` and displayed in the UI;
  "Live" claims removed; per-stock streak series labelled as sample
  history in the UI.
- **Gate:** Warden Gate 2 (data-freshness law).

### 4. Every life goal was marked FUNDED
- **Symptom:** `goalOutcomes` always returned `funded: true,
  shortfallPkr: 0` regardless of whether the portfolio could pay.
- **Root cause:** the outcome object was constructed, never computed.
- **Fix:** funded/shortfall computed from capital actually available in
  the goal year; withdrawals capped at what exists; opportunity cost now
  uses the profile's own rate (was a hardcoded 12%). Regression test
  added (goal shortfall honesty).
- **Gate:** Warden Gate 5 (honesty in modelling).

### 5. "At retirement" numbers were computed on a fixed 15-year horizon
- **Symptom:** engine simulated exactly 15 years while the UI labelled
  results "@ Age 55" / "31-year horizon".
- **Root cause:** magic constant `simulationYears = 15`.
- **Fix:** horizon = retirementAge − age, bounded 10–45 years; freedom
  fallback label is dynamic (`Beyond N Years`).
- **Gate:** Warden Gates 4–5 (no magic constants; labels match math).

### 6. Onboarding never asked half the profile; recalibrate duplicated portfolios
- **Symptom:** `gender`, `familyMembers`, `isBreadwinner` existed in the
  profile type and in wizard state but had no inputs; the vehicle resale
  value silently defaulted to Rs 28 lac for everyone; finishing the
  wizard while signed in created a NEW portfolio every time, so
  "Recalibrate" filled the account with duplicates. Wizard also
  pre-filled a real person's name and figures as defaults.
- **Root cause:** state was wired, UI was never finished; finish handler
  had only a create path.
- **Fix:** gender / family-size / breadwinner inputs in wizard step 1
  and in the planner intake form; vehicle resale input in step 5;
  wizard gained a `mode` — recalibrate updates the ACTIVE portfolio in
  place; defaults are neutral.
- **Gate:** Warden Gates 3–4.

### 7. Hardcoded hero stats contradicted the app's own data
- **Symptom:** home hero gold pill hardcoded "Rs 385,000" while the
  markets page showed the real Rs 379,836; petrol was Rs 265 in one
  engine default and Rs 322 in another component (real ~Rs 330).
- **Root cause:** display copy duplicated data instead of binding to it.
- **Fix:** hero stats bind to the data layer (`METAL_ASSETS` /
  `MARKET_SNAPSHOT`); one petrol default in one place.
- **Gate:** Warden Gate 2.

### 8. Disclaimer named the wrong regulator
- **Symptom:** footer read "SECP / SEBI Non-Advisory" — SEBI is India's
  regulator; this is a Pakistani product.
- **Fix:** SECP only.
- **Gate:** Guardian pass (Gate 7).

### 9. Portfolio IDs could collide across users created in the same millisecond
- **Symptom:** sign-up generated the default portfolio id as
  `'port_' + Date.now()` with no random component; two accounts created in
  the same millisecond shared a portfolio id (caught by the new per-user
  isolation test, intermittently).
- **Fix:** random suffix added, matching `createPortfolioForUser`.
- **Gate:** Warden Gate 1 (tests) — the catalog works: a rewritten test
  caught a latent bug in the original code.

### 10. Secondary component fallback duplicated petrol & USD rates
- **Symptom:** `MarketPulseBar.tsx` hardcoded fallback petrol Rs 265 and USD Rs 276.5
  instead of binding to `DEFAULT_MARKET_RATES` (Rs 322 / Rs 276.28).
- **Root cause:** Component edit state initialized with legacy hardcoded constants.
- **Fix:** Component imports and binds directly to `DEFAULT_MARKET_RATES`.
- **Gate:** Warden Gate 2 (Data-freshness law).

### 11. Multi-asset bucket allocation percentages drifting away from 100%
- **Symptom:** When users manually edited individual asset percentages in the planner,
  the total could drift to >100% or <100%, causing compounding distortion.
- **Root cause:** No automatic proportional rebalancing mechanism in pure engine.
- **Fix:** Added `normalizeAssetSplits` engine function with 1-click "Auto-Balance 100%"
  in `MultiAssetSplitter.tsx`, covered by comprehensive QA boundary tests.
- **Gate:** Warden Gate 4 & 5 (Contract lock & honesty in modelling).

---

## 2026-11-21 — Black marble + gold re-skin (owner request) + swarm regressions

### 10. Swarm overhaul reintroduced stale market defaults
- **Symptom:** the 3D overhaul commit (e6c2047) added `src/lib/marketRates.ts`
  with gold Rs 385,000 and USD/PKR 276.28 — the same stale hero numbers the
  fix round had already corrected — plus a 385,000 fallback in
  MarketPulseBar.
- **Fix:** defaults aligned to the verified snapshot (gold 379,836,
  USD 276.51, petrol 322, KSE-100 177,382); comment no longer calls them
  "Live".
- **Gate:** Warden Gate 2. Lesson: any new data-bearing file must source
  its numbers from `marketData.ts` constants, never retype them.

### 11. Theme re-skin: emerald glass -> black marble + gold
- **Change (owner-directed, not an error):** palette unified with the
  DropRoute / portfolio (TITAN) identity — warm black marble surfaces,
  metallic gold accents, 3D glass kept. Implemented by mapping the gold
  scale onto Tailwind's emerald/amber scales in `globals.css` `@theme`
  (blue -> champagne, purple -> bronze, zinc -> warm marble neutrals) and
  sweeping hardcoded panel/chart hexes. Rose/red untouched: they encode
  losses and danger in market data.

### 12. Theme pivot: black marble -> light ivory marble + gold (owner, 21 Nov 2026)
- **Direction:** the black-marble skin (589f4a3) read as "way too dark" to
  the owner. The theme is now LIGHT: ivory marble base (#F6F1E7), white
  cards, gold hairlines, warm near-black text. Same DropRoute/TITAN gold
  identity, opposite polarity.
- **How:** in `globals.css` `@theme`, `--color-white` resolves to warm
  near-black (#221E16) so the app's text-white / border-white/10 /
  bg-white/5 utilities flip coherently; gold text shades deepened one step
  (300/400) for contrast on ivory; panel hexes swept to white/paper;
  bg-black/40-70 field surfaces swept to paper tints; CarPodium3D's stage
  restaged from charcoal-silver to ivory-gold. Rose/red still carry losses.
- **Note:** the dark/light toggle in the navbar is currently vestigial —
  no component consumes the theme state since the swarm overhaul. The app
  ships the light theme only until a true dual theme is built.

### 13. Pulse bar showed Petrol Rs 265/L in Nov 2026 (owner screenshot, 21 Nov 2026)
- **Root cause:** three value sources had diverged historically — seeded
  presets, `marketRates` defaults, and the user's own SAVED profile. The
  pulse bar prefers `profile.petrolPricePerLitre`, and profiles persisted
  by older builds carried the pre-fix seed (265). Fixing defaults alone
  never healed stored profiles.
- **Fix:** one snapshot discipline. `migrateStaleSeedValues()` heals EXACT
  stale seeds (petrol 265, gold 385000, USD 276.28) to current defaults at
  every load path (custom rates + ProfileProvider init/portfolio switch);
  deliberate user values are never touched. Pulse bar + home pills now read
  the shared `useMarketSnapshot()` hook, which syncs hourly with the
  same-origin `/api/market-snapshot` route and never clobbers fields the
  user customized (tracked in `rizqflow_custom_rate_keys`).
- **Honesty note:** PSX/Sarafa/OGRA figures are daily-published; hourly
  sync propagates the latest verified snapshot, it does not invent a live
  feed. The bar stamps the last sync time.

### 14. Theme journey (owner, 21 Nov 2026)
- Black marble + gold: "way too dark". Light ivory marble: "awful".
  Owner's actual brief: "3D animated professional website with amazing
  colors and art." Final direction: AURORA SPATIAL — deep ink-violet base,
  animated aurora gradient pools (violet/cyan/amber) on the body, true
  emerald for growth, rich amber for gold data, violet->cyan->gold brand
  gradient, indigo glass panels, 3D tilt cards kept. Implemented through
  the same @theme scale system (white restored to true white; panel hexes
  swept to ink tones; podium restaged as a violet stage).
- The decorative GoldBullion3D hero was replaced by GoldDataCard at the
  owner's instruction: current spot, all-time peak IN PKR + date, off-peak
  drop IN PKR + %, dip-zone band IN PKR with an in-zone marker, streak,
  and the 30-day sparkline — all computed from the stamped series.
  (GoldBullion3D.tsx remains in the tree, unused.)

### 15. Theme, final: professional light (owner, 21 Nov 2026)
- Aurora was rejected as "too dark and kidish". Senior-UX reset, modelled
  on institutional fintech (Stripe/Mercury/Linear-light): neutral light
  canvas (#FAFAFA), white cards, slate ink text, hairline borders,
  whisper shadows, ONE accent (emerald-600) + amber reserved for gold
  data + rose for losses. No gradients on text, no glows, no animated
  blobs. Text ramps deepened one step for light-bg contrast (token rule).
- Watch out: with `--color-white` as the ink token, a literal `bg-white`
  class renders INK — surfaces must use `bg-[#FFFFFF]`. Caught on the
  home secondary CTA + car podium during screenshot QA (NOTES discipline
  working as intended).

### 16. Cinematic depth on the professional light theme (owner, 21 Nov 2026)
- Pro light was accepted as "pro" but rejected as flat — "no 3D feel, no
  cinematic feeling". The synthesis (same rule as the owner's TITAN
  portfolio: cinema in the SCENE, clean in the UI): depth from light and
  layering, not darkness or neon. Studio-gradient canvas (white top light
  -> deeper floor), layered elevation tokens (contact + ambient + top
  highlight) on glass cards with hover lift, hero gold card staged as a
  product shot (resting perspective angle, slow float, floor shadow,
  cursor tilt + glare), floating ticker tiles, machined primary CTA.
- Depth/motion inventory: floatY 7s on the hero object, SpatialCard3D
  tilt on gold card + podium, glass-card hover lift app-wide.
