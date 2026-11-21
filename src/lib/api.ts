import type { PortfolioRecord } from '@/lib/auth';
import type { UserProfile } from '@/types';

/**
 * Client for the RizqFlow accounts API (same-origin /api/*).
 * The session lives in an httpOnly cookie set by the server; these calls
 * just carry it along. Portfolios returned here are the server copies —
 * the same data on every device the user signs in from.
 */

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  activePortfolioId: string | null;
}

export interface AuthResult {
  user: ApiUser;
  portfolios: PortfolioRecord[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as any)?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  me: () => call<AuthResult>('/api/me'),
  signUp: (name: string, email: string, password: string) =>
    call<AuthResult>('/api/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password }) }),
  signIn: (email: string, password: string) =>
    call<AuthResult>('/api/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) }),
  signOut: () => call<{ ok: boolean }>('/api/auth/signout', { method: 'POST' }),
  setActive: (activePortfolioId: string) =>
    call<{ ok: boolean }>('/api/me', { method: 'PATCH', body: JSON.stringify({ activePortfolioId }) }),
  createPortfolio: (name: string, profile: UserProfile) =>
    call<{ portfolio: PortfolioRecord; activePortfolioId: string }>('/api/portfolios', {
      method: 'POST',
      body: JSON.stringify({ name, profile }),
    }),
  updatePortfolio: (id: string, patch: { name?: string; profile?: UserProfile }) =>
    call<{ portfolio: PortfolioRecord }>(`/api/portfolios/${id}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),
  deletePortfolio: (id: string) =>
    call<{ portfolios: PortfolioRecord[]; activePortfolioId: string | null }>(`/api/portfolios/${id}`, {
      method: 'DELETE',
    }),
};
