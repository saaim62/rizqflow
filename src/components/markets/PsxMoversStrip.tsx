'use client';

import React from 'react';
import Link from 'next/link';
import { PsxStock } from '@/types';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { GradeBadge, ShariahBadge } from '@/components/ui/GradeBadge';
import { Sparkline } from '@/components/markets/Sparkline';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Sparkles, TrendingDown, TrendingUp } from 'lucide-react';

interface PsxMoversStripProps {
  stocks: PsxStock[];
}

export function PsxMoversStrip({ stocks }: PsxMoversStripProps) {
  // Sort stocks by active red streaks (most negative currentStreak first)
  const redStreaks = [...stocks]
    .filter((s) => s.streak.currentStreak < 0)
    .sort((a, b) => a.streak.currentStreak - b.streak.currentStreak)
    .slice(0, 5);

  // Sort stocks by active green streaks (most positive currentStreak first)
  const greenStreaks = [...stocks]
    .filter((s) => s.streak.currentStreak > 0)
    .sort((a, b) => b.streak.currentStreak - a.streak.currentStreak)
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>PSX Momentum & Dip Terminal</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-zinc-400 font-normal">
              Active Streaks
            </span>
          </h2>
          <p className="text-xs text-zinc-400">
            Compare stocks in extended consecutive downstreaks (value dip accumulation) vs green breakout runs
          </p>
        </div>

        <Link
          href="/markets"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors self-start sm:self-auto"
        >
          <span>Open Full Stock Screener</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Red Streaks (SIP Dip Zones) */}
        <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <TrendingDown className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Longest Active Red Streaks
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-300 font-mono">
                      SIP Dip Opportunities
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Grade-A compounders trading below recent peaks
                  </p>
                </div>
              </div>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </div>

            <div className="divide-y divide-white/[0.04] mt-1">
              {redStreaks.map((stock) => (
                <Link
                  key={stock.ticker}
                  href={`/markets?ticker=${stock.ticker}`}
                  className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors font-mono">
                          {stock.ticker}
                        </span>
                        <ShariahBadge isShariah={stock.isShariah} />
                      </div>
                      <div className="text-xs text-zinc-400 line-clamp-1 max-w-[140px] sm:max-w-[180px]">
                        {stock.name}
                      </div>
                    </div>
                  </div>

                  {/* Sparkline mini */}
                  <div className="hidden sm:block w-20">
                    <Sparkline data={stock.history} color="rose" height={24} />
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="font-mono text-xs font-bold text-white tabular-nums">
                      Rs {stock.price.toLocaleString('en-PK')}
                    </div>
                    <div className="mt-0.5">
                      <StreakBadge streak={stock.streak} compact={true} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Buying Grade-A stocks on 3+ day dips lowers your blended average cost</span>
            <Link href="/markets" className="text-emerald-400 hover:underline">
              Inspect all &rarr;
            </Link>
          </div>
        </div>

        {/* Green Streaks (Momentum Runs) */}
        <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] p-5 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Longest Active Green Streaks
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono">
                      Momentum Runs
                    </span>
                  </h3>
                  <p className="text-[11px] text-zinc-400">
                    Sustained upward price buying pressure
                  </p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="divide-y divide-white/[0.04] mt-1">
              {greenStreaks.map((stock) => (
                <Link
                  key={stock.ticker}
                  href={`/markets?ticker=${stock.ticker}`}
                  className="flex items-center justify-between py-3 px-2 rounded-lg hover:bg-white/[0.03] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white group-hover:text-emerald-400 transition-colors font-mono">
                          {stock.ticker}
                        </span>
                        <ShariahBadge isShariah={stock.isShariah} />
                      </div>
                      <div className="text-xs text-zinc-400 line-clamp-1 max-w-[140px] sm:max-w-[180px]">
                        {stock.name}
                      </div>
                    </div>
                  </div>

                  {/* Sparkline mini */}
                  <div className="hidden sm:block w-20">
                    <Sparkline data={stock.history} color="emerald" height={24} />
                  </div>

                  <div className="text-right flex flex-col items-end">
                    <div className="font-mono text-xs font-bold text-white tabular-nums">
                      Rs {stock.price.toLocaleString('en-PK')}
                    </div>
                    <div className="mt-0.5">
                      <StreakBadge streak={stock.streak} compact={true} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/[0.06] text-[11px] text-zinc-400 flex items-center justify-between">
            <span>Dividend yield remains king even during strong capital runs</span>
            <Link href="/markets" className="text-emerald-400 hover:underline">
              Inspect all &rarr;
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
