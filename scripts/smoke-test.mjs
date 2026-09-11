// Ad-hoc local smoke test: exercises the real scan pipeline (Playwright +
// axe-core + scoring) against a public URL, without needing Resend/DB
// credentials. Run with: node --import tsx scripts/smoke-test.mjs [url]
const { buildScanReport } = await import('../src/lib/report.ts');

const url = new URL(process.argv[2] ?? 'https://example.com');
const report = await buildScanReport(url, 'en');

console.log(JSON.stringify(
  {
    finalUrl: report.finalUrl,
    score: report.score,
    totalIssues: report.totalIssues,
    counts: report.counts,
    totals: report.totals,
    topIssue: report.issues[0]?.help,
  },
  null,
  2,
));
