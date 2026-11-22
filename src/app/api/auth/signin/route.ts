import { NextResponse } from 'next/server';
import { guardAccounts, setSessionCookie, clientKey } from '@/lib/server/http';
import { verifyPassword } from '@/lib/server/passwords';
import { getUserByEmail, createSession, listPortfolios } from '@/lib/server/store';
import { allowAttempt } from '@/lib/server/rateLimit';

export async function POST(req: Request) {
  const blocked = guardAccounts();
  if (blocked) return blocked;

  let body: any;
  try {
    body = await req.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Malformed or invalid JSON body.' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Malformed or invalid JSON body.' }, { status: 400 });
  }

  try {
    const { email, password } = body;
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');

    if (!cleanEmail || !cleanPass) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 });
    }

    if (!allowAttempt(clientKey(req, cleanEmail)))
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });

    // Enforce 6–128 password length and unify failures with 401
    if (cleanPass.length < 6 || cleanPass.length > 128) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

    const row = await getUserByEmail(cleanEmail);
    if (!row || !verifyPassword(cleanPass, row.password_hash)) {
      return NextResponse.json({ error: 'Invalid email or password.' }, { status: 401 });
    }

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
