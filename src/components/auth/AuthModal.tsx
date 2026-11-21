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
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  KeyRound
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'portfolios';
  onOpenOnboarding?: () => void;
  onRecalibrate?: () => void;
}

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
  const [isCreatingPortfolio, setIsCreatingPortfolio] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = signInUser(email, password);
    if (res.success) {
      showToast(`Welcome back, ${res.user?.name || 'Investor'}!`);
      onClose();
    } else {
      setError(res.error || 'Failed to sign in.');
    }
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    const res = signUpUser(name, email, password);
    if (res.success) {
      showToast(`Welcome to RizqFlow, ${name}!`);
      onClose();
      if (onOpenOnboarding) {
        onOpenOnboarding();
      }
    } else {
      setError(res.error || 'Failed to create account.');
    }
  };

  const handleCreatePortfolio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPortfolioName.trim()) return;
    const res = createNewPortfolio(newPortfolioName);
    if (res.success) {
      showToast(`Created portfolio "${newPortfolioName}"!`);
      setNewPortfolioName('');
      setIsCreatingPortfolio(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-md my-8 rounded-2xl bg-[#FFFFFF] border border-white/10 shadow-2xl shadow-emerald-500/10 flex flex-col overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="p-6 border-b border-white/[0.08] bg-gradient-to-r from-emerald-500/10 to-amber-500/10 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg text-white">Rizq<span className="text-emerald-400">Flow</span> Portfolios</span>
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
          <div className="flex border-b border-white/5 bg-[#FFFFFF] p-1">
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

          <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-[11px] leading-relaxed text-zinc-400">
            Accounts are stored <span className="text-zinc-200 font-semibold">only in this browser, on this device</span> —
            nothing is sent to a server. Clearing browser data deletes them permanently.
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
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-zinc-300">Password / PIN</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-md shadow-emerald-500/20"
              >
                Sign In to My Portfolio
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
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
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
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
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
                    placeholder="••••••••"
                    className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-[#FFFFFF] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-extrabold text-xs transition-all shadow-lg shadow-emerald-500/25"
              >
                Create Account & Calibrate Portfolio
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
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Your Portfolios ({userPortfolios.length})</label>
                  <button
                    onClick={() => setIsCreatingPortfolio(!isCreatingPortfolio)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Portfolio</span>
                  </button>
                </div>

                {isCreatingPortfolio && (
                  <form onSubmit={handleCreatePortfolio} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-2">
                    <input
                      type="text"
                      required
                      value={newPortfolioName}
                      onChange={(e) => setNewPortfolioName(e.target.value)}
                      placeholder="e.g. Children Higher Ed Fund"
                      className="w-full px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-white/10 text-white text-xs focus:border-emerald-500 focus:outline-none"
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
                        className="px-3 py-1 rounded-md bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs"
                      >
                        Create
                      </button>
                    </div>
                  </form>
                )}

                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  {userPortfolios.map((port) => {
                    const isActive = port.id === activePortfolioId;
                    return (
                      <div
                        key={port.id}
                        onClick={() => {
                          switchActivePortfolio(port.id);
                          showToast(`Switched to: ${port.name}`);
                          onClose();
                        }}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                          isActive
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-white'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/15 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <FolderKanban className={`w-4 h-4 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                          <div>
                            <div className="font-semibold text-xs text-white">{port.name}</div>
                            <div className="text-[10px] text-zinc-400 font-mono">
                              Income: {port.profile.monthlyIncomePkr ? `Rs ${(port.profile.monthlyIncomePkr / 1000).toFixed(0)}k/mo` : 'Rs 0'} · {port.profile.shariahOnly ? 'Halal' : 'Blend'}
                            </div>
                          </div>
                        </div>

                        {isActive ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <Check className="w-3.5 h-3.5" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300">
                            Switch &rarr;
                          </span>
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
                  if (onRecalibrate) onRecalibrate();
                  else if (onOpenOnboarding) onOpenOnboarding();
                }}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-200 border border-white/10 text-xs font-semibold flex items-center justify-center gap-2 transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Recalibrate Active Portfolio (Setup Wizard)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
