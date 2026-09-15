import { scanUrlForAccessibility, scanUrlForGeo, scanUrlForPerformance, scanUrlForSeo } from './browser';
import { getTopBusinessImpacts } from './business-impact';
import { buildGeoFindings, GEO_TOTAL_CHECKS } from './geo-audit';
import { buildPerformanceFindings, PERFORMANCE_TOTAL_CHECKS } from './performance-audit';
import { buildSeoFindings, SEO_TOTAL_CHECKS } from './seo-audit';
import { computeScore, computeTotals, countByImpact, scoreAxeResult, scoreFinding } from './scoring';
import type { Language, ScanReport, ScanType, ScoredIssue } from './types';

function finalizeReport(
  url: URL,
  finalUrl: string,
  language: Language,
  scanType: ScanType,
  issues: ScoredIssue[],
  passedRuleCount: number,
  screenshotDataUrl?: string,
): ScanReport {
  const sorted = [...issues].sort((a, b) => b.manualFixMinutes - a.manualFixMinutes);
  const totals = computeTotals(sorted);
  const counts = countByImpact(sorted);
  const totalIssues = sorted.reduce((sum, issue) => sum + issue.occurrences, 0);

  return {
    url: url.toString(),
    finalUrl,
    language,
    scanType,
    scannedAt: new Date().toISOString(),
    score: computeScore(sorted, passedRuleCount),
    counts,
    totalIssues,
    passedRuleCount,
    issues: sorted,
    businessImpacts: getTopBusinessImpacts(sorted, language, scanType),
    screenshotDataUrl,
    totals,
  };
}

async function buildAccessibilityReport(url: URL, language: Language): Promise<ScanReport> {
  const { finalUrl, violations, passedRuleCount, screenshotDataUrl } = await scanUrlForAccessibility(url);
  const issues = violations.map(scoreAxeResult);
  return finalizeReport(url, finalUrl, language, 'accessibility', issues, passedRuleCount, screenshotDataUrl);
}

async function buildSeoReport(url: URL, language: Language): Promise<ScanReport> {
  const data = await scanUrlForSeo(url);
  const findings = buildSeoFindings(data);
  const issues = findings.map(scoreFinding);
  const passedRuleCount = Math.max(0, SEO_TOTAL_CHECKS - findings.length);
  return finalizeReport(url, data.finalUrl, language, 'seo', issues, passedRuleCount, data.screenshotDataUrl);
}

async function buildPerformanceReport(url: URL, language: Language): Promise<ScanReport> {
  const data = await scanUrlForPerformance(url);
  const findings = buildPerformanceFindings(data);
  const issues = findings.map(scoreFinding);
  const passedRuleCount = Math.max(0, PERFORMANCE_TOTAL_CHECKS - findings.length);
  return finalizeReport(url, data.finalUrl, language, 'performance', issues, passedRuleCount, data.screenshotDataUrl);
}

async function buildGeoReport(url: URL, language: Language): Promise<ScanReport> {
  const data = await scanUrlForGeo(url);
  const findings = buildGeoFindings(data);
  const issues = findings.map(scoreFinding);
  const passedRuleCount = Math.max(0, GEO_TOTAL_CHECKS - findings.length);
  return finalizeReport(url, data.finalUrl, language, 'geo', issues, passedRuleCount, data.screenshotDataUrl);
}

export async function buildScanReport(url: URL, language: Language, scanType: ScanType): Promise<ScanReport> {
  if (scanType === 'seo') return buildSeoReport(url, language);
  if (scanType === 'performance') return buildPerformanceReport(url, language);
  if (scanType === 'geo') return buildGeoReport(url, language);
  return buildAccessibilityReport(url, language);
}

