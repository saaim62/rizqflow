import { getPool, ensureSchema } from './db';
import { hashToken, newId, newSessionToken } from './passwords';
import type { PortfolioRecord } from '@/lib/auth';
import type { UserProfile } from '@/types';

export interface ServerUser {
  id: string;
  name: string;
  email: string;
  activePortfolioId: string | null;
}

interface UserRow extends ServerUser {
  password_hash: string;
}

const SESSION_DAYS = 30;

function rowToPortfolio(row: any): PortfolioRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    profile: row.profile as UserProfile,
  };
}

export async function createUser(name: string, email: string, passwordHash: string): Promise<ServerUser> {
  await ensureSchema();
  const id = newId('usr');
  const res = await getPool().query(
    'INSERT INTO rf_users (id, name, email, password_hash) VALUES ($1, $2, $3, $4) RETURNING id, name, email, active_portfolio_id',
    [id, name, email, passwordHash]
  );
  const r = res.rows[0];
  return { id: r.id, name: r.name, email: r.email, activePortfolioId: r.active_portfolio_id };
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  await ensureSchema();
  const res = await getPool().query('SELECT * FROM rf_users WHERE email = $1', [email]);
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return { id: r.id, name: r.name, email: r.email, activePortfolioId: r.active_portfolio_id, password_hash: r.password_hash };
}

export async function createSession(userId: string): Promise<string> {
  await ensureSchema();
  const token = newSessionToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await getPool().query('INSERT INTO rf_sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [
    hashToken(token),
    userId,
    expires,
  ]);
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<ServerUser | null> {
  if (!token) return null;
  await ensureSchema();
  const res = await getPool().query(
    `SELECT u.id, u.name, u.email, u.active_portfolio_id
       FROM rf_sessions s JOIN rf_users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now()`,
    [hashToken(token)]
  );
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return { id: r.id, name: r.name, email: r.email, activePortfolioId: r.active_portfolio_id };
}

export async function deleteSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await ensureSchema();
  await getPool().query('DELETE FROM rf_sessions WHERE token_hash = $1', [hashToken(token)]);
}

export async function listPortfolios(userId: string): Promise<PortfolioRecord[]> {
  await ensureSchema();
  const res = await getPool().query('SELECT * FROM rf_portfolios WHERE user_id = $1 ORDER BY created_at ASC', [userId]);
  return res.rows.map(rowToPortfolio);
}

export async function createPortfolio(userId: string, name: string, profile: UserProfile): Promise<PortfolioRecord> {
  await ensureSchema();
  const id = newId('port');
  const res = await getPool().query(
    'INSERT INTO rf_portfolios (id, user_id, name, profile) VALUES ($1, $2, $3, $4) RETURNING *',
    [id, userId, name, JSON.stringify(profile)]
  );
  await getPool().query('UPDATE rf_users SET active_portfolio_id = $1 WHERE id = $2', [id, userId]);
  return rowToPortfolio(res.rows[0]);
}

export async function updatePortfolio(
  userId: string,
  portfolioId: string,
  patch: { name?: string; profile?: UserProfile }
): Promise<PortfolioRecord | null> {
  await ensureSchema();
  const current = await getPool().query('SELECT * FROM rf_portfolios WHERE id = $1 AND user_id = $2', [portfolioId, userId]);
  if (current.rows.length === 0) return null;
  const name = patch.name ?? current.rows[0].name;
  const profile = patch.profile ?? current.rows[0].profile;
  const res = await getPool().query(
    'UPDATE rf_portfolios SET name = $1, profile = $2, updated_at = now() WHERE id = $3 AND user_id = $4 RETURNING *',
    [name, JSON.stringify(profile), portfolioId, userId]
  );
  return rowToPortfolio(res.rows[0]);
}

export async function deletePortfolio(
  userId: string,
  portfolioId: string
): Promise<{ portfolios: PortfolioRecord[]; activePortfolioId: string | null } | null> {
  await ensureSchema();
  const del = await getPool().query('DELETE FROM rf_portfolios WHERE id = $1 AND user_id = $2', [portfolioId, userId]);
  if (del.rowCount === 0) return null;
  const portfolios = await listPortfolios(userId);
  const userRes = await getPool().query('SELECT active_portfolio_id FROM rf_users WHERE id = $1', [userId]);
  let active = userRes.rows[0]?.active_portfolio_id as string | null;
  if (active === portfolioId) {
    active = portfolios.length > 0 ? portfolios[portfolios.length - 1].id : null;
    await getPool().query('UPDATE rf_users SET active_portfolio_id = $1 WHERE id = $2', [active, userId]);
  }
  return { portfolios, activePortfolioId: active };
}

export async function setActivePortfolio(userId: string, portfolioId: string): Promise<boolean> {
  await ensureSchema();
  const owned = await getPool().query('SELECT id FROM rf_portfolios WHERE id = $1 AND user_id = $2', [portfolioId, userId]);
  if (owned.rows.length === 0) return false;
  await getPool().query('UPDATE rf_users SET active_portfolio_id = $1 WHERE id = $2', [portfolioId, userId]);
  return true;
}
