'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  Calculator, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Moon, 
  Sparkles 
} from 'lucide-react';

export function QuickSimulator() {
  const { formatPkrMasked, formatCompactPkrMasked } = useProfile();
  const [lumpSum, setLumpSum] = useState<number>(3000000); // 30 Lac PKR default
  const [isFiler, setIsFiler] = useState<boolean>(true);
  const [isShariahOnly, setIsShariahOnly] = useState<boolean>(true);

  // Blended Gross Yield assumption for Grade A Safe Core (approx 8.2% for Shariah, 8.4% for General)
  const grossYield = isShariahOnly ? 0.082 : 0.084;
  const taxRate = isFiler ? 0.15 : 0.30;
  const netYield = grossYield * (1 - taxRate);

  const annualGrossDividend = lumpSum * grossYield;
  const annualTax = annualGrossDividend * taxRate;
  const annualNetDividend = annualGrossDividend - annualTax;
  const monthlyNetDividend = Math.round(annualNetDividend / 12);

  // What non-filer pays vs filer
  const filerTax = annualGrossDividend * 0.15;
  const nonFilerTax = annualGrossDividend * 0.30;
  const taxPenalty = Math.round((nonFilerTax - filerTax) / 12);

  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#11131A] via-[#11131A] to-[#0D1017] border border-white/[0.08] p-6 sm:p-8 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <Calculator className="w-4 h-4" />
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Instant Lump-Sum Dividend Simulator
            </h2>
            <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 text-xs font-semibold">
              Live Yield Engine
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            See how much monthly passive cash flow your capital generates in high-grade PSX dividend champions
          </p>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Shariah Toggle */}
          <button
            onClick={() => setIsShariahOnly(!isShariahOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isShariahOnly
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-sm'
                : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
            <span>{isShariahOnly ? 'Shariah (KMI-30)' : 'Conventional + Shariah'}</span>
          </button>

          {/* Filer Toggle */}
          <button
            onClick={() => setIsFiler(!isFiler)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
              isFiler
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-sm'
                : 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-sm'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{isFiler ? 'Filer (15% Tax)' : 'Non-Filer (30% Tax)'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
        {/* Left 7 cols: Slider and Quick Buttons */}
        <div className="lg:col-span-7 space-y-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs uppercase font-bold tracking-wider text-zinc-400">
                Investment Capital (PKR)
              </label>
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-white tabular-nums">
                {formatCompactPkrMasked(lumpSum)}
                <span className="text-xs font-normal text-zinc-400 ml-2">
                  ({formatPkrMasked(lumpSum)})
                </span>
              </span>
            </div>

            <input
              type="range"
              min={500000}
              max={10000000}
              step={250000}
              value={lumpSum}
              onChange={(e) => setLumpSum(Number(e.target.value))}
              className="w-full h-2.5 bg-black/60 rounded-lg appearance-none cursor-pointer accent-emerald-400 border border-white/10"
            />

            <div className="flex justify-between text-[11px] font-mono text-zinc-400 mt-2">
              <span>Rs 5 Lac</span>
              <span className="text-amber-400 font-semibold">Rs 30 Lac (Benchmark)</span>
              <span>Rs 60 Lac</span>
              <span>Rs 1 Crore</span>
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-400">Jump to:</span>
            {[
              { label: 'Rs 10 Lac', val: 1000000 },
              { label: 'Rs 30 Lac (Pakistani Core)', val: 3000000 },
              { label: 'Rs 50 Lac', val: 5000000 },
              { label: 'Rs 1 Crore', val: 10000000 },
            ].map((preset) => (
              <button
                key={preset.val}
                onClick={() => setLumpSum(preset.val)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  lumpSum === preset.val
                    ? 'bg-emerald-500 text-black font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-white/5 text-zinc-300 hover:bg-white/10 border border-white/5'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Real world context message */}
          <div className="p-4 rounded-xl bg-black/30 border border-white/[0.06] text-xs text-zinc-300 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4" />
              What this covers in Pakistan today:
            </div>
            <p className="leading-relaxed text-zinc-300">
              At <strong>{formatPkrMasked(monthlyNetDividend)}/month</strong> net passive income, 
              this portfolio covers {monthlyNetDividend >= 20000 ? 'your entire family grocery budget or monthly fuel' : 'your high-speed fiber internet and electric bills'}, 
              without you ever touching or selling your underlying shares!
            </p>
          </div>
        </div>

        {/* Right 5 cols: Result Bento Box */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl bg-black/40 border border-white/[0.08] p-5 sm:p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <span className="text-xs uppercase font-medium tracking-wider text-zinc-400">
                Estimated Net Cash Flow
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 font-mono tabular-nums mt-1">
                {formatPkrMasked(monthlyNetDividend)}
                <span className="text-sm font-normal text-zinc-400 ml-1.5">/ month</span>
              </div>
              <p className="text-xs text-zinc-400 mt-1">
                Net of 15% Filer WHT tax. Deposited directly via CDC e-dividend.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 font-mono text-xs">
              <div>
                <span className="text-zinc-400 block text-[11px]">Blended Gross Yield</span>
                <span className="font-bold text-white text-sm">{(grossYield * 100).toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Blended Net Yield</span>
                <span className="font-bold text-emerald-300 text-sm">{(netYield * 100).toFixed(2)}%</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">Annual Net Total</span>
                <span className="font-bold text-white text-sm">{formatPkrMasked(annualNetDividend)}</span>
              </div>
              <div>
                <span className="text-zinc-400 block text-[11px]">FBR WHT Rate</span>
                <span className={`font-bold text-sm ${isFiler ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {(taxRate * 100).toFixed(0)}%
                </span>
              </div>
            </div>

            {/* Non-filer penalty callout if non-filer selected */}
            {!isFiler && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Non-Filer Tax Shock:</strong> You are surrendering an extra <strong>{formatPkrMasked(taxPenalty)}/month</strong> ({formatPkrMasked(taxPenalty * 12)}/yr) to FBR!
                </span>
              </div>
            )}
          </div>

          <Link
            href={`/planner?lumpSum=${lumpSum}&taxStatus=${isFiler ? 'filer' : 'non-filer'}&shariah=${isShariahOnly}`}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 group"
          >
            <span>Model Full Life Plan with Goals & Car TCO</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
