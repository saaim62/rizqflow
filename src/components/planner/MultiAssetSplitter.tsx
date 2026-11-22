'use client';

import React, { useState } from 'react';
import { AssetBucket } from '@/types';
import { Layers, PieChart, Coins, Home, Landmark, Wallet, Wand2, Sparkles, Loader2 } from 'lucide-react';
import { AiButton } from '@/components/ui/AiButton';
import { FieldInfo } from '@/components/ui/FieldInfo';
import { useAiAssist } from '@/components/providers/AiAssistProvider';
import { useProfile } from '@/components/providers/ProfileProvider';

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

export function autoBalanceBuckets<T extends { id: string; monthlySplitPct: number }>(
  buckets: T[]
): T[] {
  const total = buckets.reduce((acc, b) => acc + (b.monthlySplitPct ?? 0), 0);
  if (total === 0) {
    const def = [
      { id: 'psx-dividends', pct: 40 },
      { id: 'gold', pct: 20 },
      { id: 'real-estate', pct: 20 },
      { id: 'money-market', pct: 15 },
      { id: 'cash', pct: 5 },
    ];
    return buckets.map((b) => {
      const found = def.find((d) => d.id === b.id);
      return { ...b, monthlySplitPct: found ? found.pct : 20 };
    });
  }

  // Calculate rounded 0.1% shares
  const rawShares = buckets.map((b) => round1(((b.monthlySplitPct ?? 0) / total) * 100));
  const sum = round1(rawShares.reduce((acc, v) => acc + v, 0));
  const remainder = round1(100.0 - sum);

  if (remainder !== 0 && rawShares.length > 0) {
    // Find index of largest bucket to absorb rounding remainder
    let largestIdx = 0;
    let maxVal = rawShares[0];
    for (let i = 1; i < rawShares.length; i++) {
      if (rawShares[i] > maxVal) {
        maxVal = rawShares[i];
        largestIdx = i;
      }
    }
    rawShares[largestIdx] = round1(rawShares[largestIdx] + remainder);
  }

  return buckets.map((b, i) => ({
    ...b,
    monthlySplitPct: rawShares[i],
  }));
}

export function MultiAssetSplitter({ assetBuckets, onChange }: MultiAssetSplitterProps) {
  const { aiOn, predict } = useAiAssist();
  const { showToast } = useProfile();
  const [fillingReturns, setFillingReturns] = useState(false);
  const totalSplit = assetBuckets.reduce((acc, b) => acc + (b.monthlySplitPct ?? 0), 0);
  const totalRounded = round1(totalSplit);

  const updateReturn = (id: string, newReturn: number) => {
    onChange(
      assetBuckets.map((b) =>
        b.id === id
          ? { ...b, expectedAnnualReturnPct: Math.max(0, Math.min(30, round1(newReturn))) }
          : b
      )
    );
  };

  /** AI Fill: predict every bucket's expected return in parallel, apply at once. */
  const aiFillReturns = async () => {
    setFillingReturns(true);
    try {
      const results = await Promise.all(
        assetBuckets.map((b) =>
          predict('bucket-return', { bucketId: b.id, bucketLabel: b.label, currentReturnPct: b.expectedAnnualReturnPct })
        )
      );
      onChange(
        assetBuckets.map((b, i) => {
          const r = results[i];
          return r ? { ...b, expectedAnnualReturnPct: r.value } : b;
        })
      );
    } catch (err) {
      showToast('Could not complete AI autofill for returns');
    } finally {
      setFillingReturns(false);
    }
  };

  const updateSplit = (id: string, newSplit: number) => {
    const updated = assetBuckets.map((b) =>
      b.id === id ? { ...b, monthlySplitPct: Math.max(0, Math.min(100, round1(newSplit))) } : b
    );
    onChange(updated);
  };

  const handleAutoBalance = () => {
    onChange(autoBalanceBuckets(assetBuckets));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Multi-Asset Monthly Split</span>
        </label>

        <div className="flex items-center gap-2">
          {aiOn && (
            <button
              type="button"
              onClick={aiFillReturns}
              disabled={fillingReturns}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold transition-all disabled:opacity-60"
              title="Predict every bucket's expected return with AI"
            >
              {fillingReturns ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Sparkles className="w-2.5 h-2.5" />}
              <span>AI Fill Returns</span>
            </button>
          )}

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
                  <span className="flex items-center gap-0.5 text-[10px] text-zinc-500">
                    Exp:
                    <input
                      type="number"
                      min={0}
                      max={30}
                      step={0.1}
                      value={bucket.expectedAnnualReturnPct}
                      onChange={(e) => updateReturn(bucket.id, Number(e.target.value))}
                      className="w-[36px] bg-transparent text-zinc-300 text-[10px] text-right focus:outline-none focus:border-b focus:border-amber-500"
                      aria-label={`${bucket.label} expected annual return percent`}
                    />
                    %
                    <FieldInfo
                      title="Expected return — what it means"
                      text={`The average yearly growth you expect from this bucket over the long run — including dividends for PSX stocks.

It is a planning assumption, not a promise: the plan grows your savings at this rate. Small changes here make a big difference over 10+ years.`}
                    />
                    <AiButton
                      type="bucket-return"
                      context={{ bucketId: bucket.id, bucketLabel: bucket.label, currentReturnPct: bucket.expectedAnnualReturnPct }}
                      currentValue={bucket.expectedAnnualReturnPct}
                      onAccept={(val) => updateReturn(bucket.id, val)}
                      formatValue={(x) => `${x}%`}
                    />
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
                className="w-full h-1.5 bg-white/15 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
