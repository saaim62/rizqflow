'use client';

import React from 'react';
import { TrendingDown, Flame, Crosshair, History } from 'lucide-react';
import { MetalAsset } from '@/types';
import { DATA_AS_OF_SHORT, GOLD_YEAR_HISTORY } from '@/data/marketData';
import { Sparkline } from '@/components/markets/Sparkline';
import { SpatialCard3D } from '@/components/ui/SpatialCard3D';

/**
 * GoldDataCard — replaces the decorative GoldBullion3D in the home hero
 * (owner, 21 Nov 2026: "change this gold card to something better and with
 * actual data on it"). Current spot, today's change and the streak come
 * from the stamped 30-day daily series; the PEAK, off-peak drop and
 * dip-zone band come from GOLD_YEAR_HISTORY (full year) — the first
 * version took the peak from the 30-day window and mislabelled a 30-day
 * high of Rs 435,636 as the all-time peak, when the real peak is
 * Rs 572,862 (29 Jan 2026). See NOTES #22.
 */
export function GoldDataCard({ gold }: { gold: MetalAsset }) {
  const history = gold.history;
  const current = gold.currentPrice;
  const prev = history.length > 1 ? history[history.length - 2].price : current;
  const todayChange = current - prev;
  const todayPct = prev > 0 ? (todayChange / prev) * 100 : 0;

  const peakPoint = GOLD_YEAR_HISTORY.reduce((a, b) => (b.price > a.price ? b : a), GOLD_YEAR_HISTORY[0]);
  const lowPoint = history.reduce((a, b) => (b.price < a.price ? b : a), history[0]);
  const dropPkr = current - peakPoint.price; // negative
  const dropPct = peakPoint.price > 0 ? (dropPkr / peakPoint.price) * 100 : 0;

  // Dip zone = 10–15% below the peak, in PKR (the band the planner's
  // "SIP dip accumulation" language refers to).
  const dipHigh = Math.round(peakPoint.price * 0.9);
  const dipLow = Math.round(peakPoint.price * 0.85);
  const inDipZone = current <= dipHigh && current >= dipLow;
  const belowDipZone = current < dipLow;

  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
  const rs = (n: number) => `Rs ${Math.abs(n).toLocaleString('en-PK')}`;

  return (
    <SpatialCard3D spotlightColor="rgba(217, 165, 33, 0.16)" className="rounded-3xl">
      <div className="relative rounded-3xl bg-[#0C0C0F] border border-amber-500/25 p-5 sm:p-6 overflow-hidden card-3d-shadow">
        {/* aurora wash */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#A87F16] via-[#E8C15A] to-[#A87F16]" />

        <div className="relative space-y-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-600">
              24K Gold · Sarafa Spot
            </span>
            <span className="text-[10px] font-mono text-zinc-400 border border-white/10 rounded-full px-2 py-0.5">
              Data as of {DATA_AS_OF_SHORT}
            </span>
          </div>

          <div>
            <div className="flex items-end gap-2 flex-wrap">
              <span className="text-3xl sm:text-4xl font-black font-mono tabular-nums text-white leading-none">
                {rs(current)}
              </span>
              <span className="text-xs text-zinc-400 mb-0.5">/ tola</span>
            </div>
            <div className="mt-1.5 flex items-center gap-2 text-xs font-mono">
              <span className={todayChange <= 0 ? 'text-rose-400' : 'text-emerald-400'}>
                {todayChange <= 0 ? '▼' : '▲'} {rs(todayChange)} today ({todayPct.toFixed(1)}%)
              </span>
              <span className="text-zinc-500">·</span>
              <span className="text-rose-400 flex items-center gap-1">
                <Flame className="w-3 h-3" /> {Math.abs(gold.streak.currentStreak)}d down streak
              </span>
            </div>
          </div>

          <Sparkline data={GOLD_YEAR_HISTORY} color="gold" height={52} strokeWidth={2} />

          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                <History className="w-3 h-3" /> All-Time Peak
              </div>
              <div className="mt-1 font-mono font-bold text-white text-sm">{rs(peakPoint.price)}</div>
              <div className="text-[10px] text-zinc-500 font-mono">{fmtDate(peakPoint.date)}</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-3">
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
                <TrendingDown className="w-3 h-3" /> Off-Peak Drop
              </div>
              <div className="mt-1 font-mono font-bold text-rose-400 text-sm">
                −{rs(dropPkr)} ({dropPct.toFixed(1)}%)
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">peak → today, in PKR</div>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-amber-500/20 p-3 col-span-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-600 font-semibold">
                  <Crosshair className="w-3 h-3" /> Dip Zone (10–15% off peak)
                </div>
                <span
                  className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded ${
                    inDipZone ? 'bg-amber-500/15 text-amber-700' : 'bg-white/5 text-zinc-400'
                  }`}
                >
                  {inDipZone ? '● YOU ARE HERE' : belowDipZone ? 'BELOW THE ZONE — deeper correction' : 'above zone'}
                </span>
              </div>
              <div className="mt-1 font-mono font-bold text-white text-sm">
                {rs(dipHigh)} <span className="text-zinc-500 font-normal">down to</span> {rs(dipLow)}
              </div>
              <div className="text-[10px] text-zinc-500 font-mono">
                30-day low: {rs(lowPoint.price)} ({fmtDate(lowPoint.date)}) · SIP dip-accumulation band
              </div>
            </div>
          </div>
        </div>
      </div>
    </SpatialCard3D>
  );
}
