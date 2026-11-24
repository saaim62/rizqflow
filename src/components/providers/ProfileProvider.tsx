'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '@/types';
import { PRESET_PROFILES } from '@/data/marketData';
import {
  loadProfileFromStorage,
  saveProfileToStorage,
  encodeProfileToHash,
  decodeProfileFromHash
} from '@/lib/stateUrl';
import { formatPkr, formatCompactPkr, maskAmount, FormatPkrOptions } from '@/lib/format';
import { PortfolioRecord, getRegisteredUsers } from '@/lib/auth';
import { api, ApiUser } from '@/lib/api';
import { migrateStaleSeedValues } from '@/lib/marketRates';
import { AuthModal } from '@/components/auth/AuthModal';
import { OnboardingWizardModal } from '@/components/onboarding/OnboardingWizardModal';
import { AiAssistProvider } from '@/components/providers/AiAssistProvider';

export interface AuthActionResult {
  success: boolean;
  user?: ApiUser;
  portfolios?: PortfolioRecord[];
  error?: string;
}

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
  hasLoaded: boolean;

  // Server-backed accounts (same data on every device)
  currentUser: ApiUser | null;
  userPortfolios: PortfolioRecord[];
  activePortfolioId: string;
  signInUser: (email: string, pass: string) => Promise<AuthActionResult>;
  signUpUser: (name: string, email: string, pass: string) => Promise<AuthActionResult>;
  signOutUser: () => void;
  switchActivePortfolio: (portfolioId: string) => Promise<void>;
  createNewPortfolio: (name: string, baseProfile?: UserProfile) => Promise<{ success: boolean; portfolio?: PortfolioRecord }>;
  deleteUserPortfolio: (portfolioId: string) => Promise<{ success: boolean }>;
  renameUserPortfolio: (portfolioId: string, name: string) => Promise<{ success: boolean }>;
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

const LEGACY_IMPORT_FLAG = 'rizqflow_legacy_imported_v1';

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const defaultProfile = (PRESET_PROFILES[0]?.profile || PRESET_PROFILES[0]) as UserProfile;

  const [profile, setProfileState] = useState<UserProfile>(defaultProfile);
  const [hideAmounts, setHideAmounts] = useState<boolean>(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [toast, setToast] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState<boolean>(false);

  // Auth State (server-backed)
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [userPortfolios, setUserPortfolios] = useState<PortfolioRecord[]>([]);
  const [activePortfolioId, setActivePortfolioId] = useState<string>('');

  // JSON of the profile as last loaded from / saved to the server. The sync
  // effect only PUTs when the live profile differs from this snapshot, so
  // hydrating or switching portfolios never echoes back as a save.
  const lastSyncedRef = useRef<string>('');

  // Pending debounced save ref (FIX-2.1) to preserve edits across fast switches & beforeunload
  const pendingSaveRef = useRef<{ portfolioId: string; profile: UserProfile } | null>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'signup' | 'portfolios'>('signin');
  const [onboardingModalOpen, setOnboardingModalOpen] = useState<boolean>(false);
  const [onboardingMode, setOnboardingMode] = useState<'create' | 'update'>('create');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast(null);
    }, 3500);
  }, []);

  const flushPendingSync = useCallback(async (): Promise<void> => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    const pending = pendingSaveRef.current;
    if (!pending) return;
    pendingSaveRef.current = null;

    try {
      const res = await api.updatePortfolio(pending.portfolioId, { profile: pending.profile });
      lastSyncedRef.current = JSON.stringify(res.portfolio.profile);
      setUserPortfolios((prev) => prev.map((p) => (p.id === res.portfolio.id ? res.portfolio : p)));
    } catch {
      showToast('Could not sync your portfolio to the server — it will retry on the next change.');
    }
  }, [showToast]);

  // Flush on page unload (FIX-2.1)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        const pending = pendingSaveRef.current;
        pendingSaveRef.current = null;
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        try {
          if (typeof fetch !== 'undefined') {
            fetch(`/api/portfolios/${pending.portfolioId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profile: pending.profile }),
              keepalive: true,
            }).catch(() => {});
          }
        } catch {}
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, []);

  const applyServerState = useCallback((user: ApiUser, portfolios: PortfolioRecord[]) => {
    setCurrentUser(user);
    setUserPortfolios(portfolios);
    const activeId = user.activePortfolioId || (portfolios.length > 0 ? portfolios[0].id : '');
    setActivePortfolioId(activeId);
    const activePort = portfolios.find((p) => p.id === activeId);
    if (activePort) {
      const healed = migrateStaleSeedValues(activePort.profile);
      lastSyncedRef.current = JSON.stringify(healed);
      setProfileState(healed);
    }
  }, []);

  /**
   * One-time import of pre-server (localStorage) portfolios. Runs when a
   * server account has no portfolios yet but this browser holds legacy
   * local portfolios under the same email — the upgrade path for users
   * who signed up before accounts moved to the server.
   */
  const importLegacyPortfolios = useCallback(
    async (user: ApiUser): Promise<PortfolioRecord[] | null> => {
      try {
        if (typeof window === 'undefined') return null;
        if (window.localStorage.getItem(LEGACY_IMPORT_FLAG)) return null;
        const legacyUsers = getRegisteredUsers();
        const legacy = legacyUsers.find((u) => u.email.toLowerCase() === user.email.toLowerCase());
        if (!legacy || legacy.portfolios.length === 0) return null;

        const created: PortfolioRecord[] = [];
        for (const p of legacy.portfolios) {
          const res = await api.createPortfolio(p.name, p.profile);
          created.push(res.portfolio);
        }
        const legacyActiveIdx = legacy.portfolios.findIndex((p) => p.id === legacy.activePortfolioId);
        const match = legacyActiveIdx >= 0 ? created[legacyActiveIdx] : created[created.length - 1];
        if (match) {
          await api.setActive(match.id);
          user = { ...user, activePortfolioId: match.id };
        }
        window.localStorage.setItem(LEGACY_IMPORT_FLAG, 'true');
        showToast(`Imported ${created.length} portfolio${created.length > 1 ? 's' : ''} from this browser into your account.`);
        return created;
      } catch (err) {
        console.error('Legacy portfolio import failed', err);
        return null;
      }
    },
    [showToast]
  );

  // Hydrate: privacy/theme, then fast local profile to prevent hydration flash (BUG-AUTH-01), then server session
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const savedPrivacy = window.localStorage.getItem('rizqflow_hide_amounts');
    if (savedPrivacy === 'true') {
      setHideAmounts(true);
    }

    const savedTheme = window.localStorage.getItem('rizqflow_theme') as 'dark' | 'light' | null;
    if (savedTheme) {
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    }

    // Fast initial load from localStorage / URL hash to eliminate signed-out hydration flash (BUG-AUTH-01)
    const initialHash = window.location.hash;
    const initialHashProfile = decodeProfileFromHash(initialHash, defaultProfile);
    if (initialHashProfile) {
      setProfileState(migrateStaleSeedValues(initialHashProfile));
    } else {
      const stored = loadProfileFromStorage(defaultProfile);
      setProfileState(migrateStaleSeedValues(stored));
    }

    (async () => {
      let signedIn = false;
      try {
        const { user, portfolios } = await api.me();
        let finalPortfolios = portfolios;
        if (portfolios.length === 0) {
          const imported = await importLegacyPortfolios(user);
          if (imported) finalPortfolios = imported;
        }
        applyServerState(user, finalPortfolios);
        signedIn = true;
      } catch {
        signedIn = false; // no server session — anonymous mode
      }

      if (signedIn) {
        // FIX-2.2: Decode window.location.hash shared plans for signed-in users too—
        // load as current view without overwriting saved portfolios, toast
        // "Loaded shared plan — it isn't saved to your account", and only persist if edited/explicitly saved.
        const currentHash = window.location.hash;
        const decodedFromHash = decodeProfileFromHash(currentHash, defaultProfile);
        if (decodedFromHash) {
          const healed = migrateStaleSeedValues(decodedFromHash);
          lastSyncedRef.current = JSON.stringify(healed);
          setProfileState(healed);
          showToast("Loaded shared plan — it isn't saved to your account");
        }
      } else {
        if (initialHashProfile) {
          showToast('Loaded shared plan from URL!');
        }
      }

      setHasLoaded(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist: anonymous mirror locally; signed-in profile syncs to the server with debouncing (FIX-2.1)
  useEffect(() => {
    if (!hasLoaded) return;
    saveProfileToStorage(profile);
    if (!currentUser || !activePortfolioId) return;
    const json = JSON.stringify(profile);
    if (json === lastSyncedRef.current) return;

    pendingSaveRef.current = { portfolioId: activePortfolioId, profile };

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      void flushPendingSync();
    }, 900);

    return () => {
      // Clear timeout but keep pendingSaveRef intact so switchActivePortfolio can flush it immediately
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [profile, hasLoaded, currentUser, activePortfolioId, flushPendingSync]);

  const updateProfile = useCallback((updated: Partial<UserProfile>) => {
    setProfileState((prev) => ({
      ...prev,
      ...updated,
    }));
  }, []);

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
        if (currentUser) {
          // Signed in: a preset must NEVER silently overwrite a saved
          // portfolio (the persist effect used to do exactly that). Save
          // the preset as a NEW portfolio instead.
          void createNewPortfolioRef.current(found.name || 'Preset Portfolio', nextProfile).then((res) => {
            if (res.success) showToast(`Preset saved as a new portfolio: ${found.name || presetId}`);
          });
        } else {
          setProfileState(nextProfile);
          saveProfileToStorage(nextProfile);
          showToast(`Reset to preset: ${found.name || presetId}`);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, showToast]
  );

  const toggleHideAmounts = useCallback(() => {
    setHideAmounts((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('rizqflow_hide_amounts', String(next));
      }
      return next;
    });
  }, []);

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

  // ---- Server account actions ----

  const signInUser = useCallback(
    async (email: string, pass: string): Promise<AuthActionResult> => {
      try {
        const { user, portfolios } = await api.signIn(email, pass);
        let finalPortfolios = portfolios;
        let finalUser = user;
        if (portfolios.length === 0) {
          const imported = await importLegacyPortfolios(user);
          if (imported) {
            finalPortfolios = imported;
            const activeLegacy = imported[imported.length - 1];
            if (activeLegacy) finalUser = { ...user, activePortfolioId: activeLegacy.id };
          }
        }
        applyServerState(finalUser, finalPortfolios);
        return { success: true, user: finalUser, portfolios: finalPortfolios };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to sign in.' };
      }
    },
    [applyServerState, importLegacyPortfolios]
  );

  const signUpUser = useCallback(
    async (name: string, email: string, pass: string): Promise<AuthActionResult> => {
      try {
        const { user, portfolios } = await api.signUp(name, email, pass);
        let finalPortfolios = portfolios;
        let finalUser = user;
        if (portfolios.length === 0) {
          const imported = await importLegacyPortfolios(user);
          if (imported) {
            finalPortfolios = imported;
            const last = imported[imported.length - 1];
            if (last) finalUser = { ...user, activePortfolioId: last.id };
          }
        }
        applyServerState(finalUser, finalPortfolios);
        return { success: true, user: finalUser, portfolios: finalPortfolios };
      } catch (err: any) {
        return { success: false, error: err?.message || 'Failed to create account.' };
      }
    },
    [applyServerState, importLegacyPortfolios]
  );

  const signOutUser = useCallback(() => {
    void api.signOut().catch(() => {});
    setCurrentUser(null);
    setUserPortfolios([]);
    setActivePortfolioId('');
    lastSyncedRef.current = '';
    const stored = loadProfileFromStorage(defaultProfile);
    setProfileState(stored);
    showToast('Signed out successfully.');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast]);

  const switchActivePortfolio = useCallback(
    async (portfolioId: string) => {
      if (portfolioId === activePortfolioId) return;
      const target = userPortfolios.find((p) => p.id === portfolioId);
      if (!target || !currentUser) return;

      // FIX-2.1: Flush immediately with the outgoing portfolio ID before any portfolio switch
      await flushPendingSync();

      try {
        await api.setActive(portfolioId);
      } catch {
        showToast('Could not switch portfolio on the server.');
        return;
      }
      setActivePortfolioId(portfolioId);
      setCurrentUser((prev) => (prev ? { ...prev, activePortfolioId: portfolioId } : null));
      const healed = migrateStaleSeedValues(target.profile);
      lastSyncedRef.current = JSON.stringify(healed);
      setProfileState(healed);
    },
    [activePortfolioId, currentUser, userPortfolios, flushPendingSync, showToast]
  );

  const createNewPortfolio = useCallback(
    async (name: string, baseProfile?: UserProfile): Promise<{ success: boolean; portfolio?: PortfolioRecord }> => {
      if (!currentUser) return { success: false };
      const trimmed = name.trim();
      if (!trimmed) {
        showToast('Portfolio name cannot be empty.');
        return { success: false };
      }
      const duplicate = userPortfolios.some(
        (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        showToast(`A portfolio named "${trimmed}" already exists.`);
        return { success: false };
      }

      await flushPendingSync();

      try {
        const res = await api.createPortfolio(trimmed, baseProfile || profile);
        setUserPortfolios((prev) => [...prev, res.portfolio]);
        setActivePortfolioId(res.portfolio.id);
        setCurrentUser({ ...currentUser, activePortfolioId: res.portfolio.id });
        lastSyncedRef.current = JSON.stringify(res.portfolio.profile);
        setProfileState(res.portfolio.profile);
        return { success: true, portfolio: res.portfolio };
      } catch (err: any) {
        showToast(err?.message || 'Could not create the portfolio on the server.');
        return { success: false };
      }
    },
    [currentUser, userPortfolios, profile, flushPendingSync, showToast]
  );
  const createNewPortfolioRef = useRef(createNewPortfolio);
  createNewPortfolioRef.current = createNewPortfolio;

  const deleteUserPortfolio = useCallback(
    async (portfolioId: string): Promise<{ success: boolean }> => {
      if (!currentUser) return { success: false };
      try {
        const res = await api.deletePortfolio(portfolioId);
        setUserPortfolios(res.portfolios);
        const nextActiveId = res.activePortfolioId || '';
        setActivePortfolioId(nextActiveId);
        setCurrentUser({ ...currentUser, activePortfolioId: res.activePortfolioId });
        if (portfolioId === activePortfolioId) {
          const next = res.portfolios.find((p) => p.id === nextActiveId);
          if (next) {
            lastSyncedRef.current = JSON.stringify(next.profile);
            setProfileState(next.profile);
          } else {
            lastSyncedRef.current = '';
            const stored = loadProfileFromStorage(defaultProfile);
    setProfileState(stored);
          }
        }
        return { success: true };
      } catch {
        showToast('Could not delete the portfolio.');
        return { success: false };
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, activePortfolioId, showToast]
  );

  const renameUserPortfolio = useCallback(
    async (portfolioId: string, name: string): Promise<{ success: boolean }> => {
      if (!currentUser) return { success: false };
      const trimmed = name.trim();
      if (!trimmed) {
        showToast('Portfolio name cannot be empty.');
        return { success: false };
      }
      const duplicate = userPortfolios.some(
        (p) => p.id !== portfolioId && p.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (duplicate) {
        showToast(`A portfolio named "${trimmed}" already exists.`);
        return { success: false };
      }
      try {
        const res = await api.updatePortfolio(portfolioId, { name: trimmed });
        setUserPortfolios((prev) => prev.map((p) => (p.id === res.portfolio.id ? res.portfolio : p)));
        return { success: true };
      } catch (err: any) {
        showToast(err?.message || 'Could not rename the portfolio.');
        return { success: false };
      }
    },
    [currentUser, userPortfolios, showToast]
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
        hasLoaded,
        currentUser,
        userPortfolios,
        activePortfolioId,
        signInUser,
        signUpUser,
        signOutUser,
        switchActivePortfolio,
        createNewPortfolio,
        deleteUserPortfolio,
        renameUserPortfolio,
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

      {/* Global Onboarding Setup Wizard Modal — mounted only while open so
          its draft form re-initializes from the current profile every time
          (a permanently mounted wizard kept stale first-mount values). */}
      {onboardingModalOpen && (
        <AiAssistProvider>
          <OnboardingWizardModal
            isOpen={onboardingModalOpen}
            mode={onboardingMode}
            onClose={() => setOnboardingModalOpen(false)}
          />
        </AiAssistProvider>
      )}

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
