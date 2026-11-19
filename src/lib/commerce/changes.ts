import type { ScanReport } from "../types";
type Result = {
  url: string;
  reports: ScanReport[] | null;
  error?: string | null;
};
export function changes(before: Result[], after: Result[]) {
  let newIssues = 0,
    resolved = 0,
    regressions = 0;
  for (const page of after) {
    if (page.error || !page.reports) continue;
    const old = before.find((p) => p.url === page.url && !p.error);
    if (!old?.reports) continue;
    for (const report of page.reports) {
      const previous = old.reports.find(
        (r) =>
          r.scanType === report.scanType &&
          r.methodologyVersion === report.methodologyVersion,
      );
      if (!previous) continue;
      const prev = new Set(previous.issues.map((i) => i.ruleId));
      const current = new Set(report.issues.map((i) => i.ruleId));
      newIssues += [...current].filter((i) => !prev.has(i)).length;
      resolved += [...prev].filter((i) => !current.has(i)).length;
      if (report.score < previous.score) regressions++;
    }
  }
  return { newIssues, resolved, regressions };
}
