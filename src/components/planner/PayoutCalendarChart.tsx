'use client';

import React, { useState, useEffect } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  Cell 
} from 'recharts';
import { Calendar, AlertCircle } from 'lucide-react';
import { useBeginnerGuide } from '@/components/ui/BeginnerDrawer';

interface PayoutCalendarChartProps {
  monthlyPayoutCalendar: { month: string; amountPkr: number }[];
}

export function PayoutCalendarChart({ monthlyPayoutCalendar }: PayoutCalendarChartProps) {
  const [mounted, setMounted] = useState(false);
  const { openGuide } = useBeginnerGuide();
  const { formatCompactPkrMasked, formatPkrMasked } = useProfile();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="rounded-2xl bg-[#0C0C0F] border border-white/[0.08] p-5 sm:p-6 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
              12-Month Chunky PSX Payout Calendar
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 uppercase font-mono font-bold">
              Quarterly Bursts
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            Real cash dividend arrival schedule across the calendar year
          </p>
        </div>

        <button
          onClick={() => openGuide('lumpy-payouts')}
          className="text-xs text-amber-400 hover:text-amber-300 underline self-start sm:self-auto"
        >
          Why is it Lumpy? &rarr;
        </button>
      </div>

      <div className="h-64 sm:h-72 w-full pt-2">
        {mounted ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthlyPayoutCalendar} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="month"
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
                  backgroundColor: '#0C0C0F',
                  borderColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: '0.75rem',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                  padding: '8px 12px',
                }}
                formatter={(val: any) => [formatPkrMasked(Number(val)), 'Cash Dividend']}
                labelFormatter={(label) => `Month: ${label}`}
              />
              <Bar dataKey="amountPkr" radius={[4, 4, 0, 0]}>
                {monthlyPayoutCalendar.map((entry, index) => {
                  const isHigh = entry.amountPkr > 0;
                  return (
                    <Cell
                      key={`cell-${index}`}
                      fill={isHigh ? '#D9A521' : '#27272A'}
                      opacity={isHigh ? 0.9 : 0.3}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500 font-mono">
            Rendering Payout Calendar...
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-zinc-300 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong>Notice the peaks and valleys:</strong> PSX companies pay heavily in <strong>March, May, August, and November</strong>. In dry months (like Jan or July), little to no dividends arrive. Your <strong>4-month emergency buffer</strong> acts as the shock absorber!
        </p>
      </div>
    </div>
  );
}
