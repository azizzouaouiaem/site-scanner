import axeSource from 'axe-core/axe.min.js';
import { chromium as playwrightChromium, type Browser } from 'playwright-core';
import type { RawAxeResult } from './types';

function getAxeSource(): string {
  return axeSource;
}

const NAVIGATION_TIMEOUT_MS = 25_000;
const AXE_TIMEOUT_MS = 20_000;
const DEFAULT_CHROMIUM_PACK_URL =
  'https://github.com/Sparticuz/chromium/releases/download/v152.0.0/chromium-v152.0.0-pack.x64.tar';

const REALISTIC_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function isServerlessEnvironment(): boolean {
  return Boolean(process.env.VERCEL) || Boolean(process.env.AWS_LAMBDA_FUNCTION_VERSION);
}

async function launchBrowser(): Promise<Browser> {
  if (isServerlessEnvironment()) {
    // Lazy-required: this package only ships a usable binary on Linux, so it
    // must never be evaluated during local (non-serverless) development.
    const { default: chromium } = await import('@sparticuz/chromium-min');
    const packUrl = process.env.CHROMIUM_PACK_URL ?? DEFAULT_CHROMIUM_PACK_URL;
    return playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(packUrl),
      headless: true,
    });
  }

  // Local dev: relies on `npx playwright install chromium` having been run
  // once so playwright-core can find the cached browser binary.
  return playwrightChromium.launch({ headless: true });
}

export interface ScanBrowserResult {
  finalUrl: string;
  pageTitle: string;
  violations: RawAxeResult[];
  passedRuleCount: number;
  screenshotDataUrl: string;
}

export interface SeoPageData {
  finalUrl: string;
  screenshotDataUrl: string;
  title: string;
  metaDescription: string;
  canonical: string;
  h1Count: number;
  viewport: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  robotsMeta: string;
  jsonLdCount: number;
  imgWithoutAlt: number;
  wordCount: number;
  lang: string;
}

export interface PerformancePageData {
  finalUrl: string;
  screenshotDataUrl: string;
  ttfbMs: number | null;
  domContentLoadedMs: number | null;
  loadTimeMs: number | null;
  requestCount: number;
  totalTransferBytes: number;
  domNodeCount: number;
  renderBlockingScripts: number;
  oversizedImages: number;
}

export interface GeoPageData {
  finalUrl: string;
  screenshotDataUrl: string;
  aiCrawlersBlocked: boolean;
  hasLlmsTxt: boolean;
  hasEntitySchema: boolean;
  hasAuthorDate: boolean;
  hasFaqSchema: boolean;
  questionHeadingCount: number;
  hasSemanticLandmark: boolean;
  wordCount: number;
}

// Well-known crawler user-agents used by generative/answer engines to fetch
// and cite web content. Not exhaustive, but covers the major ones as of 2026.
const AI_CRAWLER_USER_AGENTS = new Set([
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'google-extended',
  'ccbot',
  'anthropic-ai',
  'claudebot',
  'perplexitybot',
  'applebot-extended',
  'amazonbot',
  'bytespider',
]);

/**
 * Heuristic robots.txt parser: groups directives by blank-line-separated
 * blocks (the common convention) and flags a block that targets a known AI
 * crawler user-agent while disallowing the whole site ("Disallow: /").
 * Not a full RFC 9309 parser, but sufficient to catch the common pattern of
 * "block all AI bots" configurations.
 */
function isAiCrawlerBlocked(robotsTxt: string): boolean {
  if (!robotsTxt.trim()) return false;
  const blocks = robotsTxt.split(/\r?\n\s*\r?\n/);
  return blocks.some((block) => {
    const lines = block
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const agents = lines
      .filter((line) => line.toLowerCase().startsWith('user-agent:'))
      .map((line) => line.split(':').slice(1).join(':').trim().toLowerCase());
    const disallows = lines
      .filter((line) => line.toLowerCase().startsWith('disallow:'))
      .map((line) => line.split(':').slice(1).join(':').trim());
    const targetsAiBot = agents.some((agent) => AI_CRAWLER_USER_AGENTS.has(agent));
    const blocksEverything = disallows.includes('/');
    return targetsAiBot && blocksEverything;
  });
}


export class ScanTimeoutError extends Error {}
export class ScanNavigationError extends Error {}

async function launchAndNavigate(url: URL): Promise<{ browser: Browser; page: import('playwright-core').Page }> {
  const browser = await launchBrowser();
  try {
    const context = await browser.newContext({
      userAgent: REALISTIC_USER_AGENT,
      viewport: { width: 1366, height: 900 },
      locale: 'en-US',
      extraHTTPHeaders: {
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
    });
    context.setDefaultNavigationTimeout(NAVIGATION_TIMEOUT_MS);
    const page = await context.newPage();

    try {
      await page.goto(url.toString(), { waitUntil: 'load', timeout: NAVIGATION_TIMEOUT_MS });
    } catch (error) {
      throw new ScanNavigationError(error instanceof Error ? error.message : 'navigation_failed');
    }

    // Many client-rendered / cookie-consent-gated sites still populate
    // <title>, lang and real content shortly after the `load` event. Give
    // them a short, bounded grace period before running audits.
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

    return { browser, page };
  } catch (error) {
    await browser.close();
    throw error;
  }
}

export async function scanUrlForAccessibility(url: URL): Promise<ScanBrowserResult> {
  const { browser, page } = await launchAndNavigate(url);

  try {
    await page.addScriptTag({ content: getAxeSource() });

    const axeResults = await Promise.race([
      page.evaluate(() =>
        // @ts-expect-error axe is injected into the page global scope above
        window.axe.run(document, {
          resultTypes: ['violations', 'passes'],
        }),
      ),
      new Promise((_resolve, reject) =>
        setTimeout(() => reject(new ScanTimeoutError('axe_timeout')), AXE_TIMEOUT_MS),
      ),
    ]);

    const results = axeResults as { violations: RawAxeResult[]; passes: unknown[] };
    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });

    return {
      finalUrl: page.url(),
      pageTitle: await page.title(),
      violations: results.violations,
      passedRuleCount: results.passes.length,
      screenshotDataUrl: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
    };
  } finally {
    await browser.close();
  }
}

export async function scanUrlForSeo(url: URL): Promise<SeoPageData> {
  const { browser, page } = await launchAndNavigate(url);

  try {
    const data = await page.evaluate(() => {
      const doc = document;
      const getMeta = (selector: string) => doc.querySelector(selector)?.getAttribute('content')?.trim() ?? '';
      return {
        title: doc.title?.trim() ?? '',
        metaDescription: getMeta('meta[name="description"]'),
        canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href')?.trim() ?? '',
        h1Count: doc.querySelectorAll('h1').length,
        viewport: getMeta('meta[name="viewport"]'),
        ogTitle: getMeta('meta[property="og:title"]'),
        ogDescription: getMeta('meta[property="og:description"]'),
        ogImage: getMeta('meta[property="og:image"]'),
        robotsMeta: getMeta('meta[name="robots"]'),
        jsonLdCount: doc.querySelectorAll('script[type="application/ld+json"]').length,
        imgWithoutAlt: doc.querySelectorAll('img:not([alt])').length,
        wordCount: (doc.body?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length,
        lang: doc.documentElement.getAttribute('lang')?.trim() ?? '',
      };
    });

    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
    return { finalUrl: page.url(), screenshotDataUrl: `data:image/jpeg;base64,${screenshot.toString('base64')}`, ...data };
  } finally {
    await browser.close();
  }
}

export async function scanUrlForPerformance(url: URL): Promise<PerformancePageData> {
  const { browser, page } = await launchAndNavigate(url);

  try {
    const data = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
      const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
      const totalTransferBytes =
        resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) + (nav?.transferSize || 0);
      const images = Array.from(document.querySelectorAll('img'));

      const oversizedImages = images.filter(
        (img) => img.naturalWidth > 0 && img.clientWidth > 0 && img.naturalWidth > img.clientWidth * 2,
      ).length;

      return {
        ttfbMs: nav ? Math.round(nav.responseStart - nav.requestStart) : null,
        domContentLoadedMs: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
        loadTimeMs: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
        requestCount: resources.length,
        totalTransferBytes: Math.round(totalTransferBytes),
        domNodeCount: document.getElementsByTagName('*').length,
        renderBlockingScripts: document.querySelectorAll(
          'head script[src]:not([async]):not([defer]):not([type="module"])',
        ).length,
        oversizedImages,
      };
    });

    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });
    return { finalUrl: page.url(), screenshotDataUrl: `data:image/jpeg;base64,${screenshot.toString('base64')}`, ...data };
  } finally {
    await browser.close();
  }
}

export async function scanUrlForGeo(url: URL): Promise<GeoPageData> {
  const { browser, page } = await launchAndNavigate(url);

  try {
    const data = await page.evaluate(() => {
      const doc = document;
      const jsonLdBlocks = Array.from(doc.querySelectorAll('script[type="application/ld+json"]')).map(
        (el) => el.textContent ?? '',
      );
      const hasEntitySchema = jsonLdBlocks.some((block) => /"@type"\s*:\s*"(Organization|WebSite)"/i.test(block));
      const hasFaqSchema = jsonLdBlocks.some((block) => /"@type"\s*:\s*"FAQPage"/i.test(block));
      const hasAuthorDate = Boolean(
        doc.querySelector(
          'meta[property="article:published_time"], meta[property="article:modified_time"], meta[name="author"], time[datetime]',
        ),
      );
      const questionHeadingCount = Array.from(doc.querySelectorAll('h2, h3')).filter((el) =>
        (el.textContent ?? '').trim().endsWith('?'),
      ).length;
      const hasSemanticLandmark = Boolean(doc.querySelector('main, article'));
      const wordCount = (doc.body?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length;

      return { hasEntitySchema, hasFaqSchema, hasAuthorDate, questionHeadingCount, hasSemanticLandmark, wordCount };
    });

    const origin = new URL(page.url()).origin;
    const requestContext = page.context().request;
    const [robotsTxt, hasLlmsTxt] = await Promise.all([
      requestContext
        .get(`${origin}/robots.txt`, { failOnStatusCode: false, timeout: 8_000 })
        .then((res) => (res.ok() ? res.text() : ''))
        .catch(() => ''),
      requestContext
        .get(`${origin}/llms.txt`, { failOnStatusCode: false, timeout: 8_000 })
        .then((res) => res.ok())
        .catch(() => false),
    ]);

    const screenshot = await page.screenshot({ type: 'jpeg', quality: 70, fullPage: false });

    return {
      finalUrl: page.url(),
      screenshotDataUrl: `data:image/jpeg;base64,${screenshot.toString('base64')}`,
      aiCrawlersBlocked: isAiCrawlerBlocked(robotsTxt),
      hasLlmsTxt,
      ...data,
    };
  } finally {
    await browser.close();
  }
}

