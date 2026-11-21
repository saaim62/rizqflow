'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '@/types';
import { PRESET_PROFILES } from '@/data/marketData';
import { 
  loadProfileFromStorage, 
  saveProfileToStorage, 
  encodeProfileToHash, 
  decodeProfileFromHash 
} from '@/lib/stateUrl';
import { formatPkr, formatCompactPkr, maskAmount, FormatPkrOptions } from '@/lib/format';
import {
  UserAccount,
  PortfolioRecord,
  getActiveSession,
  getRegisteredUsers,
  signIn,
  signUp,
  signOut,
  createPortfolioForUser,
  switchUserPortfolio,
  saveProfileToActivePortfolio,
} from '@/lib/auth';
import { AuthModal } from '@/components/auth/AuthModal';
import { OnboardingWizardModal } from '@/components/onboarding/OnboardingWizardModal';

interface ProfileContextType {
  profile: UserProfile;
  setProfile: React.Dispatch<React.SetStateAction<UserProfile>>;
  updateProfile: (updated: Partial<UserProfile>) => void;
  resetToPreset: (presetId: string) => void;
  hideAmounts: boolean;
  toggleHideAmounts: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  toast: string | null;
  showToast: (msg: string) => void;
  sharePlan: () => Promise<string>;
  formatPkrMasked: (n: number, options?: FormatPkrOptions) => string;
  formatCompactPkrMasked: (n: number) => string;

  // Multi-user & Auth additions
  currentUser: UserAccount | null;
  userPortfolios: PortfolioRecord[];
  activePortfolioId: string;
  signInUser: (email: string, pass: string) => { success: boolean; user?: UserAccount; error?: string };
  signUpUser: (name: string, email: string, pass: string, initialProfile?: UserProfile, portfolioName?: string) => { success: boolean; user?: UserAccount; error?: string };
  signOutUser: () => void;
  switchActivePortfolio: (portfolioId: string) => void;
  createNewPortfolio: (name: string, baseProfile?: UserProfile) => { success: boolean; user?: UserAccount; portfolio?: PortfolioRecord };
  openAuthModal: (mode?: 'signin' | 'signup' | 'portfolios') => void;
  openOnboardingModal: (mode?: 'create' | 'update') => void;
}

const ProfileContext = createContext<ProfileContextType | null>(null);

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return ctx;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const defaultProfile = (PRESET_PROFILES[0]?.profile || PRESET_PROFILES[0]) as UserProfile;

  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [hideAmounts, setHideAmounts] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [userPortfolios, setUserPortfolios] = useState<PortfolioRecord[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'portfolios'>('signin');
  const [onboardingModalOpen, setOnboardingModalOpen] = useState<boolean>(false);
  const [onboardingMode, setOnboardingMode] = useState<'create' | 'update'>('create');

  // Show temporary toast message
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  // Hydrate from localStorage or URL hash & load active session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // 1. Privacy setting
    const savedPrivacy = window.localStorage.getItem('rizqflow_hide_amounts');
    if (savedPrivacy === 'true') {
      setHideAmounts(true);
    }

    // 2. Theme setting
    const savedTheme = window.localStorage.getItem('rizqflow_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }

    // 3. User Session
    const session = getActiveSession();
    if (session) {
      const users = getRegisteredUsers();
      const user = users.find((u) => u.id === session.userId);
      if (user) {
        setCurrentUser(user);
        setUserPortfolios(user.portfolios);
        setActivePortfolioId(user.activePortfolioId);

        // Find active portfolio profile
        const activePort = user.portfolios.find((p) => p.id === user.activePortfolioId);
        if (activePort) {
          setProfileState(activePort.profile);
        }
      }
    }

    // 4. URL Hash check (overrides default if present)
    const hash = window.location.hash;
    const decodedFromHash = decodeProfileFromHash(hash, defaultProfile);
    if (decodedFromHash) {
      setProfileState(decodedFromHash);
      showToast('Loaded shared plan from URL!');
    } else if (!session) {
      const stored = loadProfileFromStorage(defaultProfile);
      setProfileState(stored);
    }

    setHasLoaded(true);
  }, [defaultProfile, showToast]);

  // Persist profile to localStorage & active user portfolio whenever it changes
  useEffect(() => {
    if (hasLoaded) {
      saveProfileToStorage(profile);
      if (currentUser && activePortfolioId) {
        saveProfileToActivePortfolio(currentUser.id, activePortfolioId, profile);
      }
    }
  }, [profile, hasLoaded, currentUser, activePortfolioId]);

  // Update profile partially
  const updateProfile = useCallback((updated: Partial<UserProfile>) => {
    setProfileState((prev) => ({
      ...prev,
      ...updated,
    }));
  }, []);

  // Reset to preset
  const resetToPreset = useCallback(
    (presetId: string) => {
      let found: any = null;
      if (presetId === 'junior-engineer' || presetId === 'junior-swe') {
        found = PRESET_PROFILES['junior-engineer'] || PRESET_PROFILES[0];
      } else if (presetId === 'lump-sum-30lac') {
        found = PRESET_PROFILES['lump-sum-30lac'] || PRESET_PROFILES[1];
      } else if (presetId === 'solar-commuter' || presetId === 'solar-ev-swap') {
        found = PRESET_PROFILES['solar-commuter'] || PRESET_PROFILES[2];
      } else {
        found = (PRESET_PROFILES as any)[presetId] || PRESET_PROFILES[0];
      }

      if (found) {
        const nextProfile = (found.profile || found) as UserProfile;
        setProfileState(nextProfile);
        saveProfileToStorage(nextProfile);
        showToast(`Reset to preset: ${found.name || presetId}`);
      }
    },
    [showToast]
  );

  // Toggle Hide Amounts
  const toggleHideAmounts = useCallback(() => {
    setHideAmounts((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rizqflow_hide_amounts', String(next));
      }
      return next;
    });
  }, []);

  // Toggle Theme
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rizqflow_theme', next);
        if (next === 'light') {
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.add('dark');
        }
      }
      return next;
    });
  }, []);

  // Share plan URL
  const sharePlan = useCallback(async (): Promise<string> => {
    const hash = encodeProfileToHash(profile);
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const pathname = typeof window !== 'undefined' ? window.location.pathname : '/planner';
    const fullUrl = `${origin}${pathname}${hash}`;

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(fullUrl);
        showToast('Plan link copied to clipboard!');
      } catch (err) {
        console.error('Failed to copy', err);
      }
    }
    return fullUrl;
  }, [profile, showToast]);

  // Masked formatting helpers
  const formatPkrMasked = useCallback(
    (n: number, options?: FormatPkrOptions) => {
      const formatted = formatPkr(n, options);
      return maskAmount(formatted, hideAmounts);
    },
    [hideAmounts]
  );

  const formatCompactPkrMasked = useCallback(
    (n: number) => {
      const formatted = formatCompactPkr(n);
      return maskAmount(formatted, hideAmounts);
    },
    [hideAmounts]
  );

  // Auth Actions
  const signInUser = useCallback(
    (email: string, pass: string) => {
      const res = signIn(email, pass);
      const user = res.user;
      if (res.success && user) {
        setCurrentUser(user);
        setUserPortfolios(user.portfolios);
        setActivePortfolioId(user.activePortfolioId);

        const activePort = user.portfolios.find((p) => p.id === user.activePortfolioId);
        if (activePort) {
          setProfileState(activePort.profile);
        }
      }
      return res;
    },
    []
  );

  const signUpUser = useCallback(
    (name: string, email: string, pass: string, initialProfile?: UserProfile, portfolioName?: string) => {
      const res = signUp(name, email, pass, initialProfile || profile, portfolioName);
      const user = res.user;
      if (res.success && user) {
        setCurrentUser(user);
        setUserPortfolios(user.portfolios);
        setActivePortfolioId(user.activePortfolioId);

        const activePort = user.portfolios.find((p) => p.id === user.activePortfolioId);
        if (activePort) {
          setProfileState(activePort.profile);
        }
      }
      return res;
    },
    [profile]
  );

  const signOutUser = useCallback(() => {
    signOut();
    setCurrentUser(null);
    setUserPortfolios([]);
    setActivePortfolioId('');
    showToast('Signed out successfully.');
  }, [showToast]);

  const switchActivePortfolio = useCallback(
    (portfolioId: string) => {
      if (!currentUser) return;
      const targetProfile = switchUserPortfolio(currentUser.id, portfolioId);
      if (targetProfile) {
        setActivePortfolioId(portfolioId);
        setProfileState(targetProfile);
        // Refresh portfolios list
        const users = getRegisteredUsers();
        const user = users.find((u) => u.id === currentUser.id);
        if (user) {
          setUserPortfolios(user.portfolios);
        }
      }
    },
    [currentUser]
  );

  const createNewPortfolio = useCallback(
    (name: string, baseProfile?: UserProfile) => {
      if (!currentUser) return { success: false };
      const res = createPortfolioForUser(currentUser.id, name, baseProfile || profile);
      if (res.success && res.user && res.portfolio) {
        setCurrentUser(res.user);
        setUserPortfolios(res.user.portfolios);
        setActivePortfolioId(res.portfolio.id);
        setProfileState(res.portfolio.profile);
      }
      return res;
    },
    [currentUser, profile]
  );

  const openAuthModal = useCallback((mode: 'signin' | 'signup' | 'portfolios' = 'signin') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  }, []);

  const openOnboardingModal = useCallback((mode: 'create' | 'update' = 'create') => {
    setOnboardingMode(mode);
    setOnboardingModalOpen(true);
  }, []);

  return (
    <ProfileContext.Provider
      value={{
        profile,
        setProfile: setProfileState,
        updateProfile,
        resetToPreset,
        hideAmounts,
        toggleHideAmounts,
        theme,
        toggleTheme,
        toast,
        showToast,
        sharePlan,
        formatPkrMasked,
        formatCompactPkrMasked,
        currentUser,
        userPortfolios,
        activePortfolioId,
        signInUser,
        signUpUser,
        signOutUser,
        switchActivePortfolio,
        createNewPortfolio,
        openAuthModal,
        openOnboardingModal,
      }}
    >
      {children}

      {/* Global Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
        onOpenOnboarding={() => openOnboardingModal('create')}
        onRecalibrate={() => openOnboardingModal('update')}
      />

      {/* Global Onboarding Setup Wizard Modal */}
      <OnboardingWizardModal
        isOpen={onboardingModalOpen}
        mode={onboardingMode}
        onClose={() => setOnboardingModalOpen(false)}
      />

      {/* Floating Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-black font-semibold text-xs shadow-2xl shadow-emerald-500/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-black animate-ping" />
          <span>{toast}</span>
        </div>
      )}
    </ProfileContext.Provider>
  );
}
