'use client';

import React, { useState } from 'react';
import { LifeGoal } from '@/types';
import { AmountWords } from '@/components/ui/AmountWords';
import { AiButton } from '@/components/ui/AiButton';
import { FieldInfo } from '@/components/ui/FieldInfo';
import { formatCompactPkr } from '@/lib/format';
import { useProfile } from '@/components/providers/ProfileProvider';
import { Calendar, Plus, Trash2, Sparkles, Pencil, Check, X } from 'lucide-react';

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

  // Edit Goal State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState<number>(0);
  const [editCost, setEditCost] = useState<number>(0);

  const startEdit = (g: LifeGoal) => {
    setEditingId(g.id);
    setEditName(g.name);
    setEditAge(g.targetAge);
    setEditCost(g.costInTodaysPkr);
  };

  const saveEdit = (id: string) => {
    if (!editName.trim()) return;
    handleUpdateGoal(id, {
      name: editName.trim(),
      targetAge: Number(editAge),
      costInTodaysPkr: Number(editCost),
    });
    setEditingId(null);
  };

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
                <FieldInfo
                  title="Today's cost — what it means"
                  text={`What this goal would cost if you paid for it TODAY.

The app inflates the price year by year until your target age, so you save toward the future price, not today's.`}
                />
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
        {lifeGoals.map((g) => {
          if (editingId === g.id) {
            return (
              <div
                key={g.id}
                className="p-3.5 rounded-xl bg-black/[0.05] border border-amber-500/30 space-y-3 text-xs"
              >
                <div>
                  <label className="text-[10px] text-zinc-400 block mb-1">Goal Milestone Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/10 text-white font-mono text-xs"
                      required
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] text-zinc-400">Today's Cost (PKR)</label>
                      <AiButton
                        type="goal-cost"
                        context={{ goalName: editName }}
                        currentValue={editCost}
                        onAccept={(val) => setEditCost(val)}
                        formatValue={(x) => formatCompactPkr(x)}
                      />
                    </div>
                    <input
                      type="number"
                      step={100000}
                      value={editCost}
                      onChange={(e) => setEditCost(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-black border border-white/10 text-white font-mono text-xs"
                      required
                    />
                    <AmountWords value={editCost} />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => saveEdit(g.id)}
                    className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-500 text-black font-bold text-xs"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
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

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => startEdit(g)}
                  className="p-1 rounded text-zinc-500 hover:text-amber-300 transition-colors"
                  title="Edit Goal"
                  aria-label="Edit Goal"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveGoal(g.id)}
                  className="p-1 rounded text-zinc-500 hover:text-rose-400 transition-colors"
                  title="Remove Goal"
                  aria-label="Remove Goal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {lifeGoals.length === 0 && !isAdding && (
          <div className="p-3 rounded-xl bg-black/[0.04] border border-dashed border-white/10 text-center text-[11px] text-zinc-500">
            No life goals configured yet. Add your wedding, house, or pilgrimage milestones.
          </div>
        )}
      </div>
    </div>
  );
}
