import type { ScanReport } from './types';

const REPORT_COPY = {
  en: {
    product: 'Site Scanner', generated: 'Generated', issues: 'issue(s)',
    screenshot: 'Homepage screenshot', impacts: 'Top business impacts', noImpacts: 'No business impacts detected.', findings: 'Findings', noFindings: 'No issues detected.', advantages: 'Top 10 business advantages after fixing',
    manual: 'manual minutes', automated: 'automated minutes', manualShort: 'manual', automatedShort: 'automated', occurrence: 'occurrence(s)',
  },
  fr: {
    product: 'Site Scanner', generated: 'Généré le', issues: 'problème(s)',
    screenshot: "Capture d'écran de la page d'accueil", impacts: 'Principaux impacts business', noImpacts: "Aucun impact business détecté.", findings: 'Constats', noFindings: 'Aucun problème détecté.', advantages: 'Top 10 avantages business après correction',
    manual: 'minutes manuelles', automated: 'minutes automatisées', manualShort: 'manuel', automatedShort: 'automatisé', occurrence: 'occurrence(s)',
  },
} as const;

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function renderScanReportHtml(report: ScanReport): string {
  const copy = REPORT_COPY[report.language];
  const advantages = [
    ...(report.language === 'fr' ? [
      "Atteindre plus de clients en supprimant les frictions des parcours importants.", "Réduire l'exposition légale et réglementaire.", 'Améliorer la conversion grâce à des contenus et contrôles plus simples.', 'Augmenter la visibilité organique avec une structure et des métadonnées claires.', 'Réduire les abandons grâce à une meilleure performance.', 'Renforcer la confiance envers la marque.', 'Réduire les demandes au support liées aux interactions confuses.', 'Réduire la dette technique en corrigeant les patterns à la source.', "Améliorer la compatibilité mobile, vocale et avec les technologies d'assistance.", 'Créer une base mesurable pour les futures régressions.',
    ] : [
      'Reach more customers by removing friction from important journeys.', 'Reduce legal and compliance exposure.', 'Improve conversion with clearer content, forms, and controls.', 'Increase organic visibility through better structure and metadata.', 'Lower bounce rates with better performance.', 'Strengthen brand trust.', 'Reduce support requests caused by confusing interactions.', 'Reduce technical debt by fixing recurring patterns at their source.', 'Improve mobile, voice-control, and assistive-technology compatibility.', 'Create a measurable baseline for future regression testing.',
    ]),
  ];
  const issues = report.issues
    .map(
      (issue) => `
        <li>
          <strong>${escapeHtml(issue.help)}</strong>
          <span>${escapeHtml(issue.impact)} · ${issue.occurrences} ${copy.occurrence} · ${issue.manualFixMinutes} min ${copy.manual} / ${issue.automatedFixMinutes} min ${copy.automated}</span>
            <span>${escapeHtml(issue.impact)} · ${issue.occurrences} ${copy.occurrence} · ${issue.manualFixMinutes} min ${copy.manualShort} / ${issue.automatedFixMinutes} min ${copy.automatedShort}</span>
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
${report.screenshotDataUrl ? `<meta property="og:image" content="${report.screenshotDataUrl}">` : ''}
<title>${escapeHtml(title)}</title>
<style>
body{margin:0;background:#050608;color:#f5f5f7;font-family:Arial,sans-serif;line-height:1.5}
main{max-width:860px;margin:0 auto;padding:48px 24px 80px}
.card{margin-top:24px;padding:24px;background:#101216;border:1px solid #292c35;border-radius:16px}
h1{font-size:32px;margin:8px 0}h2{font-size:15px;text-transform:uppercase;letter-spacing:.12em;color:#9da3b0;margin:0 0 16px}
.score{font-size:64px;font-weight:800;color:#5bffb0}.muted{color:#9da3b0;font-size:13px;word-break:break-word}
ul{padding-left:22px}li{margin:0 0 18px}li span{display:block;color:#9da3b0;font-size:12px;text-transform:uppercase;letter-spacing:.06em}li p{margin:5px 0;color:#d9dce3}code{display:block;padding:10px;background:#050608;border-radius:8px;color:#a9f3ff;overflow-wrap:anywhere;font-size:12px}
img{display:block;width:100%;max-height:540px;object-fit:cover;border:1px solid #292c35;border-radius:12px;margin-top:16px}
</style>
</head>
<body><main>
<div class="muted">${copy.product} · ${escapeHtml(report.scanType.toUpperCase())}</div>
<h1>${escapeHtml(report.finalUrl)}</h1>
<div class="card"><div class="score">${report.score}/100</div><div class="muted">${copy.generated} ${escapeHtml(report.scannedAt)}</div><div class="muted">${report.totalIssues} ${copy.issues} · ${report.totals.manualMinutes} ${copy.manual} · ${report.totals.automatedMinutes} ${copy.automated}</div></div>
${report.screenshotDataUrl ? `<div class="card"><h2>${copy.screenshot}</h2><img src="${report.screenshotDataUrl}" alt="${copy.screenshot}"></div>` : ''}
<div class="card"><h2>${copy.impacts}</h2><ul>${impacts || `<li>${copy.noImpacts}</li>`}</ul></div>
<div class="card"><h2>${copy.findings}</h2><ul>${issues || `<li>${copy.noFindings}</li>`}</ul></div>
<div class="card"><h2>${copy.advantages}</h2><ol>${advantages.map((item) => `<li>${item}</li>`).join('')}</ol></div>
</main></body></html>`;
}
