import type { SeoPageData } from './browser';
import type { RawFinding } from './types';

/**
 * Deterministic SEO checks run against signals already collected in the
 * browser (see scanUrlForSeo in browser.ts). No LLM, no external SEO API.
 */

const TITLE_MIN_LENGTH = 15;
const TITLE_MAX_LENGTH = 65;
const DESCRIPTION_MIN_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 160;
const THIN_CONTENT_WORD_COUNT = 300;

export const SEO_TOTAL_CHECKS = 14;

export function buildSeoFindings(data: SeoPageData): RawFinding[] {
  const findings: RawFinding[] = [];

  if (data.robotsMeta.toLowerCase().includes('noindex')) {
    findings.push({
      id: 'seo-noindex',
      impact: 'critical',
      help: 'Page is marked "noindex" and will not appear in search results',
      description: 'A <meta name="robots"> (or equivalent header) tells search engines not to index this page.',
      occurrences: 1,
    });
  }

  if (!data.title) {
    findings.push({
      id: 'seo-missing-title',
      impact: 'critical',
      help: 'Page is missing a <title> tag',
      description: 'Every indexable page needs a unique, descriptive <title>.',
      occurrences: 1,
    });
  } else if (data.title.length < TITLE_MIN_LENGTH || data.title.length > TITLE_MAX_LENGTH) {
    findings.push({
      id: 'seo-title-length',
      impact: 'moderate',
      help: `Page <title> length (${data.title.length} chars) is outside the recommended ${TITLE_MIN_LENGTH}-${TITLE_MAX_LENGTH} range`,
      description: 'Titles that are too short waste ranking opportunity; too long ones get truncated in search results.',
      occurrences: 1,
    });
  }

  if (!data.metaDescription) {
    findings.push({
      id: 'seo-missing-meta-description',
      impact: 'serious',
      help: 'Page is missing a meta description',
      description: 'Search engines fall back to arbitrary page text for the search-result snippet without one.',
      occurrences: 1,
    });
  } else if (
    data.metaDescription.length < DESCRIPTION_MIN_LENGTH ||
    data.metaDescription.length > DESCRIPTION_MAX_LENGTH
  ) {
    findings.push({
      id: 'seo-meta-description-length',
      impact: 'moderate',
      help: `Meta description length (${data.metaDescription.length} chars) is outside the recommended ${DESCRIPTION_MIN_LENGTH}-${DESCRIPTION_MAX_LENGTH} range`,
      description: 'Descriptions outside this range are often truncated or under-utilized in search snippets.',
      occurrences: 1,
    });
  }

  if (!data.canonical) {
    findings.push({
      id: 'seo-missing-canonical',
      impact: 'moderate',
      help: 'Page is missing a canonical link tag',
      description: 'Without <link rel="canonical">, duplicate/parameterized URLs can split ranking signals.',
      occurrences: 1,
    });
  }

  if (data.h1Count === 0) {
    findings.push({
      id: 'seo-missing-h1',
      impact: 'serious',
      help: 'Page has no <h1> heading',
      description: 'The main heading helps search engines understand the primary topic of the page.',
      occurrences: 1,
    });
  } else if (data.h1Count > 1) {
    findings.push({
      id: 'seo-multiple-h1',
      impact: 'moderate',
      help: `Page has ${data.h1Count} <h1> headings instead of one`,
      description: 'Multiple top-level headings dilute the page\'s topical focus for search engines.',
      occurrences: data.h1Count,
    });
  }

  if (!data.viewport) {
    findings.push({
      id: 'seo-missing-viewport',
      impact: 'serious',
      help: 'Page is missing a responsive viewport meta tag',
      description: 'Mobile-friendliness is a direct ranking factor; without it the page may be flagged as not mobile-friendly.',
      occurrences: 1,
    });
  }

  const missingOgTags = ['ogTitle', 'ogDescription', 'ogImage'].filter(
    (key) => !data[key as keyof SeoPageData],
  ).length;
  if (missingOgTags > 0) {
    findings.push({
      id: 'seo-missing-og-tags',
      impact: 'moderate',
      help: `Page is missing ${missingOgTags} Open Graph tag(s) (og:title/og:description/og:image)`,
      description: 'Open Graph tags control how the page appears when shared on social media and some search surfaces.',
      occurrences: missingOgTags,
    });
  }

  if (data.jsonLdCount === 0) {
    findings.push({
      id: 'seo-missing-structured-data',
      impact: 'minor',
      help: 'Page has no structured data (JSON-LD)',
      description: 'Structured data enables rich results (star ratings, breadcrumbs, product info) in search.',
      occurrences: 1,
    });
  }

  if (!data.lang) {
    findings.push({
      id: 'seo-missing-lang',
      impact: 'serious',
      help: 'Page is missing a declared language (lang attribute)',
      description: 'Search engines use the declared language to serve the page to the right regional/language audience.',
      occurrences: 1,
    });
  }

  if (data.imgWithoutAlt > 0) {
    findings.push({
      id: 'seo-images-missing-alt',
      impact: 'moderate',
      help: `${data.imgWithoutAlt} image(s) missing alt text`,
      description: 'Alt text is indexed by image search and contributes to a page\'s relevance for image queries.',
      occurrences: data.imgWithoutAlt,
    });
  }

  if (data.wordCount < THIN_CONTENT_WORD_COUNT) {
    findings.push({
      id: 'seo-thin-content',
      impact: 'moderate',
      help: `Page has thin content (${data.wordCount} words, recommended ${THIN_CONTENT_WORD_COUNT}+)`,
      description: 'Pages with very little text content tend to rank worse for competitive queries.',
      occurrences: 1,
    });
  }

  return findings;
}
