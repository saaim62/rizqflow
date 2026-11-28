import {
  AssetBucket,
  LifeGoal,
  MetalAsset,
  PricePoint,
  PsxStock,
  UserProfile,
  VehicleCandidate,
} from '@/types';
import { computeStreakStats } from '@/lib/engine/streakEngine';

/**
 * Generate 30 daily price points ending on 2026-11-27
 * with an exact active streak leading up to the final day.
 */
function generateStockHistory(
  finalPrice: number,
  targetStreak: number,
  days: number = 30
): PricePoint[] {
  const dates: string[] = [];
  // Must be updated in lockstep with DATA_AS_OF (Forgewarden Gate 2).
  const baseDate = new Date(2026, 10, 27); // 2026-11-27

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    dates.push(`${year}-${month}-${day}`);
  }

  const prices: number[] = new Array(days);
  prices[days - 1] = finalPrice;
  const absStreak = Math.abs(targetStreak);
  const step = Math.max(0.2, Number((finalPrice * 0.008).toFixed(2)));

  // Consecutive streak leading to final day
  for (let i = days - 2; i >= days - 1 - absStreak && i >= 0; i--) {
    if (targetStreak > 0) {
      prices[i] = Number((prices[i + 1] - step).toFixed(2));
    } else if (targetStreak < 0) {
      prices[i] = Number((prices[i + 1] + step).toFixed(2));
    } else {
      prices[i] = prices[i + 1];
    }
  }

  // Break streak on the day prior to ensure exact streak count
  const streakStartIndex = days - 1 - absStreak;
  if (streakStartIndex >= 0 && streakStartIndex - 1 >= 0) {
    if (targetStreak > 0) {
      prices[streakStartIndex - 1] = Number((prices[streakStartIndex] + step * 1.5).toFixed(2));
    } else if (targetStreak < 0) {
      prices[streakStartIndex - 1] = Number((prices[streakStartIndex] - step * 1.5).toFixed(2));
    }
  }

  // Preceding days oscillating realistically
  for (let i = streakStartIndex - 2; i >= 0; i--) {
    const osc = (i % 2 === 0 ? 1 : -1) * step * 0.9;
    prices[i] = Number((prices[i + 1] + osc).toFixed(2));
  }

  return dates.map((date, idx) => ({ date, price: prices[idx] }));
}

// ---------------------------------------------------------------------------
// 1. METAL ASSETS (Gold 24K and Silver 24K)
// ---------------------------------------------------------------------------

const goldHistory: PricePoint[] = [
  { date: '2026-10-29', price: 429500 },
  { date: '2026-10-30', price: 428200 },
  { date: '2026-10-31', price: 431000 },
  { date: '2026-11-01', price: 432500 },
  { date: '2026-11-02', price: 431800 },
  { date: '2026-11-03', price: 433900 },
  { date: '2026-11-04', price: 434800 },
  { date: '2026-11-05', price: 435636 }, // 30-day high
  { date: '2026-11-06', price: 431200 },
  { date: '2026-11-07', price: 433500 },
  { date: '2026-11-08', price: 430100 },
  { date: '2026-11-09', price: 428000 },
  { date: '2026-11-10', price: 431000 },
  { date: '2026-11-11', price: 429500 },
  { date: '2026-11-12', price: 424000 },
  { date: '2026-11-13', price: 426800 },
  { date: '2026-11-14', price: 421500 },
  { date: '2026-11-15', price: 425000 }, // Prior to 6-day red streak
  { date: '2026-11-16', price: 418200 }, // Down 1
  { date: '2026-11-17', price: 411500 }, // Down 2
  { date: '2026-11-18', price: 404800 }, // Down 3
  { date: '2026-11-19', price: 395236 }, // Down 4
  { date: '2026-11-20', price: 379836 }, // Down 5 (-15,400 on 20 Nov)
  { date: '2026-11-21', price: 376336 }, // Down 6 (-3,500, APSGJA Sat 21 Nov close)
  // No Sarafa rate issued Sun 22 Nov — series is trading-day based.
  { date: '2026-11-23', price: 384136 }, // Up 1 (+7,800 today, APSGJA Mon 23 Nov close)
  { date: '2026-11-24', price: 385436 }, // Up 2 (+1,300 today, APSGJA Tue 24 Nov close)
  { date: '2026-11-25', price: 373936 }, // Down 1 (-11,500 today, APSGJA Wed 25 Nov close)
  { date: '2026-11-26', price: 378636 }, // Up 1 (+4,700 today, APSGJA Thu 26 Nov close)
  { date: '2026-11-27', price: 390136 }, // Up 2 (+11,500 today, APSGJA Fri 27 Nov close)
  { date: '2026-11-28', price: 387836 }, // Down 1 (-2,300 today, APSGJA Sat 28 Nov close)
];

const silverHistory: PricePoint[] = [
  { date: '2026-10-29', price: 5310 },
  { date: '2026-10-30', price: 5290 },
  { date: '2026-10-31', price: 5330 },
  { date: '2026-11-01', price: 5350 },
  { date: '2026-11-02', price: 5310 },
  { date: '2026-11-03', price: 5360 },
  { date: '2026-11-04', price: 5380 },
  { date: '2026-11-05', price: 5350 },
  { date: '2026-11-06', price: 5290 },
  { date: '2026-11-07', price: 5320 },
  { date: '2026-11-08', price: 5270 },
  { date: '2026-11-09', price: 5240 },
  { date: '2026-11-10', price: 5280 },
  { date: '2026-11-11', price: 5250 },
  { date: '2026-11-12', price: 5180 },
  { date: '2026-11-13', price: 5210 },
  { date: '2026-11-14', price: 5140 },
  { date: '2026-11-15', price: 5180 },
  { date: '2026-11-16', price: 5120 },
  { date: '2026-11-17', price: 5150 }, // Prior to 4-day red streak
  { date: '2026-11-18', price: 4990 }, // Down 1
  { date: '2026-11-19', price: 4850 }, // Down 2
  { date: '2026-11-20', price: 4708 }, // Down 3
  { date: '2026-11-21', price: 4600 }, // Down 4 (-108, APSGJA Sat 21 Nov close)
  // No Sarafa rate issued Sun 22 Nov — series is trading-day based.
  { date: '2026-11-23', price: 4735 }, // Up 1 (+135 today, APSGJA Mon 23 Nov close)
  { date: '2026-11-24', price: 4687 }, // Down 1 (-49 today, APSGJA Tue 24 Nov close)
  { date: '2026-11-25', price: 4463 }, // Down 2 (-224 today, APSGJA Wed 25 Nov close)
  { date: '2026-11-26', price: 4629 }, // Up 1 (+166 today, APSGJA Thu 26 Nov close)
  { date: '2026-11-27', price: 4906 }, // Up 2 (+277 today, APSGJA Fri 27 Nov close)
  { date: '2026-11-28', price: 4851 }, // Down 1 (-55 today, APSGJA Sat 28 Nov close)
];

export const METAL_ASSETS: MetalAsset[] = [
  {
    id: 'gold-24k',
    name: '24K Gold (Tola)',
    unit: 'per tola',
    currentPrice: 387836,
    history: goldHistory,
    streak: computeStreakStats(goldHistory, true),
    insight:
      'Gold fell Rs 2,300 to Rs 387,836 on Nov 28, snapping its 2-day winning streak, now -11.0% off its 30-day high of Rs 435,636 on Nov 5.',
  },
  {
    id: 'silver-24k',
    name: '24K Silver (Tola)',
    unit: 'per tola',
    currentPrice: 4851,
    history: silverHistory,
    streak: computeStreakStats(silverHistory, true),
    insight:
      'Silver fell Rs 55 to Rs 4,851/tola on Nov 28, snapping its 2-day winning streak.',
  },
];

// ---------------------------------------------------------------------------
// 2. PSX STOCKS (18 Realistic Dividend Stocks)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// DATA PROVENANCE — Forgewarden Gate 2 (data-freshness law).
// Every price/yield below is seeded reference data from the sources named
// here, as of DATA_AS_OF. It is NOT a live feed. When you refresh prices,
// update DATA_AS_OF and DATA_SOURCES in the same change.
// ---------------------------------------------------------------------------
export const DATA_AS_OF = 'Fri 27 Nov 2026 (PSX close) · Gold & silver: Sat 28 Nov 2026 (APSGJA) · Petrol: Rs 312/L, OGRA notification 27 Nov, effective 28–30 Nov 2026';
export const DATA_AS_OF_SHORT = '28 Nov 2026';
export const DATA_SOURCES =
  'PSX data portal (dps.psx.com.pk), danioPSX, smartmoney.pk dividend records, SBP interbank closing rate, OGRA petrol notification (26 Nov 2026, Rs 313/L effective 27 Nov), All Pakistan Sarafa Gems & Jewellers Association · Gold year history: APSGJA via ARY News / Express Tribune / ProPakistani (29 Jan 2026 peak, FY26 closes) and the goldrateshub monthly archive (World Bank mid-month method), retrieved 21 Nov 2026 · Gold & silver Sat 21 Nov 2026 closes (gold Rs 376,336, silver Rs 4,600) per APSGJA via The Nation / ProPakistani / MM News, verified 22 Nov 2026 · PSX Mon 23 Nov 2026 close (KSE-100 177,473.85, +91.28) per Business Recorder / Mettis Global; gold & silver Mon 23 Nov 2026 closes (gold Rs 384,136, silver Rs 4,735) per APSGJA via ARY News / ProPakistani / Aaj, verified 23 Nov 2026 · PSX Tue 24 Nov 2026 close (KSE-100 178,542.28, +1,068.42) per Business Recorder / APP via UrduPoint; gold & silver Tue 24 Nov 2026 closes (gold Rs 385,436, silver Rs 4,687) per APSGJA via Samaa / Bloom Pakistan, verified 24 Nov 2026; USD/PKR SBP M2M revaluation rate Rs 276.47, 24 Nov 2026 · PSX Wed 25 Nov 2026 close (KSE-100 178,121.25, −421.03) per Business Recorder / PSX data portal; all 18 PSX closes rolled from dps.psx.com.pk (LDCP column matched 24 Nov values); USD/PKR SBP M2M revaluation rate Rs 276.46, 25 Nov 2026, per Business Recorder / APP; gold & silver Wed 25 Nov 2026 closes (gold Rs 373,936, −11,500; silver Rs 4,463, −224) per APSGJA via APP/UrduPoint + Daily Pakistan, verified 25 Nov 2026 · petrol Thu 26 Nov 2026 (Rs 314/L, −Rs 4; diesel Rs 348) per OGRA notification 25 Nov 2026 via Express Tribune / Aaj English, verified 25 Nov 2026 · PSX Thu 26 Nov 2026 close (KSE-100 178,060.68, −60.57) per Business Recorder / PSX data portal; all 18 PSX closes rolled from dps.psx.com.pk (LDCP column matched 25 Nov values) and cross-checked against the smartmoney.pk dividends table (prices identical); yields recomputed on TTM cash DPS (MCB DPS 36.00 per #55, not the smartmoney 27.00); USD/PKR SBP interbank close Rs 276.45, 26 Nov 2026, per Business Recorder; gold & silver Thu 26 Nov 2026 closes (gold Rs 378,636, +4,700; silver Rs 4,629, +166) per APSGJA via APP/UrduPoint + Aaj, verified 26 Nov 2026 · petrol Fri 27 Nov 2026 (Rs 313/L, −Re 1; diesel Rs 346) per OGRA notification 26 Nov 2026 via Aaj English / Geo / The News, verified 26 Nov 2026 · PSX Fri 27 Nov 2026 close (KSE-100 177,663.89, −396.79) per Business Recorder / PSX data portal; all 18 PSX closes rolled from dps.psx.com.pk (LDCP column matched 26 Nov values) and cross-checked against the smartmoney.pk dividends table (prices identical); yields recomputed on TTM cash DPS (MCB DPS 36.00 per #55, not the smartmoney 27.00); USD/PKR SBP interbank close Rs 276.42, 27 Nov 2026, per Business Recorder / ProPakistani; gold & silver Fri 27 Nov 2026 closes (gold Rs 390,136, +11,500; silver Rs 4,906, +277) per APSGJA via Business Recorder + Samaa, verified 27 Nov 2026 · petrol Sat 28 Nov 2026 (Rs 312/L, −Re 1; diesel Rs 346 unchanged) per OGRA notification 27 Nov 2026 via Dawn / Business Recorder / Aaj English, verified 27 Nov 2026 · gold & silver Sat 28 Nov 2026 closes (gold Rs 387,836, −2,300; silver Rs 4,851, −55) per APSGJA via APP/UrduPoint + ARY News + Business Recorder, verified 28 Nov 2026';

export const MARKET_SNAPSHOT = {
  kse100Index: 177663.89,
  kse100ChangePts: -396.79,
  kse100ChangePct: -0.22,
  usdPkrInterbank: 276.42,
  petrolPerLitre: 312, // OGRA daily pricing, effective 28 Nov 2026
  goldPerTolaPkr: 387836,
  silverPerTolaPkr: 4851,
};

// ---------------------------------------------------------------------------
// GOLD — FULL-YEAR HISTORY, 24K per tola (Nov 2025 → Nov 2026)
// ---------------------------------------------------------------------------
// Why this exists (owner catch, 21 Nov 2026 — NOTES #22): the 30-day daily
// series was silently being read as an all-time window — the gold card
// labelled its 30-day maximum (Rs 435,636, 5 Nov 2026) the "All-Time
// Peak". The real peak is Rs 572,862 on 29 Jan 2026, reported by ARY News,
// Express Tribune and ProPakistani (APSGJA rates) as the highest gold rate
// in Pakistan's history; it crashed Rs 35,500 the very next day.
// Monthly points are monthly AVERAGE rates (goldrateshub archive, World
// Bank mid-month method); the 29 Jan 2026 point and the final point are
// actual APSGJA / Sarafa daily closes. The final point matches the daily
// series so the two windows agree where they overlap.
export const GOLD_YEAR_HISTORY: PricePoint[] = [
  { date: '2025-11-15', price: 431655 }, // Nov 2025 monthly average
  { date: '2025-12-15', price: 452254 }, // Dec 2025 monthly average
  { date: '2026-01-15', price: 499192 }, // Jan 2026 monthly average
  { date: '2026-01-29', price: 572862 }, // ALL-TIME PEAK — APSGJA daily close
  { date: '2026-02-15', price: 526080 }, // Feb 2026 monthly average
  { date: '2026-03-15', price: 508724 }, // Mar 2026 monthly average
  { date: '2026-04-15', price: 494053 }, // Apr 2026 monthly average
  { date: '2026-05-15', price: 481291 }, // May 2026 monthly average
  { date: '2026-06-15', price: 441195 }, // Jun 2026 monthly average
  { date: '2026-07-15', price: 423483 }, // Jul 2026 monthly average
  { date: '2026-08-15', price: 459225 }, // Aug 2026 monthly average
  { date: '2026-09-15', price: 449235 }, // Sep 2026 monthly average
  { date: '2026-10-15', price: 426436 }, // Oct 2026 monthly average
  { date: '2026-11-28', price: 387836 }, // Latest Sarafa close (= daily series)
];

interface StockRawConfig {
  ticker: string;
  name: string;
  sector: string;
  price: number;
  dividendYieldPct: number;
  payoutMonths: number[];
  isShariah: boolean;
  grade: 'A' | 'B' | 'C';
  gradeReason: string;
  trapWarning?: string;
  beginnerSummary: string;
  targetStreak: number;
}

const STOCK_CONFIGS: StockRawConfig[] = [
  // Shariah Grade A (9 stocks)
  {
    ticker: 'FFC',
    name: 'Fauji Fertilizer Company',
    sector: 'Fertilizer',
    price: 573.72,
    dividendYieldPct: 8.7,
    payoutMonths: [3, 6, 9, 12],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Consistent quarterly dividend payer with low debt, guaranteed gas pricing framework, and resilient agricultural demand.',
    beginnerSummary:
      'Pakistan\'s largest urea manufacturer. Generates reliable, steady cash flows and pays chunky quarterly dividends.',
    targetStreak: 1,
  },
  {
    ticker: 'HUBC',
    name: 'Hub Power Company',
    sector: 'Power Generation',
    price: 212.01,
    dividendYieldPct: 9.4,
    payoutMonths: [2, 5, 8, 11],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Largest independent power producer with dollar-indexed base capacity payments and high dividend payout ratio.',
    beginnerSummary:
      'Major electricity supplier with defensive government power contracts. Strong dividend yield distributed across 4 quarters.',
    targetStreak: 2,
  },
  {
    ticker: 'EFERT',
    name: 'Engro Fertilizers',
    sector: 'Fertilizer',
    price: 221.46,
    dividendYieldPct: 6.0,
    payoutMonths: [3, 6, 9, 11],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Blue-chip fertilizer player with state-of-the-art plant efficiency and high free cash flow conversion.',
    beginnerSummary:
      'Part of the Engro conglomerate, renowned for paying nearly 100% of net profits out to shareholders as dividends.',
    targetStreak: 2,
  },
  {
    ticker: 'MEBL',
    name: 'Meezan Bank',
    sector: 'Islamic Bank',
    price: 548.74,
    dividendYieldPct: 5.6,
    payoutMonths: [2, 5, 8, 10],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Premier Islamic bank in Pakistan with the lowest cost of deposits (CASA > 85%) and robust asset quality.',
    beginnerSummary:
      'The gold standard of Shariah banking in Pakistan. High return on equity and compounding quarterly cash payouts.',
    targetStreak: -2,
  },
  {
    ticker: 'POL',
    name: 'Pakistan Oilfields',
    sector: 'Oil & Gas Exploration',
    price: 662.07,
    dividendYieldPct: 15.1,
    payoutMonths: [1, 9],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Zero debt balance sheet with high cash holdings and direct USD revenue hedge from international oil benchmarks.',
    beginnerSummary:
      'Explores and produces oil and gas. Because it has no debt and earns in dollars, it passes huge chunky payouts directly to investors.',
    targetStreak: -1,
  },
  {
    ticker: 'OGDC',
    name: 'Oil & Gas Dev Co',
    sector: 'Oil & Gas Exploration',
    price: 310.02,
    dividendYieldPct: 6.0,
    payoutMonths: [3, 6, 9, 11],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'State-backed national energy champion holding the largest hydrocarbon reserve base in Pakistan.',
    beginnerSummary:
      'The sovereign energy backbone of Pakistan. Regular quarterly dividends backed by state-owned exploration fields.',
    targetStreak: -3,
  },
  {
    ticker: 'PPL',
    name: 'Pakistan Petroleum',
    sector: 'Oil & Gas Exploration',
    price: 222.19,
    dividendYieldPct: 5.4,
    payoutMonths: [4, 10],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Pioneer of Sui gas field, expanding offshore and frontier exploration with healthy dividend history.',
    beginnerSummary:
      'Key domestic natural gas producer. Pays semi-annual dividends and provides long-term energy resource exposure.',
    targetStreak: -3,
  },
  {
    ticker: 'BIPL',
    name: 'BankIslami Pakistan',
    sector: 'Islamic Bank',
    price: 24.61,
    dividendYieldPct: 11.2,
    payoutMonths: [3, 8],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Rapidly growing Islamic commercial franchise with improving margins and clean loan book.',
    beginnerSummary:
      'Fast-expanding pure Islamic commercial bank offering an affordable share price and attractive dividend distribution.',
    targetStreak: -1,
  },
  {
    ticker: 'MTL',
    name: 'Millat Tractors',
    sector: 'Auto Assembler',
    price: 296.27,
    dividendYieldPct: 7.1,
    payoutMonths: [2, 10],
    isShariah: true,
    grade: 'A',
    gradeReason:
      'Dominant 70%+ market share in domestic agricultural tractors with unmatched brand moat and zero debt.',
    beginnerSummary:
      'Builds Massey Ferguson tractors essential to Pakistan\'s farming heartland. Highly cash-generative industrial leader.',
    targetStreak: -2,
  },

  // Conventional Grade A (6 stocks)
  {
    ticker: 'MCB',
    name: 'MCB Bank',
    sector: 'Commercial Bank',
    price: 405.62,
    dividendYieldPct: 8.9,
    payoutMonths: [3, 6, 8, 11],
    isShariah: false,
    grade: 'A',
    gradeReason:
      'Consistently the most efficient conventional private bank with impeccable capital adequacy and discipline.',
    beginnerSummary:
      'One of the best-managed commercial banks in South Asia, famous for paying 4 solid quarterly dividends year after year.',
    targetStreak: 2,
  },
  {
    ticker: 'UBL',
    name: 'United Bank',
    sector: 'Commercial Bank',
    price: 427.24,
    dividendYieldPct: 7.5,
    payoutMonths: [2, 5, 8, 11],
    isShariah: false,
    grade: 'A',
    gradeReason:
      'Massive international presence, strong corporate deposit base, and exceptionally generous payout policy.',
    beginnerSummary:
      'Large commercial lender with top-tier dividend payout track record over the last two decades.',
    targetStreak: -3,
  },
  {
    ticker: 'HBL',
    name: 'Habib Bank',
    sector: 'Commercial Bank',
    price: 304.12,
    dividendYieldPct: 7.9,
    payoutMonths: [3, 6, 8, 11],
    isShariah: false,
    grade: 'A',
    gradeReason:
      'Largest private banking network in Pakistan with unmatched branch coverage and retail liquidity.',
    beginnerSummary:
      'Pakistan\'s oldest and largest private bank by network size, delivering steady quarterly dividends to shareholders.',
    targetStreak: 1,
  },
  {
    ticker: 'BAHL',
    name: 'Bank AL Habib',
    sector: 'Commercial Bank',
    price: 169.89,
    dividendYieldPct: 8.8,
    payoutMonths: [3, 8],
    isShariah: false,
    grade: 'A',
    gradeReason:
      'Conservative trade-finance powerhouse with near-zero non-performing loan ratio and stable earnings.',
    beginnerSummary:
      'Trade finance specialist known for rock-solid risk management and dependable semi-annual cash dividends.',
    targetStreak: 3,
  },
  {
    ticker: 'BAFL',
    name: 'Bank Alfalah',
    sector: 'Commercial Bank',
    price: 59.88,
    dividendYieldPct: 10.0,
    payoutMonths: [3, 8, 10],
    isShariah: false,
    grade: 'A',
    gradeReason:
      'Backed by Abu Dhabi Group, aggressive digital banking expansion and rising net interest margins.',
    beginnerSummary:
      'Progressive commercial bank with attractive valuation multiples and frequent interim dividend payouts.',
    targetStreak: -1,
  },
  {
    ticker: 'INDU',
    name: 'Indus Motor Company',
    sector: 'Auto Assembler',
    price: 1845.15,
    dividendYieldPct: 10.8,
    payoutMonths: [2, 5, 9],
    isShariah: false,
    grade: 'A',
    gradeReason:
      'Exclusive manufacturer of Toyota in Pakistan with substantial cash balance and high pricing power.',
    beginnerSummary:
      'Toyota assembler with virtually negative net working capital and consistent payout of surplus treasury income.',
    targetStreak: -1,
  },

  // Grade B & C Yield Traps (3 stocks)
  {
    ticker: 'NBP',
    name: 'National Bank of Pakistan',
    sector: 'Commercial Bank',
    price: 176.85,
    dividendYieldPct: 19.8,
    payoutMonths: [3],
    isShariah: false,
    grade: 'C',
    gradeReason:
      'One-off pension litigation settlement created a temporary accounting spike in dividend distribution.',
    trapWarning:
      'Extreme 20.2% yield is distorted by a one-off historical pension litigation payout resolution, not repeatable operational dividend earnings.',
    beginnerSummary:
      'State bank showing an alluring 20%+ yield, but this is a classic yield trap fueled by non-recurring legal resolution.',
    targetStreak: -3,
  },
  {
    ticker: 'KAPCO',
    name: 'Kot Addu Power Company',
    sector: 'Power Generation',
    price: 27.38,
    dividendYieldPct: 11.0,
    payoutMonths: [10],
    isShariah: true,
    grade: 'C',
    gradeReason:
      'Core sovereign Power Purchase Agreement (PPA) expired; cash flows transitioning to uncertain open competitive trading.',
    trapWarning:
      'Power Purchase Agreement (PPA) expired / transitioning to competitive market, long-term operational cash flows and capacity payments uncertain.',
    beginnerSummary:
      'Historic high yielder whose multi-decade guaranteed power contract has expired. High current yield carries terminal risk.',
    targetStreak: 2,
  },
  {
    ticker: 'LOTCHEM',
    name: 'Lotte Chemical Pakistan',
    sector: 'Chemicals',
    price: 25.21,
    dividendYieldPct: 25.8,
    payoutMonths: [4],
    isShariah: true,
    grade: 'C',
    gradeReason:
      'Pure-play purified terephthalic acid (PTA) manufacturer vulnerable to volatile international commodity petrochemical spreads.',
    trapWarning:
      'Highly cyclical petrochemical margins subject to volatile international PTA-PX spreads; dividend payouts swing wildly year to year.',
    beginnerSummary:
      'Cyclical commodity producer. When global petrochemical margins peak, payouts are huge; when they crash, dividends vanish.',
    targetStreak: -3,
  },
];

export const PSX_STOCKS: PsxStock[] = STOCK_CONFIGS.map((cfg) => {
  const history = generateStockHistory(cfg.price, cfg.targetStreak, 30);
  const streak = computeStreakStats(history, cfg.grade === 'A');

  return {
    ticker: cfg.ticker,
    name: cfg.name,
    sector: cfg.sector,
    price: cfg.price,
    dividendYieldPct: cfg.dividendYieldPct,
    payoutMonths: cfg.payoutMonths,
    isShariah: cfg.isShariah,
    grade: cfg.grade,
    gradeReason: cfg.gradeReason,
    trapWarning: cfg.trapWarning,
    beginnerSummary: cfg.beginnerSummary,
    history,
    streak,
  };
});

// ---------------------------------------------------------------------------
// 3. PRESET PROFILES (Phase 2 Upgrade with Multi-Asset, Goals, and Vehicles)
// ---------------------------------------------------------------------------

export interface PresetProfileConfig {
  id: string;
  name: string;
  subtitle: string;
  profile: UserProfile;
}

const RAW_PRESETS: PresetProfileConfig[] = [
  {
    id: 'junior-engineer',
    name: 'Junior Software Engineer',
    subtitle: 'Age 24 • Rs 2 Lac/mo • 12% Raises • Rs 100k SIP • Wedding & Home Goals',
    profile: {
      role: 'salaried',
      gender: 'male',
      age: 24,
      retirementAge: 55,
      maritalStatus: 'unmarried',
      familyMembers: 1,
      isBreadwinner: false,
      monthlyIncomePkr: 200000,
      annualSalaryRaisePct: 12,
      lumpSumPkr: 0,
      monthlyInvestPkr: 100000,
      currentCashReservePkr: 200000,
      expenses: {
        fuelAndCommute: 15000,
        utilitiesAndInternet: 20000,
        groceriesAndFood: 25000,
        rentOrHousing: 15000,
        familyAndOther: 10000,
      },
      taxStatus: 'filer',
      shariahOnly: true,
      includeZakat: false,
      reinvestDividends: true,
      inflationAdjusted: true,
      annualInflationPct: 8,
      dividendGrowthPct: 10,
      opportunityCostReturnPct: 10,
      usdToPkr: 276.5,
      goldPerTolaPkr: 385436,
      petrolPricePerLitre: 322,
      gridRatePerKwh: 55,
      solarKw: 0,
      solarTariffMode: 'none',
      dailyCommuteKm: 25,
      assetBuckets: [
        {
          id: 'psx-dividends',
          label: 'PSX Dividend Equities',
          currentValuePkr: 0,
          monthlySplitPct: 50,
          expectedAnnualReturnPct: 14,
        },
        {
          id: 'gold',
          label: '24K Physical Gold',
          currentValuePkr: 0,
          monthlySplitPct: 20,
          expectedAnnualReturnPct: 12,
        },
        {
          id: 'real-estate',
          label: 'Real Estate / Land',
          currentValuePkr: 0,
          monthlySplitPct: 15,
          expectedAnnualReturnPct: 13,
        },
        {
          id: 'money-market',
          label: 'Shariah Money Market',
          currentValuePkr: 0,
          monthlySplitPct: 10,
          expectedAnnualReturnPct: 11,
        },
        {
          id: 'cash',
          label: 'Emergency Cash',
          currentValuePkr: 200000,
          monthlySplitPct: 5,
          expectedAnnualReturnPct: 8,
        },
      ],
      lifeGoals: [
        {
          id: 'goal-wedding',
          name: 'Wedding Ceremony',
          targetAge: 28,
          costInTodaysPkr: 2500000,
        },
        {
          id: 'goal-home-dp',
          name: 'Home Downpayment',
          targetAge: 33,
          costInTodaysPkr: 5000000,
        },
      ],
      vehicles: [
        {
          id: 'owned-bike',
          name: 'Existing Petrol 70cc Bike',
          fuelType: 'petrol',
          pricePkr: 150000,
          isCurrentVehicle: true,
          kmPerLitre: 45,
          fiveYearDepreciationPct: 30,
          annualMaintenancePkr: 25000,
        },
        {
          id: 'yadea-m3',
          name: 'Yadea M3 E-Scooty',
          fuelType: 'e-scooty',
          pricePkr: 174000,
          kwhPer100Km: 3.5,
          fiveYearDepreciationPct: 35,
          // Includes a battery-replacement reserve (~Rs 45k at year ~4
          // amortized) — e-scooty packs are a real mid-life cost (NOTES #21)
          annualMaintenancePkr: 19000,
        },
        {
          id: 'alektra-mini',
          name: 'Alektra MINI X2 EV',
          fuelType: 'ev',
          pricePkr: 1095000,
          kwhPer100Km: 10.0,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 25000,
        },
      ],
    },
  },
  {
    id: 'lump-sum-30lac',
    name: 'Rs 30 Lac Lump Sum Investor',
    subtitle: 'Age 32 • Married Breadwinner • Rs 3M Capital • Immediate Passive Flow',
    profile: {
      role: 'salaried',
      gender: 'male',
      age: 32,
      retirementAge: 60,
      maritalStatus: 'married',
      familyMembers: 3,
      isBreadwinner: true,
      monthlyIncomePkr: 250000,
      annualSalaryRaisePct: 8,
      lumpSumPkr: 3000000,
      monthlyInvestPkr: 0,
      currentCashReservePkr: 600000,
      expenses: {
        fuelAndCommute: 25000,
        utilitiesAndInternet: 30000,
        groceriesAndFood: 40000,
        rentOrHousing: 15000,
        familyAndOther: 10000,
      },
      taxStatus: 'filer',
      shariahOnly: false,
      includeZakat: false,
      reinvestDividends: false,
      inflationAdjusted: false,
      annualInflationPct: 8,
      dividendGrowthPct: 8,
      opportunityCostReturnPct: 10,
      usdToPkr: 276.5,
      goldPerTolaPkr: 385436,
      petrolPricePerLitre: 322,
      gridRatePerKwh: 55,
      solarKw: 0,
      solarTariffMode: 'none',
      dailyCommuteKm: 30,
      assetBuckets: [
        {
          id: 'psx-dividends',
          label: 'PSX Dividend Equities',
          currentValuePkr: 3000000,
          monthlySplitPct: 70,
          expectedAnnualReturnPct: 14,
        },
        {
          id: 'money-market',
          label: 'Bank Term Deposits',
          currentValuePkr: 0,
          monthlySplitPct: 20,
          expectedAnnualReturnPct: 11,
        },
        {
          id: 'cash',
          label: 'Cash Reserve',
          currentValuePkr: 600000,
          monthlySplitPct: 10,
          expectedAnnualReturnPct: 8,
        },
      ],
      lifeGoals: [
        {
          id: 'goal-kids-education',
          name: 'Children Higher Education',
          targetAge: 45,
          costInTodaysPkr: 4000000,
        },
      ],
      vehicles: [
        {
          id: 'owned-alsvin',
          name: 'Changan Alsvin 1.3L Petrol',
          fuelType: 'petrol',
          pricePkr: 2500000,
          isCurrentVehicle: true,
          kmPerLitre: 13,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 60000,
        },
        {
          id: 'honri-ve2',
          name: 'Honri Ve 2.0 EV',
          fuelType: 'ev',
          pricePkr: 3599000,
          kwhPer100Km: 14.0,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 20000,
        },
      ],
    },
  },
  {
    id: 'solar-commuter',
    name: 'Solar Home + SUV vs EV + House Build',
    subtitle: 'Age 28 • 22 kW Solar • House Build @ 30 (Rs 1.8 Cr) • SUV vs EV TCO',
    profile: {
      role: 'business',
      gender: 'male',
      age: 28,
      retirementAge: 55,
      maritalStatus: 'married',
      familyMembers: 2,
      isBreadwinner: true,
      monthlyIncomePkr: 450000,
      annualSalaryRaisePct: 10,
      lumpSumPkr: 1500000,
      monthlyInvestPkr: 150000,
      currentCashReservePkr: 1200000,
      expenses: {
        fuelAndCommute: 40000,
        utilitiesAndInternet: 25000,
        groceriesAndFood: 45000,
        rentOrHousing: 20000,
        familyAndOther: 15000,
      },
      taxStatus: 'filer',
      shariahOnly: true,
      includeZakat: false,
      reinvestDividends: true,
      inflationAdjusted: true,
      annualInflationPct: 8,
      dividendGrowthPct: 10,
      opportunityCostReturnPct: 10,
      usdToPkr: 276.5,
      goldPerTolaPkr: 385436,
      petrolPricePerLitre: 322,
      gridRatePerKwh: 55,
      solarKw: 10,
      solarTariffMode: 'net-metering-legacy',
      dailyCommuteKm: 45,
      assetBuckets: [
        {
          id: 'psx-dividends',
          label: 'PSX Dividend Equities',
          currentValuePkr: 1500000,
          monthlySplitPct: 40,
          expectedAnnualReturnPct: 14,
        },
        {
          id: 'real-estate',
          label: 'Paragon City Plot',
          currentValuePkr: 12000000,
          monthlySplitPct: 30,
          expectedAnnualReturnPct: 13,
        },
        {
          id: 'gold',
          label: 'Physical Gold Tolas',
          currentValuePkr: 2000000,
          monthlySplitPct: 20,
          expectedAnnualReturnPct: 12,
        },
        {
          id: 'cash',
          label: 'Business Cash Reserves',
          currentValuePkr: 1200000,
          monthlySplitPct: 10,
          expectedAnnualReturnPct: 8,
        },
      ],
      lifeGoals: [
        {
          id: 'goal-house-build',
          name: 'Paragon City House Construction',
          targetAge: 30,
          costInTodaysPkr: 18000000,
        },
      ],
      vehicles: [
        {
          id: 'petrol-suv',
          name: 'Kia Sportage Petrol SUV',
          fuelType: 'petrol',
          pricePkr: 6500000,
          isCurrentVehicle: true,
          kmPerLitre: 9,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 90000,
        },
        {
          id: 'nissan-leaf',
          name: 'Nissan Leaf 40 kWh EV',
          fuelType: 'ev',
          pricePkr: 4200000,
          kwhPer100Km: 15.0,
          fiveYearDepreciationPct: 40,
          annualMaintenancePkr: 25000,
        },
        {
          id: 'honri-ve2',
          name: 'Honri Ve 2.0 EV',
          fuelType: 'ev',
          pricePkr: 3599000,
          kwhPer100Km: 14.0,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 20000,
        },
        {
          id: 'alsvin-petrol',
          name: 'Changan Alsvin Sedan',
          fuelType: 'petrol',
          pricePkr: 3800000,
          kmPerLitre: 13,
          fiveYearDepreciationPct: 35,
          annualMaintenancePkr: 50000,
        },
        {
          id: 'yadea-m3',
          name: 'Yadea M3 E-Scooty',
          fuelType: 'e-scooty',
          pricePkr: 174000,
          kwhPer100Km: 3.5,
          fiveYearDepreciationPct: 35,
          // Includes a battery-replacement reserve (~Rs 45k at year ~4
          // amortized) — e-scooty packs are a real mid-life cost (NOTES #21)
          annualMaintenancePkr: 19000,
        },
      ],
    },
  },
];

export type PresetProfileItem = PresetProfileConfig & UserProfile;

export const PRESET_PROFILES: PresetProfileItem[] & {
  'junior-engineer': PresetProfileItem;
  'lump-sum-30lac': PresetProfileItem;
  'solar-commuter': PresetProfileItem;
  [key: string]: any;
} = (() => {
  const list = RAW_PRESETS.map((p) => {
    // Also include backward compatibility fields for older tests
    const compat = {
      ...p.profile,
      currentVehicleType:
        p.id === 'junior-engineer'
          ? 'petrol-bike'
          : 'petrol-car',
      currentVehicleResalePkr:
        p.id === 'junior-engineer'
          ? 150000
          : p.id === 'lump-sum-30lac'
          ? 2500000
          : 3800000,
      id: p.id,
      name: p.name,
      subtitle: p.subtitle,
      profile: {
        ...p.profile,
        currentVehicleType:
          p.id === 'junior-engineer'
            ? 'petrol-bike'
            : 'petrol-car',
        currentVehicleResalePkr:
          p.id === 'junior-engineer'
            ? 150000
            : p.id === 'lump-sum-30lac'
            ? 2500000
            : 3800000,
      },
    };
    return compat as unknown as PresetProfileItem;
  });

  const record: any = [...list];
  list.forEach((item) => {
    record[item.id] = item;
    record[item.name] = item;
  });
  // Convenience aliases
  record['junior-dev'] = record['junior-engineer'];
  record['lump-sum'] = record['lump-sum-30lac'];
  record['solar-ev'] = record['solar-commuter'];

  return record;
})();
