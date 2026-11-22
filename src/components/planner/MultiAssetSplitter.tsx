'use client';

import React from 'react';
import { AssetBucket } from '@/types';
import { Layers, PieChart, Coins, Home, Landmark, Wallet, Wand2 } from 'lucide-react';

interface MultiAssetSplitterProps {
  assetBuckets: AssetBucket[];
  onChange: (updatedBuckets: AssetBucket[]) => void;
}

const BUCKET_ICONS: Record<string, React.ElementType> = {
  'psx-dividends': PieChart,
  gold: Coins,
  'real-estate': Home,
  'money-market': Landmark,
  cash: Wallet,
};

/** Splits carry one decimal (NOTES #23) — real portfolios are split like
 * 12.7 / 30.7 / 42.1 / 7.7 / 6.8, which the old 5%-step sliders and the
 * integer-rounding auto-balance could not represent at all. */
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmtPct = (n: number) => (Number.isInteger(n) ? `${n}` : n.toFixed(1));

export function MultiAssetSplitter({ assetBuckets, onChange }: MultiAssetSplitterProps) {
  const totalSplit = assetBuckets.reduce((acc, b) => acc + (b.monthlySplitPct || 0), 0);
  const totalRounded = round1(totalSplit);

  const updateSplit = (id: string, newSplit: number) => {
    const updated = assetBuckets.map((b) =>
      b.id === id ? { ...b, monthlySplitPct: Math.max(0, Math.min(100, round1(newSplit))) } : b
    );
    onChange(updated);
  };

  const handleAutoBalance = () => {
    if (totalSplit === 0) {
      // Default balanced split
      const def = [
        { id: 'psx-dividends', pct: 40 },
        { id: 'gold', pct: 20 },
        { id: 'real-estate', pct: 20 },
        { id: 'money-market', pct: 15 },
        { id: 'cash', pct: 5 },
      ];
      const balanced = assetBuckets.map((b) => {
        const found = def.find((d) => d.id === b.id);
        return { ...b, monthlySplitPct: found ? found.pct : 20 };
      });
      onChange(balanced);
      return;
    }

    // Pro-rata normalization at 0.1 precision (was integer rounding)
    let runningSum = 0;
    const normalized = assetBuckets.map((b, idx) => {
      if (idx === assetBuckets.length - 1) {
        return { ...b, monthlySplitPct: Math.max(0, round1(100 - runningSum)) };
      }
      const p = round1((b.monthlySplitPct / totalSplit) * 100);
      runningSum = round1(runningSum + p);
      return { ...b, monthlySplitPct: p };
    });

    onChange(normalized);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Multi-Asset Monthly Split</span>
        </label>

        <div className="flex items-center gap-2">
          {totalRounded !== 100 && (
            <button
              type="button"
              onClick={handleAutoBalance}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold transition-all"
            >
              <Wand2 className="w-2.5 h-2.5" />
              <span>Auto-Balance 100%</span>
            </button>
          )}

          <span
            className={`font-mono text-[11px] font-bold ${
              totalRounded === 100 ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            Total: {fmtPct(totalRounded)}%
          </span>
        </div>
      </div>

      <div className="space-y-2.5">
        {assetBuckets.map((bucket) => {
          const Icon = BUCKET_ICONS[bucket.id] || Layers;

          return (
            <div
              key={bucket.id}
              className="p-2.5 rounded-xl bg-[#0C0C0F] border border-white/5 space-y-1.5"
            >
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Icon className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-zinc-200 font-medium">{bucket.label}</span>
                </div>
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-[10px] text-zinc-500">
                    Exp: {bucket.expectedAnnualReturnPct}%
                  </span>
                  <span className="flex items-center gap-0.5">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={bucket.monthlySplitPct}
                      onChange={(e) => updateSplit(bucket.id, Number(e.target.value))}
                      className="w-[52px] bg-transparent font-bold text-white text-xs text-right focus:outline-none focus:border-b focus:border-emerald-500"
                      aria-label={`${bucket.label} split percent`}
                    />
                    <span className="font-bold text-white text-xs">%</span>
                  </span>
                </div>
              </div>

              <input
                type="range"
                min={0}
                max={100}
                step={0.1}
                value={bucket.monthlySplitPct}
                onChange={(e) => updateSplit(bucket.id, Number(e.target.value))}
                className="w-full h-1.5 bg-black/[0.05] rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
