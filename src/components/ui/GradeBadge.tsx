'use client';

import React from 'react';
import { StockGrade } from '@/types';
import { ShieldCheck, AlertTriangle, Moon } from 'lucide-react';

interface GradeBadgeProps {
  grade: StockGrade;
  showLabel?: boolean;
}

export function GradeBadge({ grade, showLabel = true }: GradeBadgeProps) {
  if (grade === 'A') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 text-[11px] font-semibold tracking-wide">
        <ShieldCheck className="w-3 h-3 text-emerald-400" />
        <span>Grade A{showLabel ? ' Safe Core' : ''}</span>
      </span>
    );
  }

  if (grade === 'B') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[11px] font-semibold tracking-wide">
        <AlertTriangle className="w-3 h-3 text-amber-400" />
        <span>Grade B{showLabel ? ' Cyclical' : ''}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30 text-[11px] font-bold tracking-wide">
      <AlertTriangle className="w-3 h-3 text-rose-400" />
      <span>Grade C{showLabel ? ' Yield Trap' : ''}</span>
    </span>
  );
}

export function ShariahBadge({ isShariah }: { isShariah: boolean }) {
  if (!isShariah) {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-white/5 text-[10px] font-medium">
        Conventional
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/25 text-[10px] font-semibold tracking-wide">
      <Moon className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
      <span>Shariah (KMI)</span>
    </span>
  );
}
