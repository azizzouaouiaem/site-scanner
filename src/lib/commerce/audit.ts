import {
  launchAndNavigate,
  scanUrlForAccessibility,
  scanUrlForSeo,
  scanUrlForPerformance,
  scanUrlForGeo,
} from "../browser";
import { buildSeoFindings, SEO_TOTAL_CHECKS } from "../seo-audit";
import { buildGeoFindings, GEO_TOTAL_CHECKS } from "../geo-audit";
import {
  buildPerformanceFindings,
  PERFORMANCE_TOTAL_CHECKS,
} from "../performance-audit";
import {
  scoreAxeResult,
  scoreFinding,
  computeScore,
  countByImpact,
  computeTotals,
} from "../scoring";
import { assertPublicHttpUrl } from "../ssrf-guard";
import type { ScanReport, Language, ScoredIssue, ScanType } from "../types";
export async function auditPage(
  raw: string,
  language: Language,
): Promise<{ reports: ScanReport[]; links: string[] }> {
  const url = await assertPublicHttpUrl(raw);
  const shared = await launchAndNavigate(url);
  try {
    const finalUrl = shared.page.url();
    const links = await shared.page
      .locator("a[href]")
      .evaluateAll((elements) =>
        elements.map((el) => (el as HTMLAnchorElement).href),
      );
    const reports: ScanReport[] = [];
    function add(
      scanType: ScanType,
      issues: ScoredIssue[],
      passed: number,
      observations: Record<string, unknown>,
    ) {
      const rank = { critical: 4, serious: 3, moderate: 2, minor: 1 };
      issues.sort(
        (a, b) =>
          rank[b.impact] - rank[a.impact] || b.occurrences - a.occurrences,
      );
      reports.push({
        url: url.toString(),
        finalUrl,
        language,
        scanType,
        scannedAt: new Date().toISOString(),
        score: computeScore(issues, passed),
        counts: countByImpact(issues),
        totalIssues: issues.reduce((n, i) => n + i.occurrences, 0),
        passedRuleCount: passed,
        issues,
        businessImpacts: [],
        totals: computeTotals(issues),
        observations,
        methodologyVersion: "2",
      });
    }
    const a = await scanUrlForAccessibility(url, shared);
    add("accessibility", a.violations.map(scoreAxeResult), a.passedRuleCount, {
      incompleteRuleCount: a.incompleteRuleCount,
    });
    const s = await scanUrlForSeo(url, shared);
    const sf = buildSeoFindings(s);
    add("seo", sf.map(scoreFinding), SEO_TOTAL_CHECKS - sf.length, {
      ...s,
      screenshotDataUrl: undefined,
    });
    const p = await scanUrlForPerformance(url, shared);
    const pf = buildPerformanceFindings(p);
    add(
      "performance",
      pf.map(scoreFinding),
      PERFORMANCE_TOTAL_CHECKS - pf.length,
      { ...p, screenshotDataUrl: undefined },
    );
    const g = await scanUrlForGeo(url, shared);
    const gf = buildGeoFindings(g);
    add("geo", gf.map(scoreFinding), GEO_TOTAL_CHECKS - gf.length, {
      ...g,
      screenshotDataUrl: undefined,
    });
    return { reports, links };
  } finally {
    await shared.browser.close();
  }
}
export function pageCandidates(
  root: string,
  links: string[],
  visited: string[],
) {
  const base = new URL(root);
  const found = new Set(visited);
  for (const raw of links) {
    try {
      const url = new URL(raw);
      url.hash = "";
      if (
        url.origin !== base.origin ||
        url.search ||
        url.username ||
        url.password ||
        /\.(pdf|zip|png|jpg|jpeg|gif|svg|webp|mp4|xml|json|css|js)$/i.test(
          url.pathname,
        )
      )
        continue;
      if (/\/(logout|signout|delete|cart|checkout)(\/|$)/i.test(url.pathname))
        continue;
      found.add(url.toString());
      if (found.size >= 25) break;
    } catch {}
  }
  return [...found].slice(0, 25);
}
