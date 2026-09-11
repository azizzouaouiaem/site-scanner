import { Resend } from 'resend';
import { t } from './i18n';
import { formatMinutes } from './scoring';
import type { ScanReport } from './types';

const IMPACT_COLORS: Record<string, string> = {
  critical: '#ff3b3b',
  serious: '#ff8a3b',
  moderate: '#ffd23b',
  minor: '#8a8f98',
};

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderIssueRow(issue: ScanReport['issues'][number], language: ScanReport['language']): string {
  const strings = t(language);
  const color = IMPACT_COLORS[issue.impact] ?? '#8a8f98';
  return `
    <tr>
      <td style="padding:12px 8px;border-bottom:1px solid #222;vertical-align:top;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;background:${color}22;color:${color};font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">${strings.impact[issue.impact]}</span>
        <div style="color:#f5f5f7;font-size:14px;font-weight:600;margin-top:6px;">${escapeHtml(issue.help)}</div>
        <div style="color:#9a9a9f;font-size:12px;margin-top:4px;">${strings.occurrences(issue.occurrences)} &middot; ${issue.wcagCriteria.join(', ') || '—'}</div>
        <a href="${issue.helpUrl}" style="color:#5b9dff;font-size:12px;">${issue.helpUrl}</a>
      </td>
      <td style="padding:12px 8px;border-bottom:1px solid #222;text-align:right;white-space:nowrap;vertical-align:top;">
        <div style="color:#f5f5f7;font-size:13px;">${formatMinutes(issue.manualFixMinutes)}</div>
        <div style="color:#5bffb0;font-size:12px;margin-top:2px;">${formatMinutes(issue.automatedFixMinutes)}</div>
      </td>
    </tr>`;
}

export function renderReportEmailHtml(report: ScanReport, contactEmail: string, contactUrl: string): string {
  const strings = t(report.language);
  const rows = report.issues.map((issue) => renderIssueRow(issue, report.language)).join('');
  const businessImpactRows = report.businessImpacts
    .map(
      (item, index) => `
    <tr>
      <td style="padding:8px 8px;border-bottom:1px solid #222;vertical-align:top;color:#5a5a5f;font-size:12px;font-weight:700;">${index + 1}.</td>
      <td style="padding:8px 8px;border-bottom:1px solid #222;vertical-align:top;color:#e4e4e7;font-size:13px;line-height:1.5;">${escapeHtml(item.statement)}</td>
    </tr>`,
    )
    .join('');

  return `<!doctype html>
<html>
  <body style="margin:0;background:#0a0a0b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="color:#f5f5f7;font-size:20px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">${strings.siteName[report.scanType]}</div>
      </div>
      <div style="background:#111113;border:1px solid #222;border-radius:16px;padding:28px;text-align:center;">
        <div style="color:#9a9a9f;font-size:13px;word-break:break-all;">${escapeHtml(report.finalUrl)}</div>
        <div style="font-size:56px;font-weight:800;color:#fff;margin:12px 0 4px;">${report.score}</div>
        <div style="color:#9a9a9f;font-size:13px;text-transform:uppercase;letter-spacing:.08em;">${strings.scoreLabel[report.scanType]}</div>
      </div>

      <div style="display:flex;gap:12px;margin-top:16px;">
        <div style="flex:1;background:#111113;border:1px solid #222;border-radius:16px;padding:20px;text-align:center;">
          <div style="color:#fff;font-size:28px;font-weight:800;">${report.totalIssues}</div>
          <div style="color:#9a9a9f;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">${strings.totalIssuesLabel}</div>
        </div>
        <div style="flex:1;background:#111113;border:1px solid #222;border-radius:16px;padding:20px;text-align:center;">
          <div style="color:#fff;font-size:28px;font-weight:800;">${formatMinutes(report.totals.manualMinutes)}</div>
          <div style="color:#9a9a9f;font-size:12px;text-transform:uppercase;letter-spacing:.06em;">${strings.manualTimeLabel}</div>
        </div>
      </div>

      <div style="margin-top:24px;background:#111113;border:1px solid #222;border-radius:16px;overflow:hidden;">
        <div style="padding:16px 16px 0;color:#f5f5f7;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${strings.topIssuesTitle}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div style="margin-top:24px;background:#111113;border:1px solid #222;border-radius:16px;overflow:hidden;">
        <div style="padding:16px 16px 0;color:#f5f5f7;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${strings.businessImpactsTitle}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <tbody>${businessImpactRows}</tbody>
        </table>
      </div>

      <div style="margin-top:24px;background:linear-gradient(135deg,#1a1a1d,#0f0f11);border:1px solid #2a2a2e;border-radius:16px;padding:24px;text-align:center;">
        <div style="color:#9a9a9f;font-size:13px;">${strings.automatedTimeLabel}</div>
        <div style="color:#5bffb0;font-size:32px;font-weight:800;margin:8px 0 16px;">${formatMinutes(report.totals.automatedMinutes)}</div>
        <a href="${contactUrl}?utm_source=report&utm_medium=email" style="display:inline-block;background:#e82127;color:#fff;text-decoration:none;font-weight:700;padding:12px 28px;border-radius:999px;font-size:13px;letter-spacing:.04em;text-transform:uppercase;">${strings.contactCta}</a>
        <div style="color:#5a5a5f;font-size:11px;margin-top:12px;">${escapeHtml(contactEmail)}</div>
      </div>

      <div style="color:#5a5a5f;font-size:11px;text-align:center;margin-top:24px;">${new Date(report.scannedAt).toUTCString()}</div>
    </div>
  </body>
</html>`;
}

export async function sendReportEmail(params: {
  report: ScanReport;
  toEmail: string;
  subject: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const contactEmail = process.env.CONTACT_EMAIL ?? 'aziz.zouaoui.aem@gmail.com';
  const contactUrl = process.env.CONTACT_URL ?? 'https://example.com/contact';

  if (!apiKey || !fromEmail) {
    // Local dev convenience: let the full scan flow be tested end-to-end
    // without a Resend account. Never falls back silently in production.
    if (process.env.NODE_ENV !== 'production') {
      console.warn(
        `[dev] RESEND_API_KEY/RESEND_FROM_EMAIL not set — skipping real send. Would have emailed "${params.subject}" to ${params.toEmail}.`,
      );
      return;
    }
    throw new Error('email_not_configured');
  }

  const resend = new Resend(apiKey);
  const html = renderReportEmailHtml(params.report, contactEmail, contactUrl);

  const { error } = await resend.emails.send({
    from: fromEmail,
    to: params.toEmail,
    subject: params.subject,
    html,
  });

  if (error) {
    throw new Error(`email_send_failed: ${error.message}`);
  }
}
