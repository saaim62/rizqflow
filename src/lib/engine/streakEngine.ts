import { PricePoint, StreakStats } from '@/types';

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
