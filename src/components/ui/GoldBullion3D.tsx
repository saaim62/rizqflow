'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Flame, ShieldCheck, Sparkles } from 'lucide-react';

interface GoldBullion3DProps {
  currentPrice: number;
  streakDays: number;
  drawdownPct: number;
}

export function GoldBullion3D({
  currentPrice,
  streakDays,
  drawdownPct,
}: GoldBullion3DProps) {
  const barRef = useRef<HTMLDivElement>(null);
  const [rotate, setRotate] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [shinePos, setShinePos] = useState<number>(50);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rX = ((y - centerY) / centerY) * -12;
    const rY = ((x - centerX) / centerX) * 12;

    setRotate({ x: rX, y: rY });
    setShinePos((x / rect.width) * 100);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setRotate({ x: 0, y: 0 });
    setShinePos(50);
  }, []);

  return (
    <div
      ref={barRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative w-full max-w-md mx-auto py-4 cursor-pointer select-none perspective-1200"
    >
      {/* 3D Gold Ingot Structure */}
      <div
        style={{
          transform: `perspective(1200px) rotateX(${rotate.x.toFixed(2)}deg) rotateY(${rotate.y.toFixed(2)}deg)`,
          transition: 'transform 0.15s ease-out',
        }}
        className="relative mx-auto w-full aspect-[2.4/1] rounded-2xl preserve-3d shadow-[0_25px_50px_-12px_rgba(245,158,11,0.25)] border border-amber-400/40"
      >
        {/* Main Front Face with Brushed Gold Gradient */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden flex flex-col justify-between p-5 border border-amber-300/40"
          style={{
            background: `linear-gradient(135deg, 
              #B45309 0%, 
              #D97706 18%, 
              #FBBF24 40%, 
              #FFFBEB 50%, 
              #D4AF37 62%, 
              #B45309 85%, 
              #78350F 100%)`,
          }}
        >
          {/* Moving Specular Sheen Layer */}
          <div
            className="absolute inset-0 pointer-events-none opacity-40 mix-blend-overlay transition-all duration-150"
            style={{
              background: `radial-gradient(ellipse at ${shinePos}% 30%, rgba(255,255,255,0.9), transparent 60%)`,
            }}
          />

          {/* Top Ingot Stamp Header */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#FFFFFF] backdrop-blur-sm border border-black/20 text-amber-950 font-bold text-[10px] tracking-widest uppercase">
              <Sparkles className="w-3 h-3 text-amber-900" />
              <span>SARAFA KARACHI</span>
            </div>
            <span className="font-mono text-[10px] font-bold text-amber-950/80 tracking-widest">
              RF-24K-2026
            </span>
          </div>

          {/* Center Ingot Hallmark */}
          <div className="relative z-10 text-center my-auto space-y-0.5">
            <div className="text-xl sm:text-2xl font-black tracking-widest text-amber-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.6)] font-mono">
              999.9 FINE GOLD
            </div>
            <div className="text-xs font-bold text-amber-900/90 tracking-widest uppercase">
              1 TOLA · 11.664 GRAMS
            </div>
          </div>

          {/* Bottom Ingot Stamp Footer */}
          <div className="relative z-10 flex items-center justify-between text-amber-950 text-[10px] font-bold font-mono">
            <span>OFFICIAL SPOT BENCHMARK</span>
            <span className="px-1.5 py-0.5 rounded bg-black/[0.04] border border-black/10">
              HALLMARKED
            </span>
          </div>
        </div>
      </div>

      {/* Floating Spotlight Indicators under Gold Bar */}
      <div className="flex items-center justify-center gap-3 mt-4 text-xs font-mono">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30 font-semibold shadow-sm shadow-rose-500/10">
          <Flame className="w-3.5 h-3.5 text-rose-400" />
          <span>▼ {streakDays}d Dip Zone</span>
        </span>
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
          <span>{drawdownPct.toFixed(1)}% off Peak</span>
        </span>
      </div>
    </div>
  );
}
