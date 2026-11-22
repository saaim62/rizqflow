import { NextResponse } from 'next/server';
import { guardAccounts, setSessionCookie, clientKey } from '@/lib/server/http';
import { hashPassword } from '@/lib/server/passwords';
import { createUser, createSession } from '@/lib/server/store';
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
    const { name, email, password } = body;
    const cleanName = String(name || '').trim();
    const cleanEmail = String(email || '').trim().toLowerCase();
    const cleanPass = String(password || '');
    if (!cleanName) return NextResponse.json({ error: 'Please enter your name.' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail))
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    if (cleanPass.length < 6 || cleanPass.length > 128)
      return NextResponse.json({ error: 'Password must be between 6 and 128 characters.' }, { status: 400 });
    if (!allowAttempt(clientKey(req, cleanEmail)))
      return NextResponse.json({ error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });

    const user = await createUser(cleanName, cleanEmail, hashPassword(cleanPass));
    const token = await createSession(user.id);
    await setSessionCookie(token);
    // No portfolio is created here — the setup wizard creates the first one
    // with the user's own numbers (the old flow silently seeded a preset).
    return NextResponse.json({ user, portfolios: [] });
  } catch (err: any) {
    if (err?.code === '23505')
      return NextResponse.json({ error: 'An account with this email already exists. Please sign in.' }, { status: 409 });
    console.error('signup failed', err);
    return NextResponse.json({ error: 'Sign up failed. Please try again.' }, { status: 500 });
  }
}
