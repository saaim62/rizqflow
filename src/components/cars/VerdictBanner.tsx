'use client';

import React from 'react';
import { CarDecisionSummary } from '@/types';
import { Trophy, Zap, AlertCircle, Sparkles, Sun } from 'lucide-react';

interface VerdictBannerProps {
  decision: CarDecisionSummary;
}

export function VerdictBanner({ decision }: VerdictBannerProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#FFFFFF] to-amber-500/10 border border-emerald-500/30 p-6 sm:p-8 shadow-2xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-3 max-w-3xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider">
              <Trophy className="w-3.5 h-3.5 text-emerald-400" />
              5-Year TCO Verdict
            </span>

            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-zinc-300">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              Charging Opportunity Cost: Rs {decision.effectiveSolarRatePerKwh}/kWh
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white tracking-tight leading-snug">
            {decision.verdictSentence}
          </h2>

          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Factors in full 5-year petrol consumption, true solar tariff opportunity cost (export rate foregone), expected vehicle depreciation, routine maintenance, quote-based bank interest, and a 10% capital opportunity cost on upfront equity.
          </p>
        </div>

        {decision.crossoverKmPerDay !== null && (
          <div className="shrink-0 p-4 rounded-xl bg-[#FDFBF6] border border-white/10 text-center space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-zinc-400 block font-semibold">
              Distance Crossover
            </span>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-300 font-mono tabular-nums">
              {decision.crossoverKmPerDay} km/day
            </div>
            <span className="text-[10px] text-zinc-400 block">
              Tipping point where EV becomes cheaper
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
