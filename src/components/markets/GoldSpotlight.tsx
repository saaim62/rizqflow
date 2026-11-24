'use client';

import React, { useState, useEffect } from 'react';
import { MetalAsset } from '@/types';
import { DATA_AS_OF_SHORT, GOLD_YEAR_HISTORY } from '@/data/marketData';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { Sparkline } from '@/components/markets/Sparkline';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { Sparkles, TrendingDown, ArrowDownRight, ShieldCheck, Flame } from 'lucide-react';

interface GoldSpotlightProps {
  gold: MetalAsset;
  silver: MetalAsset;
}

export function GoldSpotlight({ gold, silver }: GoldSpotlightProps) {
  const [mounted, setMounted] = useState(false);
  const [timeRange, setTimeRange] = useState<'30d' | '14d' | '7d'>('30d');

  useEffect(() => {
    setMounted(true);
  }, []);

  const goldHistory = gold.history;

  // Peak math comes from the FULL-YEAR series, never the 30-day window
  // (the hardcoded copy here once called the 30-day high of Rs 435,636 an
  // "all-time peak" — the real peak is Rs 572,862, 29 Jan 2026; NOTES #22).
  const yearPeak = GOLD_YEAR_HISTORY.reduce((a, b) => (b.price > a.price ? b : a), GOLD_YEAR_HISTORY[0]);
  const peakDropPct = yearPeak.price > 0 ? ((gold.currentPrice - yearPeak.price) / yearPeak.price) * 100 : 0;
  const prevClose = goldHistory.length > 1 ? goldHistory[goldHistory.length - 2].price : gold.currentPrice;
  const todayDrop = gold.currentPrice - prevClose;
  const downStreak = Math.abs(Math.min(0, gold.streak.currentStreak));
  const peakDateLabel = new Date(yearPeak.date + 'T00:00:00').toLocaleDateString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const filteredHistory =
    timeRange === '7d'
      ? goldHistory.slice(-7)
      : timeRange === '14d'
      ? goldHistory.slice(-14)
      : goldHistory;

  // Format date for chart
  const chartData = filteredHistory.map((pt) => {
    const parts = pt.date.split('-');
    const month = parts[1] === '11' ? 'Nov' : parts[1] === '10' ? 'Oct' : parts[1];
    return {
      date: pt.date,
      displayDate: `${month} ${parseInt(parts[2], 10)}`,
      price: pt.price,
    };
  });

  const minPrice = Math.min(...filteredHistory.map((d) => d.price));
  const maxPrice = Math.max(...filteredHistory.map((d) => d.price));
  const yDomain = [Math.floor(minPrice * 0.98), Math.ceil(maxPrice * 1.01)];

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-7 shadow-xl">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                24K Sarafa Gold Streak Spotlight
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[11px] font-semibold">
                Sarafa Association Karachi & Lahore
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Physical gold spot tracking · seeded series as of {DATA_AS_OF_SHORT} · 30-day streak momentum
            </p>
          </div>
        </div>

        {/* Time Filter Pills */}
        <div className="flex items-center gap-1 self-start sm:self-auto bg-[#0C0C0F] p-1 rounded-lg border border-white/5">
          {(['7d', '14d', '30d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                timeRange === range
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: Hero Chart on Left (2/3), Silver Ticker & Context on Right (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-6">
        {/* Left Column: Gold Metrics & Recharts Area */}
        <div className="lg:col-span-2 space-y-5">
          {/* Price & Stat Metrics */}
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
            <div>
              <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                24K Physical Gold
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-mono tabular-nums">
                Rs {gold.currentPrice.toLocaleString('en-PK')}
                <span className="text-sm font-normal text-zinc-400 ml-1.5">/ tola (11.66g)</span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <StreakBadge streak={gold.streak} showSipDipGlow={true} />

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-xs font-mono font-semibold text-rose-400 tabular-nums">
                <ArrowDownRight className="w-3.5 h-3.5" />
                -Rs {Math.abs(gold.streak.changeToday).toLocaleString('en-PK')} today ({gold.streak.changeTodayPct.toFixed(1)}%)
              </span>

              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-xs font-mono font-medium text-amber-300 tabular-nums">
                {Math.abs(peakDropPct).toFixed(1)}% off all-time peak (Rs {yearPeak.price.toLocaleString('en-PK')}, {peakDateLabel})
              </span>
            </div>
          </div>

          {/* Interactive Recharts Chart */}
          <div className="h-64 sm:h-72 w-full pt-2">
            {mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#D9A521" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#D9A521" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="displayDate"
                    stroke="#5C574D"
                    tick={{ fill: '#7D7769', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                  />
                  <YAxis
                    domain={yDomain}
                    stroke="#5C574D"
                    tick={{ fill: '#7D7769', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0C0C0F',
                      borderColor: 'rgba(212, 175, 55, 0.3)',
                      borderRadius: '0.75rem',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                      padding: '8px 12px',
                    }}
                    formatter={(val) => [`Rs ${Number(val).toLocaleString('en-PK')} / tola`, 'Price']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#D9A521"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#goldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
                Loading live chart...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Silver Ticker Card & Analysis */}
        <div className="space-y-4 flex flex-col justify-between">
          {/* Silver Companion Card */}
          <div className="rounded-xl bg-[#0C0C0F] border border-white/[0.08] p-4 relative overflow-hidden group hover:border-white/15 transition-all">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-slate-300" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  24K Sarafa Silver
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">1 Tola</span>
            </div>

            <div className="text-2xl font-extrabold text-white font-mono tabular-nums">
              Rs {silver.currentPrice.toLocaleString('en-PK')}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <StreakBadge streak={silver.streak} compact={true} />
              <span className="text-xs font-mono text-rose-400">
                {silver.streak.changeTodayPct.toFixed(1)}% today
              </span>
            </div>

            <div className="mt-3 pt-3 border-t border-white/5">
              <span className="text-[11px] text-zinc-400">30-day trend:</span>
              <div className="mt-1">
                <Sparkline data={silver.history} color="rose" height={32} />
              </div>
            </div>
          </div>

          {/* Sarafa Market Context Insight Box */}
          <div className="rounded-xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 p-4">
            <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider mb-2">
              <Flame className="w-4 h-4 text-amber-400" />
              Sarafa Dip Analysis
            </div>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Gold touched its all-time peak of <strong>Rs {yearPeak.price.toLocaleString('en-PK')}</strong> on {peakDateLabel}.
              At the latest close it sits <strong>{Math.abs(peakDropPct).toFixed(1)}% below that peak</strong> — a far deeper
              correction than the recent 30-day window suggests. The current <strong>{downStreak}-day consecutive drop
              ({todayDrop <= 0 ? '−' : '+'}Rs {Math.abs(todayDrop).toLocaleString('en-PK')} today)</strong> continues that slide.
              For physical gold savers and wedding budgets, staggered entries during deep corrections have historically
              beaten chasing record highs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
