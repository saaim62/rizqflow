# RizqFlow — Pakistan Financial Intelligence Platform

Turn PSX blue-chip dividends and gold streaks into a plan for financial
freedom: model your income, expenses, life goals, taxes and even a petrol→EV
swap, and see what your money actually does — in today's rupees.

## Features
- **Gold & PSX Streak Terminal** — consecutive up/down day streaks for 24K
  gold, silver and 18 PSX dividend stocks, with a dividend screener, Shariah
  (KMI) filter, reliability grades and yield-trap warnings.
- **Life & Wealth Planner** — compounding simulation to *your* retirement
  age: salary raises, dividend growth, FBR filer/non-filer withholding
  (15%/30%), optional Zakat, dated life goals with honest funded/shortfall
  outcomes and true opportunity cost, emergency-fund gate, monthly payout
  calendar, freedom date in PKR, USD and gold tolas.
- **Car Decision Map** — 5-year total cost of ownership (fuel/charging,
  depreciation, maintenance, bank-financing interest, capital opportunity
  cost) for petrol vs EV vs e-scooty, with solar charging priced honestly at
  the export rate you give up (legacy net metering Rs 26/kWh, 2026 net
  billing Rs 11/kWh, or grid Rs 55/kWh) and a km/day crossover chart.
- **Accounts & portfolios** — sign up / sign in with multiple portfolios per
  user. **Local only:** accounts live in your browser's localStorage on your
  device; nothing is sent to a server, and clearing browser data deletes
  them. There are no seeded or demo accounts.
- **Onboarding wizard** — 6 steps (persona & household, tax & Shariah,
  income, expenses, commute/vehicle/solar, life goals) that calibrate the
  whole app; recalibrating updates your active portfolio in place.
- Beginner guide, hide-amounts privacy mode, share-plan-as-URL, dark/light
  themes, 3 persona presets.

## Market data — read this before trusting a number
Prices, dividends and yields are **seeded reference data**, stamped in
`src/data/marketData.ts` with `DATA_AS_OF` and `DATA_SOURCES`, and the date
is shown in the app. They are **not** a live feed. Per-stock streak charts
use sample price history and are labelled as such in the UI. Verify current
prices with your broker / PSX before making any investment decision.

## Develop
```bash
npm ci        # must succeed from a clean clone (Warden Gate 1)
npm run dev   # http://localhost:3000
npm test      # vitest — engines, auth, QA edge cases
npm run build # production build
```

## How this repo is built
This project follows the **Forgewarden Method** — see `FORGEWARDEN.md`
(FORGE task contracts + Warden quality gates) and `NOTES.md` (the error
catalog every builder must check before starting).

## Disclaimer
Educational financial modelling only — not investment advice. RizqFlow is
not licensed or regulated by the SECP as an advisory service.
