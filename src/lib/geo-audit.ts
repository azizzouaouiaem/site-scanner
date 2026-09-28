import type { GeoPageData } from './browser';
import type { RawFinding } from './types';

/**
 * Deterministic GEO (Generative Engine Optimization) and AEO (Answer Engine
 * Optimization) checks: signals that influence whether generative AI
 * assistants (ChatGPT, Perplexity, Google AI Overviews, etc.) and answer
 * engines can crawl, understand, cite, and quote a page. No LLM involved —
 * every check is a deterministic signal collected in the browser
 * (see scanUrlForGeo in browser.ts).
 */

const THIN_CONTENT_WORD_COUNT = 150;

export const GEO_TOTAL_CHECKS = 8;

export function buildGeoFindings(data: GeoPageData): RawFinding[] {
  const findings: RawFinding[] = [];

  if (data.aiCrawlersBlocked) {
    findings.push({
      id: 'geo-ai-crawlers-blocked',
      impact: 'critical',
      help: 'robots.txt blocks major AI crawlers (GPTBot, Google-Extended, PerplexityBot, ClaudeBot, etc.)',
      description:
        'Generative engines and answer engines cannot crawl or cite this page at all while their bots are disallowed.',
      occurrences: 1,
    });
  }

  if (!data.hasLlmsTxt) {
    findings.push({
      id: 'geo-missing-llms-txt',
      impact: 'minor',
      help: 'No /llms.txt file found',
      description:
        "llms.txt is an emerging standard that gives AI assistants a curated, token-efficient summary of a site's key content.",
      occurrences: 1,
    });
  }

  if (!data.hasEntitySchema) {
    findings.push({
      id: 'geo-missing-entity-schema',
      impact: 'moderate',
      help: 'No Organization/WebSite structured data found',
      description:
        'Entity (Organization/WebSite) schema helps generative engines correctly identify and attribute content to your brand.',
      occurrences: 1,
    });
  }

  if (!data.hasAuthorDate) {
    findings.push({
      id: 'geo-missing-author-date',
      impact: 'moderate',
      help: 'No author or publish/update date signal found',
      description:
        'Authorship and freshness signals are used by generative engines to evaluate the trustworthiness and recency of content before citing it.',
      occurrences: 1,
    });
  }

  if (data.wordCount < THIN_CONTENT_WORD_COUNT) {
    findings.push({
      id: 'geo-thin-content-for-ai',
      impact: 'moderate',
      help: `Page has very little extractable text (${data.wordCount} words)`,
      description:
        'Generative engines need enough substantive text on the page to summarize, quote, or cite it accurately.',
      occurrences: 1,
    });
  }

  if (!data.hasFaqSchema) {
    findings.push({
      id: 'aeo-missing-faq-schema',
      impact: 'moderate',
      help: 'No FAQPage structured data found',
      description:
        'FAQPage schema is the primary way answer engines and voice assistants extract quotable question/answer pairs from a page.',
      occurrences: 1,
    });
  }

  if (data.questionHeadingCount === 0) {
    findings.push({
      id: 'aeo-no-question-headings',
      impact: 'minor',
      help: 'No headings phrased as direct questions',
      description:
        'A question-style heading followed by a concise, direct answer is the content pattern answer engines quote most often.',
      occurrences: 1,
    });
  }

  if (!data.hasSemanticLandmark) {
    findings.push({
      id: 'geo-missing-semantic-landmark',
      impact: 'minor',
      help: 'No <main> or <article> element found',
      description:
        'Semantic landmarks help AI crawlers isolate the actual content from navigation, ads, and boilerplate when indexing the page.',
      occurrences: 1,
    });
  }

  return findings;
}
