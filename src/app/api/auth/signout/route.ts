import { NextResponse } from 'next/server';
import { guardAccounts, clearSessionCookie, currentSessionToken } from '@/lib/server/http';
import { deleteSession } from '@/lib/server/store';

export async function POST() {
  const blocked = guardAccounts();
  if (blocked) return blocked;
  try {
    await deleteSession(await currentSessionToken());
  } catch (err) {
    console.error('signout failed', err);
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
