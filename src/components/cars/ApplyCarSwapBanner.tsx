'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { CarDecisionSummary, UserProfile, VehicleCandidate } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Zap, ArrowRight, Check, Sparkles, TrendingUp, Coins } from 'lucide-react';

interface ApplyCarSwapBannerProps {
  decision: CarDecisionSummary;
  profile: UserProfile;
}

export function ApplyCarSwapBanner({ decision, profile }: ApplyCarSwapBannerProps) {
  const { updateProfile, showToast, formatPkrMasked } = useProfile();

  const cheapest = decision.results[0];

  // Baseline (NOTES #33): the vehicle(s) the user marked "I own this".
  // With several owned, the honest comparison is against the owned
  // vehicle with the highest monthly true cost — switching THAT one
  // saves the most. The from-vehicle is named in the banner text;
  // before this round the flag was invisible everywhere on screen.
  // No vehicle marked -> fall back to the first vehicle, as before.
  const allVehicles = profile.vehicles ?? [];
  const ownedIds = new Set(allVehicles.filter((v) => v.isCurrentVehicle).map((v) => v.id));
  const baselinePool: VehicleCandidate[] =
    ownedIds.size > 0 ? allVehicles.filter((v) => ownedIds.has(v.id)) : allVehicles.slice(0, 1);

  let currentVeh: VehicleCandidate | undefined;
  let currentVehCost = -1;
  for (const r of decision.results) {
    if (r.vehicleId === cheapest?.vehicleId) continue;
    if (!baselinePool.some((v) => v.id === r.vehicleId)) continue;
    if (r.realCostPerMonthPkr > currentVehCost) {
      currentVehCost = r.realCostPerMonthPkr;
      currentVeh = baselinePool.find((v) => v.id === r.vehicleId);
    }
  }

  if (!cheapest || !currentVeh) {
    return null;
  }

  const winningCandidate = allVehicles.find((v) => v.id === cheapest.vehicleId);

  // Monthly savings vs the baseline owned vehicle
  const monthlySavings = Math.max(0, currentVehCost - cheapest.realCostPerMonthPkr);

  // Financed baseline freed equity uses equityTiedUp (down payment) rather than full sticker price
  const isBaselineFinanced = Boolean(currentVeh.emiQuote?.enabled);
  const baselineEquity = isBaselineFinanced
    ? (currentVeh.emiQuote?.downPaymentPkr ?? 0)
    : (currentVeh.pricePkr ?? 0);

  const isWinnerFinanced = Boolean(winningCandidate?.emiQuote?.enabled);
  const winnerEquity = isWinnerFinanced
    ? (winningCandidate?.emiQuote?.downPaymentPkr ?? 0)
    : (winningCandidate?.pricePkr ?? 0);

  const freedEquity = Math.max(0, baselineEquity - winnerEquity);

  // Do not render the banner if monthlySavings <= 0 && freedEquity <= 0
  if (monthlySavings <= 0 && freedEquity <= 0) {
    return null;
  }

  const decisionSignature = `${currentVeh.id}:${winningCandidate?.id ?? cheapest.vehicleId}:${Math.round(freedEquity)}:${Math.round(monthlySavings)}`;
  const isApplied = profile.appliedCarSwapKey === decisionSignature;

  const handleApply = () => {
    updateProfile({
      lumpSumPkr: profile.lumpSumPkr + freedEquity,
      monthlyInvestPkr: profile.monthlyInvestPkr + monthlySavings,
      appliedCarSwapKey: decisionSignature,
    });
    showToast(`Applied: +${formatPkrMasked(freedEquity)} to Lump Sum & +${formatPkrMasked(monthlySavings)}/mo to SIP!`);
  };

  return (
    <div className="rounded-2xl bg-gradient-to-r from-emerald-500/15 via-[#121214] to-amber-500/10 border border-emerald-500/30 p-5 sm:p-6 shadow-xl space-y-3">
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
            Switching from your <strong>{currentVeh.name}</strong> to <strong>{cheapest.name}</strong> frees up{' '}
            <strong className="text-white font-mono">{formatPkrMasked(freedEquity)}</strong> {isBaselineFinanced ? 'estimated equity' : 'upfront cash'} and saves{' '}
            <strong className="text-emerald-400 font-mono">+{formatPkrMasked(monthlySavings)}/month</strong>. Channel these savings directly into PSX dividend compounding!
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleApply}
            disabled={isApplied}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md ${
              isApplied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
            }`}
          >
            {isApplied ? <Check className="w-4 h-4 text-emerald-400" /> : <Coins className="w-4 h-4" />}
            <span>{isApplied ? 'Applied ✓' : 'Apply to Wealth Plan'}</span>
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
