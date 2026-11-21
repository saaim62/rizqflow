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

### 17. Theme, definitive: exact DropRoute + TITAN portfolio tokens (owner, 21 Nov 2026)
- Owner instruction: "use the exact same background theme and colors that
  we used for my portfolio and dropRoute." Tokens were lifted VERBATIM
  from the source repos, not reinterpreted:
  - droproute/apps/web/src/app/globals.css: obsidian #050505, graphite
    #0A0A0C/#121214/#1C1C1F, gold ramp 300 #F7E08C / 400 #E8C15A /
    500 #D9A521 / 600 #A87F16, surface-glass rgba(13,13,15,0.7), the exact
    glass-panel/glass-card gradient+shadow recipes, body art = one gold
    breath radial rgba(217,165,33,0.05) + grain.
  - portfolio_v4/app/globals.css: ink #060607, cream #F5F1E6 (the ink
    token), muted #A7A7B3, faint #6D6D78, cyanx #2DD4EE.
- Emerald/amber/teal/yellow scales all carry the gold ramp ("Brand IS
  gold"); blue carries cyanx; purple carries DropRoute's electric violet.
- The cinematic depth layer from NOTES #16 is retained (float, tilt,
  layered shadows) with dark-stage values.

### 18. Holographic 3D chart + live pulse (owner, 21 Nov 2026)
- HoloChart3D (home): the real 30-day gold series rendered as a tilted
  holographic price plane — CSS 3D perspective, 3-layer extruded area,
  glowing brand-gold line, light pillars at peak/current, scanner sweep,
  floating peak/now readout chips. Visualization only; every coordinate
  is a stamped close.
- LivePulse (under hero): pulsing LIVE SYNC beacon, a bright segment
  travelling the REAL gold trace, snapshot values, and a REAL countdown
  to the next hourly /api/market-snapshot sync. No simulated price
  ticks — PSX/Sarafa publish daily and the strip labels the trace as
  real closes with the as-of date (Gate 2 holds).
- Next 16 prerender rule: Date.now() must not run in a client
  component's state initializer — set it inside useEffect.

### 19. Deploy OOM: in-Docker next build killed dockerd on the 2 GB host (21 Nov 2026)
- `docker compose up --build` on the t4g.small (1.8 GB RAM + DropRoute's
  ~1.3 GB) ran the host into global OOM during `next build`; the kernel
  killed dockerd itself (anon-rss 1.37 GB). systemd restarted Docker and
  DropRoute was unharmed (verified HTTPS 200), but the pattern is banned
  here: prebuild in a memory-capped throwaway container, run via the
  compose volume pattern (see docker-compose.prod.yml header).

### 20. Portfolio management QA round + server accounts (owner, 21 Nov 2026)
Owner's customer report: "I see 2 portfolios but only generated 1; I can't
see my full portfolios, nor edit or delete them." Full-flow QA found and
fixed five defects:
1. **Phantom portfolio.** Signup silently seeded a portfolio from
   PRESET_PROFILES[0] (a fictional junior engineer: 200k income) and the
   post-signup wizard then created the user's real portfolio as a second
   one. Fix: server signup creates NO portfolio; the wizard creates the
   first one with the user's own numbers.
2. **Wrong-profile planner.** The wizard was permanently mounted, so its
   draft useState initializers ran once at first mount (from a stale /
   preset profile) and never re-synced — recalibrating showed numbers
   from a profile that matched neither saved portfolio. Fix: the wizard
   now mounts only while open, so drafts initialize from the current
   profile every time.
3. **Preset overwrite.** While signed in, clicking a home-page preset
   replaced the active profile and the persist effect then saved it OVER
   the user's portfolio. Fix: signed-in preset clicks create a NEW
   portfolio from the preset; anonymous behavior unchanged.
4. **No portfolio management.** The account modal only had Switch. Now
   every portfolio row has View (full details), Rename (inline), and
   Delete (two-step confirm); server enforces ownership on every call.
5. **Cars podium contradiction.** evaluateCarDecision returned results
   UNSORTED while the leaderboard sorted its own copy — the podium
   crowned results[0] (profile order = the current vehicle) while the
   leaderboard crowned the true cheapest. Fix: the engine returns the
   ranked array; regression test in tests/server-auth.test.ts.
**Architecture change (FORGEWARDEN Gate 6, Amendment 2):** accounts and
portfolios moved from localStorage-only to the owner's server (RizqFlow's
own Postgres container on the host — separate instance/volume/credentials
from DropRoute's database, per the owner's explicit instruction; scrypt password hashes; hashed
session tokens in httpOnly cookies; `src/lib/server/*`, `/api/auth/*`,
`/api/me`, `/api/portfolios/*`). Pre-server local portfolios import into
the server account automatically on first sign-in/sign-up when the
server account is empty (one-time, flag `rizqflow_legacy_imported_v1`).
Gate that should have caught 1–4: Gate 7 guardian pass was never run as
an end-to-end customer flow; they are now covered by scripted browser QA.

## #21 — Owner audit of the advice layer (21 Nov 2026): exact arithmetic, four modelling defects

An independent from-scratch model (hand/Python, built from the stamped
PSX data) reproduced every engine output on the owner's real portfolio
TO THE RUPEE (final wealth, goal shortfall, all car TCOs, basket yield).
The calculators were never wrong; the ADVICE layer was:

1. **Manufactured freedom date.** The simulation escalated the dividend
   YIELD RATE itself at `dividendGrowthPct` (10%/yr), reaching ~19.7% by
   year 11. Fix: the yield stays flat at the current stamped yield; the
   PSX sleeve appreciates at (bucket expected total return − yield) in
   total-return terms. `dividendGrowthPct` no longer drives the sim.
2. **Bucket-blind planner.** Dividends were paid on 100% of the lump sum
   and every SIP regardless of the user's asset buckets. Fix: dividends
   are earned only on the PSX sleeve (`psx-dividends` bucket share of
   lump + SIP); other sleeves compound at their declared returns; goal
   withdrawals are pro-rata across sleeves. Contributions earn a
   half-year of dividends in their first year (monthly arrival), not a
   full year. Profiles without buckets keep the legacy 100%-PSX reading.
3. **Frozen basket.** `selectStockPortfolio` used two hand-picked lists
   calibrated to stale yields and excluded BIPL (11.3%, grade A,
   Shariah). Fix: the basket is derived from the stamped data on every
   call — grade-A payers only, top 8 by current yield, equal weights
   (yield-proportional weights chase the lumpiest payer).
4. **Self-contradicting fuel figures.** The planner expense field and the
   car engine's computed fuel for the same commute could differ ~4.6x;
   nothing reconciled them. The owner's own profile was corrected to the
   car engine's computed figure (see #21 follow-up in the deploy log);
   a product-level reconciliation prompt remains future work.
RETRACTED during the same audit: an initial finding claimed FFC/HUBC/
EFERT were mis-flagged as Shariah. WRONG — verified against the PSX
KMI-30 re-composition notice (accounts of 31 Dec 2025): all three ARE
KMI-30 constituents and the data flags were correct. Lesson recorded:
never assert Shariah status from model knowledge; check the index.
Also fixed: the freedom-date label counted from a hardcoded Oct 2026;
it now counts from the current month. E-scooty battery replacement is
carried in the Yadea preset's maintenance figure (data-level, labelled)
rather than a new engine term, keeping the types contract locked.
Gate that should have caught 1–3: Gate 5 (modelling honesty) — the
yield escalation and bucket-blindness were inherited from the original
swarm build and never re-derived against the stamped data until the
owner ordered this audit.

#22 — The "all-time peak" was a 30-day high (owner catch, 21 Nov 2026)
The gold card computed its peak as the maximum of the 30-day daily
series and labelled it "All-Time Peak": Rs 435,636 (5 Nov 2026), with a
"−12.8% off peak" story repeated in GoldSpotlight's hardcoded copy and
badge. The owner caught it from memory — his own gold had touched
~Rs 31 lac earlier in the year. The real all-time peak is Rs 572,862
per tola on 29 Jan 2026 (APSGJA rates, reported by ARY News, Express
Tribune and ProPakistani as the highest in Pakistan's history; it fell
Rs 35,500 the next day). The true drawdown at the 20 Nov close is
−33.7%, and today's price sits BELOW the 10–15% dip-zone band, not in
it. Fix: GOLD_YEAR_HISTORY (full year — monthly averages from the
goldrateshub/World Bank archive + the APSGJA peak and latest closes,
sources named in DATA_SOURCES) now drives the peak, off-peak drop and
dip-zone math in GoldDataCard and GoldSpotlight; the HoloChart chip is
labelled "30-day peak"; the dip-zone chip gained a truthful
below-the-zone state. Gate that should have caught it: Gate 5
(modelling honesty) — a window-relative statistic was labelled with an
absolute claim, the same failure class as #21's yield escalation.
