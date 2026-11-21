'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';

interface AnimatedNumberProps {
  value: number;
  prefix?: string;
  suffix?: string;
  durationMs?: number;
  decimals?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  prefix = '',
  suffix = '',
  durationMs = 400,
  decimals = 0,
  className = '',
}: AnimatedNumberProps) {
  const { hideAmounts } = useProfile();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const startValRef = useRef<number>(value);
  const startTimeRef = useRef<number | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (hideAmounts) return;

    startValRef.current = displayValue;
    startTimeRef.current = null;

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(1, elapsed / durationMs);

      // Ease-out cubic curve
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startValRef.current + (value - startValRef.current) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [value, durationMs, hideAmounts]);

  if (hideAmounts) {
    return <span className={className}>{prefix}•••••{suffix}</span>;
  }

  const formattedNum =
    decimals > 0
      ? displayValue.toLocaleString('en-US', {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : Math.round(displayValue).toLocaleString('en-US');

  return (
    <span className={`tabular-nums ${className}`}>
      {prefix}
      {formattedNum}
      {suffix}
    </span>
  );
}
