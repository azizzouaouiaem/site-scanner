import { neon } from '@neondatabase/serverless';
import type { Language, ScanReport } from './types';

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
      email TEXT NOT NULL,
      url TEXT NOT NULL,
      language TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_issues INTEGER NOT NULL,
      manual_minutes INTEGER NOT NULL,
      automated_minutes INTEGER NOT NULL,
      requester_ip TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS scans_email_idx ON scans (email);`;
  await sql`CREATE INDEX IF NOT EXISTS scans_created_at_idx ON scans (created_at);`;
  schemaEnsured = true;
}

export async function recordScan(report: ScanReport, email: string, requesterIp: string | null): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`
    INSERT INTO scans (email, url, language, score, total_issues, manual_minutes, automated_minutes, requester_ip)
    VALUES (${email}, ${report.finalUrl}, ${report.language}, ${report.score}, ${report.totalIssues}, ${report.totals.manualMinutes}, ${report.totals.automatedMinutes}, ${requesterIp})
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
  email: string;
  url: string;
  language: Language;
  score: number;
  createdAt: string;
}
