import { NextResponse } from 'next/server';
import { countRecentScansByEmail, countRecentScansByIp, recordScan } from '@/lib/db';
import { sendReportEmail } from '@/lib/email';
import { buildScanReport } from '@/lib/report';
import { renderScanReportHtml } from '@/lib/report-html';
import { assertPublicHttpUrl, UnsafeUrlError } from '@/lib/ssrf-guard';
import { ScanNavigationError, ScanTimeoutError } from '@/lib/browser';
import { scanRequestSchema } from '@/lib/validators';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EMAIL_RATE_LIMIT_WINDOW_MINUTES = 60;
const EMAIL_RATE_LIMIT_MAX = 5;
const IP_RATE_LIMIT_WINDOW_MINUTES = 15;
const IP_RATE_LIMIT_MAX = 10;

function getRequesterIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? null;
  }
  return request.headers.get('x-real-ip');
}

function emailSubject(language: 'en' | 'fr', scanType: 'accessibility' | 'seo' | 'performance', finalUrl: string): string {
  const labels = {
    en: { accessibility: 'accessibility', seo: 'SEO', performance: 'performance' },
    fr: { accessibility: "d'accessibilité", seo: 'SEO', performance: 'de performance' },
  } as const;
  return language === 'fr'
    ? `Votre rapport ${labels.fr[scanType]} pour ${finalUrl}`
    : `Your ${labels.en[scanType]} report for ${finalUrl}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = scanRequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  const { url, email, language, scanType } = parsed.data;
  const requesterIp = getRequesterIp(request);

  try {
    const [emailCount, ipCount] = await Promise.all([
      email ? countRecentScansByEmail(email, EMAIL_RATE_LIMIT_WINDOW_MINUTES) : Promise.resolve(0),
      requesterIp ? countRecentScansByIp(requesterIp, IP_RATE_LIMIT_WINDOW_MINUTES) : Promise.resolve(0),
    ]);

    if (emailCount >= EMAIL_RATE_LIMIT_MAX || ipCount >= IP_RATE_LIMIT_MAX) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }
  } catch {
    // If the DB isn't reachable, fail open on rate limiting rather than
    // blocking every scan — the scan itself will still surface DB errors.
  }

  let validatedUrl: URL;
  try {
    validatedUrl = await assertPublicHttpUrl(url);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      return NextResponse.json({ error: 'blocked_url' }, { status: 400 });
    }
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  try {
    const report = await buildScanReport(validatedUrl, language, scanType);

    if (email) {
      await sendReportEmail({
        report,
        toEmail: email,
        subject: emailSubject(language, scanType, report.finalUrl),
      });
    }

    recordScan(report, email ?? null, requesterIp).catch(() => {
      // Best-effort analytics write; never block the user response on it.
    });

    return NextResponse.json({
      score: report.score,
      scanType: report.scanType,
      totalIssues: report.totalIssues,
      counts: report.counts,
      totals: report.totals,
      topIssues: report.issues.slice(0, 5).map((issue) => ({
        ruleId: issue.ruleId,
        impact: issue.impact,
        help: issue.help,
        occurrences: issue.occurrences,
        manualFixMinutes: issue.manualFixMinutes,
        automatedFixMinutes: issue.automatedFixMinutes,
      })),
      businessImpacts: report.businessImpacts,
      finalUrl: report.finalUrl,
      reportHtml: report.score > 95 ? null : renderScanReportHtml(report),
    });
  } catch (error) {
    if (error instanceof ScanTimeoutError || error instanceof ScanNavigationError) {
      return NextResponse.json({ error: 'scan_timeout' }, { status: 504 });
    }
    if (error instanceof Error && error.message === 'email_not_configured') {
      console.error('email_not_configured: set RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel');
      return NextResponse.json({ error: 'email_not_configured' }, { status: 503 });
    }
    // Log server-side for observability without leaking internals to the client.
    console.error('scan_failed', error);
    return NextResponse.json({ error: 'scan_failed' }, { status: 500 });
  }
}
