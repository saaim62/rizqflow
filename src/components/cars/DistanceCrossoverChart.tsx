'use client';

import React, { useState, useEffect } from 'react';
import { CarDecisionSummary, VehicleCandidate } from '@/types';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  ReferenceLine,
  Legend 
} from 'recharts';
import { TrendingUp, Sparkles, AlertCircle } from 'lucide-react';

interface DistanceCrossoverChartProps {
  decision: CarDecisionSummary;
  vehicles: VehicleCandidate[];
  currentDailyKm: number;
}

const LINE_COLORS = ['#D4AF37', '#D4AF37', '#3B82F6', '#EC4899', '#8B5CF6', '#C9A227'];

export function DistanceCrossoverChart({
  decision,
  vehicles,
  currentDailyKm,
}: DistanceCrossoverChartProps) {
  const [mounted, setMounted] = useState(false);
  const { formatPkrMasked } = useProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  const data = decision.crossoverSeries;

  return (
    <div className="rounded-2xl bg-[#FFFFFF] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              Distance Crossover Map (5 – 100 km/day)
            </h3>
            {decision.crossoverKmPerDay !== null && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-mono font-bold">
                Crossover at {decision.crossoverKmPerDay} km/day
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-400">
            See how the cheapest vehicle shifts as daily commute increases. The steep slope of petrol cars vs flat EV lines.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-300">
          <span className="w-3 h-0.5 bg-emerald-400" />
          <span>You are at {currentDailyKm} km/day</span>
        </div>
      </div>

      <div className="h-72 sm:h-80 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="kmPerDay"
                stroke="#5C574D"
                tick={{ fill: '#A8A294', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                tickFormatter={(val) => `${val}km`}
              />
              <YAxis
                stroke="#5C574D"
                tick={{ fill: '#A8A294', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `Rs ${(val / 1000).toFixed(0)}k`}
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
                  const v = vehicles.find((cand) => cand.id === name);
                  const label = v ? v.name : name;
                  return [formatPkrMasked(Number(val)) + ' / mo', label];
                }}
                labelFormatter={(label) => `Commute: ${label} km/day`}
              />
              <Legend
                formatter={(val) => {
                  const v = vehicles.find((cand) => cand.id === val);
                  return <span className="text-xs text-zinc-300">{v ? v.name : val}</span>;
                }}
              />

              {/* Vertical Reference Line for current daily commute */}
              <ReferenceLine
                x={currentDailyKm}
                stroke="#D4AF37"
                strokeDasharray="3 3"
                strokeWidth={2}
                label={{
                  value: `You (${currentDailyKm} km)`,
                  fill: '#D4AF37',
                  fontSize: 10,
                  position: 'top',
                }}
              />

              {/* Vehicle cost lines */}
              {vehicles.map((v, idx) => (
                <Line
                  key={v.id}
                  type="monotone"
                  dataKey={v.id}
                  stroke={LINE_COLORS[idx % LINE_COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500 font-mono">
            Loading Crossover Chart...
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-[#FFFFFF] border border-white/5 text-xs text-zinc-400 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Key Takeaway:</strong> Low-mileage drivers (under 15–20 km/day) often find keeping an older petrol car cheaper because EV depreciation & capital opportunity cost outweigh fuel savings. At higher commutes (&gt; 35 km/day), the EV line flattens out, providing monumental compound savings!
        </p>
      </div>
    </div>
  );
}
