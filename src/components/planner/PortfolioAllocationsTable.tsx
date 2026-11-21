'use client';

import React from 'react';
import { PlanSummary } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { ShariahBadge } from '@/components/ui/GradeBadge';
import { ShieldCheck, PieChart, Sparkles } from 'lucide-react';

interface PortfolioAllocationsTableProps {
  allocations: PlanSummary['recommendedAllocations'];
  totalLumpSum: number;
}

export function PortfolioAllocationsTable({
  allocations,
  totalLumpSum,
}: PortfolioAllocationsTableProps) {
  const { formatPkrMasked } = useProfile();

  if (!allocations || allocations.length === 0) {
    return (
      <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-6 text-center text-zinc-400 text-xs">
        No portfolio allocations generated yet. Allocate capital above.
      </div>
    );
  }

  const totalAllocated = allocations.reduce((sum, item) => sum + item.amountPkr, 0);
  const totalAnnualNet = allocations.reduce((sum, item) => sum + item.annualNetDivPkr, 0);

  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <PieChart className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Auto-Built Grade-A Core Portfolio
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-semibold">
              Zero Yield Traps
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Scientifically balanced across defensive fertilizers, power producers, oil/gas and Islamic banking
          </p>
        </div>

        <div className="text-right font-mono text-xs">
          <span className="text-zinc-400">Total Portfolio Value: </span>
          <strong className="text-white font-bold">{formatPkrMasked(totalAllocated)}</strong>
        </div>
      </div>

      {/* Table view */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-white/[0.06] text-[11px] font-semibold text-zinc-400 uppercase tracking-wider bg-[#FFFFFF]">
              <th className="py-2.5 px-3">Stock & Sector</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3 text-right">Target Weight</th>
              <th className="py-2.5 px-3 text-right">Allocated PKR</th>
              <th className="py-2.5 px-3 text-right">Yield %</th>
              <th className="py-2.5 px-3 text-right">Annual Net Div</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {allocations.map((item) => (
              <tr key={item.stock.ticker} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-3">
                  <div className="flex items-center gap-2 font-mono font-bold text-white">
                    <span>{item.stock.ticker}</span>
                    <span className="text-[10px] font-normal text-zinc-400">({item.stock.name})</span>
                  </div>
                  <div className="text-[10px] text-zinc-500">{item.stock.sector}</div>
                </td>

                <td className="py-3 px-3">
                  <ShariahBadge isShariah={item.stock.isShariah} />
                </td>

                <td className="py-3 px-3 text-right font-mono font-bold text-white">
                  {item.weightPct.toFixed(1)}%
                </td>

                <td className="py-3 px-3 text-right font-mono font-bold text-white tabular-nums">
                  {formatPkrMasked(item.amountPkr)}
                </td>

                <td className="py-3 px-3 text-right font-mono text-emerald-400 font-bold tabular-nums">
                  {item.stock.dividendYieldPct.toFixed(1)}%
                </td>

                <td className="py-3 px-3 text-right font-mono font-bold text-emerald-300 tabular-nums">
                  {formatPkrMasked(item.annualNetDivPkr)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/[0.08] bg-[#FFFFFF] font-mono font-bold text-xs">
              <td colSpan={2} className="py-3 px-3 text-white">
                Total Recommended Core
              </td>
              <td className="py-3 px-3 text-right text-emerald-400">
                100.0%
              </td>
              <td className="py-3 px-3 text-right text-white">
                {formatPkrMasked(totalAllocated)}
              </td>
              <td className="py-3 px-3 text-right text-zinc-400">-</td>
              <td className="py-3 px-3 text-right text-emerald-400">
                {formatPkrMasked(totalAnnualNet)} / yr
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
