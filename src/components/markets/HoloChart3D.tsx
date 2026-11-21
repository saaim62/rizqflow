'use client';

import React from 'react';
import { PricePoint } from '@/types';
import { DATA_AS_OF_SHORT } from '@/data/marketData';

/**
 * HoloChart3D — a holographic 3D rendering of the REAL gold series.
 * The price plane floats tilted in space (CSS 3D), the area is extruded
 * in stacked layers, light pillars rise from the peak and the current
 * point, and a scanner sweep crosses the plane. Every coordinate is
 * computed from the stamped closes — the hologram is a visualization of
 * real data, not a simulation.
 */
export function HoloChart3D({ data }: { data: PricePoint[] }) {
  const W = 840;
  const H = 300;
  const PAD = 26;
  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;
  const x = (i: number) => PAD + (i / (data.length - 1)) * (W - PAD * 2);
  const y = (p: number) => H - PAD - ((p - min) / range) * (H - PAD * 2);

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.price).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${H - 4} L${x(0).toFixed(1)},${H - 4} Z`;

  const peakIdx = prices.indexOf(max);
  const lastIdx = data.length - 1;
  const fmtDate = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-PK', { day: 'numeric', month: 'short' });
  const rs = (n: number) => `Rs ${n.toLocaleString('en-PK')}`;

  // floor grid: horizontal rules across the plane
  const gridYs = [0.25, 0.5, 0.75].map((f) => PAD + f * (H - PAD * 2));

  return (
    <div className="glass-panel relative rounded-3xl p-5 sm:p-7 overflow-visible">
      <div className="flex items-start justify-between gap-3 flex-wrap relative z-20">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#E8C15A]">
            Holographic Terminal
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
            24K Gold — 30-Day Price Plane
          </h3>
        </div>
        <span className="text-[10px] font-mono text-zinc-400 border border-white/10 rounded-full px-2.5 py-1">
          Real closes · Data as of {DATA_AS_OF_SHORT}
        </span>
      </div>

      {/* stage */}
      <div className="holo-stage relative h-[320px] sm:h-[360px] mt-2">
        {/* base glow */}
        <div className="absolute left-[8%] right-[8%] bottom-2 h-16 rounded-[100%] bg-[#D9A521]/10 blur-2xl pointer-events-none" />

        {/* tilted plane */}
        <div className="holo-plane absolute inset-x-2 top-4 bottom-8">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="holoArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#E8C15A" stopOpacity="0.32" />
                <stop offset="100%" stopColor="#D9A521" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="holoPillar" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#E8C15A" stopOpacity="0.65" />
                <stop offset="100%" stopColor="#E8C15A" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* floor grid */}
            {gridYs.map((gy) => (
              <line key={gy} x1={PAD} y1={gy} x2={W - PAD} y2={gy} stroke="rgba(232,193,90,0.09)" strokeWidth="1" />
            ))}
            {data.map((_, i) =>
              i % 5 === 0 ? (
                <line key={i} x1={x(i)} y1={PAD} x2={x(i)} y2={H - PAD} stroke="rgba(255,255,255,0.045)" strokeWidth="1" />
              ) : null
            )}

            {/* extrusion layers (depth) */}
            <path d={area} transform="translate(0,16)" fill="#D9A521" opacity="0.05" />
            <path d={area} transform="translate(0,10)" fill="#D9A521" opacity="0.07" />
            <path d={area} transform="translate(0,5)" fill="#D9A521" opacity="0.09" />

            {/* main area + line */}
            <path d={area} fill="url(#holoArea)" />
            <path
              d={line}
              fill="none"
              stroke="#E8C15A"
              strokeWidth="2.6"
              strokeLinejoin="round"
              strokeLinecap="round"
              style={{ filter: 'drop-shadow(0 0 7px rgba(232,193,90,0.75))' }}
            />

            {/* light pillars: peak + current */}
            <line x1={x(peakIdx)} y1={y(max)} x2={x(peakIdx)} y2={y(max) - 74} stroke="url(#holoPillar)" strokeWidth="2" />
            <line x1={x(lastIdx)} y1={y(prices[lastIdx])} x2={x(lastIdx)} y2={y(prices[lastIdx]) - 74} stroke="url(#holoPillar)" strokeWidth="2" />

            {/* points */}
            <circle cx={x(peakIdx)} cy={y(max)} r="4.5" fill="#F7E08C" stroke="#A87F16" strokeWidth="1.5" />
            <circle cx={x(lastIdx)} cy={y(prices[lastIdx])} r="5" fill="#E8C15A" stroke="#F7E08C" strokeWidth="1.5" />
          </svg>

          {/* scanner sweep */}
          <div className="holo-sweep pointer-events-none absolute top-0 bottom-0 w-16 bg-gradient-to-r from-transparent via-[#E8C15A]/14 to-transparent blur-[3px]" />
        </div>

        {/* floating readouts (stay level while the plane tilts) */}
        <div className="absolute left-1 sm:left-6 top-1 z-20 animate-float-slow">
          <div className="rounded-xl bg-black/55 backdrop-blur-md border border-[#D9A521]/30 px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]">
            <div className="text-[9px] uppercase tracking-[0.16em] text-zinc-400 font-semibold">30-day peak · {fmtDate(data[peakIdx].date)}</div>
            <div className="font-mono font-bold text-[#F7E08C] text-sm">{rs(max)}</div>
          </div>
        </div>
        <div className="absolute right-1 sm:right-6 bottom-3 z-20 animate-float-slow" style={{ animationDelay: '-3.2s' }}>
          <div className="rounded-xl bg-black/55 backdrop-blur-md border border-[#D9A521]/30 px-3 py-2 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.9)]">
            <div className="text-[9px] uppercase tracking-[0.16em] text-zinc-400 font-semibold">Now · {fmtDate(data[lastIdx].date)}</div>
            <div className="font-mono font-bold text-white text-sm">{rs(prices[lastIdx])} <span className="text-rose-400 text-xs">▼ {(((prices[lastIdx] - max) / max) * 100).toFixed(1)}%</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
