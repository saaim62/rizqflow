import { NextResponse } from 'next/server';
import { guardAccounts, currentSessionUser } from '@/lib/server/http';
import { createPortfolio } from '@/lib/server/store';

export async function POST(req: Request) {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  const user = await currentSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { name, profile } = await req.json();
    if (!profile || typeof profile !== 'object')
      return NextResponse.json({ error: 'A portfolio profile is required.' }, { status: 400 });
    const record = await createPortfolio(user.id, String(name || 'My Portfolio').slice(0, 80), profile);
    return NextResponse.json({ portfolio: record, activePortfolioId: record.id });
  } catch (err) {
    console.error('create portfolio failed', err);
    return NextResponse.json({ error: 'Could not create the portfolio.' }, { status: 500 });
  }
}
