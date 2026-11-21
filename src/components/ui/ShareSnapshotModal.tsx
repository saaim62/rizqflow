'use client';

import React, { useRef, useState, useEffect } from 'react';
import { PlanSummary, UserProfile } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Download, X, Sparkles, Share2, Check } from 'lucide-react';

interface ShareSnapshotModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: PlanSummary;
  profile: UserProfile;
}

export function ShareSnapshotModal({
  isOpen,
  onClose,
  plan,
  profile,
}: ShareSnapshotModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { hideAmounts } = useProfile();
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dimensions: 1200 x 630 (Standard OpenGraph card size)
    canvas.width = 1200;
    canvas.height = 630;

    // 1. Background Obsidian Void
    const bgGrad = ctx.createLinearGradient(0, 0, 1200, 630);
    bgGrad.addColorStop(0, '#07060E');
    bgGrad.addColorStop(0.5, '#0B0D15');
    bgGrad.addColorStop(1, '#05070D');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1200, 630);

    // 2. Ambient Volumetric Glow Orbs
    const orb1 = ctx.createRadialGradient(250, 150, 10, 250, 150, 350);
    orb1.addColorStop(0, 'rgba(212, 175, 55, 0.18)');
    orb1.addColorStop(1, 'transparent');
    ctx.fillStyle = orb1;
    ctx.fillRect(0, 0, 1200, 630);

    const orb2 = ctx.createRadialGradient(950, 480, 10, 950, 480, 400);
    orb2.addColorStop(0, 'rgba(212, 175, 55, 0.15)');
    orb2.addColorStop(1, 'transparent');
    ctx.fillStyle = orb2;
    ctx.fillRect(0, 0, 1200, 630);

    // 3. Subtle Outer Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, 1160, 590);

    // 4. Header Wordmark
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 36px -apple-system, sans-serif';
    ctx.fillText('Rizq', 60, 85);
    ctx.fillStyle = '#D4AF37';
    ctx.fillText('Flow', 135, 85);

    // Tagline / Market Badge
    ctx.fillStyle = '#A8A294';
    ctx.font = 'bold 16px -apple-system, sans-serif';
    ctx.fillText('PAKISTAN PSX & SARAFA FINANCIAL FREEDOM BLUEPRINT', 230, 80);

    // Separator Line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.moveTo(60, 115);
    ctx.lineTo(1140, 115);
    ctx.stroke();

    // 5. Freedom Milestone Banner
    ctx.fillStyle = '#FFFFFF';
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.35)';
    ctx.lineWidth = 1.5;
    ctx.roundRect(60, 145, 1080, 140, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('DIVIDEND FREEDOM MILESTONE', 90, 185);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 42px -apple-system, sans-serif';
    ctx.fillText(plan.freedomDateLabel, 90, 240);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 18px monospace';
    const ageText = plan.freedomAge ? `Achieved at Age ${plan.freedomAge}` : 'Lifetime Compounder';
    ctx.fillText(ageText, 850, 240);

    // 6. Metric Bento Boxes (3 Columns)
    // Box 1: Today's Real Wealth
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.roundRect(60, 310, 340, 160, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#A8A294';
    ctx.font = 'bold 14px monospace';
    ctx.fillText("TODAY'S PURCHASING POWER", 85, 345);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 34px monospace';
    const realText = hideAmounts
      ? 'Rs •••••'
      : `Rs ${(plan.finalRealTodaysPkr / 100000).toFixed(1)} Lac`;
    ctx.fillText(realText, 85, 400);

    ctx.fillStyle = '#7D7769';
    ctx.font = '13px monospace';
    ctx.fillText(`Target Age: ${profile.retirementAge || 60} (${Math.max(1, (profile.retirementAge || 60) - profile.age)} yrs)`, 85, 435);

    // Box 2: Monthly Net Dividends
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.roundRect(430, 310, 340, 160, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#A8A294';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('MONTHLY NET DIVIDEND', 455, 345);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 34px monospace';
    const divText = hideAmounts
      ? 'Rs •••••'
      : `Rs ${Math.round(plan.initialMonthlyNetDividendPkr).toLocaleString('en-PK')}/mo`;
    ctx.fillText(divText, 455, 400);

    ctx.fillStyle = '#7D7769';
    ctx.font = '13px monospace';
    ctx.fillText(`Net of ${plan.taxRatePct}% FBR Section 150 WHT`, 455, 435);

    // Box 3: Gold & USD Equivalent
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.roundRect(800, 310, 340, 160, 14);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#A8A294';
    ctx.font = 'bold 14px monospace';
    ctx.fillText('HEDGE CONVERSIONS', 825, 345);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 28px monospace';
    const goldText = hideAmounts ? '••••• tolas' : `${Math.round(plan.finalWealthGoldTolas)} Tolas Gold`;
    ctx.fillText(goldText, 825, 395);

    ctx.fillStyle = '#C4B797';
    ctx.font = 'bold 20px monospace';
    const usdText = hideAmounts ? '$ •••••' : `$ ${(plan.finalWealthUsd / 1000).toFixed(0)}k USD Value`;
    ctx.fillText(usdText, 825, 435);

    // 7. Footer Seal & Disclaimer
    ctx.fillStyle = '#5C574D';
    ctx.font = '12px -apple-system, sans-serif';
    ctx.fillText('Verified with RizqFlow Client Engine • 100% Client-Side Privacy • SECP Non-Advisory Simulation', 60, 560);

    ctx.fillStyle = '#D4AF37';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('Bismillah for Halal Barakah', 950, 560);

    setDownloadUrl(canvas.toDataURL('image/png'));
  }, [isOpen, plan, profile, hideAmounts]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl bg-[#12101F] border border-white/15 rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-lg text-white">
              Cinematic Freedom Blueprint Snapshot
            </h3>
            {hideAmounts && (
              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono">
                Privacy Mode Active (Masked)
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Canvas Preview Container */}
        <div className="w-full rounded-xl overflow-hidden border border-white/10 shadow-2xl bg-black">
          <canvas ref={canvasRef} className="w-full h-auto block" />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-xs text-zinc-400">
            Generated client-side via HTML5 Canvas. No data uploaded to servers.
          </p>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold"
            >
              Close
            </button>
            {downloadUrl && (
              <a
                href={downloadUrl}
                download="RizqFlow-Freedom-Blueprint.png"
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs shadow-lg shadow-emerald-500/25 transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Download PNG Snapshot</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
