'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DATA_AS_OF_SHORT } from '@/data/marketData';
import { 
  BookOpen, 
  TrendingUp, 
  Compass, 
  BarChart3, 
  Car, 
  Eye, 
  EyeOff, 
  Share2, 
  Sun, 
  Moon, 
  Menu, 
  X, 
  Sparkles,
  User,
  FolderKanban,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { useBeginnerGuide } from './BeginnerDrawer';
import { useProfile } from '@/components/providers/ProfileProvider';
import { useAiAssist } from '@/components/providers/AiAssistProvider';

/**
 * AiAssistToggle — the global AI Assist switch (NOTES #27).
 * Deliberately NOT one more grey pill in the crowded bar (owner
 * instruction, 22 Nov 2026): it sits at the far right, behind a
 * divider, gold-outlined, and fills gold when ON so its state reads
 * from anywhere. Renders nothing when the server has no AI configured.
 */
export function AiAssistToggle({ inMenu = false }: { inMenu?: boolean }) {
  const { enabled, setEnabled, available } = useAiAssist();
  if (!available) return null;

  const pill = (
    <button
      onClick={() => setEnabled(!enabled)}
      title={enabled ? 'AI Assist is ON — prediction buttons appear beside fields' : 'Turn AI Assist ON — prediction buttons appear beside fields'}
      className={`flex items-center gap-2 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
        inMenu ? 'w-full justify-center px-3 py-2' : 'px-3 py-1.5'
      } ${
        enabled
          ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-black border border-amber-300 shadow-sm shadow-amber-500/30'
          : 'bg-amber-500/[0.06] text-amber-400/80 border border-amber-500/40 hover:bg-amber-500/15 hover:text-amber-300'
      }`}
    >
      <Sparkles className="w-3.5 h-3.5" />
      <span>AI Assist</span>
      <span
        className={`relative inline-flex w-7 h-4 rounded-full transition-colors ${
          enabled ? 'bg-black/30' : 'bg-white/10'
        }`}
      >
        <span
          className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${
            enabled ? 'left-3.5 bg-black' : 'left-0.5 bg-zinc-400'
          }`}
        />
      </span>
    </button>
  );

  if (inMenu) return pill;
  return <div className="hidden md:flex items-center pl-3 ml-1 border-l border-white/10">{pill}</div>;
}

export function Navbar() {
  const pathname = usePathname();
  const { openGuide } = useBeginnerGuide();
  const { 
    hideAmounts, 
    toggleHideAmounts, 
    theme, 
    toggleTheme, 
    sharePlan,
    currentUser,
    userPortfolios,
    activePortfolioId,
    openAuthModal,
    openOnboardingModal
  } = useProfile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePort = userPortfolios.find((p) => p.id === activePortfolioId);

  const navLinks = [
    { href: '/', label: 'Overview', icon: Compass },
    { href: '/markets', label: 'Gold & PSX Streaks', icon: TrendingUp },
    { href: '/planner', label: 'Life Planner', icon: BarChart3 },
    { href: '/cars', label: 'Car Decision Map', icon: Car, badge: '5-Yr TCO' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#121214]/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 2xl:px-8 min-h-16 py-1 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        {/* Brand / Logo */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-amber-500/20 border border-emerald-500/30 group-hover:border-emerald-400/60 transition-colors">
              <span className="font-extrabold text-base bg-gradient-to-r from-emerald-400 to-amber-300 bg-clip-text text-transparent">
                RF
              </span>
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400 animate-ping opacity-75" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg tracking-tight text-white group-hover:text-emerald-300 transition-colors">
                  Rizq<span className="text-[#E8C15A]">Flow</span>
                </span>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              </div>
              <span className="text-[10px] font-medium tracking-wider uppercase text-zinc-400 -mt-0.5">
                PSX & SARAFA
              </span>
            </div>
          </Link>

          {/* Pakistan Market Live Badge */}
          <div className="hidden 2xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[11px] font-medium text-zinc-300 whitespace-nowrap shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>KSE-100 · Sarafa · Data {DATA_AS_OF_SHORT}</span>
          </div>
        </div>

        {/* Desktop Nav Links */}
        <nav className="hidden lg:flex items-center gap-1.5 2xl:gap-2.5">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-2 px-2.5 2xl:px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-all ${
                  isActive
                    ? 'bg-white/10 text-white border border-white/15 shadow-sm font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                <span>{link.label}</span>
                {link.badge && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-mono font-bold">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right Action Controls */}
        <div className="flex items-center gap-2 2xl:gap-3">
          {/* Setup Wizard Button */}
          <button
            onClick={() => openOnboardingModal()}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 text-xs font-semibold transition-all shadow-sm"
            title="Setup & Calibrate Your Personal Financial Flow"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden xl:inline">Setup Flow</span>
          </button>

          {/* User Account / Portfolio Selector */}
          {currentUser ? (
            <button
              onClick={() => openAuthModal('portfolios')}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs transition-all group"
              title="Manage Portfolios & Account"
            >
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-emerald-500 to-teal-400 text-black font-bold text-[11px] flex items-center justify-center">
                {currentUser.name.substring(0, 2).toUpperCase()}
              </div>
              <div className="hidden xl:flex flex-col text-left">
                <span className="font-semibold text-white leading-none text-[11px] group-hover:text-emerald-300 transition-colors">
                  {currentUser.name}
                </span>
                <span className="text-[10px] text-zinc-400 font-normal leading-tight truncate max-w-[110px]">
                  {activePort ? activePort.name : 'Personal'}
                </span>
              </div>
              <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300 transition-colors hidden sm:inline" />
            </button>
          ) : (
            <button
              onClick={() => openAuthModal('signin')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs transition-all shadow-sm shadow-emerald-500/20"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}

          {/* Hide Amounts Privacy Toggle */}
          <button
            onClick={toggleHideAmounts}
            className={`p-2 rounded-lg border text-xs font-semibold transition-all ${
              hideAmounts
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-white/5 text-zinc-400 border-white/5 hover:text-white hover:bg-white/10'
            }`}
            title={hideAmounts ? 'Show Financial Figures' : 'Hide Financial Figures (Privacy Mode)'}
            aria-label="Toggle Amount Masking"
          >
            {hideAmounts ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4" />}
          </button>

          {/* Share Plan URL button */}
          <button
            onClick={() => sharePlan()}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/5 text-xs font-medium transition-all"
            title="Copy Shareable URL Hash"
          >
            <Share2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden 2xl:inline">Share</span>
          </button>


          {/* Beginner Guide Drawer CTA */}
          <button
            onClick={() => openGuide()}
            className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 text-xs font-semibold whitespace-nowrap shrink-0 transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden 2xl:inline">Guide</span>
          </button>

          {/* Global AI Assist switch — far right, behind a divider */}
          <AiAssistToggle />

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#0C0C0F] px-4 py-3 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive
                    ? 'bg-white/10 text-white font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-emerald-400" />
                  <span>{link.label}</span>
                </div>
                {link.badge && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-mono">
                    {link.badge}
                  </span>
                )}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-white/5 flex flex-col gap-2">
            <AiAssistToggle inMenu />
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                openOnboardingModal();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-semibold"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Setup Flow / Calibrate Portfolio</span>
            </button>

            <button
              onClick={() => {
                setMobileMenuOpen(false);
                openAuthModal(currentUser ? 'portfolios' : 'signin');
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-white border border-white/10 text-xs font-semibold"
            >
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentUser ? `Account: ${currentUser.name}` : 'Sign In / Sign Up'}</span>
            </button>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  openGuide();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-zinc-300 border border-white/10 text-xs font-semibold"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Beginner Guide</span>
              </button>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  sharePlan();
                }}
                className="px-3 py-2 rounded-lg bg-white/5 text-zinc-300 border border-white/10 text-xs font-semibold"
              >
                <Share2 className="w-3.5 h-3.5 text-emerald-400" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
