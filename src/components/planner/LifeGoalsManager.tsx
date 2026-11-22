'use client';

import React, { useState } from 'react';
import { LifeGoal } from '@/types';
import { AmountWords } from '@/components/ui/AmountWords';
import { AiButton } from '@/components/ui/AiButton';
import { formatCompactPkr } from '@/lib/format';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Calendar, Plus, Trash2, Sparkles } from 'lucide-react';

interface LifeGoalsManagerProps {
  lifeGoals: LifeGoal[];
  currentAge: number;
  retirementAge: number;
  onChange: (updatedGoals: LifeGoal[]) => void;
}

export function LifeGoalsManager({
  lifeGoals,
  currentAge,
  retirementAge,
  onChange,
}: LifeGoalsManagerProps) {
  const { formatPkrMasked } = useProfile();
  const [newGoalName, setNewGoalName] = useState('');
  const [newGoalAge, setNewGoalAge] = useState(currentAge + 5);
  const [newGoalCost, setNewGoalCost] = useState(2500000);
  const [isAdding, setIsAdding] = useState(false);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalName.trim()) return;

    const newGoal: LifeGoal = {
      id: `goal-${Date.now()}`,
      name: newGoalName.trim(),
      targetAge: Number(newGoalAge),
      costInTodaysPkr: Number(newGoalCost),
    };

    onChange([...lifeGoals, newGoal]);
    setNewGoalName('');
    setIsAdding(false);
  };

  const handleRemoveGoal = (id: string) => {
    onChange(lifeGoals.filter((g) => g.id !== id));
  };

  const handleUpdateGoal = (id: string, updates: Partial<LifeGoal>) => {
    onChange(lifeGoals.map((g) => (g.id === id ? { ...g, ...updates } : g)));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs">
        <label className="font-semibold text-zinc-300 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-amber-400" />
          <span>Dated Life Goals & Lump-Sum Milestones</span>
        </label>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 text-[11px]"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{isAdding ? 'Cancel' : 'Add Goal'}</span>
        </button>
      </div>

      {/* Add Goal Form Drawer */}
      {isAdding && (
        <form
          onSubmit={handleAddGoal}
          className="p-3.5 rounded-xl bg-black/[0.05] border border-emerald-500/30 space-y-3 text-xs"
        >
          <div>
            <label className="text-[10px] text-zinc-400 block mb-1">Goal Milestone Name</label>
            <input
              type="text"
              placeholder="e.g. Wedding, House Construction, EV Upgrade"
              value={newGoalName}
              onChange={(e) => setNewGoalName(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/10 text-white text-xs"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-400 block mb-1">Target Age</label>
              <input
                type="number"
                min={currentAge + 1}
                max={retirementAge}
                value={newGoalAge}
                onChange={(e) => setNewGoalAge(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/10 text-white font-mono text-xs"
                required
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] text-zinc-400">Today's Cost (PKR)</label>
                <AiButton
                  type="goal-cost"
                  context={{ goalName: newGoalName }}
                  currentValue={newGoalCost}
                  onAccept={(val) => setNewGoalCost(val)}
                  formatValue={(x) => formatCompactPkr(x)}
                />
              </div>
              <input
                type="number"
                step={100000}
                value={newGoalCost}
                onChange={(e) => setNewGoalCost(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/10 text-white font-mono text-xs"
                required
              />
              <AmountWords value={newGoalCost} />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-1.5 rounded-lg bg-emerald-500 text-black font-bold text-xs"
          >
            Save Life Goal
          </button>
        </form>
      )}

      {/* Goals List */}
      <div className="space-y-2">
        {lifeGoals.map((g) => (
          <div
            key={g.id}
            className="p-3 rounded-xl bg-[#0C0C0F] border border-white/5 flex items-center justify-between gap-3 text-xs"
          >
            <div>
              <div className="font-bold text-white text-xs">{g.name}</div>
              <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                Target Age: <strong className="text-zinc-200">{g.targetAge}</strong> ({g.targetAge - currentAge} yrs) · Cost: <strong className="text-emerald-400">{formatPkrMasked(g.costInTodaysPkr)}</strong>
              </div>
            </div>

            <button
              onClick={() => handleRemoveGoal(g.id)}
              className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
              title="Remove Goal"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {lifeGoals.length === 0 && !isAdding && (
          <div className="p-3 rounded-xl bg-black/[0.04] border border-dashed border-white/10 text-center text-[11px] text-zinc-500">
            No life goals configured yet. Add your wedding, house, or pilgrimage milestones.
          </div>
        )}
      </div>
    </div>
  );
}
