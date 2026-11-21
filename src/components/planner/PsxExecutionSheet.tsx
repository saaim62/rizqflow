'use client';

import React, { useState } from 'react';
import { PlanSummary } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { FileSpreadsheet, Check, Copy, Sparkles, ShieldCheck } from 'lucide-react';

interface PsxExecutionSheetProps {
  allocations: PlanSummary['recommendedAllocations'];
  portfolioPkr: number;
}

export function PsxExecutionSheet({ allocations, portfolioPkr }: PsxExecutionSheetProps) {
  const { formatPkrMasked } = useProfile();
  const [copied, setCopied] = useState(false);

  if (!allocations || allocations.length === 0) return null;

  // Compute exact shares and friction fees
  const executionItems = allocations.map((item) => {
    const price = item.stock.price;
    const allocated = item.amountPkr;
    const shares = Math.floor(allocated / price);
    const tradedAmount = shares * price;
    const feePkr = Math.round(tradedAmount * 0.0025); // 0.25% PSX broker + CDC transaction fee
    const remainderPkr = Math.max(0, allocated - (tradedAmount + feePkr));

    return {
      ticker: item.stock.ticker,
      name: item.stock.name,
      price,
      shares,
      allocated,
      tradedAmount,
      feePkr,
      remainderPkr,
    };
  });

  const totalTraded = executionItems.reduce((acc, i) => acc + i.tradedAmount, 0);
  const totalFees = executionItems.reduce((acc, i) => acc + i.feePkr, 0);
  const totalRemainder = executionItems.reduce((acc, i) => acc + i.remainderPkr, 0);

  const handleCopySummary = async () => {
    const text = executionItems
      .map(
        (i) =>
          `${i.ticker}: Buy ${i.shares.toLocaleString('en-PK')} shares @ Rs ${i.price} (Traded: Rs ${i.tradedAmount.toLocaleString('en-PK')})`
      )
      .join('\n');

    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              PSX Broker Execution Sheet
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 font-mono font-bold">
              0.25% Friction Modeled
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Exact whole share purchase instructions for your PSX broker terminal (Arif Habib, AKD, Finox, KTrade)
          </p>
        </div>

        <button
          onClick={handleCopySummary}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold transition-all self-start sm:self-auto"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
          <span>{copied ? 'Copied Order Sheet!' : 'Copy Order Sheet'}</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-white/[0.06] text-[10px] font-semibold text-zinc-400 uppercase tracking-wider bg-[#0C0C0F]">
              <th className="py-2.5 px-3">Ticker</th>
              <th className="py-2.5 px-3 text-right">Market Price</th>
              <th className="py-2.5 px-3 text-right">Shares to Buy</th>
              <th className="py-2.5 px-3 text-right">Traded Total</th>
              <th className="py-2.5 px-3 text-right">0.25% Broker/CDC Fee</th>
              <th className="py-2.5 px-3 text-right">Cash Left</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {executionItems.map((item) => (
              <tr key={item.ticker} className="hover:bg-white/[0.02] transition-colors">
                <td className="py-2.5 px-3 font-bold text-white">
                  <span>{item.ticker}</span>
                  <span className="text-zinc-500 font-normal ml-1.5 text-[10px]">
                    ({item.name})
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right text-zinc-300">
                  Rs {item.price.toLocaleString('en-PK')}
                </td>
                <td className="py-2.5 px-3 text-right font-bold text-emerald-400 text-sm">
                  {item.shares.toLocaleString('en-PK')}
                </td>
                <td className="py-2.5 px-3 text-right text-white">
                  {formatPkrMasked(item.tradedAmount)}
                </td>
                <td className="py-2.5 px-3 text-right text-rose-400/90 text-[11px]">
                  {formatPkrMasked(item.feePkr)}
                </td>
                <td className="py-2.5 px-3 text-right text-zinc-400 text-[11px]">
                  {formatPkrMasked(item.remainderPkr)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-white/[0.08] bg-[#0C0C0F] font-bold text-xs">
              <td colSpan={2} className="py-3 px-3 text-white">
                Execution Totals
              </td>
              <td className="py-3 px-3 text-right text-emerald-400">
                {executionItems.reduce((acc, i) => acc + i.shares, 0).toLocaleString('en-PK')} shares
              </td>
              <td className="py-3 px-3 text-right text-white">
                {formatPkrMasked(totalTraded)}
              </td>
              <td className="py-3 px-3 text-right text-rose-400">
                {formatPkrMasked(totalFees)}
              </td>
              <td className="py-3 px-3 text-right text-zinc-400">
                {formatPkrMasked(totalRemainder)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
