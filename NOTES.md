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

#23 — Four copy-fidelity gaps: decimal splits, item detail, liabilities, EV cars (owner report, 22 Nov 2026)
Copying a real portfolio into RizqFlow failed in four places, all model
limits rather than data errors: (1) the allocation splitter moved in 5%
steps and its auto-balance rounded to integers, so a real split like
12.7 / 30.7 / 42.1 / 7.7 / 6.8 could not be entered — the splitter now
works at 0.1 precision (slider step, typed input, decimal auto-balance)
and the engine already consumed splits as plain numbers. (2) There was
no item level at all — buckets held only a total and a %. Profiles now
carry additive-optional `holdings` (kind, label, value, quantity × unit
price — tola × rate, fund units × NAV, shares × price — gold purity,
free-text details for plots/banks) edited in the planner's new
Holdings & Liabilities card and preserved by sanitizeProfile.
(3) There was no liability field: the only way to show a debt (e.g. a
Splitwise balance of Rs 3,544,611) was a negative cash reserve, which
the local sanitize path clamps to ≥ 0. Profiles now carry
`liabilities`; the emergency-fund gap and the card are computed on the
net liquid position (reserve − liabilities) via netLiquidReservePkr.
Existing profiles are untouched: no liabilities = zero, so Saim's
verified plan outputs do not move. (4) The wizard's current-vehicle
picker offered only Petrol Car / Motorbike / None, though the TCO
engine has always supported fuelType 'ev' — it now offers Electric Car
(Leaf-class defaults: 16.5 kWh/100km, Rs 35k/yr maintenance). Gate that
should have caught these: Gate 5 (modelling honesty) — the model
silently approximated or refused real user data instead of representing
it.

#24 — Cars page had no way to ADD a vehicle at all (owner report, 22 Nov 2026)
Follow-up to #23: the wizard gained an EV option for the CURRENT vehicle,
but the Cars page's Vehicle Contenders card — where contenders are
compared — had no add control whatsoever. Existing candidates could be
edited or deleted, but a new one could never be created, so "add an
electric car" was impossible there (the Leaf/Honri in the owner's
screenshot were presets, not user-added). The card now has an Add
Vehicle form (type first: Petrol Car / Electric Car (EV) / E-Scooty,
with per-type defaults — EV starts at Leaf-class 15 kWh/100km,
Rs 35k/yr maintenance) and each existing card's type label is now a
select, so a mislabelled card can be converted petrol ↔ EV ↔ e-scooty
in place (the efficiency field swaps km/L ↔ kWh/100km with it). Gate
that should have caught this: Gate 5's spirit — a comparison tool whose
comparison set cannot be extended by its user is modelling only the
data it shipped with.

#25 — Raw digit strings hide zero-errors; amounts now spell themselves (owner request, 22 Nov 2026)
Typing 10000000000 into a price field gives the eye nothing to check —
one zero too many or too few is invisible until the plan comes out
wrong. Every money input now shows a live words line underneath via
formatPkrWords + the AmountWords component: Pakistani units, exact
decomposition (100000 → "1 Lac", 10000000 → "1 Crore",
12500000 → "1 Crore 25 Lac", 10000000000 → "10 Arab",
3544611 → "35 Lac 44 Thousand 611"). Silent below Rs 1,000, where the
digits are already readable. Wired into the planner intake (income,
SIP, lump, reserve, all five expenses), goal costs, holdings &
liabilities values, vehicle prices/maintenance/EMI fields (cards and
the add form), the onboarding wizard's money steps, and the gold-rate
editor. Gate that should have caught this: Gate 5 (modelling honesty)
— an input the user cannot verify at entry time is an error source,
not a convenience.

#26 — Cars page order: contenders directly under the parameters (owner instruction, 22 Nov 2026)
The Vehicle Contenders card sat below the leaderboard and the crossover
chart, so the user read results for a fleet they had not finished
editing. Per the owner's instruction it now sits directly below
Economic Parameters & Driving Profile and above the Real Cost a Month
Leaderboard: parameters → fleet → ranking → chart → disclosures.

#27 — AI Assist Phase 1: prediction core + Cars (owner request, 22 Nov 2026)
Users cannot sanity-predict fields like a car's 5-year depreciation —
they have no resale statistics — so the owner ordered an AI assistant:
a global toggle plus per-field predictions that fill the field and stay
editable. Phase 1 ships the core: POST /api/ai/predict (server-side
Groq call, key only in .env.server; primary openai/gpt-oss-120b with
qwen/qwen3.8-27b fallback — the owner's exact model, verified live
against his Groq account after an initial wrong guess of
qwen/qwen3-32b returned model_not_found), a pure prediction registry
(src/lib/aiPredictions.ts) with per-field prompts and sane-range
clamping, the AiAssistProvider + AiButton (inline suggestion panel:
value, reasoning, confidence; gold state marks AI-filled values), the
navbar toggle placed at the far right behind a divider with the bar's
spacing opened up (owner: the bar was too cramped), and Cars wiring —
price, depreciation, maintenance and efficiency predictions on every
vehicle card and in the add-vehicle form. Recorded as Gate 6
Amendment 3: AI fills inputs only, never touches stamped market data,
and the app works unchanged with AI off.

#28 — AI Assist Phase 2: Planner, goals, wizard, fill actions (22 Nov 2026)
Phase 2 of #27. Bucket expected returns were previously display-only
preset constants; they are now editable per bucket with a per-bucket AI
prediction plus an "AI Fill Returns" action that predicts all five in
parallel. Planner expenses gained per-category AI buttons (context:
category, household size, income) and an "AI Fill Expenses" action that
applies all five predictions in a single profile update (the intake's
field updaters close over the current profile, so five sequential
updates would have overwritten each other). Salary raise and new-goal
"Today's Cost" gained AI buttons; the wizard mirrors the expense and
vehicle-resale predictions; each vehicle card gained an "AI Fill" that
predicts depreciation, maintenance and efficiency in one tap.

#29 — AI Assist Phase 3: Holdings estimates + Markets outlook (22 Nov 2026)
Phase 3 of #27, completing the owner's inventory. Holdings rows gained
per-kind unit-price predictions: gold rate per tola (computed against
the live 24K rate and the row's purity), mutual-fund NAV estimates and
PSX share-price estimates — accepting one flows through the existing
quantity x unit-price value derivation. The Markets screener's expanded
stock view (desktop and mobile) gained an "AI 12-Month Outlook" panel:
a forecast price range with reasoning and confidence, displayed beside
the stamped close and explicitly labelled a forecast — the seeded
market data is never edited by AI (Gates 2 + 6 Amendment 3).
Correction inside #29: the first build failed type-check — the gold
rate context assumed a `currentRates` field on ProfileProvider that
does not exist; the 24K rate actually lives on the profile itself
(`profile.goldPerTolaPkr`, falling back to DEFAULT_MARKET_RATES), which
is what the shipped code uses. Gate 1's type check caught it before
any push, as designed.

#30 — AI Assist QA round: data restore + fixes (22 Nov 2026)
The owner's Chrome QA pass (all functional checks passed) surfaced
four defects, fixed here. (1) DATA: the QA session's authorised AI
Fill actions persisted to the owner's live portfolio — bucket returns
halved (14/12/13/11/8 -> 7/6.5/7/6.5/5), expenses tripled (43,162 ->
144,000, including an invented Rs 55,000 rent where the user has 0),
and the Leaf test values changed. All restored in the production DB
to the exact pre-QA values and verified by re-read. Root cause of the
worst swing: prediction prompts ignored the user's current values, so
the model substituted generic averages. Prompts for bucket returns and
expenses now receive the current value and are instructed to anchor on
it — a zero is deliberate (no rent in a family home) and bucket returns
stay within ~3 points of the researched baseline. (2) The widened
navbar (NOTES #27) wrapped labels at laptop widths: nav links and the
AI pill are now whitespace-nowrap, and the KSE-100 badge only renders
at 2xl widths (it was being crushed into a vertical pill that overlapped
the logo). (3) The AI ESTIMATE panel floated detached over neighbouring
cards on scroll — it now closes on any scroll. (4) The confidence chip
wrapped to two lines — now whitespace-nowrap in both panels. Pre-
existing issues the QA also flagged (auth flicker on direct
navigation, narrow stat-card wrapping) are unrelated to AI Assist and
were left for a separate round.

#31 — Topbar still cramped at laptop widths (owner screenshot, 22 Nov 2026)
The #30 nowrap fix stopped labels wrapping, but at the owner's actual
window width the bar still overflowed: too many controls compete for
one row. The header now degrades gracefully instead of crushing —
labels go icon-only in stages (Setup Flow text from xl, Share and
Guide text from 2xl, account name block from xl), gaps and padding
tighten below 2xl, and the bar wraps to a second row rather than
overlapping if space truly runs out. The KSE-100 badge stays 2xl-only
per #30 (it was the element crushing into a vertical pill over the
logo in the owner's screenshot).

#32 — Field explanation popups (owner request, 22 Nov 2026)
The owner asked for the kind of worked explanation he had just been
given for his Leaf's efficiency (40 kWh at 80% SOH over 200 km =
16 kWh/100km) to live inside the app: a small "i" beside every field
people find hard to understand, opening a plain-language popup on
hover or tap. New FieldInfo component (fixed-position panel, closes
on scroll/away, same pattern as AiButton). Wired into 17 places: car
price/resale, depreciation (with the Rs 30 Lac -> Rs 15 Lac example),
maintenance, mileage, kWh/100km (with the SOH worked example), EMI
down payment and installment, bucket expected return, lump sum, cash
reserve (negative = debt), salary raise, goal today's cost, holdings
rate-per-tola / NAV / price-per-share, and the wizard's resale field.
Pure UI — engines and data untouched.

#33 — Ownership made visible + hourly fuel/power checks (owner
report, 22 Nov 2026)
Two real gaps the owner caught: (1) the isCurrentVehicle flag drove
the swap banner's math but was shown NOWHERE — he could not see
which car the site thought was his (in the copied portfolio, the
Alsvin), and there was no way to change it from the Cars page.
(2) Fuel/power prices were stamped seeds with no refresh cadence,
while OGRA has moved petrol to DAILY revisions.
Fixes: every vehicle card now carries an independent "I own this"
checkbox (more than one vehicle can be owned) with a gold ring +
YOUR VEHICLE badge when ticked; a new YourVehiclesStrip at the very
top of the Cars page lists the owned vehicles with price and true
monthly cost (or explains the checkbox when none are marked); the
swap banner now NAMES its baseline ("Switching from your X to Y")
and, with several owned, compares against the owned vehicle with
the highest monthly true cost. Prices: a scheduled hourly check
(rizqflow-fuel-power-refresh) verifies the OGRA petrol price (and
NEPRA tariffs on Mondays) and runs the full update + deploy
pipeline only on a verified change. Engines untouched — the audited
plan numbers do not move.

#34 — True-cost explainer on Your Vehicles + FieldInfo hover fix
(owner, 22 Nov 2026)
(1) The Your Vehicles strip now carries a one-line explanation of
true cost under the owned vehicles ("value lost + what the price
could have earned invested + fuel/charging + maintenance, 5-yr
total / 60") with a FieldInfo icon holding the full worked example
(the Rs 48 Lac EV breakdown) for anyone who wants the detail.
(2) FieldInfo bug: the popup flashed and vanished because moving
the mouse from the icon toward the panel crossed the click-catcher
backdrop, whose mouse-enter closed it instantly. Fixed with a grace
timer — leaving the icon schedules a close in 300ms, entering the
panel cancels it, leaving the panel or clicking away closes.

#35 — FieldInfo v3, dead theme toggle removed, .env.example
(owner, 22 Nov 2026)
(1) The explanation popup STILL closed after ~a second: the v2
click-catcher backdrop was gone as a handler but still sat ON TOP
of the icon, so the icon lost hover the moment the popup opened
and the grace timer closed it. v3 removes the backdrop entirely —
click-away is now a document mousedown listener that ignores
clicks inside the panel/icon; nothing invisible covers the icon.
(2) The navbar sun/moon theme toggle did nothing visible: the
app's obsidian/gold theme is a fixed identity (owner directive:
the exact DropRoute/portfolio theme), so the toggle flipped state
no surface used. Button removed; it will not be missed.
(3) Added .env.example documenting every variable the code reads
(DATABASE_URL, POSTGRES_*, GROQ_API_KEY / GROQ_MODEL /
GROQ_MODEL_FALLBACK, NODE_ENV, PORT) with the optionality and
defaults, for local setup.

#35 — Gold & silver Sat 21 Nov 2026 closes (hourly fuel/power check, 22 Nov 2026)
The 21:23 PKT run was the first at/after 16:30 PKT, so it ran the daily
wider-market check (Sunday — PSX closed, so gold/silver/USD only, latest
PSX close kept). Petrol verified UNCHANGED at Rs 322/L (OGRA notification
issued Fri 20 Nov, effective 21–23 Nov; Dunya, Aaj, ARY, Business Recorder
agree) and USD/PKR unchanged at 276.51 (SBP M2M close Fri 20 Nov).
Gold and silver HAD moved: APSGJA Sat 21 Nov closes are gold Rs 376,336
(down Rs 3,500 — The Nation, ProPakistani, MM News) and silver Rs 4,600
(down Rs 108 — MM News, Karachi Post weekly summary). Two pages still
showing silver Rs 4,708 were repeating Friday's rate, not Saturday's;
MM News' own article gives 4,600, so 4,600 stands. No new APGJSA rate
was issued Sunday, so Saturday's closes remain in force.
Changes: DEFAULT_MARKET_RATES gold 379,836 -> 376,336, lastUpdated
2026-11-22; superseded 379,836 appended to STALE_SEED_VALUES so saved
profiles on the old default heal (deliberate custom values untouched);
daily gold/silver series rolled forward one day (30 points kept, 21 Nov
appended, 22 Oct dropped — streaks now gold −6, silver −4; gold insight
also stops calling the 30-day high of Rs 435,636 the "all-time peak");
GOLD_YEAR_HISTORY final point 21 Nov @ 376,336 (true drawdown from the
29 Jan peak now −34.3%); MARKET_SNAPSHOT gold/silver updated; preset
profiles, wealth-engine gold fallback and the types comment follow the
new default; DATA_SOURCES records the Saturday closes. Tests updated
to the new closes plus a stale-heal assertion for 379,836.

#36 — Portfolio Import & Export with AI field mapping (22 Nov 2026)
Added native and foreign portfolio import/export capability:
(1) Native Export: pure client-side JSON envelope generation (single:
    `rizqflow-portfolio-<name>.json`, all: `rizqflow-all-portfolios.json`)
    via `createNativeExportEnvelope` and `createAllPortfoliosExportEnvelope`
    in `src/lib/portfolioTransfer.ts`. Zero server round-trip.
(2) Native Import: automatically detects the envelope, cleanses raw
    payload through `sanitizeDeep()` (stripping `__proto__`, `constructor`,
    `prototype`), validates with `sanitizeProfile()`, shows a verified preview
    (age, income, investment, buckets, goals, vehicles), and imports as a NEW
    portfolio, resolving name collisions with ` (imported)`.
(3) Foreign AI Mapping: `POST /api/ai/map-portfolio` accepts foreign JSON or
    CSV (client parses CSV into records via `parseCsvRows`/`parseCsvToRecord`).
    Groq `openai/gpt-oss-120b` (fallback `qwen/qwen3.8-27b`) maps foreign keys
    to `UserProfile` fields using `PROFILE_SCHEMA_DESCRIPTOR`.
    A strict 30 KB payload cap is enforced server-side.
(4) Human-in-the-Loop Review: Client displays an editable mapping review table
    (source -> target -> value -> confidence badge: high/medium/low), highlights
    defaulted or low-confidence fields, and lists unmapped keys with their raw
    values. User confirms or discards; nothing is saved automatically.
(5) Heuristic Fallback: If AI is unavailable or rate-limited, client falls back
    to `mapForeignPayloadHeuristic()` without hard-failing the import.
(6) Dual Storage: Supported seamlessly in both signed-in mode (via
    `createNewPortfolio` server API) and anonymous mode (`ProfileProvider`).
Verified: 132/132 tests green (including round-trip, synthetic JSON/CSV,
hostile 15 MB/pollution inputs); Next.js 16 build clean across 16 routes.

#37 — Owner review corrections to the swarm branch (22 Nov 2026)
The Antigravity swarm's import/export branch (NOTES #36) was
independently reviewed before merge. The feature, the wizard fixes
and the gates all verified — but three corrections were required:
(1) QA-REPORT.md §2 originally presented the `solar-commuter`
PRESET (Rs 1.5M lump, Rs 150k/mo SIP, 22 kW solar) as the owner's
"Golden Fixture" and published its planner outputs (Rs 8.84 Cr
real wealth, freedom age 50, Rs 580k emergency target) as the
owner's baseline. Section 2 now carries the owner's REAL portfolio
(exported verbatim from production) and its true audited outputs
(real wealth Rs 11,464,756; home-goal shortfall Rs 14,664,188;
starting net dividend Rs 0), and tests/qa-baseline.test.ts now
loads the real fixture and asserts those numbers exactly instead
of asserting "> 0" against a preset. (2) The /planner ?ticker=
banner claimed it was "Simulating impact of PSX stock X in your
wealth plan" while changing nothing in the plan — reworded to say
what is actually true (the plan runs on the PSX bucket's expected
return; adjust it under Allocation). (3) The Alsvin true cost is
Rs 83,322/mo — the brief's hand-computed 83,325 was off by Rs 3;
the engine was right. Behaviour note carried from the review: the
swarm's BUG-AUTH-02 fix auto-creates a baseline "My Portfolio" on
the server when the last portfolio is deleted — shipped as-is at
the owner's decision to merge, recorded here so it is a known
behaviour, not a surprise.

## #38 — AI price predictions grounded in live web search (Nov 23, 2026)
- **Problem (owner-reported):** the AI Fill price for a Changan Alsvin came back **Rs 13.0 Lac** against a real market of ~Rs 38–42 Lac — the ungrounded model bled an INR figure (13 Lac INR ≈ the car's PKR price) and/or anchored on a down-payment listing. Ungrounded weights cannot know volatile PKR prices; no prompt wording alone fixes that.
- **Fix — grounded types:** `car-price`, `car-maintenance` and `car-depreciation` are now *grounded* (`GROUNDED_PREDICTION_TYPES` in `aiPredictions.ts`). The server answers them first with Groq's built-in **`browser_search`** tool on the primary model (gpt-oss-120b; `tool_choice: required`, `reasoning_effort: low`, 60s timeout) — search executes on Groq's side, so no new provider, key or client call is introduced (still inside Gate 6 Amendment 3). Fallback chain: grounded → plain primary → fallback model, so a search outage degrades to today's behaviour, never to an error.
- **Prompts:** car-price demands PakWheels/OLX listings, the MEDIAN full-cash price, explicit rejection of down-payment / installment / booking figures, and an explicit INR warning. Car-maintenance now receives the user's real `annualKm` (daily commute × 365, passed by `VehicleCardList`) and must scale service frequency to it. All three grounded prompts end with "reply with ONLY the JSON".
- **Parser:** browser-search replies carry snippets/prose before the answer and are incompatible with `response_format`, so `parsePrediction` now also scans balanced `{...}` objects from last to first and accepts the first that parses with a numeric value; the legacy whole-span path runs first, so plain replies behave exactly as before.
- **Not used:** Groq Compound (`groq/compound`, `groq/compound-mini`) — verified against Groq's changelog: deprecated Aug 2026 and **decommissioned 21 Sep 2026**; the model IDs now error. `browser_search` on gpt-oss is its documented replacement.
- **Deliberately unchanged:** the remaining ten prediction types stay ungrounded (stable knowledge or deliberately anchored to in-app baselines); verified market data is still never a prediction target; clamps unchanged. New tests: `tests/ai-grounding.test.ts` (grounded set, prompt rules, search-reply parsing).

*Renumbering note: entries #39–#42 below were filed as #38–#41 on the `swarm/fix-audit-round-2` branch and renumbered on merge — #38 above (AI grounding) landed on main first, the same day. Code comments from that round still cite the branch numbers.*

#39 — Canvas PNG Export Contrast, Markets Terminal, Pulse Bar & A11y (23 Nov 2026)
Audit Round 2 UI & accessibility remediations across global markets, snapshot export, and core modals:
(1) Canvas PNG Export (FIX-1.5, ShareSnapshotModal.tsx):
    - Replaced the three dark text fills (`#0C0C0F` used for the "Rizq" wordmark, the freedom date, and the real purchasing power wealth figure) with cream ink `#F5F1E6`.
    - Audited all canvas draw calls for contrast against dark obsidian/bento backgrounds: bumped the bottom disclaimer seal fill from `#5C574D` (2.73:1 contrast ratio) to `#8C867A` (5.6:1 contrast ratio), guaranteeing all text elements exceed the 3:1 contrast threshold.
    - Added unit test suite `tests/shareSnapshot.test.ts` with a Canvas 2D context stub asserting zero `#0C0C0F` text fills remain across all text rendering operations and auditing contrast ratios.
(2) Markets Terminal & Quick Simulator (FIX-3.2(a)(b)(c)):
    - QuickSimulator.tsx: dynamically derives WHT tax copy from actual filer status (`Net of 15% Filer WHT` vs `Net of 30% Non-Filer WHT`) instead of hardcoding 15% Filer copy.
    - markets/page.tsx: replaced ternary month mapping (`parts[1] === '11' ? 'Nov' : 'Oct'`) with a full 12-month calendar mapping table (`MONTH_NAMES`). Stylized daily metal price delta and percentage badges with sign-aware coloring (positive `+` in emerald, negative in rose, flat in zinc) instead of static red.
    - MarketPulseBar.tsx: dynamically derived 24K gold and silver streak badges from `METAL_ASSETS` history data (displaying sign-aware `▼ Nd` or `▲ Nd`) instead of hardcoded `▼ 5d` / `▼ 3d`. Added strict input validation asserting all benchmark overrides are finite numbers `> 0` before saving.
(3) Layout, A11y & Form Polish (FIX-3.4):
    - globals.css: updated `body { overflow-x: hidden }` to `overflow-x: clip`, resolving the CSS overflow containment conflict that prevented the Planner sticky sidebar (`position: sticky`) from anchoring during vertical scroll. Theme tokens remained strictly untouched.
    - QuickSimulator.tsx: upgraded slider track background to `bg-white/15` for clear visibility on dark canvas and aligned the tick labels (`Rs 5 Lac`, `Rs 30 Lac`, `Rs 60 Lac`, `Rs 1 Crore`) by their true mathematical percentage offsets (`0%`, `26.3%`, `57.9%`, `100%`) rather than CSS flex space-between.
    - FieldInfo.tsx: increased tap target bounding box to ~32px (`p-2 -m-2`) for touch accessibility while retaining zero layout footprint; added viewport boundary detection to flip the explanation popover upward when triggered in the bottom third of the viewport, preserving the NOTES #35 hover grace-timer behavior.
    - StockScreener.tsx: added `[color-scheme:dark]` and `style={{ colorScheme: 'dark' }}` to the native `<select>` element to prevent white-on-white text illegibility on Windows/Linux; expanded search input right padding to `pr-16` so typed queries never overlap the "Clear" button.
    - page.tsx: corrected "Beginner Guide" hero button hover styling from `text-zinc-500 hover:text-zinc-800` to `text-zinc-400 hover:text-white` so it remains clearly legible on obsidian background; bound gold and silver ticker pills to dynamic streak history.
    - Modals A11y: added `role="dialog"`, `aria-modal="true"`, and keyboard `Escape`-to-close handlers across `ShareSnapshotModal`, `AuthModal`, and `MarketPulseBar` benchmark editor.

#40 — Core Engines, Types & State Sanitizer Hardening (Audit Round 2, 23 Nov 2026)
Audit Round 2 pure calculation engine math, type contract, and state sanitizer hardening:
(1) WealthFlow Non-PSX Asset Compounding (FIX-1.2, wealthEngine.ts):
    - When `assetBuckets` contains no PSX bucket (e.g. 100% physical gold portfolio), `psxShare` is set to 0, PSX pot and dividend flows remain 0, and all user-declared buckets compound in `otherPots` at their declared expected returns and shares.
    - Preserved byte-identical behavior when PSX bucket exists, and preserved 100% PSX default when `assetBuckets` is omitted (legacy unpartitioned profile).
    - Added closed-form gold-only compounding test verifying 10-year compounding matching $P \times (1+r)^t$ exactly.
(2) Zakat Annual Wealth Tax Modeling (FIX-1.3, wealthEngine.ts):
    - Corrected modeling misconception: Zakat is an annual 2.5% wealth levy on eligible assets, NOT a dividend withholding tax (WHT) deducted at source.
    - Changed `netRetentionRate` to `1 - taxRate` only (15% filer, 30% non-filer).
    - When `profile.includeZakat` is true, 2.5% is deducted annually pro-rata across all asset sleeves before yearly goal checks. Documented no-nisab v1 simplification.
    - Added 3-year hand-computed verification test asserting exact rupee outputs year-by-year; Zakat OFF remains bit-identical.
(3) Dip-Buying Non-Hindsight Execution (FIX-1.4, streakEngine.ts):
    - Eliminated look-ahead bias in `simulateDipStrategy`: replaced hindsight `windowSlice.reduce(min)` with an executable chronological rule.
    - In each window, walks days chronologically and executes purchase at the first close completing a $\ge 3$-day consecutive down streak; falls back to window's final close only if no dip occurs.
    - Handled short histories (`history.length < safeMonths`) by capping window count to `Math.min(safeMonths, n)` rather than repeatedly buying the last day.
    - Added crafted price-series unit test verifying that when a 3-day drop triggers a buy, it executes on that close rather than cherry-picking lower prices later in the window.
(4) Car TCO 0% Down-Payment & 84-Month Loan Proration (FIX-2.7, carTcoEngine.ts):
    - Replaced falsy checks (`!quote.downPaymentPkr || quote.downPaymentPkr <= 0`) with explicit null/undefined/< 0 checks, allowing `downPaymentPkr === 0` (100% bank financing) as a valid complete quote with `equityTiedUp = 0` (zero capital opportunity cost).
    - For loan tenures > 60 months (e.g. 84-month auto loans), prorated bank markup over the 5-year evaluation window via `totalInterest * Math.min(tenure, 60) / tenure` (linear proration simplification).
    - Verified solar net-billing (Rs 11) and grid tariffs remain untouched. Added 0%-down and 84-month proration tests.
(5) State URL Sanitizer Hardening (FIX-3.1, stateUrl.ts):
    - Strict boolean parsing: `parseStrictBoolean(val, fallback)` checks `val === true || val === 'true'` vs `val === false || val === 'false'`, preventing string `"false"` from evaluating truthy.
    - Deep element-level clamping and validation for `assetBuckets` (whitelisted IDs, percentages 0–100, money $\ge 0$), `lifeGoals` (valid ages, money $\ge 0$), and `vehicles` (whitelisted fuel types, valid consumption rates, validated EMI quotes).
    - Clamped `currentCashReservePkr` allowing negative values for debt modeling.
    - Added tests proving the owner's golden fixture round-trips field-for-field unchanged.
(6) Polish & Documentation (§6.5, FIX-3.2(d), FIX-3.3(b)):
    - Replaced `dividendYieldPct || 8.0` with `?? 0` in execution sheet calculation.
    - Removed unused hardcoded `monthsShavedOffFreedom: 0` from `VehicleSwapOption`.
    - Added clarifying code comments documenting the inflation exponent convention (`Math.pow(1 + inf, year)` for goals/wealth vs `year - 1` for annual expenses) and calculated exact PKR deltas for FIX-REPORT-ROUND-2.md (home goal at yr 4 delta: PKR 1,511,654; debt goal at yr 1 delta: PKR 60,000).
    - Golden baseline verified bit-identical to the rupee.

#41 — Sync, Auth/Session Hardening, AI Cache, Import/Export & Infra (Audit Round 2, 23 Nov 2026)
Audit Round 2 API sync, auth session hardening, AI cache, import/export, and infrastructure remediations:
(1) ProfileProvider Debounce & Sync Ordering (FIX-2.1, ProfileProvider.tsx):
    - Stored pending debounced profile updates in a ref (`pendingSaveRef`).
    - Flushed pending updates immediately with the outgoing portfolio ID before any portfolio switch (`await flushPendingSync()`), preventing lost edits during rapid switches (< 900ms).
    - Registered a `beforeunload` listener calling both `api.updatePortfolio` and `fetch('/api/portfolios/${id}', { keepalive: true })` to guarantee delivery on page unload.
    - Added unit test in `tests/sync.test.ts` verifying rapid edit → switch still sends the update for the old portfolio ID.
(2) Shared Plan Hash Support for Signed-in Users (FIX-2.2, ProfileProvider.tsx):
    - Enabled `window.location.hash` plan decoding for signed-in users on page load: loads the shared plan as the active view without overwriting saved portfolios in the DB.
    - Synchronized `lastSyncedRef` with the loaded shared plan to suppress automatic persist echoing unless explicitly edited or recalibrated.
    - Dispatched distinct toast: `"Loaded shared plan — it isn't saved to your account"` for signed-in users vs `'Loaded shared plan from URL!'` for anonymous users.
    - Covered both auth states in `tests/sync.test.ts`.
(3) Server & API Hardening (FIX-2.3):
    - `src/lib/server/http.ts`: Mirrored `setSessionCookie`'s `secure: process.env.NODE_ENV === 'production'` in `clearSessionCookie` (with `maxAge: 0`).
    - `src/lib/server/db.ts`: Cleared cached `schemaReady` promise on rejection so transient database connection errors automatically retry on subsequent requests.
    - `src/app/api/auth/signin/route.ts`: Unified missing-account, wrong-password, and out-of-range password failures to 401 `{ error: 'Invalid email or password.' }` to prevent account enumeration and protect scrypt from DoS.
    - Auth & Portfolio routes (`/api/auth/*`, `/api/me`, `/api/portfolios/*`): Enforced 400 on malformed/null/array JSON bodies; enforced password length 6–128; rejected non-object/array profile payloads with 400 and executed server-side `sanitizeProfile` before persisting.
    - Added test suite in `tests/server-auth.test.ts`.
(4) AI Cache & Rate Limit Hardening (FIX-2.4):
    - `src/lib/server/ai.ts`: Constructed cache keys via `stableStringify` (recursive sorted-key serialization), eliminating `[object Object]` collision bugs on complex context objects while maintaining deterministic keys across property insertion orders.
    - Capped AI prediction cache, foreign mapping cache, and daily IP counts map at 500 entries using FIFO/LRU eviction.
    - `src/lib/server/rateLimit.ts`: Capped auth rate-limiting buckets map at 500 entries.
    - Automatic daily count map reset on day rollover. Kept AI endpoints public for anonymous users.
    - Added collision and capacity tests in `tests/server-auth.test.ts`.
(5) Portfolio Import & Numeric Parser Hardening (FIX-2.5):
    - `src/lib/portfolioTransfer.ts`: Rewrote `cleanSign()` in `parseCleanNumber` to properly parse negative values positioned after currency prefixes and within accounting parentheses (e.g. `parseCleanNumber('Rs. -30 Lac') === -3000000`, `parseCleanNumber('-2.5 Cr') === -25000000`, `parseCleanNumber('Rs (-30 Lac)') === -3000000`).
    - `src/components/portfolio/ImportPortfolioModal.tsx`: Used a local `takenNames` Set during multi-portfolio batch import loops to ensure duplicates in the same batch receive distinct names (e.g. `Dev`, `Dev (imported)`).
    - Strict boolean parsing for inline foreign edits: `'true' -> true`, `'false' -> false`, avoiding JavaScript's `Boolean('false') === true` bug.
    - Reset file input (`e.target.value = ''`) after handling so re-uploading the same file reliably fires `onChange`.
    - Added unit test suite in `tests/portfolioTransfer.test.ts`.
(6) Infrastructure, Salt & Hydration (FIX-3.3(c)(d)(e), §6.6):
    - `docker-compose.prod.yml`: Added `required: false` to `env_file: - path: .env.server` for both `rizqflow` and `db` services, keeping `.:/app` volume mount intact.
    - `src/lib/auth.ts`: Upgraded local salt generation in `makeSalt()` to use `crypto.getRandomValues(bytes)` with a local-only fallback comment.
    - Enforced unique portfolio names on manual create and rename across client `ProfileProvider` and server API routes (409 on collision).
    - Resolved signed-out hydration flash (BUG-AUTH-01) by synchronously hydrating from `localStorage` / URL hash on client mount, and exported `hasLoaded: boolean` in `ProfileContextType`.
    - `README.md`: Rewrote the persistence section to document PostgreSQL server-backed accounts, httpOnly session cookies, scrypt hashing, and multi-device synchronization under Gate 6 Amendment 2.

#42 — Onboarding, Planner, Cars & Zero-Value Sweep (Audit Round 2, 23 Nov 2026)
Audit Round 2 UI, accessibility, and zero-value preservation across Onboarding, Planner, and Cars:
(1) Zero-Value Sweep & Clearable Inputs (FIX-1.1):
    - Replaced every numeric `|| default` with `?? default` in `OnboardingWizardModal.tsx`, `PlannerIntakeForm.tsx`, `MultiAssetSplitter.tsx`, `WealthHeadlineCards.tsx`, `CompoundingChart.tsx`, `CarControls.tsx`, `VehicleCardList.tsx`, and `cars/page.tsx`, ensuring deliberate `0` entries (e.g. `lumpSumPkr: 0`, `rentOrHousing: 0`, `annualSalaryRaisePct: 0`, `dailyCommuteKm: 0`) are never overwritten by fallback values.
    - Added raw string state across clearable inputs (`rawRetirementAge`, `rawPetrolPrice`, `rawKmPerLitre`, `rawKwhPer100Km`, `rawQty`, `rawPrice`, `rawEmiDown`, `rawEmiInstallment`) so clearing an input does not snap back to defaults while typing.
    - Updated `HoldingsLiabilitiesCard.tsx` so setting or clearing `quantity <= 0` or `unitPricePkr <= 0` immediately resets `valuePkr` to 0.
(2) ApplyCarSwapBanner Persistence & Financed Equity (FIX-1.6):
    - Persists decision signature (`${currentVeh.id}:${winningCandidate?.id ?? cheapest.vehicleId}:${Math.round(freedEquity)}:${Math.round(monthlySavings)}`) to `profile.appliedCarSwapKey`. When applied, the button displays "Applied ✓" and stays disabled until input parameters change.
    - Financed baseline freed equity is computed from tied-up equity (`currentVeh.emiQuote?.downPaymentPkr`) rather than the full sticker price, and rendered with "estimated equity" copy.
    - Suppressed banner rendering when `monthlySavings <= 0 && freedEquity <= 0`.
(3) Empty Vehicle Fleet Safety (FIX-1.7):
    - Updated `cars/page.tsx` to check `profile.vehicles !== undefined ? profile.vehicles : DEFAULT_CARS`, allowing users to maintain an empty fleet (`[]`) without resurrecting `DEFAULT_CARS`.
    - Rendered clean empty state in `VehicleCardList.tsx` ("No vehicles yet — add your first") with options to add custom vehicles or pick presets (Yadea M3, BYD Atto 3, or restore default fleet).
    - Audited all car consumers (`CarPodium3D`, `RealCostLeaderboard`, `YourVehiclesStrip`, `DistanceCrossoverChart`, `VerdictBanner`) for empty fleet safety with fallback placeholders and null checks.
(4) Confirmation Modal & AI Fill Error Handling (FIX-2.6):
    - Added confirmation modal before `resetToPreset('junior-engineer')` in `planner/page.tsx` to prevent accidental profile overwrites.
    - Wrapped `aiFillExpenses`, `aiFillReturns`, `aiFillVehicle`, and all prediction handlers in `try { ... } catch (err) { showToast(...); } finally { clear loading }`, guaranteeing loading states are cleared and user is notified on failure.
(5) Planner Polish, Goal Editing, Zakat & A11y (FIX-3.2(e)(f), FIX-3.3(a), FIX-3.4(a)):
    - `MultiAssetSplitter.tsx`: exported `autoBalanceBuckets` with 0.1% rounding remainder absorbed into the largest bucket, guaranteeing exact 100.0% totals across fractional splits (tested with 12.7 / 30.7 / 42.1 / 7.7 / 6.8).
    - `LifeGoalsManager.tsx`: wired `handleUpdateGoal` to an inline edit UI (name, target age, today's cost in PKR) with Save and Cancel buttons.
    - Zakat UI copy updated across Onboarding and Planner to "2.5% of portfolio value, yearly".
    - Removed unused `dividendGrowthPct` from wizard step 2.
    - Upgraded slider tracks to `bg-white/15` and aligned tick labels by exact mathematical percentages in `MultiAssetSplitter.tsx` and `CarControls.tsx`.
    - Added `role="dialog"`, `aria-modal="true"`, and keyboard `Escape` handler to `OnboardingWizardModal.tsx`.
(6) Unit Testing (tests/ui-planner-cars.test.ts):
    - Added 11 unit tests covering MultiAssetSplitter auto-balance remainder, wizard zero-value drafts, holding zero-value resets, car swap decision signature persistence, empty fleet safety, and AI fill rejected promise handling.
    - Verified full test suite (172/172 tests green) and Next.js production build (`npm run build`).

## #43 — Grounding narrowed to car-price after live evidence (Nov 23, 2026)
- Deployed #38–#42 and live-tested `/api/ai/predict`: **car-price grounding works** — Changan Alsvin 1.3L returned **Rs 3,789,000** via `gpt-oss-120b + browser_search`, reasoning citing a real PakWheels on-road listing (vs the Rs 13.0 Lac ungrounded failure that started #38).
- But car-maintenance and car-depreciation grounded calls **ran into the 60s timeout** (their searches browse workshop/spec pages interactively) and fell back anyway — first to Qwen (during a short gpt-oss rate-limit window after the search-heavy call), then to the plain primary once the window passed. Net effect of grounding those two: a ~60s wait for the same answer.
- **Change:** `GROUNDED_PREDICTION_TYPES` is now `{car-price}` only. Maintenance keeps the annual-km scaling prompt; depreciation keeps its cross-year framing (search wording removed since no tool is attached). Fallback chain unchanged. Verified live after redeploy.

## #44 — Wizard Step 5 vehicle reverts on reopen; Step 6 goals never round-tripped (Phase 0, Round 3, Nov 23, 2026)
- **Symptom (owner-reproduced):** in Recalibrate (mode='update'), Step 5's Current Vehicle Setup set to EV reverted to "Petrol Car" and Current Vehicle Resale set to Rs 4,800,000 reverted to Rs 2,800,000 when the wizard was reopened, while plain fields (e.g. daily commute) round-tripped correctly.
- **Root cause (full trace, save vs load per step):** Steps 1–4 and Step 5's plain fields (dailyCommuteKm, solarKw, solarTariffMode) save and load the SAME profile fields — no mismatch. Step 5's vehicle was split-brain: the finish path wrote it ONLY into the `vehicles[]` entry flagged `isCurrentVehicle` (`fuelType: 'ev'|'petrol'`, `pricePkr` = resale; petrol-bike vs petrol-car collapsed to 'petrol', split only via kmPerLitre 45/13) and NEVER wrote the profile-level `currentVehicleType`/`currentVehicleResalePkr` (they survived only as stale spread values), while the draft initialisers read NEITHER representation — `useState('petrol-car')` and `useState(2800000)` were hard-coded constants. Step 6 had the same pattern in both directions: finish built wedding/house goals but then set `lifeGoals` to the pre-existing profile goals in update mode (and whenever any goals already existed), discarding the draft; the initialisers were constants (29/2,500,000, 33/15,000,000) that never read `profile.lifeGoals`.
- **Fix — single source of truth:** new pure module `src/lib/wizardDraft.ts` exporting `buildWizardDraft(profile)` (load) and `compileWizardProfile(profile, draft, mode)` (save); `OnboardingWizardModal` now initialises every step from the former and finishes through the latter, so the tested functions ARE the wizard's path. Step 5's authoritative representation is the profile-level `currentVehicleType`/`currentVehicleResalePkr` (already in the locked types, already preserved by `sanitizeProfile`, already what the wealth engine's swap math reads): save writes them on EVERY finish AND mirrors them into the flagged `vehicles[]` entry for the Cars pages; load prefers them and falls back to deriving from the flagged entry for legacy profiles that lack them (ev/e-scooty → ev-car; petrol with kmPerLitre ≥ 30 or 'bike' in the name → petrol-bike; else petrol-car), with the old constants only as last-resort defaults. Step 6: load reads the saved goals (wizard ids `goal-wedding-custom`/`goal-house-custom`, name match as fallback); save merges the two wizard goals into `lifeGoals` in BOTH modes, replacing the loaded goal in place and preserving all non-wizard goals (e.g. Debt Clearance) untouched. No type, engine, market-data, theme or TCO-horizon changes; `tests/qa-baseline.test.ts` untouched and bit-identical.
- **Tests:** new `tests/wizard-roundtrip.test.ts` (8 tests): full-field round-trip across all 6 steps in both create and update modes asserting the reopened draft is identical, idempotence of a second cycle, the exact owner regression (EV + Rs 4,800,000 survive, and do NOT return as Petrol Car / Rs 2,800,000), 'none' + resale round-trip, zero-value round-trip, Step 6 update-mode merge with a non-wizard goal preserved, and legacy vehicles[]-only derivation. Suite: 186/186 green (was 178), build green.
- Gate that should have caught this: Gate 8 / Gate 1 — a save→reopen round-trip test for the wizard draft did not exist; the #42 zero-value wizard tests emulated draft logic in the test instead of exercising the wizard's actual serialise/deserialise path, so a load side that read constants instead of the profile passed every gate.

## #45 — Liabilities that actually bite: due-date model in the life-plan projection (Phase 1, Round 3, Nov 23, 2026)
- **Before:** `liabilities` (NOTES #23) were position-only items (`label` + `amountPkr`): they reduced the net liquid position and widened the emergency-fund gap, but no payment ever left the projected portfolio — a Rs 1M family loan "due in 5 years" changed nothing in the wealth path.
- **Types (additive-optional, locked-contract discipline):** `LiabilityItem` extended into `Liability` (alias kept) with `name`, `category` (mortgage / vehicle-loan / education-loan / personal-loan / credit-card / bnpl / medical / tax / family-loan / other), `kind` ('amortizing' | 'revolving' | 'balloon'), `balancePkr`, `aprPct` (0 allowed), `monthlyPaymentPkr` (amortizing), `minPaymentPctOfBalance` (revolving), `dueDateISO` (balloon due date; amortizing optional term end). Legacy `label`/`amountPkr` remain as synced mirrors. `PlanSummary` gained additive-optional `liabilityWarnings` / `liabilityShortfalls` / `liabilityPayoffs` / `totalLiabilityPaymentsPkr`, and timeline points gained optional `liabilityPaidPkr` / `liabilityBalancePkr` — all present ONLY when scheduled liabilities exist, so liability-free results keep the exact pre-#45 shape.
- **Engine:** new pure `src/lib/engine/debtSchedule.ts` builds a monthly schedule (interest accrues, then the payment applies): amortizing pays a fixed monthly payment to payoff; revolving pays min% of the current balance (Rs 1 residual settles so % schedules terminate); balloon accrues and the FULL balance is one outflow in its due month. `calculateLifePlan` consumes the schedule aggregated per year, paid pro-rata from the sleeves BEFORE goal checks, as separate outflows — never routed through monthly expenses (no double-count). If the portfolio cannot cover a year's outflows, the unpaid part is recorded as explicit `liabilityShortfalls` (balloon dues attributed first) instead of a silent negative. Payment < monthly interest grows the balance (negative amortisation) and is flagged on the payoff info AND in `liabilityWarnings` — never silent. **Purity:** the engine never reads the clock for debts; a balloon's due month is derived from `dueDateISO` relative to an explicit `projectionStart` parameter (the planner page passes today; a balloon with no usable date/start is reported unscheduled in warnings, not guessed).
- **Legacy compat (load-bearing):** scheduling requires an explicit `kind` + `balancePkr`. Legacy #23 items (Splitwise-style, no schedule fields) stay position-only — the existing engine test asserting they move the emergency gap but NOT final wealth still passes unchanged, and the owner's Rs 7.5L debt (held as a life goal / negative cash reserve in the audited fixture) is NOT silently migrated. Absent/empty liabilities ⇒ engine output deep-identical (asserted).
- **Sanitizer:** `sanitizeLiabilities` (the single path — the server portfolio API uses the same `sanitizeProfile`) now deep-clamps the scheduled fields with holdings discipline: NaN/Infinity never survive, negative APR clamps to 0, unknown category → undefined, unknown kind → schedule dropped (balance kept as position), invalid calendar due dates dropped, missing ids regenerated, kind-specific fields kept only for their kind, and canonical/mirror fields synced.
- **UI:** `HoldingsLiabilitiesCard` liabilities side is now a real manager — add/edit/delete with category + kind selects, kind-specific fields (monthly payment + optional term end / min-payment % / due date), FieldInfo on APR, min-payment % and balloon due date, and a per-liability summary line from the SAME schedule helper the engine uses ("Clears Mar 2029 · total interest Rs X", "Due …" for balloons, red warning on negative amortisation; unscheduled legacy items say so plainly). Liabilities total already showed in the card summary; `WealthHeadlineCards` now also shows today's liabilities under the net-worth headline, noting scheduled payments are inside the projection. Household bills stay in expenses — untouched.
- **Tests:** new `tests/liabilities.test.ts` (12 tests), hand-computed expectations shown in comments: (a) balloon Rs 1,000,000 @ 0% due month 60 — schedule helper asserts months 1–59 zero and exactly Rs 1,000,000 at month 60 (the engine exposes yearly snapshots, so month precision is asserted on the helper and the year-5 engine snapshot carries exactly the balloon, with years 1–4 identical and the final-wealth delta exactly Rs 1,000,000 on a zero-return flat variant of the qa-baseline fixture pattern); balloon shortfall case (Rs 500k portfolio vs Rs 1M due → shortfall Rs 500,000 at month 60, wealth floors at 0); (b) amortizing Rs 1,200,000 @ 12%, Rs 25,000/mo → payoff month 66, total interest Rs 443,001.80 (formula n ≈ 65.72); (c) revolving Rs 200,000 @ 24%, 10% min → clears month 144, total paid Rs 248,780.27 > principal; (d) negative amortisation Rs 500,000 @ 24% paying Rs 5,000 → balance Rs 567,060.45 after 12 months + GROWING warning on helper and plan; (e) absent/empty liabilities deep-equal, legacy position-only behaviour; (f) sanitizer malformed entries. Suite: 198/198 green (was 186), build green, `tests/qa-baseline.test.ts` byte-unchanged vs 79da2b6.
- Gate that should have caught the original gap: Gate 5 (honesty in modelling) — a declared debt with a due date that never moved the projection was a model that did not compute what the UI implied; the acceptance tests above are the standing proof.

## #46 — AI Assist v2: grounded specs, code-derived EV efficiency, bands, ground truth (Phase 3, Round 3, Nov 23, 2026)
- **Grounding extension:** `GROUNDED_PREDICTION_TYPES` is now {car-price, car-efficiency, car-depreciation} — the exact #38/#43 pattern (gpt-oss-120b + `browser_search`, `tool_choice: "required"`, `reasoning_effort: "low"`, 60s grounded timeout, chain grounded → plain primary → fallback model). Per-type prompts demand Pakistani sources (PakWheels, OLX PK, official brand PK pages): efficiency must return manufacturer specs (battery kWh + rated range km for EVs; engine + rated mileage for petrol), depreciation must compare same-model listings across model years, full-cash only. Car-maintenance stays ungrounded (#43 evidence stands). **Live grounded behaviour for the two newly grounded types is UNVERIFIED**: the build sandbox has no Groq key (it lives only in production `.env.server`), so no live call could be run; no evidence of breakage was obtained either, so nothing was narrowed back out — first live check after deploy should watch these two types for 60s-timeout fallbacks, the #43 signal.
- **Code-side EV derivation:** `deriveEvEfficiencyKwhPer100Km(batteryKwh, ratedRangeKm)` (pure, in `aiPredictions.ts`) — when a car-efficiency reply carries `batteryKwh` + `ratedRangeKm`, `parsePrediction` replaces the model's value with battery ÷ range × 100 and records the specs + source/cycle in the reasoning ("Derived in code: 40 kWh ÷ 250 km × 100 = 16 kWh/100km (rated specs, …)"). The model's arithmetic is never trusted; absent/invalid specs fall back to the model's direct value. `PredictionResult` gained additive-optional `source` / `sourceNote` / `batteryKwh` / `ratedRangeKm` / `specSource`.
- **Validation bands (flag, don't silently clamp):** `EFFICIENCY_BANDS_KWH_PER_100KM` — e-scooty 1–5, EV car 8–30 kWh/100km. An out-of-band value keeps the global spec clamp for safety but is forced to confidence `low` with the reason appended to the reasoning ("Flagged: 7 kWh/100km is outside the expected 1–5 … band"). Petrol km/L unchanged. One forced spec change: the car-efficiency global clamp floor dropped 2 → 1, because the old floor silently clamped the Yadea M3's real derived 1.725 up to 2 — exactly the silent-clamp failure this phase exists to remove.
- **Ground-truth table:** new `src/lib/vehicleGroundTruth.ts` (DATA_AS_OF 2026-11-23, per-entry source + URL + note, marketRates-style discipline). `predictWithAi` checks it BEFORE any model call (and before the API-key check — a hit needs no key and consumes no daily cap) for car-price / car-efficiency / car-depreciation; hits return `source: 'sourced'`, model label "Sourced data", and AiButton renders a "Sourced Data · <source>" header instead of "AI Estimate" (Gate 6 Amendment 3: sourced data is never labelled an AI estimate, model output never labelled sourced). Seeded: Nissan Leaf 40 kWh (price + specs-derived efficiency), Changan Alsvin, Yadea M3 (1.38 kWh / 80 km → 1.725), Honda City, Toyota Corolla, Suzuki Alto, Suzuki Mehran, Honda CG 125, Lifan V16S (price only) — every value from a Pakistani source consulted during this phase (PakWheels model/bike pages and comparisons, HamariWeb Autos, DealDone PK), cited per entry. **Omissions, deliberately:** depreciation % seeded for NO vehicle (no consulted source publishes a defensible per-model 5-year % — omitted rather than guessed; the model path still answers it), and Lifan V16S efficiency (no Pakistani rated-km/L source found; its price rests on a single PakWheels used listing and is flagged as such in the entry).
- **Price_type filtering:** the current code had NO listing aggregation (the model returned a single median). Minimal parser awareness added: the car-price prompt may now return `listings[]` with `priceType` tags, and `medianFullCashPrice` computes the median of full-cash listings only — down-payment / installment / lease / booking listings are excluded from the derivation (the #38 failure mode). Replies without listings behave exactly as before; #38/#43 parser behaviour (last-JSON extraction) untouched.
- **Provider abstraction:** `AiProvider` layer in `src/lib/server/ai.ts` — provider chosen by `AI_PROVIDER` env (default `groq`), models by the existing `GROQ_MODEL` / `GROQ_MODEL_FALLBACK`; Groq is the only wired provider, no new endpoints or external calls, `/api/ai/predict` external behaviour unchanged.
- **Rate-limit discipline:** single-flight map keyed by the same `cacheKey` as the 6h cache — identical concurrent requests share one upstream chain (joiners don't consume the daily cap twice); bulk fills remain sequential; no parallel bursts introduced.
- **Tests:** new `tests/ai-v2.test.ts` (18 tests): derivation (40/250 → 16.0; 1.38/80 → 1.725; model value overridden by specs; absent specs fall back), bands (7 kWh/100km e-scooty flagged low with reason; in-band EV passes; petrol unflagged), ground truth (Yadea M3 resolves sourced with NO model call — asserted through `predictWithAi` with no API key configured; unknown vehicle / unseeded field / non-vehicle type miss cleanly; every entry carries source + URL), price_type (down-payment excluded from median; parser derives price from full-cash listings), provider default + single-flight (two concurrent identical requests = one stubbed upstream fetch). `tests/ai-grounding.test.ts`: the grounded-set expectation updated for the two re-extended types (the #43-era assertion contradicted this phase's brief); all parser expectations unchanged. Suite: 216/216 green (was 198), build green, `tests/qa-baseline.test.ts` byte-unchanged vs 79da2b6. No market-data, engine, type-contract, theme or horizon changes.
- Gate that should have caught the original gap: Gate 5 (honesty in modelling) — an "AI estimate" for a Leaf's consumption was the model's invented arithmetic on specs it never looked up; derivation-in-code plus a sourced table makes the number's provenance explicit and checkable.
