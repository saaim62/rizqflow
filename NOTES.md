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
