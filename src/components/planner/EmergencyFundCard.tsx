'use client';

import React from 'react';
import { PlanSummary, UserProfile } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Shield, ShieldAlert, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';

interface EmergencyFundCardProps {
  plan: PlanSummary;
  profile: UserProfile;
}

export function EmergencyFundCard({ plan, profile }: EmergencyFundCardProps) {
  const { openGuide } = useBeginnerGuide();
  const { formatPkrMasked } = useProfile();

  const totalMonthlyExpenses = Object.values(profile.expenses).reduce((a, b) => a + b, 0);
  const target = plan.emergencyFundTargetPkr;
  const currentReserve = profile.currentCashReservePkr;
  const gap = plan.emergencyFundGapPkr;
  const isFunded = gap <= 0;
  const fundedPct = target > 0 ? Math.min(100, Math.round((currentReserve / target) * 100)) : 100;

  return (
    <div className={`rounded-2xl border p-5 sm:p-6 transition-all shadow-md ${
      isFunded
        ? 'bg-[#FFFFFF] border-emerald-500/30'
        : 'bg-[#FFFFFF] border-amber-500/30'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isFunded
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-amber-500/10 border border-amber-500/20 text-amber-400'
          }`}>
            {isFunded ? <ShieldCheck className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                Emergency Fund: The 4-Month First Gate
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                isFunded
                  ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
              }`}>
                {isFunded ? 'Gate Cleared (Safe)' : 'Buffer Needed'}
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Mandatory safety buffer before aggressive equity allocation to prevent panic selling during quarterly dry spells
            </p>
          </div>
        </div>

        <button
          onClick={() => openGuide('lumpy-payouts')}
          className="text-xs text-amber-400 hover:text-amber-300 underline self-start sm:self-auto"
        >
          Why 4 Months? &rarr;
        </button>
      </div>

      {/* Progress Bar & Amounts */}
      <div className="mt-5 space-y-2">
        <div className="flex justify-between text-xs font-mono">
          <span className="text-zinc-400">
            Current Cash Reserve: <strong className="text-white">{formatPkrMasked(currentReserve)}</strong>
          </span>
          <span className="text-zinc-400">
            Target (4x Expenses): <strong className="text-white">{formatPkrMasked(target)}</strong>
          </span>
        </div>

        {/* Bar */}
        <div className="h-3 w-full bg-[#FFFFFF] rounded-full overflow-hidden p-0.5 border border-white/10">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isFunded
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-amber-500 to-rose-400'
            }`}
            style={{ width: `${fundedPct}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px]">
          <span className="font-mono text-zinc-400">{fundedPct}% Funded</span>
          {isFunded ? (
            <span className="text-emerald-400 font-semibold flex items-center gap-1">
              ✓ Ready for 100% PSX Dividend Machine deployment
            </span>
          ) : (
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              Gap: {formatPkrMasked(gap)} needed in liquid cash or Islamic money market fund
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
