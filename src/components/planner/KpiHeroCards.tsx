'use client';

import React from 'react';
import { PlanSummary, UserProfile } from '@/types';
import { formatPkr } from '@/lib/format';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  Coins, 
  Target, 
  Percent, 
  ShieldAlert, 
  Info, 
  Sparkles, 
  CheckCircle2, 
  HelpCircle 
} from 'lucide-react';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';

interface KpiHeroCardsProps {
  plan: PlanSummary;
  profile: UserProfile;
}

export function KpiHeroCards({ plan, profile }: KpiHeroCardsProps) {
  const { openGuide } = useBeginnerGuide();
  const { formatPkrMasked } = useProfile();

  const isFiler = profile.taxStatus === 'filer';
  const hasFreedom = plan.freedomAge !== null && plan.freedomAge <= profile.age;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {/* Card 1: Monthly Net Dividend */}
      <div className="rounded-2xl bg-[#12101F] border border-white/[0.08] p-5 shadow-lg relative overflow-hidden group hover:border-white/15 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Coins className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Monthly Net Dividend
            </span>
          </div>

          <button
            onClick={() => openGuide('lumpy-payouts')}
            className="p-1 rounded text-zinc-500 hover:text-amber-400 transition-colors"
            title="Why PSX dividends arrive quarterly, not monthly"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-3">
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
            {formatPkrMasked(plan.initialMonthlyNetDividendPkr)}
            <span className="text-xs font-normal text-zinc-400 ml-1.5">/ mo</span>
          </div>
          <div className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1.5">
            <span>Gross: {formatPkrMasked(plan.initialMonthlyGrossDividendPkr)}</span>
            <span>•</span>
            <span className="text-emerald-400 font-mono">
              {formatPkrMasked(plan.initialMonthlyNetDividendPkr * 12)} / yr net
            </span>
          </div>
        </div>

        {/* Honest reality notice */}
        <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-start gap-1.5 text-[11px] text-zinc-400">
          <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <span className="leading-tight">
            Average monthly rate. Real payouts arrive in <strong>quarterly bursts</strong> (Mar, May, Aug, Nov).
          </span>
        </div>
      </div>

      {/* Card 2: Dividend Freedom Date */}
      <div className="rounded-2xl bg-[#12101F] border border-white/[0.08] p-5 shadow-lg relative overflow-hidden group hover:border-white/15 transition-all">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Target className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Dividend Freedom Date
            </span>
          </div>

          <Sparkles className="w-4 h-4 text-amber-400" />
        </div>

        <div className="mt-3">
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${
            hasFreedom ? 'text-emerald-400' : 'text-amber-300'
          }`}>
            {plan.freedomDateLabel}
          </div>
          <div className="text-[11px] text-zinc-400 mt-1">
            {plan.freedomAge === null
              ? 'Beyond 15-year horizon with current monthly SIP'
              : hasFreedom
              ? '🎉 100% of all monthly living expenses covered today!'
              : `Achieved at Age ${plan.freedomAge} with compounding`}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-white/[0.06] text-[11px] text-zinc-400 flex items-center justify-between">
          <span>Target Monthly Expenses:</span>
          <span className="font-mono font-bold text-white">
            {formatPkrMasked(
              Object.values(profile.expenses).reduce((a, b) => a + b, 0)
            )}
            /mo
          </span>
        </div>
      </div>

      {/* Card 3: Blended Yield & Filer Tax Callout */}
      <div className="rounded-2xl bg-[#12101F] border border-white/[0.08] p-5 shadow-lg relative overflow-hidden group hover:border-white/15 transition-all sm:col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Percent className="w-4 h-4" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Blended Net Yield
            </span>
          </div>

          <button
            onClick={() => openGuide('filer-tax')}
            className="text-[10px] text-emerald-400 hover:underline font-mono"
          >
            FBR WHT Rules &rarr;
          </button>
        </div>

        <div className="mt-3 flex items-baseline justify-between">
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono tabular-nums">
              {(plan.blendedGrossYieldPct * (1 - plan.taxRatePct / 100)).toFixed(2)}%
            </div>
            <div className="text-[11px] text-zinc-400 mt-1">
              Gross Yield: <span className="font-mono text-white">{plan.blendedGrossYieldPct.toFixed(1)}%</span>
            </div>
          </div>

          <div className="text-right">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
              isFiler ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
            }`}>
              {plan.taxRatePct}% WHT ({profile.taxStatus})
            </span>
          </div>
        </div>

        {/* Filer / Non-Filer callout */}
        <div className="mt-3 pt-3 border-t border-white/[0.06]">
          {isFiler ? (
            <div className="text-[11px] text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Active Filer: Saving {formatPkrMasked(plan.nonFilerTaxPenaltyYearlyPkr)}/yr vs non-filer penal rate!</span>
            </div>
          ) : (
            <div className="text-[11px] text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
              <span>Non-Filer Penalty: Losing {formatPkrMasked(plan.nonFilerTaxPenaltyYearlyPkr)}/yr to FBR!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
