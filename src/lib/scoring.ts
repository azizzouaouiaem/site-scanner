import type { AxeImpact, RawAxeResult, RawFinding, ScoredIssue } from './types';

/**
 * Deterministic, heuristic time estimation — no LLM call involved.
 *
 * `manualFixMinutes`: how long a developer would typically take to fix every
 * occurrence of a given rule violation by hand (diagnose + code + review).
 * `automatedFixMinutes`: how long it would take our team to fix it for the
 * client using our automated/AI-assisted remediation tooling + QA pass.
 *
 * Both numbers scale with the number of occurrences, but with diminishing
 * returns: the first broken node costs the full "base" price (find the
 * pattern, decide the fix), every additional occurrence of the *same rule*
 * is usually a mechanical repeat of that same fix, so it costs much less.
 */

// Base manual-fix minutes for the first occurrence of a rule, by severity.
const BASE_MANUAL_MINUTES_BY_IMPACT: Record<AxeImpact, number> = {
  critical: 90,
  serious: 45,
  moderate: 20,
  minor: 10,
};

// Extra minutes per *additional* occurrence of the same rule (repetition cost).
const REPEAT_MANUAL_MINUTES_BY_IMPACT: Record<AxeImpact, number> = {
  critical: 12,
  serious: 6,
  moderate: 3,
  minor: 1.5,
};

// The automated/AI-assisted offer is always a flat quarter of the manual
// dev estimate (diagnosis + repetitive fixes are what automation is best at).
const AUTOMATION_TIME_FACTOR = 0.25;

const WCAG_TAG_PATTERN = /^wcag(\d)(\d)(\d?)a{0,3}$/i;

function impactOrDefault(impact: AxeImpact | null): AxeImpact {
  return impact ?? 'moderate';
}

function extractWcagCriteria(tags: string[]): string[] {
  const criteria = new Set<string>();
  for (const tag of tags) {
    const match = WCAG_TAG_PATTERN.exec(tag);
    if (match) {
      const [, major, minor, criterionDigit] = match;
      criteria.add(criterionDigit ? `${major}.${minor}.${criterionDigit}` : `WCAG ${major}.${minor}`);
    }
  }
  return Array.from(criteria).sort((a, b) => a.localeCompare(b));
}

function manualMinutesForOccurrences(impact: AxeImpact, occurrences: number): number {
  const base = BASE_MANUAL_MINUTES_BY_IMPACT[impact];
  const repeat = REPEAT_MANUAL_MINUTES_BY_IMPACT[impact];
  return base + Math.max(0, occurrences - 1) * repeat;
}

export function scoreAxeResult(result: RawAxeResult): ScoredIssue {
  const impact = impactOrDefault(result.impact);
  const occurrences = result.nodes.length || 1;
  const manualFixMinutes = Math.round(manualMinutesForOccurrences(impact, occurrences));
  const automatedFixMinutes = Math.round(manualFixMinutes * AUTOMATION_TIME_FACTOR);

  return {
    ruleId: result.id,
    impact,
    help: result.help,
    description: result.description,
    helpUrl: result.helpUrl,
    wcagCriteria: extractWcagCriteria(result.tags),
    occurrences,
    sampleTargets: result.nodes.slice(0, 3).map((node) => node.target.join(' ')),
    manualFixMinutes,
    automatedFixMinutes,
  };
}

/**
 * Same time-estimation logic as scoreAxeResult(), generalized for the SEO
 * and performance audit engines, which don't have axe-core's tags/nodes
 * shape but produce the same RawFinding fields directly.
 */
export function scoreFinding(finding: RawFinding): ScoredIssue {
  const occurrences = finding.occurrences && finding.occurrences > 0 ? finding.occurrences : 1;
  const manualFixMinutes = Math.round(manualMinutesForOccurrences(finding.impact, occurrences));
  const automatedFixMinutes = Math.round(manualFixMinutes * AUTOMATION_TIME_FACTOR);

  return {
    ruleId: finding.id,
    impact: finding.impact,
    help: finding.help,
    description: finding.description,
    helpUrl: finding.helpUrl ?? '',
    wcagCriteria: finding.wcagCriteria ?? [],
    occurrences,
    sampleTargets: finding.sampleTargets ?? [],
    manualFixMinutes,
    automatedFixMinutes,
  };
}

const IMPACT_WEIGHT: Record<AxeImpact, number> = {
  critical: 6,
  serious: 3,
  moderate: 1.5,
  minor: 0.75,
};

/**
 * 0-100 score = weighted pass rate: each distinct failing rule counts once
 * against its impact weight (not once per DOM node, so 40 repeats of the
 * same missing-label pattern don't swamp the score the way a naive
 * per-occurrence penalty would), with a small capped bonus for rules that
 * repeat across many nodes. Each *passed* rule counts as one point in
 * favour. This is a readability heuristic, not an official WCAG/Lighthouse
 * metric, so it will not exactly match Lighthouse's accessibility score.
 */
export function computeScore(issues: ScoredIssue[], passedRuleCount: number): number {
  if (issues.length === 0) return 100;

  let failedWeight = 0;
  for (const issue of issues) {
    const weight = IMPACT_WEIGHT[issue.impact];
    const repeatBonus = weight * Math.min(issue.occurrences - 1, 9) * 0.05;
    failedWeight += weight + repeatBonus;
  }

  const total = passedRuleCount + failedWeight;
  if (total === 0) return 100;
  return Math.round((100 * passedRuleCount) / total);
}

export function computeTotals(issues: ScoredIssue[]): { manualMinutes: number; automatedMinutes: number } {
  const manualMinutes = issues.reduce((sum, issue) => sum + issue.manualFixMinutes, 0);
  const automatedMinutes = issues.reduce((sum, issue) => sum + issue.automatedFixMinutes, 0);
  return { manualMinutes, automatedMinutes };
}

export function countByImpact(issues: ScoredIssue[]): Record<AxeImpact, number> {
  const counts: Record<AxeImpact, number> = { critical: 0, serious: 0, moderate: 0, minor: 0 };
  for (const issue of issues) {
    counts[issue.impact] += issue.occurrences;
  }
  return counts;
}

export function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes} min`;
  }
  const hours = totalMinutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} h`;
}
