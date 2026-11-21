'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CarDecisionSummary, UserProfile } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Zap, ArrowRight, Check, Sparkles, TrendingUp, Coins } from 'lucide-react';

interface ApplyCarSwapBannerProps {
  decision: CarDecisionSummary;
  profile: UserProfile;
}

export function ApplyCarSwapBanner({ decision, profile }: ApplyCarSwapBannerProps) {
  const { updateProfile, showToast, formatPkrMasked } = useProfile();
  const [applied, setApplied] = useState(false);

  const cheapest = decision.results[0];
  const currentVeh = profile.vehicles?.find((v) => v.isCurrentVehicle) || profile.vehicles?.[0];

  if (!cheapest || !currentVeh || cheapest.vehicleId === currentVeh.id) {
    return null;
  }

  const currentVehTco = decision.results.find((r) => r.vehicleId === currentVeh.id);
  const winningCandidate = profile.vehicles?.find((v) => v.id === cheapest.vehicleId);

  // Calculate monthly savings vs current vehicle
  const monthlySavings = Math.max(
    0,
    currentVehTco
      ? currentVehTco.realCostPerMonthPkr - cheapest.realCostPerMonthPkr
      : 0
  );

  const freedEquity = Math.max(0, (currentVeh.pricePkr || 0) - (winningCandidate?.pricePkr || 0));

  const handleApply = () => {
    updateProfile({
      lumpSumPkr: profile.lumpSumPkr + freedEquity,
      monthlyInvestPkr: profile.monthlyInvestPkr + monthlySavings,
    });
    setApplied(true);
    showToast(`Applied: +${formatPkrMasked(freedEquity)} to Lump Sum & +${formatPkrMasked(monthlySavings)}/mo to SIP!`);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#F4F4F5] to-amber-500/10 border border-emerald-500/30 p-5 sm:p-6 shadow-xl space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <span>Bridge Savings to Wealth Planner</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono font-bold">
                Car-to-Wealth Arbitrage
              </span>
            </h3>
          </div>
          <p className="text-xs text-zinc-300 mt-1 max-w-2xl leading-relaxed">
            Switching to <strong>{cheapest.name}</strong> frees up{' '}
            <strong className="text-white font-mono">{formatPkrMasked(freedEquity)}</strong> upfront cash and saves{' '}
            <strong className="text-emerald-400 font-mono">+{formatPkrMasked(monthlySavings)}/month</strong>. Channel these savings directly into PSX dividend compounding!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleApply}
            disabled={applied}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md ${
              applied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
            }`}
          >
            {applied ? <Check className="w-4 h-4 text-emerald-400" /> : <Coins className="w-4 h-4" />}
            <span>{applied ? 'Savings Applied to Plan!' : 'Apply to Wealth Plan'}</span>
          </button>

          <Link
            href="/planner"
            className="flex items-center gap-1 px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs font-semibold transition-all"
          >
            <span>View Planner</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
