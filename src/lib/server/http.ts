import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { accountsEnabled } from './db';
import { getSessionUser, type ServerUser } from './store';

export const SESSION_COOKIE = 'rf_session';

export function accountsUnavailable() {
  return NextResponse.json({ error: 'Accounts are not available on this deployment.' }, { status: 503 });
}

export function guardAccounts(): NextResponse | null {
  return accountsEnabled() ? null : accountsUnavailable();
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 24 * 3600,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function currentSessionUser(): Promise<ServerUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return getSessionUser(token);
}

export async function currentSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export function clientKey(req: Request, extra: string): string {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  return `${ip}:${extra.toLowerCase()}`;
}
