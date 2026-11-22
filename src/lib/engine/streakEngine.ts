import { DipStrategyResult, PricePoint, PsxStock, StreakStats } from '@/types';

/**
 * Compute streak and momentum statistics for a given price history.
 *
 * @param history Array of daily price points
 * @param isGradeA Whether the asset is a Grade A asset (eligible for SIP dip alerts)
 * @returns StreakStats object
 */
export function computeStreakStats(
  history: PricePoint[],
  isGradeA: boolean = true
): StreakStats {
  if (!history || history.length === 0) {
    return {
      currentStreak: 0,
      longestUpStreak: 0,
      longestDownStreak: 0,
      changeToday: 0,
      changeTodayPct: 0,
      drawdownFromPeakPct: 0,
      isSipDipZone: false,
    };
  }

  // Sort ascending by date
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;

  if (n < 2) {
    const singlePrice = sorted[0].price;
    return {
      currentStreak: 0,
      longestUpStreak: 0,
      longestDownStreak: 0,
      changeToday: 0,
      changeTodayPct: 0,
      drawdownFromPeakPct: 0,
      isSipDipZone: false,
    };
  }

  const latestPrice = sorted[n - 1].price;
  const prevPrice = sorted[n - 2].price;
  const changeToday = latestPrice - prevPrice;
  const changeTodayPct = prevPrice > 0 ? (changeToday / prevPrice) * 100 : 0;

  // Compute all daily deltas
  const deltas: number[] = [];
  for (let i = 1; i < n; i++) {
    deltas.push(sorted[i].price - sorted[i - 1].price);
  }

  // Current streak (leading into the final day)
  let currentStreak = 0;
  const lastDelta = deltas[deltas.length - 1];

  if (lastDelta > 0) {
    let count = 0;
    for (let i = deltas.length - 1; i >= 0; i--) {
      if (deltas[i] > 0) {
        count++;
      } else {
        break;
      }
    }
    currentStreak = count;
  } else if (lastDelta < 0) {
    let count = 0;
    for (let i = deltas.length - 1; i >= 0; i--) {
      if (deltas[i] < 0) {
        count++;
      } else {
        break;
      }
    }
    currentStreak = -count;
  } else {
    currentStreak = 0;
  }

  // Longest streaks across entire history
  let longestUpStreak = 0;
  let longestDownStreak = 0;
  let runningUp = 0;
  let runningDown = 0;

  for (const delta of deltas) {
    if (delta > 0) {
      runningUp++;
      runningDown = 0;
      if (runningUp > longestUpStreak) {
        longestUpStreak = runningUp;
      }
    } else if (delta < 0) {
      runningDown++;
      runningUp = 0;
      if (runningDown > longestDownStreak) {
        longestDownStreak = runningDown;
      }
    } else {
      runningUp = 0;
      runningDown = 0;
    }
  }

  // Peak drawdown
  const maxPrice = Math.max(...sorted.map((p) => p.price));
  const drawdownFromPeakPct = maxPrice > 0 ? ((latestPrice - maxPrice) / maxPrice) * 100 : 0;

  // SIP Dip Zone: Grade A asset with at least 3 consecutive down days
  const isSipDipZone = Boolean(isGradeA && currentStreak <= -3);

  return {
    currentStreak,
    longestUpStreak,
    longestDownStreak,
    changeToday,
    changeTodayPct,
    drawdownFromPeakPct,
    isSipDipZone,
  };
}

/**
 * Simulates and compares Fixed DCA vs Opportunistic SIP Dip Buying (buying on >=3-day red streaks).
 *
 * @param stock Target PSX dividend stock
 * @param monthlyBudgetPkr Monthly SIP cash allocation
 * @param months Duration in months to simulate (default: 6)
 * @returns Comparative DipStrategyResult
 */
export function simulateDipStrategy(
  stock: PsxStock,
  monthlyBudgetPkr: number,
  months: number = 6
): DipStrategyResult {
  const safeMonths = Math.max(1, Math.min(24, Math.round(months || 6)));
  const history = stock && stock.history ? stock.history : [];

  if (!stock || history.length < 2 || !monthlyBudgetPkr || monthlyBudgetPkr <= 0) {
    const fallbackPrice = stock && stock.price > 0 ? stock.price : 100;
    return {
      dcaShares: 0,
      dcaAvgCost: fallbackPrice,
      dcaTotalInvested: 0,
      dipShares: 0,
      dipAvgCost: fallbackPrice,
      dipTotalInvested: 0,
      sharesLiftPct: 0,
      costBasisReductionPct: 0,
      yieldLiftPct: 0,
      verdict: 'Insufficient historical data or invalid budget to simulate.',
    };
  }

  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const n = sorted.length;
  const chunk = monthlyBudgetPkr;

  // FIX-1.4: Precompute consecutive down streaks across history
  const downStreaks = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    if (sorted[i].price < sorted[i - 1].price) {
      downStreaks[i] = downStreaks[i - 1] + 1;
    } else {
      downStreaks[i] = 0;
    }
  }

  // Handle short histories (history.length < safeMonths) by reducing window count
  const windowCount = Math.min(safeMonths, n);
  const step = Math.max(1, Math.floor(n / windowCount));

  // 1. Fixed Monthly DCA: buy on fixed schedule
  let dcaShares = 0;
  let dcaTotalInvested = 0;

  for (let m = 0; m < windowCount; m++) {
    const idx = Math.min(n - 1, m * step);
    const price = Math.max(0.1, sorted[idx].price);
    const sharesBought = Math.floor(chunk / price);
    dcaShares += sharesBought;
    dcaTotalInvested += sharesBought * price;
  }

  const dcaAvgCost = dcaShares > 0 ? dcaTotalInvested / dcaShares : stock.price;

  // 2. SIP Dip Buying: walk each window chronologically and buy at the first
  // close completing a >= 3-day consecutive down streak (fallback to window's
  // final close if none occurs). Eliminates hindsight look-ahead bias.
  let dipShares = 0;
  let dipTotalInvested = 0;

  for (let m = 0; m < windowCount; m++) {
    const startIdx = m * step;
    const endIdx = m === windowCount - 1 ? n : Math.min(n, (m + 1) * step);

    let dipPoint: PricePoint | null = null;
    for (let i = startIdx; i < endIdx; i++) {
      if (downStreaks[i] >= 3) {
        dipPoint = sorted[i];
        break;
      }
    }

    if (!dipPoint) {
      dipPoint = sorted[Math.max(startIdx, endIdx - 1)];
    }

    const price = Math.max(0.1, dipPoint.price);
    const sharesBought = Math.floor(chunk / price);
    dipShares += sharesBought;
    dipTotalInvested += sharesBought * price;
  }

  const dipAvgCost = dipShares > 0 ? dipTotalInvested / dipShares : stock.price;

  const sharesLiftPct =
    dcaShares > 0
      ? Number((((dipShares - dcaShares) / dcaShares) * 100).toFixed(2))
      : 0;
  const costBasisReductionPct =
    dcaAvgCost > 0
      ? Number((((dcaAvgCost - dipAvgCost) / dcaAvgCost) * 100).toFixed(2))
      : 0;

  const baseYield = stock.dividendYieldPct && stock.dividendYieldPct > 0 ? stock.dividendYieldPct : 8.0;
  const dcaYield = baseYield * (stock.price / dcaAvgCost);
  const dipYield = baseYield * (stock.price / dipAvgCost);
  const yieldLiftPct = Number((dipYield - dcaYield).toFixed(2));

  const verdict =
    sharesLiftPct > 0
      ? `Dip-buying ${stock.ticker} on ≥3-day red streaks acquired +${sharesLiftPct}% more shares (${dipShares} vs ${dcaShares}) at a -${costBasisReductionPct}% lower cost basis, lifting effective dividend yield by +${Math.max(
          0,
          yieldLiftPct
        )}%.`
      : `DCA and Dip-buying performed identically across this period (${dipShares} shares acquired at ~Rs ${dipAvgCost.toFixed(
          1
        )} avg cost).`;

  return {
    dcaShares,
    dcaAvgCost: Number(dcaAvgCost.toFixed(2)),
    dcaTotalInvested: Math.round(dcaTotalInvested),
    dipShares,
    dipAvgCost: Number(dipAvgCost.toFixed(2)),
    dipTotalInvested: Math.round(dipTotalInvested),
    sharesLiftPct,
    costBasisReductionPct,
    yieldLiftPct,
    verdict,
  };
}
