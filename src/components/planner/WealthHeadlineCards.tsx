'use client';

import React from 'react';
import { PlanSummary, UserProfile } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  Sparkles, 
  DollarSign, 
  Coins, 
  ShieldCheck, 
  Target, 
  TrendingUp, 
  Clock, 
  HelpCircle 
} from 'lucide-react';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';

interface WealthHeadlineCardsProps {
  plan: PlanSummary;
  profile: UserProfile;
}

export function WealthHeadlineCards({ plan, profile }: WealthHeadlineCardsProps) {
  const { formatPkrMasked, formatCompactPkrMasked, hideAmounts } = useProfile();
  const { openGuide } = useBeginnerGuide();

  const isTodayMoney = profile.inflationAdjusted;
  const targetRetirementAge = profile.retirementAge || 60;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            Wealth & Freedom Horizon @ Age {targetRetirementAge}
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">
          Compounding Horizon: {Math.max(1, targetRetirementAge - profile.age)} Years
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* 1. Today's Money Net Worth */}
        <div className="rounded-xl bg-[#12101F] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/15 transition-all">
          <div>
            <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold">
              <span>Today's Real Wealth</span>
              <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-300 font-mono text-[9px]">
                Deflated
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tabular-nums mt-1.5">
              {formatCompactPkrMasked(plan.finalRealTodaysPkr)}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            Nominal: {formatCompactPkrMasked(plan.finalNominalWealthPkr)}
          </div>
        </div>

        {/* 2. USD Wealth */}
        <div className="rounded-xl bg-[#12101F] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/15 transition-all">
          <div>
            <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold">
              <span className="flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                USD Valuation
              </span>
              <span className="text-zinc-500 font-mono text-[9px]">Rs {profile.usdToPkr || 276.5}</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 font-mono tabular-nums mt-1.5">
              {hideAmounts
                ? '$ •••••'
                : `$ ${(plan.finalWealthUsd / 1000).toFixed(0)}k`}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            {hideAmounts ? '$ •••••' : `$ ${Math.round(plan.finalWealthUsd).toLocaleString('en-US')}`}
          </div>
        </div>

        {/* 3. Gold Tolas */}
        <div className="rounded-xl bg-[#12101F] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/15 transition-all">
          <div>
            <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold">
              <span className="flex items-center gap-1">
                <Coins className="w-3 h-3 text-amber-400" />
                24K Gold Tolas
              </span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-amber-300 font-mono tabular-nums mt-1.5">
              {hideAmounts
                ? '••••• tolas'
                : `${Math.round(plan.finalWealthGoldTolas).toLocaleString('en-PK')} tolas`}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            Physical hedge equivalent
          </div>
        </div>

        {/* 4. Safe Monthly Income (4% Rule) */}
        <div className="rounded-xl bg-[#12101F] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/15 transition-all">
          <div>
            <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold">
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-blue-400" />
                Safe 4% Income
              </span>
              <span className="text-zinc-500 text-[9px]">Monthly</span>
            </div>
            <div className="text-xl sm:text-2xl font-extrabold text-white font-mono tabular-nums mt-1.5">
              {formatPkrMasked(plan.safeMonthlyIncome4PctTodaysPkr)}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            In today's purchasing power
          </div>
        </div>

        {/* 5. Dividend Freedom Date & Age */}
        <div className="rounded-xl bg-[#12101F] border border-white/[0.08] p-4 flex flex-col justify-between relative overflow-hidden group hover:border-white/15 transition-all col-span-2 lg:col-span-1">
          <div>
            <div className="flex items-center justify-between text-zinc-400 text-[10px] uppercase font-semibold">
              <span className="flex items-center gap-1">
                <Target className="w-3 h-3 text-amber-400" />
                Dividend Freedom
              </span>
            </div>
            <div className="text-base sm:text-lg font-extrabold text-amber-300 font-mono tabular-nums mt-1.5 leading-tight break-words">
              {plan.freedomDateLabel}
            </div>
          </div>
          <div className="text-[10px] text-zinc-500 mt-2 font-mono">
            {plan.freedomAge ? `At Age ${plan.freedomAge}` : 'Exp. covered by dividends'}
          </div>
        </div>
      </div>
    </div>
  );
}
