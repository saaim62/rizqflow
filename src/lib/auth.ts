import { UserProfile } from '@/types';
import { PRESET_PROFILES } from '@/data/marketData';

export interface PortfolioRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  profile: UserProfile;
}

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  passwordHash: string; // Client-side hashed/encoded for local session validation
  createdAt: string;
  portfolios: PortfolioRecord[];
  activePortfolioId: string;
}

export interface AuthSession {
  userId: string;
  email: string;
  name: string;
  activePortfolioId: string;
}

const STORAGE_KEY_USERS = 'rizqflow_users_v1';
const STORAGE_KEY_SESSION = 'rizqflow_active_session_v1';

/**
 * Simple client-side hash for password matching in local-first environment
 */
function hashPassword(pass: string): string {
  let hash = 0;
  for (let i = 0; i < pass.length; i++) {
    const char = pass.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return 'rf_hash_' + Math.abs(hash).toString(36) + '_' + pass.length;
}

/**
 * Get all registered local user accounts
 */
export function getRegisteredUsers(): UserAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_USERS);
    if (!raw) {
      // Seed initial account for Saim Asif (saaim62@gmail.com)
      const saimDefaultProfile = (PRESET_PROFILES[0]?.profile || PRESET_PROFILES[0]) as UserProfile;
      const initialSaim: UserAccount = {
        id: 'usr_saim_62',
        name: 'Saim Asif',
        email: 'saaim62@gmail.com',
        passwordHash: hashPassword('password123'),
        createdAt: new Date().toISOString(),
        activePortfolioId: 'port_saim_primary',
        portfolios: [
          {
            id: 'port_saim_primary',
            name: 'Halal Dividend Wealth (Primary)',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            profile: {
              ...saimDefaultProfile,
              monthlyIncomePkr: 250000,
              monthlyInvestPkr: 100000,
              lumpSumPkr: 1500000,
              shariahOnly: true,
              taxStatus: 'filer',
            },
          },
          {
            id: 'port_saim_car',
            name: 'EV Transition & Solar Map',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            profile: {
              ...saimDefaultProfile,
              solarKw: 10,
              solarTariffMode: 'net-metering-legacy',
              dailyCommuteKm: 40,
            },
          },
        ],
      };
      saveRegisteredUsers([initialSaim]);
      return [initialSaim];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse registered users', e);
    return [];
  }
}

/**
 * Persist user accounts list
 */
export function saveRegisteredUsers(users: UserAccount[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users));
  } catch (e) {
    console.error('Failed to save registered users', e);
  }
}

/**
 * Get active session
 */
export function getActiveSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_SESSION);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

/**
 * Persist active session
 */
export function saveActiveSession(session: AuthSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(STORAGE_KEY_SESSION);
      window.localStorage.setItem('rizqflow_explicit_signout', 'true');
    } else {
      window.localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
      window.localStorage.removeItem('rizqflow_explicit_signout');
    }
  } catch (e) {
    console.error('Failed to save active session', e);
  }
}

/**
 * Sign In
 */
export function signIn(email: string, pass: string): { success: boolean; user?: UserAccount; error?: string } {
  const users = getRegisteredUsers();
  const normalizedEmail = email.trim().toLowerCase();
  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

  if (!user) {
    return { success: false, error: 'Account not found. Please sign up or check your email.' };
  }

  if (user.passwordHash !== hashPassword(pass)) {
    return { success: false, error: 'Incorrect password. Try again.' };
  }

  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    activePortfolioId: user.activePortfolioId,
  };
  saveActiveSession(session);

  return { success: true, user };
}

/**
 * Sign Up
 */
export function signUp(
  name: string,
  email: string,
  pass: string,
  initialProfile?: UserProfile,
  portfolioName?: string
): { success: boolean; user?: UserAccount; error?: string } {
  const users = getRegisteredUsers();
  const normalizedEmail = email.trim().toLowerCase();

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    return { success: false, error: 'An account with this email already exists. Please sign in.' };
  }

  const defaultProfile = initialProfile || ((PRESET_PROFILES[0]?.profile || PRESET_PROFILES[0]) as UserProfile);
  const userId = 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);
  const portfolioId = 'port_' + Date.now().toString(36);

  const newPortfolio: PortfolioRecord = {
    id: portfolioId,
    name: portfolioName || `${name.split(' ')[0]}'s Main Portfolio`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: defaultProfile,
  };

  const newUser: UserAccount = {
    id: userId,
    name: name.trim(),
    email: normalizedEmail,
    passwordHash: hashPassword(pass),
    createdAt: new Date().toISOString(),
    activePortfolioId: portfolioId,
    portfolios: [newPortfolio],
  };

  users.push(newUser);
  saveRegisteredUsers(users);

  const session: AuthSession = {
    userId: newUser.id,
    email: newUser.email,
    name: newUser.name,
    activePortfolioId: portfolioId,
  };
  saveActiveSession(session);

  return { success: true, user: newUser };
}

/**
 * Sign Out
 */
export function signOut(): void {
  saveActiveSession(null);
}

/**
 * Create a new portfolio for user
 */
export function createPortfolioForUser(
  userId: string,
  name: string,
  baseProfile: UserProfile
): { success: boolean; user?: UserAccount; portfolio?: PortfolioRecord } {
  const users = getRegisteredUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return { success: false };

  const newPort: PortfolioRecord = {
    id: 'port_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
    name: name.trim() || 'New Portfolio',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    profile: { ...baseProfile },
  };

  user.portfolios.push(newPort);
  user.activePortfolioId = newPort.id;
  saveRegisteredUsers(users);

  // Update active session
  saveActiveSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    activePortfolioId: newPort.id,
  });

  return { success: true, user, portfolio: newPort };
}

/**
 * Switch user's active portfolio
 */
export function switchUserPortfolio(userId: string, portfolioId: string): UserProfile | null {
  const users = getRegisteredUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return null;

  const target = user.portfolios.find((p) => p.id === portfolioId);
  if (!target) return null;

  user.activePortfolioId = portfolioId;
  target.updatedAt = new Date().toISOString();
  saveRegisteredUsers(users);

  saveActiveSession({
    userId: user.id,
    email: user.email,
    name: user.name,
    activePortfolioId: portfolioId,
  });

  return target.profile;
}

/**
 * Save updated profile back into active portfolio
 */
export function saveProfileToActivePortfolio(userId: string, portfolioId: string, updatedProfile: UserProfile): void {
  const users = getRegisteredUsers();
  const user = users.find((u) => u.id === userId);
  if (!user) return;

  const port = user.portfolios.find((p) => p.id === portfolioId);
  if (port) {
    port.profile = { ...updatedProfile };
    port.updatedAt = new Date().toISOString();
    saveRegisteredUsers(users);
  }
}
