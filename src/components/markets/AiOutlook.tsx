'use client';

import React, { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useAiAssist } from '@/components/providers/AiAssistProvider';
import type { PredictionResult } from '@/lib/aiPredictions';

/**
 * AiOutlook — per-stock AI forecast panel (NOTES #29).
 * Shows a predicted 12-month price RANGE next to the stock's real
 * stamped close. It is a forecast, clearly labelled as an AI estimate —
 * it never replaces or edits the seeded market data (Gate 2 / Gate 6
 * Amendment 3).
 */

interface AiOutlookProps {
  ticker: string;
  companyName: string;
  currentPrice: number;
}

export function AiOutlook({ ticker, companyName, currentPrice }: AiOutlookProps) {
  const { aiOn, predict } = useAiAssist();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(PredictionResult & { model?: string }) | null>(null);
  const [failed, setFailed] = useState(false);

  if (!aiOn) return null;

  const run = async () => {
    setLoading(true);
    setFailed(false);
    const r = await predict('stock-outlook', { ticker, companyName, currentPrice });
    setLoading(false);
    if (r) setResult(r);
    else setFailed(true);
  };

  const fmt = (v: number) => `Rs ${v.toLocaleString('en-PK')}`;

  return (
    <div className="p-4 rounded-xl bg-amber-500/[0.04] border border-amber-500/20 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          AI 12-Month Outlook
          {result?.model && (
            <span className="text-zinc-500 normal-case font-medium">
              · {result.model.includes('qwen') ? 'Qwen 3.8 27B' : 'GPT-OSS 120B'}
            </span>
          )}
        </span>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold transition-all disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
          <span>{result ? 'Re-predict' : 'Predict'}</span>
        </button>
      </div>

      {!result && !loading && !failed && (
        <p className="text-[11px] text-zinc-500">
          Ask AI for a forecast range for {ticker} over the next 12 months, based on the current price of {fmt(currentPrice)}.
        </p>
      )}
      {loading && <p className="text-[11px] text-zinc-400">Forecasting…</p>}
      {failed && (
        <p className="text-[11px] text-zinc-400">AI is unavailable right now — the stamped market data above is unaffected.</p>
      )}
      {result && (
        <>
          <div className="font-mono font-extrabold text-base text-white">
            {result.valueHigh !== undefined
              ? `${fmt(result.value)} – ${fmt(result.valueHigh)}`
              : fmt(result.value)}
            <span
              className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide align-middle whitespace-nowrap ${
                result.confidence === 'high'
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : result.confidence === 'low'
                  ? 'bg-rose-500/15 text-rose-300'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {result.confidence} confidence
            </span>
          </div>
          <p className="text-[11px] text-zinc-400 leading-relaxed">{result.reasoning}</p>
          <p className="text-[10px] text-zinc-600">
            AI forecast — an estimate, not live data and not investment advice. The real stamped close stays the price of record.
          </p>
        </>
      )}
    </div>
  );
}
