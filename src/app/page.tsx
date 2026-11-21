'use client';

import React from 'react';
import Link from 'next/link';
import { METAL_ASSETS, PSX_STOCKS, MARKET_SNAPSHOT } from '@/data/marketData';
import { useMarketSnapshot } from '@/lib/useMarketSnapshot';
import { GoldSpotlight } from '@/components/markets/GoldSpotlight';
import { GoldDataCard } from '@/components/markets/GoldDataCard';
import { PsxMoversStrip } from '@/components/markets/PsxMoversStrip';
import { QuickSimulator } from '@/components/markets/QuickSimulator';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  TrendingUp, 
  Sparkles, 
  ShieldCheck, 
  ArrowRight, 
  BookOpen, 
  Car, 
  Coins, 
  Percent, 
  HelpCircle,
  Landmark,
  Zap,
  Fuel
} from 'lucide-react';

export default function HomePage() {
  const { openGuide } = useBeginnerGuide();
  const { formatPkrMasked } = useProfile();
  const snap = useMarketSnapshot();

  const gold = METAL_ASSETS.find((m) => m.id === 'gold-24k') || METAL_ASSETS[0];
  const silver = METAL_ASSETS.find((m) => m.id === 'silver-24k') || METAL_ASSETS[1];

  return (
    <div className="min-h-screen space-y-10 pb-16">
      {/* 1. Executive Hero Header */}
      <section className="relative overflow-hidden border-b border-white/[0.06] bg-gradient-to-b from-[#FFFFFF] via-[#F4F4F5] to-[#F4F4F5] pt-10 pb-12 sm:pt-16 sm:pb-16">
        {/* Glow ambient background effects */}
                
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-xs font-semibold text-emerald-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Pakistan Financial Intelligence Platform
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-zinc-400">
              KSE-100 · Sarafa 24K · Car TCO
            </span>
          </div>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 pt-2">
            <div className="max-w-2xl space-y-4">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
                Turn PSX Blue-Chip Dividends & Gold Streaks into{' '}
                <span className="text-emerald-600">
                  True Financial Freedom
                </span>
              </h1>
              <p className="text-base sm:text-lg text-zinc-600 leading-relaxed">
                Model real-life Pakistani living expenses — fuel, electricity, groceries, and EV swaps — paid for entirely by Grade-A halal dividend machines. Honest yields, zero yield traps, and automated FBR tax optimization.
              </p>

              {/* Quick CTA Actions */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/planner"
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/25 group"
                >
                  <Sparkles className="w-4 h-4 text-black" />
                  <span>Launch Life & Wealth Planner</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>

                <Link
                  href="/cars"
                  className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#FFFFFF] hover:bg-zinc-50 text-zinc-700 border border-black/10 font-semibold text-sm transition-all shadow-sm"
                >
                  <Car className="w-4 h-4 text-amber-400" />
                  <span>Car Decision Map (5-Yr TCO)</span>
                </Link>

                <button
                  onClick={() => openGuide()}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-zinc-500 hover:text-zinc-800 text-sm font-medium transition-all"
                >
                  <BookOpen className="w-4 h-4 text-emerald-400" />
                  <span>Beginner Guide</span>
                </button>
              </div>
            </div>

            {/* Gold intelligence card — real data, not decoration */}
            <div className="w-full lg:w-[400px] shrink-0 self-center">
              <GoldDataCard gold={gold} />
            </div>
          </div>

          {/* Ticker Pills Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-4 border-t border-white/[0.08] text-xs">
            {/* Gold */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] uppercase">24K Sarafa Gold</span>
              <div className="font-mono font-bold text-white text-sm mt-0.5">
                Rs {snap.rates.goldPerTolaPkr.toLocaleString('en-PK')}
              </div>
              <span className="text-rose-400 font-mono text-[10px]">▼ 5d Dip Zone (-12.8%)</span>
            </div>

            {/* Silver */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] uppercase">24K Silver (Tola)</span>
              <div className="font-mono font-bold text-white text-sm mt-0.5">
                Rs {snap.silverPerTolaPkr.toLocaleString('en-PK')}
              </div>
              <span className="text-rose-400 font-mono text-[10px]">▼ 3d Losing Streak</span>
            </div>

            {/* USD / PKR */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] uppercase">Interbank USD</span>
              <div className="font-mono font-bold text-emerald-400 text-sm mt-0.5">
                Rs {snap.rates.usdToPkr}
              </div>
              <span className="text-zinc-400 font-mono text-[10px]">SBP Remittance Rate</span>
            </div>

            {/* KSE-100 */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between">
              <span className="text-zinc-500 text-[10px] uppercase">KSE-100 Index</span>
              <div className="font-mono font-bold text-white text-sm mt-0.5">
                {snap.rates.kse100Index.toLocaleString('en-PK', { maximumFractionDigits: 0 })}
              </div>
              <span className="text-emerald-400 font-mono text-[10px]">▲ +{MARKET_SNAPSHOT.kse100ChangePts} pts (+{MARKET_SNAPSHOT.kse100ChangePct}%)</span>
            </div>

            {/* Petrol */}
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex flex-col justify-between col-span-2 sm:col-span-1">
              <span className="text-zinc-500 text-[10px] uppercase">Petrol (Super)</span>
              <div className="font-mono font-bold text-amber-300 text-sm mt-0.5">
                Rs {snap.rates.petrolPricePerLitre} / L
              </div>
              <span className="text-zinc-400 font-mono text-[10px]">Effective Nov 21, 2026</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* 2. Hero Gold & Silver Streak Spotlight */}
        <section className="space-y-3">
          <GoldSpotlight gold={gold} silver={silver} />
        </section>

        {/* 3. PSX Streak Movers Strip */}
        <section className="space-y-3">
          <PsxMoversStrip stocks={PSX_STOCKS} />
        </section>

        {/* 4. Instant Rs 30 Lac Quick Simulator */}
        <section className="space-y-3">
          <QuickSimulator />
        </section>

        {/* 5. Car Decision Feature Spotlight Banner */}
        <section className="rounded-2xl bg-gradient-to-r from-amber-500/10 via-[#F4F4F5] to-emerald-500/10 border border-white/[0.08] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
          <div className="space-y-2 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
              <Car className="w-3.5 h-3.5" />
              New Feature: 5-Year Car TCO Map
            </div>
            <h3 className="text-lg font-bold text-white">
              Should You Keep Your Petrol Car or Switch to EV?
            </h3>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl">
              Model true Pakistani vehicle economics: 2026 gross-billing solar tariffs (Rs 11/kWh foregone export), 5-year depreciation, bank financing quotes, and 10% capital opportunity costs.
            </p>
          </div>

          <Link
            href="/cars"
            className="px-5 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition-all shadow-md shadow-amber-500/20 shrink-0"
          >
            Launch Car Decision Map &rarr;
          </Link>
        </section>
      </div>
    </div>
  );
}
