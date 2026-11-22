'use client';

import React, { useState } from 'react';
import { useProfile } from '@/components/providers/ProfileProvider';
import {
  User,
  Mail,
  Lock,
  Sparkles,
  X,
  Plus,
  Check,
  LogOut,
  FolderKanban,
  Eye,
  Pencil,
  Trash2,
  CloudUpload,
  Download,
  Upload,
} from 'lucide-react';
import {
  createNativeExportEnvelope,
  createAllPortfoliosExportEnvelope,
} from '@/lib/portfolioTransfer';
import { ImportPortfolioModal } from '@/components/portfolio/ImportPortfolioModal';
import { UserProfile } from '@/types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'portfolios';
  onOpenOnboarding?: () => void;
  onRecalibrate?: () => void;
}

const fmtRs = (n?: number) => (n ? `Rs ${n.toLocaleString('en-PK')}` : '—');

export function AuthModal({ isOpen, onClose, initialMode = 'signin', onOpenOnboarding, onRecalibrate }: AuthModalProps) {
  const {
    currentUser,
    signInUser,
    signUpUser,
    signOutUser,
    userPortfolios,
    activePortfolioId,
    switchActivePortfolio,
    createNewPortfolio,
    deleteUserPortfolio,
    renameUserPortfolio,
    showToast
  } = useProfile();

  const [mode, setMode] = useState<'signin' | 'signup' | 'portfolios'>(
    currentUser ? 'portfolios' : initialMode
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [newPortfolioName, setNewPortfolioName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);

  // Portfolio management UI state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const downloadJson = (filename: string, data: unknown) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSingle = (port: { name: string; profile: UserProfile }) => {
    const envelope = createNativeExportEnvelope(port);
    const slug = port.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'portfolio';
    downloadJson(`rizqflow-portfolio-${slug}.json`, envelope);
    showToast(`Exported "${port.name}" as JSON backup.`);
  };

  const handleExportAll = () => {
    if (userPortfolios.length === 0) return;
    const envelope = createAllPortfoliosExportEnvelope(userPortfolios);
    downloadJson(`rizqflow-all-portfolios.json`, envelope);
    showToast(`Exported all ${userPortfolios.length} portfolios as JSON backup.`);
  };

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await signInUser(email, password);
    setBusy(false);
    if (res.success) {
      showToast(`Welcome back, ${res.user?.name || 'Investor'}!`);
      onClose();
    } else {
      setError(res.error || 'Failed to sign in.');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    const res = await signUpUser(name, email, password);
    setBusy(false);
    if (res.success) {
      showToast(`Welcome to RizqFlow, ${name}!`);
      onClose();
      // Only launch the setup wizard when the account has no portfolio yet
      // (e.g. legacy portfolios were imported instead — no wizard needed).
      if ((res.portfolios?.length ?? 0) === 0 && onOpenOnboarding) {
        onOpenOnboarding();
      }
    } else {
      setError(res.error || 'Failed to create account.');
    }
  };

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    setBusy(true);
    const res = await createNewPortfolio(newPortfolioName);
    setBusy(false);
    if (res.success) {
      showToast(`Created portfolio "${newPortfolioName}"!`);
      setNewPortfolioName('');
      setIsCreatingPortfolio(false);
    }
  };

  const handleRename = async (id: string) => {
    if (!renameValue.trim()) return;
    setBusy(true);
    const res = await renameUserPortfolio(id, renameValue.trim());
    setBusy(false);
    if (res.success) {
      showToast('Portfolio renamed.');
      setRenamingId(null);
    }
  };

  const handleDelete = async (id: string, portName: string) => {
    setBusy(true);
    const res = await deleteUserPortfolio(id);
    setBusy(false);
    if (res.success) {
      showToast(`Deleted portfolio "${portName}".`);
      setConfirmDeleteId(null);
      setExpandedId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md my-8 rounded-2xl bg-[#0C0C0F] border border-white/10 shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden text-zinc-100">

        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/10 to-amber-500/10 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-white">Rizq<span className="text-[#E8C15A]">Flow</span> Portfolios</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            </div>
            <p className="text-xs text-zinc-400">
              {mode === 'signin' && 'Sign in to access your saved wealth & dividend portfolios.'}
              {mode === 'signup' && 'Create your personal investor account & portfolio.'}
              {mode === 'portfolios' && `Logged in as ${currentUser?.name}`}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switchers if not logged in */}
        {!currentUser && (
          <div className="flex border-b border-white/5 bg-[#0C0C0F] p-1">
            <button
              onClick={() => {
                setMode('signin');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signin' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('signup');
                setError(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                mode === 'signup' ? 'bg-white/10 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Sign Up
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] leading-relaxed text-zinc-400 flex gap-2">
            <CloudUpload className="w-4 h-4 text-[#E8C15A] shrink-0 mt-0.5" />
            <span>
              Your account and portfolios are stored <span className="text-zinc-200 font-semibold">securely on the RizqFlow server</span> —
              sign in on any device (phone, laptop, Mac) and you will see the same portfolios everywhere.
            </span>
          </div>

          {/* SIGN IN FORM */}
          {mode === 'signin' && !currentUser && (
            <form onSubmit={handleSignIn} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
              >
                {busy ? 'Signing in…' : 'Sign In to My Portfolio'}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {mode === 'signup' && !currentUser && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Your Full Name</label>
                <div className="relative">
                  <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Create Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#0C0C0F] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:opacity-60 text-black font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/25"
              >
                {busy ? 'Creating account…' : 'Create Account & Calibrate Portfolio'}
              </button>
            </form>
          )}

          {/* PORTFOLIO MANAGER (If signed in) */}
          {currentUser && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <div>
                  <div className="font-bold text-white text-sm">{currentUser.name}</div>
                  <div className="text-xs text-zinc-400">{currentUser.email}</div>
                </div>
                <button
                  onClick={() => {
                    signOutUser();
                    setMode('signin');
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-medium transition-all"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>

              {/* Portfolios List */}
              <div className="space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-semibold text-zinc-300">Your Portfolios ({userPortfolios.length})</label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(true)}
                      className="text-xs text-[#E8C15A] hover:text-amber-200 font-semibold flex items-center gap-1"
                      title="Import portfolio from JSON or CSV"
                    >
                      <Upload className="w-3 h-3 text-[#E8C15A]" />
                      <span>Import</span>
                    </button>
                    {userPortfolios.length > 0 && (
                      <button
                        type="button"
                        onClick={handleExportAll}
                        className="text-xs text-zinc-400 hover:text-zinc-200 font-semibold flex items-center gap-1"
                        title="Export all portfolios as a single JSON file"
                      >
                        <Download className="w-3 h-3" />
                        <span>Export All</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsCreatingPortfolio(!isCreatingPortfolio)}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>New</span>
                    </button>
                  </div>
                </div>

                {isCreatingPortfolio && (
                  <form onSubmit={handleCreatePortfolio} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <input
                      type="text"
                      required
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                      placeholder="e.g. Children Higher Ed Fund"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#0C0C0F] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCreatingPortfolio(false)}
                        className="px-2.5 py-1 text-xs text-zinc-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={busy}
                        className="px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-semibold text-xs"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                {userPortfolios.length === 0 && (
                  <div className="p-3.5 rounded-xl bg-white/[0.02] border border-white/5 text-[11px] text-zinc-400 space-y-2.5">
                    <p>No portfolios yet. Run the Setup Wizard below or import an existing portfolio backup.</p>
                    <button
                      type="button"
                      onClick={() => setImportModalOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/25 font-semibold hover:bg-emerald-500/20 transition-colors"
                    >
                      <Upload className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Import Portfolio (JSON/CSV)</span>
                    </button>
                  </div>
                )}

                <div className="space-y-1.5 max-h-72 overflow-y-auto">
                  {userPortfolios.map((port) => {
                    const isActive = port.id === activePortfolioId;
                    const isExpanded = expandedId === port.id;
                    const p = port.profile;
                    return (
                      <div
                        key={port.id}
                        className={`p-3 rounded-xl border transition-all ${
                          isActive
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FolderKanban className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                            <div className="min-w-0">
                              {renamingId === port.id ? (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    className="px-2 py-1 rounded-md bg-[#0C0C0F] border border-white/15 text-white text-xs focus:border-emerald-500 focus:outline-none w-36"
                                    autoFocus
                                  />
                                  <button
                                    onClick={() => handleRename(port.id)}
                                    disabled={busy}
                                    className="px-2 py-1 rounded-md bg-emerald-500 text-black text-[10px] font-bold disabled:opacity-60"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={() => setRenamingId(null)}
                                    className="px-2 py-1 text-[10px] text-zinc-400 hover:text-white"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div className="font-semibold text-xs text-white truncate">{port.name}</div>
                              )}
                              <div className="text-[10px] text-zinc-400 font-mono">
                                Income: {p.monthlyIncomePkr ? `Rs ${(p.monthlyIncomePkr / 1000).toFixed(0)}k/mo` : 'Rs 0'} · {p.shariahOnly ? 'Halal' : 'Blend'}
                              </div>
                            </div>
                          </div>

                          {isActive ? (
                            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400 shrink-0">
                              <Check className="w-3.5 h-3.5" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <button
                              onClick={async () => {
                                await switchActivePortfolio(port.id);
                                showToast(`Switched to: ${port.name}`);
                              }}
                              className="text-[10px] font-semibold text-[#E8C15A] hover:text-white shrink-0"
                            >
                              Switch &rarr;
                            </button>
                          )}
                        </div>

                        {/* Management actions */}
                        <div className="flex items-center gap-1.5 mt-2.5 pt-2.5 border-t border-white/5">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : port.id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-zinc-300"
                          >
                            <Eye className="w-3 h-3" /> {isExpanded ? 'Hide' : 'View'}
                          </button>
                          <button
                            onClick={() => {
                              setRenamingId(port.id);
                              setRenameValue(port.name);
                            }}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-zinc-300"
                          >
                            <Pencil className="w-3 h-3" /> Rename
                          </button>
                          <button
                            onClick={() => handleExportSingle(port)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] font-semibold text-zinc-300"
                            title="Export single portfolio JSON"
                          >
                            <Download className="w-3 h-3 text-[#E8C15A]" /> Export
                          </button>
                          {confirmDeleteId === port.id ? (
                            <>
                              <span className="text-[10px] text-rose-300 ml-1">Delete permanently?</span>
                              <button
                                onClick={() => handleDelete(port.id, port.name)}
                                disabled={busy}
                                className="px-2 py-1 rounded-md bg-rose-500 text-white text-[10px] font-bold disabled:opacity-60"
                              >
                                Yes, delete
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2 py-1 text-[10px] text-zinc-400 hover:text-white"
                              >
                                Keep
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(port.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-[10px] font-semibold text-rose-300 ml-auto"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>

                        {/* Expanded full details */}
                        {isExpanded && (
                          <div className="mt-2.5 pt-2.5 border-t border-white/5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                            <div className="flex justify-between"><span className="text-zinc-500">Age</span><span className="font-mono text-zinc-200">{p.age ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Retires at</span><span className="font-mono text-zinc-200">{p.retirementAge ?? '—'}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Income</span><span className="font-mono text-zinc-200">{fmtRs(p.monthlyIncomePkr)}/mo</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Invests</span><span className="font-mono text-zinc-200">{fmtRs(p.monthlyInvestPkr)}/mo</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Lump sum</span><span className="font-mono text-zinc-200">{fmtRs(p.lumpSumPkr)}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Cash reserve</span><span className="font-mono text-zinc-200">{fmtRs(p.currentCashReservePkr)}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Annual raise</span><span className="font-mono text-zinc-200">{p.annualSalaryRaisePct ?? '—'}%</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Daily commute</span><span className="font-mono text-zinc-200">{p.dailyCommuteKm ?? '—'} km</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Life goals</span><span className="font-mono text-zinc-200">{p.lifeGoals?.length ?? 0}</span></div>
                            <div className="flex justify-between"><span className="text-zinc-500">Updated</span><span className="font-mono text-zinc-200">{new Date(port.updatedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recalibrate button */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (userPortfolios.length === 0 && onOpenOnboarding) onOpenOnboarding();
                  else if (onRecalibrate) onRecalibrate();
                  else if (onOpenOnboarding) onOpenOnboarding();
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>{userPortfolios.length === 0 ? 'Run the Setup Wizard' : 'Recalibrate Active Portfolio (Setup Wizard)'}</span>
              </button>
            </div>
          )}

          {/* Quick Import for Anonymous / Offline Investors */}
          {!currentUser && (
            <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>Have a portfolio backup or CSV?</span>
              <button
                type="button"
                onClick={() => setImportModalOpen(true)}
                className="text-[#E8C15A] hover:text-amber-200 font-semibold flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-[#E8C15A]" />
                <span>Import Portfolio</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Import Portfolio Modal (Native & AI-Mapped Foreign) */}
      <ImportPortfolioModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
      />
    </div>
  );
}
