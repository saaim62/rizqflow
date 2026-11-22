'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import type { PredictionResult, PredictionType } from '@/lib/aiPredictions';
import { useAiAssist } from '@/components/providers/AiAssistProvider';

/**
 * AiButton — the per-field AI prediction control (NOTES #27).
 * Sits beside a field's label; on click it asks the server for a
 * prediction for THAT field only and shows it in a small panel: value,
 * one-line reasoning, confidence. "Use this value" fills the field via
 * onAccept; the user can always type over it afterwards. When the
 * field's current value is exactly the last accepted AI value, the
 * button turns gold so AI-filled values are recognisable.
 */

interface AiButtonProps {
  type: PredictionType;
  context: Record<string, unknown>;
  currentValue?: number;
  onAccept: (value: number, result: PredictionResult) => void;
  formatValue?: (n: number) => string;
}

function modelShort(model?: string): string {
  if (!model) return 'AI';
  if (model.includes('gpt-oss-120b')) return 'GPT-OSS 120B';
  if (model.includes('qwen')) return 'Qwen 3.8 27B';
  return model;
}

export function AiButton({ type, context, currentValue, onAccept, formatValue }: AiButtonProps) {
  const { aiOn, predict } = useAiAssist();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<(PredictionResult & { model?: string }) | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [acceptedValue, setAcceptedValue] = useState<number | undefined>(undefined);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isAiValue = acceptedValue !== undefined && currentValue === acceptedValue;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('resize', close);
    // The panel is fixed-position: close it on any scroll so it never
    // floats detached over neighbouring cards (QA finding, NOTES #30).
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [open ]);

  if (!aiOn) return null;

  const fmt = formatValue ?? ((v: number) => Math.round(v).toLocaleString('en-US'));

  const handleClick = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      setPos({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - 264, window.innerWidth - 272)),
      });
    }
    setOpen(true);
    if (result || loading) return;
    setLoading(true);
    setFailed(false);
    const r = await predict(type, context);
    setLoading(false);
    if (r) setResult(r);
    else setFailed(true);
  };

  const accept = () => {
    if (!result) return;
    onAccept(result.value, result);
    setAcceptedValue(result.value);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleClick}
        title={isAiValue ? 'AI-filled value — click to re-predict' : 'Predict this value with AI'}
        className={`relative inline-flex items-center justify-center w-5 h-5 rounded-md border transition-all shrink-0 ${
          isAiValue
            ? 'bg-amber-400 text-black border-amber-300'
            : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/25'
        }`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
        {isAiValue && (
          <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-300 border border-black" />
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-[79]" onClick={() => setOpen(false)} />
          <div
            className="fixed z-[80] w-[264px] rounded-xl bg-[#17171A] border border-amber-500/30 shadow-2xl shadow-black/60 p-3 space-y-2"
            style={{ top: pos.top, left: pos.left }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold tracking-widest text-amber-400 uppercase">
                {result?.source === 'sourced'
                  ? `Sourced Data${result.sourceNote ? ` · ${result.sourceNote}` : ''}`
                  : `AI Estimate${result ? ` · ${modelShort(result.model)}` : ''}`}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-zinc-500 hover:text-white"
                aria-label="Close AI suggestion"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {loading && (
              <p className="text-xs text-zinc-400 flex items-center gap-2 py-1">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" /> Predicting…
              </p>
            )}

            {!loading && failed && (
              <p className="text-xs text-zinc-400 leading-relaxed">
                AI is unavailable right now — enter the value manually.
              </p>
            )}

            {!loading && result && (
              <>
                <div className="font-mono font-extrabold text-lg text-white leading-none">
                  {result.valueHigh !== undefined
                    ? `${fmt(result.value)} – ${fmt(result.valueHigh)}`
                    : fmt(result.value)}
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">{result.reasoning}</p>
                <div className="flex items-center justify-between pt-1">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide whitespace-nowrap ${
                      result.confidence === 'high'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : result.confidence === 'low'
                        ? 'bg-rose-500/15 text-rose-300'
                        : 'bg-amber-500/15 text-amber-300'
                    }`}
                  >
                    {result.confidence} confidence
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="px-2 py-1 rounded-lg bg-white/[0.05] hover:bg-white/10 text-zinc-300 border border-white/10 text-[11px] font-bold"
                    >
                      Dismiss
                    </button>
                    <button
                      type="button"
                      onClick={accept}
                      className="px-2 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-black text-[11px] font-bold"
                    >
                      Use this value
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </>
  );
}
