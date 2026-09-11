import type { ScanReport } from './types';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderScanReportHtml(report: ScanReport): string {
  const issues = report.issues
    .map(
      (issue) => `
        <li>
          <strong>${escapeHtml(issue.help)}</strong>
          <span>${escapeHtml(issue.impact)} · ${issue.occurrences} occurrence(s) · ${issue.manualFixMinutes} min manual / ${issue.automatedFixMinutes} min automated</span>
          <p>${escapeHtml(issue.description)}</p>
          ${issue.sampleTargets.length ? `<code>${escapeHtml(issue.sampleTargets.join(' | '))}</code>` : ''}
        </li>`,
    )
    .join('');
  const impacts = report.businessImpacts
    .map((impact) => `<li>${escapeHtml(impact.statement)}</li>`)
    .join('');
  const title = `${report.scanType.toUpperCase()} report · ${report.finalUrl}`;

  return `<!doctype html>
<html lang="${report.language}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;background:#050608;color:#f5f5f7;font-family:Arial,sans-serif;line-height:1.5}
main{max-width:860px;margin:0 auto;padding:48px 24px 80px}
.card{margin-top:24px;padding:24px;background:#101216;border:1px solid #292c35;border-radius:16px}
h1{font-size:32px;margin:8px 0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:#9da3b0;margin:0 0 16px}
.score{font-size:64px;font-weight:800;color:#5bffb0}.muted{color:#9da3b0;font-size:13px;word-break:break-word}
ul{padding-left:22px}li{margin:0 0 18px}li span{display:block;color:#9da3b0;font-size:12px;text-transform:uppercase;letter-spacing:.06em}li p{margin:5px 0;color:#d9dce3}code{display:block;padding:10px;background:#050608;border-radius:8px;color:#a9f3ff;overflow-wrap:anywhere;font-size:12px}
</style>
</head>
<body><main>
<div class="muted">Accessibility Reviewer · ${escapeHtml(report.scanType.toUpperCase())}</div>
<h1>${escapeHtml(report.finalUrl)}</h1>
<div class="card"><div class="score">${report.score}/100</div><div class="muted">Generated ${escapeHtml(report.scannedAt)}</div><div class="muted">${report.totalIssues} issue(s) · ${report.totals.manualMinutes} manual minutes · ${report.totals.automatedMinutes} automated minutes</div></div>
<div class="card"><h2>Top business impacts</h2><ul>${impacts || '<li>No business impacts detected.</li>'}</ul></div>
<div class="card"><h2>Findings</h2><ul>${issues || '<li>No issues detected.</li>'}</ul></div>
</main></body></html>`;
}
