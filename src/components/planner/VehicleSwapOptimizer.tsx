'use client';

import React from 'react';
import Link from 'next/link';
import { CarDecisionSummary, UserProfile } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  Zap, 
  Sun, 
  Fuel, 
  Car, 
  ArrowRight, 
  Trophy 
} from 'lucide-react';

interface VehicleSwapOptimizerProps {
  decision: CarDecisionSummary;
  profile: UserProfile;
}

export function VehicleSwapOptimizer({ decision, profile }: VehicleSwapOptimizerProps) {
  const { formatPkrMasked } = useProfile();
  const hasSolar = profile.solarKw > 0;

  return (
    <div className="rounded-2xl bg-[#12101F] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Car className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Vehicle TCO & Solar Arbitrage
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
              5-Year TCO
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {decision.verdictSentence}
          </p>
        </div>

        <Link
          href="/cars"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition-all self-start sm:self-auto"
        >
          <span>Open Full Car Decision Map</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {decision.results.slice(0, 3).map((res) => (
          <div
            key={res.vehicleId}
            className="p-3.5 rounded-xl bg-[#0B0A16] border border-white/5 space-y-1.5"
          >
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-white">{res.name}</span>
              <span className="text-[10px] font-mono uppercase text-zinc-400">{res.fuelType}</span>
            </div>
            <div className="font-mono font-bold text-emerald-400 text-sm">
              {formatPkrMasked(res.realCostPerMonthPkr)}
              <span className="text-[10px] text-zinc-500 font-normal ml-1">/ month</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
