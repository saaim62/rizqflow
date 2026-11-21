# RizqFlow — Agent Instructions

## This repo follows the Forgewarden Method

**Read `FORGEWARDEN.md` and `NOTES.md` before writing any code.**
Every task is briefed as a FORGE contract (Focused, Output-defined,
Requirements-first, Granular, Errors-cataloged). Every push must pass the
Warden Gates:

1. `npm ci` clean + `npm test` green + `npm run build` green — from a fresh clone.
2. Market data carries `DATA_AS_OF` + named sources; never label static data "live".
3. No seeded accounts, no hardcoded credentials, no real person's data as defaults.
4. `src/types/index.ts` is the locked contract; engines stay pure.
5. Modelling honesty: computed flags only; labels match the simulated horizon.
6. Zero external network calls; all user data stays in the browser.
7. Guardian pass by a reviewer who did not write the code.
8. New errors go into `NOTES.md` in the same change that fixes them.

## System Architecture & Directory Ownership
- `src/types/index.ts`: THE LOCKED CONTRACT. All data shapes live here. Do not deviate or use `any` to bypass types.
- `src/data/marketData.ts`: Seeded market data (PSX stocks, gold/silver series, presets) + `MARKET_SNAPSHOT`. Header must always carry current `DATA_AS_OF` and `DATA_SOURCES` — update them in the same change as any price update.
- `src/lib/engine/`: Pure calculation engines (wealth compounding, car TCO, streak detection). No I/O, no globals.
- `src/lib/auth.ts`: Local-only accounts & multi-portfolio storage (localStorage). Never seed users. Passwords are salted v2 hashes; this is device-local demo auth, not server auth — never describe it as secure authentication.
- `src/lib/format.ts`: Currency/number formatting (PKR Lac/Cr).
- `src/components/providers/ProfileProvider.tsx`: Global state (profile, portfolios, auth session, theme, privacy mask, onboarding mode).
- `src/components/onboarding/OnboardingWizardModal.tsx`: 6-step setup wizard. `mode='create'` makes a new portfolio; `mode='update'` recalibrates the active portfolio in place.
- `src/app/`: Routes — `/` overview, `/markets` streak terminal, `/planner` life planner, `/cars` car TCO map.

## Execution Guardrails
- **Token Cap:** Do not exceed 1.5 hours of continuous generation per run. Ship in verifiable increments.
- **Privacy First:** 100% client-side. No external API calls, no analytics, no tracking.
- **Data Updates:** when refreshing prices, change `marketData.ts`, the engine test ranges that encode yields, and `DATA_AS_OF` together — then run the full gate (ci/test/build).
