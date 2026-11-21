'use client';

import React, { useState } from 'react';
import { CarDecisionSummary, VehicleTcoResult } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  Trophy, 
  ChevronDown, 
  ChevronUp, 
  AlertTriangle, 
  Fuel, 
  Zap, 
  Bike, 
  Car, 
  Layers, 
  Coins, 
  Info 
} from 'lucide-react';

interface RealCostLeaderboardProps {
  decision: CarDecisionSummary;
}

export function RealCostLeaderboard({ decision }: RealCostLeaderboardProps) {
  const { formatPkrMasked, formatCompactPkrMasked } = useProfile();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const results = [...decision.results].sort(
    (a, b) => a.totalFiveYearCostPkr - b.totalFiveYearCostPkr
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Real Cost a Month Leaderboard
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
              Ranked by 5-Year True TCO
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            True monthly cost includes fuel, depreciation, maintenance, bank interest, and cash opportunity cost
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {results.map((res, index) => {
          const isCheapest = index === 0;
          const isExpanded = expandedId === res.vehicleId;
          const isBike = res.fuelType === 'e-scooty';
          const isEv = res.fuelType === 'ev';

          return (
            <div
              key={res.vehicleId}
              className={`rounded-xl border transition-all ${
                isCheapest
                  ? 'bg-gradient-to-r from-emerald-500/[0.07] via-black/30 to-transparent border-emerald-500/35 shadow-md shadow-emerald-500/5'
                  : 'bg-[#FDFBF6] border-white/[0.07] hover:border-white/15'
              }`}
            >
              {/* Main Row */}
              <div
                onClick={() => toggleExpand(res.vehicleId)}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                      isCheapest
                        ? 'bg-emerald-500 text-black font-extrabold shadow-sm shadow-emerald-500/30'
                        : 'bg-white/5 text-zinc-400 border border-white/5'
                    }`}
                  >
                    #{index + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-white">{res.name}</span>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase tracking-wider ${
                          isEv
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/25'
                            : isBike
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/25'
                            : 'bg-blue-500/15 text-blue-300 border border-blue-500/25'
                        }`}
                      >
                        {isEv ? <Zap className="w-2.5 h-2.5" /> : isBike ? <Bike className="w-2.5 h-2.5" /> : <Fuel className="w-2.5 h-2.5" />}
                        <span>{res.fuelType}</span>
                      </span>

                      {isCheapest && (
                        <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                          WINNER
                        </span>
                      )}

                      {res.isQuoteIncomplete && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px]">
                          <AlertTriangle className="w-3 h-3 text-amber-400" />
                          Quote Incomplete
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-zinc-400 mt-0.5">
                      5-Yr Total: <strong className="text-zinc-200 font-mono">{formatCompactPkrMasked(res.totalFiveYearCostPkr)}</strong>
                    </div>
                  </div>
                </div>

                {/* Right side: Real Cost per Month & Expand CTA */}
                <div className="flex items-center justify-between sm:justify-end gap-4 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase tracking-wider text-zinc-500 block">
                      Real Cost / Month
                    </span>
                    <div className="text-lg sm:text-xl font-mono font-extrabold text-emerald-400 tabular-nums">
                      {formatPkrMasked(res.realCostPerMonthPkr)}
                      <span className="text-xs text-zinc-400 font-normal ml-1">/ mo</span>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(res.vehicleId);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold"
                  >
                    <span>{isExpanded ? 'Hide' : 'See Why'}</span>
                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {/* Expandable 5-Line Waterfall */}
              {isExpanded && (
                <div className="p-4 border-t border-white/[0.06] bg-[#FDFBF6] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-400" />
                      5-Year Cost Breakdown & Cumulative Total
                    </span>
                    <span className="text-[11px] text-zinc-500 font-mono">
                      Running Waterfall
                    </span>
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    {res.waterfall.map((step, sIdx) => (
                      <div
                        key={step.label}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 font-bold">{sIdx + 1}.</span>
                          <span className="text-zinc-200">{step.label}</span>
                        </div>
                        <div className="flex items-center gap-4 text-right">
                          <span className="text-zinc-400">+{formatPkrMasked(step.amountPkr)}</span>
                          <span className="font-bold text-white min-w-[90px]">
                            = {formatPkrMasked(step.runningTotalPkr)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex justify-between items-center text-[11px] text-zinc-400 border-t border-white/5">
                    <span>Divided evenly across 60 months:</span>
                    <span className="text-emerald-400 font-bold font-mono">
                      {formatPkrMasked(res.realCostPerMonthPkr)} / month
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
