import { NextResponse } from 'next/server';
import { guardAccounts, currentSessionUser } from '@/lib/server/http';
import { updatePortfolio, deletePortfolio } from '@/lib/server/store';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  const user = await currentSessionUser();
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  try {
    const { id } = await params;
    const body = await req.json();
    const patch: { name?: string; profile?: any } = {};
    if (typeof body.name === 'string') patch.name = body.name.slice(0, 80);
    if (body.profile && typeof body.profile === 'object') patch.profile = body.profile;
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
