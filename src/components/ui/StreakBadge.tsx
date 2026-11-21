'use client';

import React from 'react';
import { TrendingDown, TrendingUp, Minus, AlertCircle, Sparkles } from 'lucide-react';
import { StreakStats } from '@/types';

interface StreakBadgeProps {
  streak: StreakStats;
  compact?: boolean;
  showSipDipGlow?: boolean;
}

export function StreakBadge({ streak, compact = false, showSipDipGlow = true }: StreakBadgeProps) {
  const { currentStreak, isSipDipZone } = streak;

  if (currentStreak < 0) {
    const days = Math.abs(currentStreak);
    return (
      <div className="inline-flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono text-xs font-semibold tabular-nums border ${
            isSipDipZone && showSipDipGlow
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-[0_0_10px_rgba(244,63,94,0.25)]'
              : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
          }`}
        >
          <TrendingDown className="w-3 h-3 text-rose-400" />
          <span>{compact ? `▼ ${days}d` : `▼ ${days} Days Straight`}</span>
        </span>

        {isSipDipZone && showSipDipGlow && !compact && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[11px] font-semibold tracking-wide uppercase animate-pulse">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>SIP Dip Zone</span>
          </span>
        )}
      </div>
    );
  }

  if (currentStreak > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-xs font-semibold tabular-nums">
        <TrendingUp className="w-3 h-3 text-emerald-400" />
        <span>{compact ? `▲ ${currentStreak}d` : `▲ ${currentStreak} Days Straight`}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono text-xs font-medium tabular-nums">
      <Minus className="w-3 h-3" />
      <span>Neutral</span>
    </span>
  );
}
