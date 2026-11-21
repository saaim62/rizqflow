'use client';

import React, { useState, useEffect } from 'react';
import { PricePoint } from '@/types';

interface SparklineProps {
  data: PricePoint[];
  color?: 'emerald' | 'rose' | 'amber' | 'gold';
  height?: number;
  width?: number | string;
  strokeWidth?: number;
}

export function Sparkline({
  data,
  color,
  height = 36,
  strokeWidth = 2,
}: SparklineProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!data || data.length < 2) {
    return <div style={{ height }} className="w-full bg-white/[0.02] rounded" />;
  }

  // Determine trend if color not specified
  const firstPrice = data[0].price;
  const lastPrice = data[data.length - 1].price;
  const isUp = lastPrice >= firstPrice;
  const strokeColor =
    color === 'gold' || color === 'amber'
      ? '#F59E0B'
      : color === 'rose'
      ? '#F43F5E'
      : color === 'emerald'
      ? '#10B981'
      : isUp
      ? '#10B981'
      : '#F43F5E';

  if (!mounted) {
    return <div style={{ height }} className="w-full" />;
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const w = 120;
  const h = height;
  const padding = 3;

  const points = data
    .map((d, index) => {
      const x = padding + (index / (data.length - 1)) * (w - 2 * padding);
      const y = h - padding - ((d.price - min) / range) * (h - 2 * padding);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPoints = `${points} ${w - padding},${h} ${padding},${h}`;
  const gradientId = `sparkline-grad-${Math.random().toString(36).substring(2, 9)}`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full overflow-visible"
      style={{ height }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.25} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <polygon fill={`url(#${gradientId})`} points={areaPoints} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}
