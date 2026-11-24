'use client';

import React, { useEffect, useState } from 'react';
import { MetalAsset } from '@/types';
import { DATA_AS_OF_SHORT } from '@/data/marketData';
import { useMarketSnapshot } from '@/lib/useMarketSnapshot';
import { useProfile } from '@/components/providers/ProfileProvider';
import { maskAmount } from '@/lib/format';

/**
 * LivePulse — the platform's heartbeat strip.
 * The trace is the REAL 30-day gold close series (a bright segment travels
 * along it); the genuinely live elements are the sync state: the app
 * re-syncs with /api/market-snapshot hourly, and this strip counts down
 * to the next sync in real time. No simulated price ticks — PSX/Sarafa
 * publish daily, and the strip says so.
 */
export function LivePulse({ gold }: { gold: MetalAsset }) {
  const snap = useMarketSnapshot();
  const { hideAmounts } = useProfile();
  const [now, setNow] = useState(0);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const history = gold.history;
  const W = 560;
  const H = 38;
  const prices = history.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const points = history
    .map((d, i) => `${((i / (history.length - 1)) * W).toFixed(1)},${(H - 4 - ((d.price - min) / range) * (H - 8)).toFixed(1)}`)
    .join(' ');
  const path = `M${points.replaceAll(' ', ' L')}`;

  const nextSyncMs = snap.updatedAt ? snap.updatedAt + 3600_000 - now : null;
  const countdown =
    nextSyncMs !== null && nextSyncMs > 0
      ? `${String(Math.floor(nextSyncMs / 60000)).padStart(2, '0')}:${String(Math.floor((nextSyncMs % 60000) / 1000)).padStart(2, '0')}`
      : 'due now';

  return (
    <div className="border-b border-white/[0.06] bg-[#0A0A0C]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-3 sm:gap-5 flex-wrap">
        <span className="flex items-center gap-2 shrink-0">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E8C15A] opacity-60" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#E8C15A]" />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#E8C15A]">Live Sync</span>
        </span>

        <svg viewBox={`0 0 ${W} ${H}`} className="flex-1 min-w-[180px] h-[30px]" preserveAspectRatio="none" aria-hidden="true">
          <path d={path} fill="none" stroke="rgba(245,241,230,0.16)" strokeWidth="1.4" />
          <path
            d={path}
            fill="none"
            stroke="#E8C15A"
            strokeWidth="2"
            pathLength={100}
            strokeDasharray="16 84"
            className="pulse-travel"
            style={{ filter: 'drop-shadow(0 0 5px rgba(232,193,90,0.8))' }}
          />
        </svg>

        <div className="hidden md:flex items-center gap-4 font-mono text-[11px] shrink-0">
          <span className="text-zinc-500">GOLD <span className="text-white font-bold">{maskAmount(`Rs ${snap.rates.goldPerTolaPkr.toLocaleString('en-PK')}`, hideAmounts)}</span></span>
          <span className="text-zinc-500">KSE-100 <span className="text-white font-bold">{maskAmount(snap.rates.kse100Index.toLocaleString('en-PK', { maximumFractionDigits: 0 }), hideAmounts)}</span></span>
          <span className="text-zinc-500">USD <span className="text-[#E8C15A] font-bold">{maskAmount(`Rs ${snap.rates.usdToPkr}`, hideAmounts)}</span></span>
        </div>

        <span className="font-mono text-[10px] text-zinc-500 shrink-0 ml-auto">
          next sync <span className="text-zinc-300">{countdown}</span>
          <span className="hidden lg:inline"> · trace = real 30-day gold closes, data as of {DATA_AS_OF_SHORT}</span>
        </span>
      </div>
    </div>
  );
}
