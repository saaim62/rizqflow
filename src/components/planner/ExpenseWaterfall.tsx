'use client';

import React from 'react';
import { ExpenseCoverageStep } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { CheckCircle2, Fuel, Wifi, ShoppingCart, Home, Users, Sparkles } from 'lucide-react';

interface ExpenseWaterfallProps {
  waterfall: ExpenseCoverageStep[];
}

const STEP_ICONS: Record<string, React.ElementType> = {
  'Fuel & Commute': Fuel,
  'Utilities & Internet': Wifi,
  'Groceries & Food': ShoppingCart,
  'Rent & Housing': Home,
  'Family & Other': Users,
};

export function ExpenseWaterfall({ waterfall }: ExpenseWaterfallProps) {
  const { formatPkrMasked } = useProfile();
  const allFullyCovered = waterfall.every((step) => step.isFullyCovered || step.monthlyCostPkr === 0);

  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Expense Waterfall Sorter
            </h3>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
              Prioritized Cash Cover
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            How monthly dividend cash flow knocks out each expense category one by one
          </p>
        </div>

        {allFullyCovered && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold animate-pulse">
            <Sparkles className="w-3.5 h-3.5" />
            100% Financial Independence
          </span>
        )}
      </div>

      <div className="space-y-4">
        {waterfall.map((step, idx) => {
          const Icon = STEP_ICONS[step.label] || Sparkles;
          const isCovered = step.isFullyCovered;
          const isZero = step.monthlyCostPkr === 0;

          return (
            <div
              key={step.label}
              className={`p-4 rounded-xl border transition-all ${
                isCovered
                  ? 'bg-emerald-500/[0.03] border-emerald-500/25'
                  : step.coveredPkr > 0
                  ? 'bg-amber-500/[0.02] border-amber-500/20'
                  : 'bg-[#FFFFFF] border-white/5 opacity-80'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                      isCovered
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : step.coveredPkr > 0
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-white/5 text-zinc-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-white tracking-tight flex items-center gap-2">
                      <span>{idx + 1}. {step.label}</span>
                      {isCovered && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-bold tracking-wider uppercase shadow-[0_0_8px_rgba(16,185,129,0.3)]">
                          PAID BY DIVIDENDS
                        </span>
                      )}
                    </span>
                  </div>
                </div>

                <div className="text-right flex items-baseline justify-between sm:justify-end gap-3 font-mono text-xs">
                  <span className="text-zinc-400">
                    Cost: <strong className="text-white">{formatPkrMasked(step.monthlyCostPkr)}/mo</strong>
                  </span>
                  <span className={isCovered ? 'text-emerald-400 font-bold' : 'text-amber-400'}>
                    Covered: {formatPkrMasked(step.coveredPkr)} ({step.coveragePct.toFixed(0)}%)
                  </span>
                </div>
              </div>

              {/* Step Progress Bar */}
              <div className="h-2 w-full bg-black/[0.05] rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCovered
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                      : 'bg-gradient-to-r from-amber-500 to-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, step.coveragePct)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
