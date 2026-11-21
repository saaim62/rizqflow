'use client';

import React from 'react';
import { GoalOutcome } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Calendar, AlertCircle, CheckCircle2, TrendingDown, Sparkles } from 'lucide-react';

interface GoalShortfallCardProps {
  goalOutcomes: GoalOutcome[];
}

export function GoalShortfallCard({ goalOutcomes }: GoalShortfallCardProps) {
  const { formatPkrMasked, formatCompactPkrMasked } = useProfile();

  if (!goalOutcomes || goalOutcomes.length === 0) {
    return null;
  }

  const totalWithdrawn = goalOutcomes.reduce((acc, g) => acc + g.inflatedCostPkr, 0);
  const totalOppCost = goalOutcomes.reduce(
    (acc, g) => acc + g.trueOpportunityCostAtRetirementPkr,
    0
  );

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-amber-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Dated Life Goals & The True Opportunity Cost of Withdrawals
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Every rupee taken out for a house, wedding, or upgrade doesn't just reduce today's pot — it stops compounding forever
          </p>
        </div>

        <div className="text-right font-mono text-xs">
          <span className="text-zinc-500 block text-[10px]">Total Compounding Drained @ Retirement:</span>
          <span className="text-rose-400 font-bold text-sm">
            {formatCompactPkrMasked(totalOppCost)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {goalOutcomes.map((goal) => (
          <div
            key={goal.goalId}
            className="p-3.5 rounded-xl bg-[#0C0C0F] border border-white/5 space-y-2.5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h4 className="font-bold text-sm text-white">{goal.name}</h4>
                  <span className="text-[10px] text-zinc-400 font-mono">
                    Target Age: <strong className="text-white">{goal.targetAge}</strong>
                  </span>
                </div>

                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    goal.funded
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/25'
                  }`}
                >
                  {goal.funded ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      Funded
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-3 h-3 text-rose-400" />
                      Shortfall
                    </>
                  )}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-white/5 space-y-1 font-mono text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span className="text-[11px]">Future Cost (Inflated):</span>
                  <span className="font-bold text-white">
                    {formatPkrMasked(goal.inflatedCostPkr)}
                  </span>
                </div>

                <div className="flex justify-between text-rose-300 text-[11px]">
                  <span>Lost Pot @ Retirement:</span>
                  <span className="font-bold text-rose-400">
                    -{formatCompactPkrMasked(goal.trueOpportunityCostAtRetirementPkr)}
                  </span>
                </div>
              </div>
            </div>

            {goal.shortfallPkr > 0 && (
              <div className="p-2 rounded bg-rose-500/10 text-rose-400 text-[11px] font-mono flex items-center justify-between">
                <span>Shortfall Gap:</span>
                <span className="font-bold">{formatPkrMasked(goal.shortfallPkr)}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
