'use client';

import React, { useState, useEffect } from 'react';
import { WealthTimelinePoint } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  AreaChart, 
  Area, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface SnowballChartProps {
  timeline: WealthTimelinePoint[];
}

export function SnowballChart({ timeline }: SnowballChartProps) {
  const [mounted, setMounted] = useState(false);
  const { formatCompactPkrMasked, formatPkrMasked } = useProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = timeline.map((pt) => ({
    year: `Yr ${pt.year}`,
    yearNum: pt.year,
    monthlyDividend: pt.monthlyNetDividendPkr,
    monthlyExpenses: pt.monthlyExpensesPkr,
    portfolioValue: pt.nominalPortfolioPkr,
  }));

  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Dividend Snowball Projection
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Watch monthly dividend cash flow cross over living expenses as compounding takes over
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-zinc-300">Monthly Dividend</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-rose-400" />
            <span className="text-zinc-300">Living Expenses</span>
          </div>
        </div>
      </div>

      <div className="h-72 sm:h-80 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="snowballGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="year"
                stroke="#5C574D"
                tick={{ fill: '#A8A294', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              />
              <YAxis
                stroke="#5C574D"
                tick={{ fill: '#A8A294', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatCompactPkrMasked(val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#FFFFFF',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  padding: '10px 14px',
                }}
                formatter={(val: any, name: any) => {
                  const num = Number(val);
                  if (name === 'monthlyDividend') {
                    return [formatPkrMasked(num) + ' / mo', 'Net Dividend'];
                  }
                  if (name === 'monthlyExpenses') {
                    return [formatPkrMasked(num) + ' / mo', 'Expenses'];
                  }
                  return [formatPkrMasked(num), name];
                }}
                labelFormatter={(label) => `Timeline: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="monthlyDividend"
                stroke="#D4AF37"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#snowballGrad)"
                name="monthlyDividend"
              />
              <Line
                type="monotone"
                dataKey="monthlyExpenses"
                stroke="#F43F5E"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
                name="monthlyExpenses"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500 font-mono">
            Rendering Snowball Chart...
          </div>
        )}
      </div>
    </div>
  );
}
