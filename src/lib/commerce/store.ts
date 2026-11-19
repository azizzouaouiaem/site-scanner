import postgres from "postgres";
let client: ReturnType<typeof postgres> | undefined;
export function sql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("database_not_configured");
  return (client ??= postgres(url, {
    // Local production-build checks use a disposable loopback database.
    ssl: ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)
      ? false
      : "require",
    prepare: false,
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  }));
}
let ready: Promise<void> | undefined;
export function schema() {
  return (ready ??= init().catch((error) => {
    ready = undefined;
    throw error;
  }));
}
async function init() {
  await sql().begin(async (db) => {
    await db`SELECT pg_advisory_xact_lock(831941105)`;
    await db`CREATE TABLE IF NOT EXISTS scanner_users (id UUID PRIMARY KEY, email TEXT UNIQUE NOT NULL, stripe_customer TEXT UNIQUE, subscription_id TEXT UNIQUE, subscription_status TEXT NOT NULL DEFAULT 'none', created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await db`CREATE TABLE IF NOT EXISTS scanner_tokens (hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES scanner_users(id), kind TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, used BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await db`CREATE TABLE IF NOT EXISTS scanner_limits (key TEXT NOT NULL, bucket BIGINT NOT NULL, count INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(key,bucket))`;
    await db`CREATE TABLE IF NOT EXISTS scanner_orders (id UUID PRIMARY KEY, user_id UUID NOT NULL REFERENCES scanner_users(id), kind TEXT NOT NULL, url TEXT NOT NULL, language TEXT NOT NULL, stripe_session TEXT UNIQUE, status TEXT NOT NULL DEFAULT 'pending', reports JSONB, advice JSONB, pdf BYTEA, attempt INTEGER NOT NULL DEFAULT 0, run_id TEXT, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await db`CREATE TABLE IF NOT EXISTS scanner_sites (id UUID PRIMARY KEY, user_id UUID UNIQUE NOT NULL REFERENCES scanner_users(id), url TEXT NOT NULL, language TEXT NOT NULL, next_run TIMESTAMPTZ NOT NULL DEFAULT now(), created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await db`CREATE TABLE IF NOT EXISTS scanner_cycles (id UUID PRIMARY KEY, site_id UUID NOT NULL REFERENCES scanner_sites(id) ON DELETE CASCADE, status TEXT NOT NULL DEFAULT 'queued', run_id TEXT, notified BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`;
    await db`CREATE UNIQUE INDEX IF NOT EXISTS scanner_cycle_active ON scanner_cycles(site_id) WHERE status IN ('queued','running')`;
    await db`CREATE TABLE IF NOT EXISTS scanner_results (cycle_id UUID NOT NULL REFERENCES scanner_cycles(id) ON DELETE CASCADE, url TEXT NOT NULL, reports JSONB, error TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(cycle_id,url))`;
    for (const table of [
      "scanner_users",
      "scanner_tokens",
      "scanner_limits",
      "scanner_orders",
      "scanner_sites",
      "scanner_cycles",
      "scanner_results",
    ]) {
      await db.unsafe(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
    await db`CREATE INDEX IF NOT EXISTS scanner_tokens_user ON scanner_tokens(user_id)`;
    await db`CREATE UNIQUE INDEX IF NOT EXISTS scanner_pending_site_order ON scanner_orders(user_id) WHERE kind='site' AND status='pending'`;
    await db`DELETE FROM scanner_tokens WHERE expires_at < now() - interval '1 day'`;
    await db`DELETE FROM scanner_limits WHERE bucket < floor(extract(epoch from now()) / 900) - 192`;
  });
}
export interface User {
  id: string;
  email: string;
  stripe_customer: string | null;
  subscription_id: string | null;
  subscription_status: string;
}
export const active = (user: Pick<User, "subscription_status">) =>
  ["active", "trialing"].includes(user.subscription_status);
export async function limit(key: string, max: number) {
  await schema();
  const bucket = Math.floor(Date.now() / 900000);
  const rows =
    await sql()`INSERT INTO scanner_limits(key,bucket) VALUES (${key},${bucket}) ON CONFLICT(key,bucket) DO UPDATE SET count = scanner_limits.count + 1 RETURNING count`;
  if (Number(rows[0]?.count) > max) throw new Error("rate_limited");
}
