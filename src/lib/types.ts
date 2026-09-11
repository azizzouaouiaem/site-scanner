export type Language = 'en' | 'fr';

export type ScanType = 'accessibility' | 'seo' | 'performance';

export type AxeImpact = 'minor' | 'moderate' | 'serious' | 'critical';

export interface RawAxeNode {
  html: string;
  target: string[];
  failureSummary?: string | null;
}

export interface RawAxeResult {
  id: string;
  impact: AxeImpact | null;
  help: string;
  description: string;
  helpUrl: string;
  tags: string[];
  nodes: RawAxeNode[];
}

/**
 * Common shape every audit engine (accessibility/SEO/performance) converts
 * its raw findings into before scoring, so scoring/report/UI/email code is
 * shared across the three scan types.
 */
export interface RawFinding {
  id: string;
  impact: AxeImpact;
  help: string;
  description: string;
  helpUrl?: string;
  occurrences?: number;
  wcagCriteria?: string[];
  sampleTargets?: string[];
}

export interface ScoredIssue {
  ruleId: string;
  impact: AxeImpact;
  help: string;
  description: string;
  helpUrl: string;
  wcagCriteria: string[];
  occurrences: number;
  sampleTargets: string[];
  manualFixMinutes: number;
  automatedFixMinutes: number;
}

export interface BusinessImpact {
  ruleId: string;
  impact: AxeImpact;
  statement: string;
}

export interface ScanReport {
  url: string;
  finalUrl: string;
  language: Language;
  scanType: ScanType;
  scannedAt: string;
  score: number;
  counts: Record<AxeImpact, number>;
  totalIssues: number;
  passedRuleCount: number;
  issues: ScoredIssue[];
  businessImpacts: BusinessImpact[];
  totals: {
    manualMinutes: number;
    automatedMinutes: number;
  };
}

export interface ScanRequestBody {
  url: string;
  email?: string;
  language: Language;
  scanType: ScanType;
}
