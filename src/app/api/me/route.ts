import { NextResponse } from 'next/server';
import { guardAccounts, currentSessionUser } from '@/lib/server/http';
import { listPortfolios, setActivePortfolio } from '@/lib/server/store';

export async function GET() {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  const user = await currentSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  const portfolios = await listPortfolios(user.id);
  return NextResponse.json({ user, portfolios });
}

export async function PATCH(req: Request) {
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
    const { activePortfolioId } = body;
    const ok = await setActivePortfolio(user.id, String(activePortfolioId || ''));
    if (!ok) return NextResponse.json({ error: 'Portfolio not found.' }, { status: 404 });
    return NextResponse.json({ ok: true, activePortfolioId });
  } catch (err) {
    console.error('set active failed', err);
    return NextResponse.json({ error: 'Could not switch portfolio.' }, { status: 500 });
  }
}
