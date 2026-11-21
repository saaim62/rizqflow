import { Pool } from 'pg';

/**
 * Postgres access for RizqFlow accounts & portfolios.
 * Connection string comes from DATABASE_URL (set on the server only —
 * see docker-compose.prod.yml / .env.server). When it is absent (local
 * dev, CI, build), `accountsEnabled()` is false and the auth API
 * returns 503 instead of crashing; the public site keeps working.
 */

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

export function accountsEnabled(): boolean {
  return typeof process.env.DATABASE_URL === 'string' && process.env.DATABASE_URL.length > 0;
}

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
  }
  return pool;
}

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const p = getPool();
      await p.query(`
        CREATE TABLE IF NOT EXISTS rf_users (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          active_portfolio_id TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS rf_portfolios (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES rf_users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          profile JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS rf_portfolios_user_idx ON rf_portfolios(user_id);
        CREATE TABLE IF NOT EXISTS rf_sessions (
          token_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES rf_users(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
    })().catch((err) => {
      // Allow a later request to retry schema init after a transient failure.
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}
