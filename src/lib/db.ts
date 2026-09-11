import { neon } from '@neondatabase/serverless';
import type { Language, ScanReport, ScanType } from './types';

function getSql() {
  const connectionString = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('db_not_configured');
  }
  return neon(connectionString);
}

let schemaEnsured = false;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  const sql = getSql();
  await sql`
    CREATE TABLE IF NOT EXISTS scans (
      id BIGSERIAL PRIMARY KEY,
      email TEXT,
      url TEXT NOT NULL,
      language TEXT NOT NULL,
      scan_type TEXT NOT NULL DEFAULT 'accessibility',
      score INTEGER NOT NULL,
      total_issues INTEGER NOT NULL,
      manual_minutes INTEGER NOT NULL,
      automated_minutes INTEGER NOT NULL,
      requester_ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`ALTER TABLE scans ALTER COLUMN email DROP NOT NULL;`;
  await sql`ALTER TABLE scans ADD COLUMN IF NOT EXISTS scan_type TEXT NOT NULL DEFAULT 'accessibility';`;
  await sql`CREATE INDEX IF NOT EXISTS scans_email_idx ON scans (email);`;
  await sql`CREATE INDEX IF NOT EXISTS scans_created_at_idx ON scans (created_at);`;
  schemaEnsured = true;
}

export async function recordScan(report: ScanReport, email: string | null, requesterIp: string | null): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO scans (email, url, language, scan_type, score, total_issues, manual_minutes, automated_minutes, requester_ip)
    VALUES (${email ?? null}, ${report.finalUrl}, ${report.language}, ${report.scanType}, ${report.score}, ${report.totalIssues}, ${report.totals.manualMinutes}, ${report.totals.automatedMinutes}, ${requesterIp})
  `;
}

/**
 * Basic abuse guard: caps how many scans a single email address can trigger
 * within a rolling window. This is a heuristic, not a substitute for real
 * auth — see README for suggested follow-ups (email verification, captcha).
 */
export async function countRecentScansByEmail(email: string, windowMinutes: number): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::text AS count FROM scans
    WHERE email = ${email} AND created_at > now() - (${windowMinutes} || ' minutes')::interval
  `) as Array<{ count: string }>;
  return Number(rows[0]?.count ?? '0');
}

export async function countRecentScansByIp(requesterIp: string, windowMinutes: number): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT COUNT(*)::text AS count FROM scans
    WHERE requester_ip = ${requesterIp} AND created_at > now() - (${windowMinutes} || ' minutes')::interval
  `) as Array<{ count: string }>;
  return Number(rows[0]?.count ?? '0');
}

export interface ScanListRow {
  id: number;
  email: string | null;
  url: string;
  language: Language;
  scanType: ScanType;
  score: number;
  totalIssues: number;
  createdAt: string;
}

export async function listRecentScans(limit = 100): Promise<ScanListRow[]> {
  await ensureSchema();
  const sql = getSql();
  const rows = (await sql`
    SELECT id, email, url, language, scan_type, score, total_issues, created_at
    FROM scans
    ORDER BY created_at DESC
    LIMIT ${limit}
  `) as Array<{
    id: number;
    email: string | null;
    url: string;
    language: Language;
    scan_type: ScanType;
    score: number;
    total_issues: number;
    created_at: Date | string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    url: row.url,
    language: row.language,
    scanType: row.scan_type,
    score: row.score,
    totalIssues: row.total_issues,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}
