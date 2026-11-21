'use client';

import React, { useState, useEffect } from 'react';
import { WealthTimelinePoint } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  AreaChart, 
  Area, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Legend, 
  ReferenceLine 
} from 'recharts';
import { TrendingUp, Sparkles, Layers } from 'lucide-react';

interface CompoundingChartProps {
  timeline: WealthTimelinePoint[];
  startAge: number;
  retirementAge: number;
}

export function CompoundingChart({
  timeline,
  startAge,
  retirementAge,
}: CompoundingChartProps) {
  const [mounted, setMounted] = useState(false);
  const { formatCompactPkrMasked, formatPkrMasked } = useProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  const chartData = timeline.map((pt) => ({
    age: `Age ${pt.age}`,
    ageNum: pt.age,
    nominal: pt.nominalPortfolioPkr,
    realTodays: pt.realTodaysPkr,
    withdrawn: pt.goalWithdrawnPkr,
    monthlyDiv: pt.monthlyNetDividendPkr,
    expenses: pt.monthlyExpensesPkr,
  }));

  return (
    <div className="rounded-2xl bg-[#11131A] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Age {startAge} to {retirementAge} Multi-Asset Compounding Trajectory
            </h3>
          </div>
          <p className="text-xs text-zinc-400">
            Comparing nominal capital growth against inflation-deflated Today's Purchasing Power
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500" />
            <span className="text-zinc-300">Nominal Wealth</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-teal-400 opacity-60" />
            <span className="text-zinc-300">Today's Real Money</span>
          </div>
        </div>
      </div>

      <div className="h-72 sm:h-80 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="compoundingNominal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="compoundingReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#14B8A6" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="age"
                stroke="#52525B"
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
              />
              <YAxis
                stroke="#52525B"
                tick={{ fill: '#A1A1AA', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => formatCompactPkrMasked(val)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#11131A',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  padding: '10px 14px',
                }}
                formatter={(val: any, name: any) => {
                  const num = Number(val);
                  if (name === 'nominal') {
                    return [formatPkrMasked(num), 'Nominal Wealth'];
                  }
                  if (name === 'realTodays') {
                    return [formatPkrMasked(num), "Today's Real Purchasing Power"];
                  }
                  if (name === 'withdrawn' && num > 0) {
                    return [formatPkrMasked(num), 'Goal Withdrawal Deducted'];
                  }
                  return [formatPkrMasked(num), name];
                }}
                labelFormatter={(label) => `Milestone: ${label}`}
              />
              <Area
                type="monotone"
                dataKey="nominal"
                stroke="#10B981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#compoundingNominal)"
                name="nominal"
              />
              <Area
                type="monotone"
                dataKey="realTodays"
                stroke="#14B8A6"
                strokeWidth={2}
                strokeDasharray="3 3"
                fillOpacity={1}
                fill="url(#compoundingReal)"
                name="realTodays"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500 font-mono">
            Rendering Compounding Trajectory...
          </div>
        )}
      </div>

      <div className="pt-2 text-[11px] text-zinc-400 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-white/[0.06]">
        <span>
          Includes annual salary raises, multi-asset monthly splits, and dated goal lump sum deductions.
        </span>
        <span className="text-emerald-400 font-mono">
          Final Real Wealth @ Age {retirementAge}: {formatCompactPkrMasked(timeline[timeline.length - 1]?.realTodaysPkr || 0)}
        </span>
      </div>
    </div>
  );
}
