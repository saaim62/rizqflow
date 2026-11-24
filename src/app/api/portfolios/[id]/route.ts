import { NextResponse } from 'next/server';
import { guardAccounts, currentSessionUser } from '@/lib/server/http';
import { updatePortfolio, deletePortfolio, listPortfolios } from '@/lib/server/store';
import { sanitizeProfile } from '@/lib/stateUrl';
import { getDefaultFallbackProfile } from '@/lib/portfolioTransfer';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  const user = await currentSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });

  const MAX_BODY = 256 * 1024;
  const cl = Number(req.headers.get('content-length') || 0);
  if (cl > MAX_BODY) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 });
  }
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
    const { id } = await params;
    const patch: { name?: string; profile?: any } = {};
    if (typeof body.name === 'string') {
      const cleanName = body.name.trim().slice(0, 80);
      if (!cleanName) {
        return NextResponse.json({ error: 'Portfolio name cannot be empty.' }, { status: 400 });
      }
      const existing = await listPortfolios(user.id);
      if (existing.some((p) => p.id !== id && p.name.trim().toLowerCase() === cleanName.toLowerCase())) {
        return NextResponse.json({ error: 'A portfolio with this name already exists.' }, { status: 409 });
      }
      patch.name = cleanName;
    }
    if (body.profile !== undefined) {
      if (!body.profile || typeof body.profile !== 'object' || Array.isArray(body.profile)) {
        return NextResponse.json({ error: 'Profile must be an object.' }, { status: 400 });
      }
      patch.profile = sanitizeProfile(body.profile, getDefaultFallbackProfile());
    }
    const record = await updatePortfolio(user.id, id, patch);
    if (!record) return NextResponse.json({ error: 'Portfolio not found.' }, { status: 404 });
    return NextResponse.json({ portfolio: record });
  } catch (err) {
    console.error('update portfolio failed', err);
    return NextResponse.json({ error: 'Could not save the portfolio.' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  const user = await currentSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { id } = await params;
    const result = await deletePortfolio(user.id, id);
    if (!result) return NextResponse.json({ error: 'Portfolio not found.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (err) {
    console.error('delete portfolio failed', err);
    return NextResponse.json({ error: 'Could not delete the portfolio.' }, { status: 500 });
  }
}
