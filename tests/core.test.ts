import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScore, scoreFinding } from "../src/lib/scoring";
import { buildSeoFindings, SEO_TOTAL_CHECKS } from "../src/lib/seo-audit";
import { buildGeoFindings, GEO_TOTAL_CHECKS } from "../src/lib/geo-audit";
import {
  buildPerformanceFindings,
  PERFORMANCE_TOTAL_CHECKS,
} from "../src/lib/performance-audit";
import { assertPublicHttpUrl } from "../src/lib/ssrf-guard";
import { validateAdvice } from "../src/lib/commerce/recommendations";
import { changes } from "../src/lib/commerce/changes";
import type { ScanReport } from "../src/lib/types";
const finding = (
  impact: "critical" | "serious" | "moderate" | "minor",
  n = 1,
) =>
  scoreFinding({
    id: "test",
    help: "test",
    description: "test",
    impact,
    occurrences: n,
  });
test("score endpoints, severity, repetition cap and independent arithmetic", () => {
  assert.equal(computeScore([], 11), 100);
  assert.equal(computeScore([], 0), 0);
  assert.equal(computeScore([finding("critical")], 0), 0);
  assert.equal(computeScore([finding("serious")], 10), 77);
  assert.equal(computeScore([finding("critical")], 10), 63);
  assert.equal(
    computeScore([finding("minor", 10)], 10),
    computeScore([finding("minor", 1000)], 10),
  );
  assert(
    computeScore([finding("critical")], 10) <
      computeScore([finding("minor")], 10),
  );
  assert.throws(() => computeScore([], -1));
  for (const severity of ["critical", "serious", "moderate", "minor"] as const)
    for (let p = 0; p < 100; p++) {
      const score = computeScore([finding(severity, 5)], p);
      assert(score >= 0 && score <= 100);
    }
});
test("SEO has exactly 11 independently evaluated families, with exclusive alternatives", () => {
  const good = {
    finalUrl: "https://example.com",
    screenshotDataUrl: "",
    title: "A sufficiently descriptive page title",
    metaDescription:
      "A sufficiently detailed description that explains this example page clearly and accurately.",
    canonical: "https://example.com",
    h1Count: 1,
    viewport: "width=device-width",
    ogTitle: "title",
    ogDescription: "description",
    ogImage: "image",
    robotsMeta: "",
    jsonLdCount: 1,
    imgWithoutAlt: 0,
    wordCount: 400,
    lang: "en",
  };
  assert.equal(buildSeoFindings(good).length, 0);
  assert.equal(SEO_TOTAL_CHECKS, 11);
  const bad = {
    ...good,
    title: "",
    metaDescription: "",
    canonical: "",
    h1Count: 0,
    viewport: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    robotsMeta: "noindex",
    jsonLdCount: 0,
    imgWithoutAlt: 8,
    wordCount: 0,
    lang: "",
  };
  assert.equal(buildSeoFindings(bad).length, SEO_TOTAL_CHECKS);
  const alternatives = buildSeoFindings({
    ...bad,
    title: "x",
    metaDescription: "x",
    h1Count: 5,
  });
  assert.equal(alternatives.length, SEO_TOTAL_CHECKS);
  assert.equal(
    new Set(alternatives.map((i) => i.id)).size,
    alternatives.length,
  );
});
test("GEO never penalizes llms.txt, FAQ, authorship, word count thresholds or question headings", () => {
  const good = {
    finalUrl: "https://example.com",
    screenshotDataUrl: "",
    aiCrawlersBlocked: false,
    hasLlmsTxt: false,
    hasEntitySchema: false,
    hasAuthorDate: false,
    hasFaqSchema: false,
    questionHeadingCount: 0,
    hasSemanticLandmark: true,
    wordCount: 10,
  };
  assert.equal(buildGeoFindings(good).length, 0);
  assert.equal(
    buildGeoFindings({
      ...good,
      aiCrawlersBlocked: true,
      hasSemanticLandmark: false,
      wordCount: 0,
    }).length,
    GEO_TOTAL_CHECKS,
  );
});
test("performance thresholds are strict and all 8 failures match the denominator", () => {
  const data = {
    finalUrl: "https://example.com",
    screenshotDataUrl: "",
    ttfbMs: 600,
    domContentLoadedMs: 2500,
    loadTimeMs: 4000,
    requestCount: 80,
    totalTransferBytes: 3000000,
    domNodeCount: 1500,
    renderBlockingScripts: 0,
    oversizedImages: 0,
  };
  assert.equal(buildPerformanceFindings(data).length, 0);
  assert.equal(
    buildPerformanceFindings({
      ...data,
      ttfbMs: 601,
      domContentLoadedMs: 2501,
      loadTimeMs: 4001,
      requestCount: 81,
      totalTransferBytes: 3000001,
      domNodeCount: 1501,
      renderBlockingScripts: 1,
      oversizedImages: 1,
    }).length,
    PERFORMANCE_TOTAL_CHECKS,
  );
});
test("private, mapped IPv6, credentials and unsafe ports are rejected", async () => {
  for (const url of [
    "http://127.0.0.1",
    "http://10.0.0.1",
    "http://169.254.169.254",
    "http://[::1]",
    "http://[::ffff:172.16.0.1]",
    "http://[::ffff:192.168.1.1]",
    "http://[fe90::1]",
    "http://user:pass@example.com",
    "http://example.com:5432",
    "file:///tmp/file",
  ])
    await assert.rejects(() => assertPublicHttpUrl(url));
  assert.equal(
    (await assertPublicHttpUrl("https://1.1.1.1")).hostname,
    "1.1.1.1",
  );
});
test("AI output must cover every finding exactly once and cannot introduce findings", () => {
  const item = {
    id: "seo:missing-title",
    diagnosis: "Observed missing title",
    steps: ["Add title"],
    example: "<title>Example</title>",
    verification: "Recheck DOM",
    limits: "Source review needed",
  };
  assert.equal(validateAdvice({ items: [item] }, [item.id]).items.length, 1);
  assert.throws(() => validateAdvice({ items: [] }, [item.id]));
  assert.throws(() => validateAdvice({ items: [item, item] }, [item.id]));
  assert.throws(() =>
    validateAdvice({ items: [{ ...item, id: "invented" }] }, [item.id]),
  );
});
test("weekly alerts compare matching pages and methodology versions only", () => {
  const report = (score: number, ids: string[], version = "2") =>
    ({
      scanType: "seo",
      score,
      methodologyVersion: version,
      issues: ids.map((ruleId) => ({ ruleId })),
    }) as ScanReport;
  assert.deepEqual(
    changes(
      [{ url: "a", reports: [report(90, ["old"])] }],
      [
        { url: "a", reports: [report(70, ["new"])] },
        { url: "b", reports: [report(10, ["other"])] },
      ],
    ),
    { newIssues: 1, resolved: 1, regressions: 1 },
  );
  assert.deepEqual(
    changes(
      [{ url: "a", reports: [report(90, ["old"], "1")] }],
      [{ url: "a", reports: [report(10, ["new"])] }],
    ),
    { newIssues: 0, resolved: 0, regressions: 0 },
  );
});

test('AI robots policy distinguishes search from training and honors path-specific allows', async () => {
 const {isAiCrawlerBlocked}=await import('../src/lib/browser');
 assert.equal(isAiCrawlerBlocked('User-agent: *\nDisallow: /','https://example.com/page'),true);
 assert.equal(isAiCrawlerBlocked('User-agent: GPTBot\nDisallow: /','https://example.com/page'),false);
 assert.equal(isAiCrawlerBlocked('User-agent: OAI-SearchBot\nDisallow: /private/\nAllow: /private/open/','https://example.com/private/open/page'),false);
 assert.equal(isAiCrawlerBlocked('User-agent: OAI-SearchBot\nDisallow: /private/','https://example.com/private/page'),true);
});
test('site discovery remains on origin, excludes mutations/query URLs and caps at 25', async()=>{
 const {pageCandidates}=await import('../src/lib/commerce/audit');
 const links=['https://other.example/a','https://example.com/a?x=1','https://example.com/logout','https://example.com/file.pdf',...Array.from({length:40},(_,i)=>'https://example.com/page-'+i)];
 const urls=pageCandidates('https://example.com/',links,['https://example.com/']);assert.equal(urls.length,25);assert(urls.every(u=>new URL(u).origin==='https://example.com'));assert(!urls.some(u=>u.includes('?')||u.includes('logout')||u.endsWith('.pdf')));
});
