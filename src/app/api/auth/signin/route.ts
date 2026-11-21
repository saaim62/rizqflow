import { NextResponse } from 'next/server';
import { guardAccounts, setSessionCookie, clientKey } from '@/lib/server/http';
import { verifyPassword } from '@/lib/server/passwords';
import { getUserByEmail, createSession, listPortfolios } from '@/lib/server/store';
import { allowAttempt } from '@/lib/server/rateLimit';

export async function POST(req: Request) {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  try {
    const { email, password } = await req.json();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    if (!allowAttempt(clientKey(req, cleanEmail)))
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });

    const row = await getUserByEmail(cleanEmail);
    if (!row) return NextResponse.json({ error: 'Account not found. Please sign up or check your email.' }, { status: 404 });
    if (!verifyPassword(cleanPass, row.password_hash))
      return NextResponse.json({ error: 'Incorrect password. Try again.' }, { status: 401 });

    const token = await createSession(row.id);
    await setSessionCookie(token);
    const portfolios = await listPortfolios(row.id);
    const { password_hash: _ph, ...user } = row;
    return NextResponse.json({ user, portfolios });
  } catch (err) {
    console.error('signin failed', err);
    return NextResponse.json({ error: 'Sign in failed. Please try again.' }, { status: 500 });
  }
}
