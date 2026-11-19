import type { GeoPageData } from "./browser";
import type { RawFinding } from "./types";
// Technical readiness only. llms.txt, FAQ schema and question headings are
// observations, never universal requirements or evidence of AI citations.
export const GEO_TOTAL_CHECKS = 3;
export function buildGeoFindings(data: GeoPageData): RawFinding[] {
  const findings: RawFinding[] = [];
  if (data.aiCrawlersBlocked)
    findings.push({
      id: "geo-ai-crawlers-blocked",
      impact: "serious",
      help: "At least one search-oriented AI crawler is disallowed for this URL",
      description:
        "Review the intended access policy. A block for one crawler does not imply absence from all AI answers.",
      occurrences: 1,
    });
  if (data.wordCount === 0)
    findings.push({
      id: "geo-no-extractable-text",
      impact: "serious",
      help: "No extractable visible text",
      description:
        "Review whether the page exposes useful text content without requiring an interaction.",
      occurrences: 1,
    });
  if (!data.hasSemanticLandmark)
    findings.push({
      id: "geo-missing-semantic-landmark",
      impact: "minor",
      help: "No main or article landmark",
      description:
        "A semantic content landmark helps identify the primary content. It does not guarantee indexing or citation.",
      occurrences: 1,
    });
  return findings;
}
