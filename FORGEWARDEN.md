# The Forgewarden Method

> How work is done in this repository — by humans and by AI agents (Antigravity
> swarms, Muse, or any other builder). Codified 21 Nov 2026 after a full
> external audit of this codebase found strong engines undermined by stale
> data, a seeded account, and tests that could not run. Every rule below is a
> scar from a real failure in this repo (see `NOTES.md`).

**Forge** = how a task is specified and built.
**Warden** = the gates that guard the repo. A gate is not advice; work that
fails a gate does not ship.

---

## Part 1 — FORGE: every task is a contract

Before any building starts, the task brief states all five:

| # | Rule | Test |
|---|------|------|
| **F** | **Focused** — the title names domain, action and scope. | Read the title with no context: do you know exactly what will change? |
| **O** | **Output defined** — the deliverable is concrete and checkable (files, behaviours, numbers). | Could a stranger verify "done" without asking you? |
| **R** | **Requirements first** — every input, dependency and constraint declared upfront, including what NOT to touch. | Can the builder start without asking a single question? |
| **G** | **Granular** — 2 to 5 subtasks. Fewer hides complexity; more is a project, not a task. | Is each subtask independently verifiable? |
| **E** | **Errors cataloged** — before starting, check `NOTES.md`. If the same error happens twice, it is written there with root cause and fix. The third occurrence is a process failure, not bad luck. | Did you read the catalog entries for the areas you are touching? |

## Part 2 — The Warden Gates (all must pass before any push)

1. **Fresh-clone gate.** `npm ci` succeeds from a clean checkout, `npm test`
   is green, `npm run build` is green. A test that cannot run from a clean
   clone does not exist. Never commit dependency or config changes without
   re-running all three.
2. **Data-freshness law.** Every market figure in `src/data/marketData.ts`
   carries an as-of date and a named source in the file header
   (`DATA_AS_OF`, `DATA_SOURCES`). The UI displays that date wherever the
   data is presented. The words "live" / "real-time" are **forbidden** for
   static data. Synthetic or sample series must be labelled as sample in the
   UI. Prices older than 5 trading days must be treated as a defect, not a
   detail.
3. **No seeds, no secrets, no real people.** No hardcoded credentials, no
   seeded user accounts, no real person's name, email, income or portfolio
   as a default, fixture or placeholder in shipped code. Tests use fictional
   users. Demo content uses clearly fictional personas.
4. **Contract lock.** `src/types/index.ts` is the single source of truth for
   data shapes. Engines in `src/lib/engine/` are pure functions of the
   profile — no I/O, no globals, no hidden constants that contradict profile
   fields (rates come from the profile or the data layer, never magic
   numbers buried in a formula).
5. **Honesty in modelling.** The engine must never claim an outcome it did
   not compute: funded flags are computed from available capital, labels
   match the simulated horizon, yields are computed from the stamped prices
   and declared dividends — never hand-tuned to look good. If a number is an
   approximation, the UI copy says so.
6. **Privacy law.** Amounts are maskable; no third-party network calls, no
   analytics, no tracking. One owner-approved exception (21 Nov 2026): a
   same-origin GET to the app's own `/api/market-snapshot`, which serves
   only the app's stamped market snapshot and transmits nothing about the
   user — added for the owner's hourly indicator-refresh requirement.
   **Amendment 2 (owner instruction, 21 Nov 2026):** accounts and
   portfolios are stored server-side, on the owner's own server, in
   RizqFlow's own dedicated Postgres container (separate instance,
   volume and credentials from any other product's database) — the
   owner ruled that a user who signs in on any device must see the
   same portfolios everywhere, which browser-only storage cannot do. Terms of the amendment: passwords are
   scrypt-hashed server-side (never stored or logged in plain text),
   sessions are random tokens stored hashed and carried in an httpOnly
   cookie, the only endpoints are the same-origin `/api/auth/*`,
   `/api/me` and `/api/portfolios/*`, no user data leaves the owner's
   server, and anonymous (signed-out) use keeps working from
   localStorage exactly as before. Any further backend still requires a
   new FORGE brief and explicit owner approval.
   **Amendment 3 (owner instruction, 22 Nov 2026):** AI Assist — the
   owner's own server may call the Groq API (models in `GROQ_MODEL` /
   `GROQ_MODEL_FALLBACK`) from the same-origin `POST /api/ai/predict`
   route, for field predictions only. Terms: the API key lives only in
   the server's `.env.server` (never in git, never in the browser);
   prompts carry only the minimum field context (no account identity,
   no portfolio export); every AI output is labelled "AI estimate" in
   the UI, fills input fields only, and never overwrites the stamped
   market data of Gate 2; the feature is behind a global user toggle
   and the app remains fully functional with AI off or unavailable.
   **Amendment 4 (owner instruction, 24 Nov 2026):** Dynamic market-price
   refresh. The owner requires petrol, gold, silver, KSE-100 and grid
   rates to refresh on a 2-hour cadence instead of waiting for a manual
   redeploy. Terms: the browser makes NO third-party calls — all external
   fetching happens server-side through the same-origin
   `/api/market-snapshot/refresh` route, which (a) reads provider URLs/keys
   only from the server's `.env.server`, (b) validates and stamps every
   figure with a fresh `DATA_AS_OF` + named source before it is served,
   (c) falls back to the last stamped seed when no provider is configured
   or the fetch fails, and (d) never transmits user data. The client polls
   `/api/market-snapshot` every 2 hours and on tab-visibility change.
   Prices served are always labelled with their as-of stamp; "live"/
   "real-time" remains forbidden for any figure that is not a same-instant
   quote. Gate 2's named-source requirement still applies to refreshed data.
7. **Guardian pass.** Before a push, a read-only reviewer (human or agent
   who did not write the code) checks the diff against gates 1–6 and the
   `NOTES.md` catalog. The builder cannot mark its own work verified.
8. **Errors get cataloged.** Any bug found by the guardian, by tests, or in
   production goes into `NOTES.md` in the same change that fixes it:
   symptom, root cause, fix, and the gate that should have caught it.

## Part 3 — The working loop

```
Brief (FORGE contract) → Build → Verify (gates 1–6, yourself)
→ Guardian audit (read-only, someone else) → Ship → Catalog errors (NOTES.md)
```

## For the next agent who opens this repo

1. Read `FORGEWARDEN.md`, `AGENTS.md` and `NOTES.md` before writing code.
2. State your task as a FORGE contract (F/O/R/G/E) in your first message.
3. If market data looks old, refreshing it *is* the task — stop and do that
   first, with sources, and update `DATA_AS_OF`.
4. End your run with a handoff that lists: what changed, gate results
   (`npm ci` / `npm test` / `npm run build`), and any new `NOTES.md` entries.
   No handoff, no "done".
