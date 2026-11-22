'use client';

import React from 'react';
import { formatPkrWords } from '@/lib/format';

/**
 * AmountWords — the words line under a money input (NOTES #25).
 * While the user types a raw digit string like 10000000000, this spells
 * it underneath in Pakistani units ("10 Arab", "1 Crore 25 Lac",
 * "35 Lac 44 Thousand") so a missing or extra zero is obvious before
 * the value is saved. Renders nothing below Rs 1,000.
 */
export function AmountWords({ value, className }: { value: number; className?: string }) {
  const words = formatPkrWords(value ?? 0);
  if (!words) return null;
  return (
    <p className={`text-[10px] leading-tight text-amber-400/90 font-semibold mt-1 ${className ?? ''}`}>
      {words}
    </p>
  );
}
