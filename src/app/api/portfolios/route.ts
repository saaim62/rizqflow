import { NextResponse } from 'next/server';
import { guardAccounts, currentSessionUser } from '@/lib/server/http';
import { createPortfolio, listPortfolios } from '@/lib/server/store';
import { sanitizeProfile } from '@/lib/stateUrl';
import { getDefaultFallbackProfile } from '@/lib/portfolioTransfer';

export async function POST(req: Request) {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  const user = await currentSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

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
    const { name, profile } = body;
    if (!profile || typeof profile !== 'object' || Array.isArray(profile))
      return NextResponse.json({ error: 'A portfolio profile object is required.' }, { status: 400 });

    const cleanName = String(name || 'My Portfolio').trim().slice(0, 80) || 'My Portfolio';
    const existing = await listPortfolios(user.id);
    if (existing.some((p) => p.name.trim().toLowerCase() === cleanName.toLowerCase())) {
      return NextResponse.json({ error: 'A portfolio with this name already exists.' }, { status: 409 });
    }

    const sanitized = sanitizeProfile(profile, getDefaultFallbackProfile());
    const record = await createPortfolio(user.id, cleanName, sanitized);
    return NextResponse.json({ portfolio: record, activePortfolioId: record.id });
  } catch (err) {
    console.error('create portfolio failed', err);
    return NextResponse.json({ error: 'Could not create the portfolio.' }, { status: 500 });
  }
}
