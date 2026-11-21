'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { METAL_ASSETS, PSX_STOCKS, DATA_AS_OF_SHORT } from '@/data/marketData';
import { StockScreener } from '@/components/markets/StockScreener';
import { StreakBadge } from '@/components/ui/StreakBadge';
import { formatPkr, formatPct } from '@/lib/format';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingDown, 
  TrendingUp, 
  Sparkles, 
  Flame, 
  ShieldCheck, 
  Coins, 
  Layers,
  Info
} from 'lucide-react';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';

function MarketsTerminal() {
  const searchParams = useSearchParams();
  const initialTicker = searchParams.get('ticker') || undefined;
  const { openGuide } = useBeginnerGuide();

  const [activeMetalId, setActiveMetalId] = useState<'gold-24k' | 'silver-24k'>('gold-24k');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const gold = METAL_ASSETS.find((m) => m.id === 'gold-24k') || METAL_ASSETS[0];
  const silver = METAL_ASSETS.find((m) => m.id === 'silver-24k') || METAL_ASSETS[1];
  const activeMetal = activeMetalId === 'gold-24k' ? gold : silver;

  // Format active metal history for Recharts
  const chartData = activeMetal.history.map((pt) => {
    const parts = pt.date.split('-');
    const month = parts[1] === '11' ? 'Nov' : 'Oct';
    return {
      date: pt.date,
      displayDate: `${month} ${parseInt(parts[2], 10)}`,
      price: pt.price,
    };
  });

  const minPrice = Math.min(...activeMetal.history.map((d) => d.price));
  const maxPrice = Math.max(...activeMetal.history.map((d) => d.price));
  const yDomain = [Math.floor(minPrice * 0.98), Math.ceil(maxPrice * 1.01)];

  return (
    <div className="min-h-screen py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
      {/* 1. Terminal Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Layers className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Gold & PSX Streak Terminal
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-semibold">
              Data as of {DATA_AS_OF_SHORT}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Detect extended consecutive red/green momentum streaks, track physical gold corrections, and filter Grade-A dividend compounders
          </p>
        </div>

        <button
          onClick={() => openGuide('yield-traps')}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold transition-all self-start md:self-auto"
        >
          <Info className="w-3.5 h-3.5 text-rose-400" />
          <span>Yield Traps Guide (NBP, KAPCO, LOTCHEM)</span>
        </button>
      </div>

      {/* 2. Metal Assets Full Terminal Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Sarafa Precious Metals Benchmark
            </h2>
          </div>

          {/* Toggle between Gold and Silver */}
          <div className="flex items-center bg-[#0C0C0F] p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveMetalId('gold-24k')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeMetalId === 'gold-24k'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>24K Gold</span>
            </button>
            <button
              onClick={() => setActiveMetalId('silver-24k')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                activeMetalId === 'silver-24k'
                  ? 'bg-slate-300/20 text-slate-200 border border-slate-300/40 shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <span>24K Silver</span>
            </button>
          </div>
        </div>

        {/* Metal Detail Box */}
        <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-7 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left 4 cols: Key Stats */}
            <div className="lg:col-span-4 space-y-5 flex flex-col justify-between">
              <div>
                <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                  {activeMetal.name}
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold text-white font-mono tabular-nums mt-1">
                  Rs {activeMetal.currentPrice.toLocaleString('en-PK')}
                  <span className="text-xs font-normal text-zinc-400 ml-1.5">/ tola</span>
                </div>

                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <StreakBadge streak={activeMetal.streak} showSipDipGlow={true} />
                  <span className="text-xs font-mono text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                    {formatPct(activeMetal.streak.changeTodayPct)} today
                  </span>
                </div>
              </div>

              {/* 30-Day Streak Metrics Bento */}
              <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/5">
                  <span className="text-zinc-500 block text-[10px] uppercase">Drawdown from Peak</span>
                  <span className="text-amber-400 font-bold text-sm">
                    {activeMetal.streak.drawdownFromPeakPct.toFixed(1)}%
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/5">
                  <span className="text-zinc-500 block text-[10px] uppercase">Today's Price Delta</span>
                  <span className="text-rose-400 font-bold text-sm">
                    {formatPkr(activeMetal.streak.changeToday)}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/5">
                  <span className="text-zinc-500 block text-[10px] uppercase">Longest Up Streak</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    +{activeMetal.streak.longestUpStreak} Days
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#0C0C0F] border border-white/5">
                  <span className="text-zinc-500 block text-[10px] uppercase">Longest Down Streak</span>
                  <span className="text-rose-400 font-bold text-sm">
                    -{activeMetal.streak.longestDownStreak} Days
                  </span>
                </div>
              </div>

              {/* Insight Text */}
              <p className="text-xs text-zinc-400 leading-relaxed pt-2 border-t border-white/5">
                {activeMetal.insight}
              </p>
            </div>

            {/* Right 8 cols: Area Chart */}
            <div className="lg:col-span-8 h-72 sm:h-80 w-full">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="metalChartGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={activeMetalId === 'gold-24k' ? '#D9A521' : '#E8E3D8'}
                          stopOpacity={0.35}
                        />
                        <stop
                          offset="95%"
                          stopColor={activeMetalId === 'gold-24k' ? '#D9A521' : '#E8E3D8'}
                          stopOpacity={0.0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="displayDate"
                      stroke="#5C574D"
                      tick={{ fill: '#A8A294', fontSize: 11 }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    />
                    <YAxis
                      domain={yDomain}
                      stroke="#5C574D"
                      tick={{ fill: '#A8A294', fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0C0C0F',
                        borderColor:
                          activeMetalId === 'gold-24k'
                            ? 'rgba(212, 175, 55, 0.4)'
                            : 'rgba(226, 232, 240, 0.4)',
                        borderRadius: '0.75rem',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                        padding: '10px 14px',
                      }}
                      formatter={(val) => [`Rs ${Number(val).toLocaleString('en-PK')} / tola`, 'Price']}
                      labelFormatter={(label) => `Date: ${label}, 2026`}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={activeMetalId === 'gold-24k' ? '#D9A521' : '#CBD5E1'}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#metalChartGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
                  Loading chart...
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Comprehensive PSX Stock Screener */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              PSX Dividend Stock Screener & Trap Detector
            </h2>
            <p className="text-xs text-zinc-400">
              Filter 18 tracked companies by Shariah status, Grade A safety core vs Grade B/C yield traps, and active streak lengths. Prices & yields as of {DATA_AS_OF_SHORT} close — 30-day streak charts use sample price history, so verify live prices before trading.
            </p>
          </div>
        </div>

        <StockScreener stocks={PSX_STOCKS} initialTicker={initialTicker} />
      </section>
    </div>
  );
}

export default function MarketsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-xs text-zinc-500 font-mono">
          Loading Pakistan Stock Terminal...
        </div>
      }
    >
      <MarketsTerminal />
    </Suspense>
  );
}
