import type { PerformancePageData } from './browser';
import type { RawFinding } from './types';

/**
 * Deterministic performance checks built from Navigation/Resource Timing
 * APIs already collected in the browser (see scanUrlForPerformance in
 * browser.ts) — no Lighthouse dependency, no LLM.
 */

const TTFB_THRESHOLD_MS = 600;
const DOM_CONTENT_LOADED_THRESHOLD_MS = 2500;
const LOAD_TIME_THRESHOLD_MS = 4000;
const PAGE_WEIGHT_THRESHOLD_BYTES = 3_000_000;
const REQUEST_COUNT_THRESHOLD = 80;
const DOM_NODE_COUNT_THRESHOLD = 1500;

export const PERFORMANCE_TOTAL_CHECKS = 8;

function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

export function buildPerformanceFindings(data: PerformancePageData): RawFinding[] {
  const findings: RawFinding[] = [];

  if (data.ttfbMs !== null && data.ttfbMs > TTFB_THRESHOLD_MS) {
    findings.push({
      id: 'perf-slow-ttfb',
      impact: 'serious',
      help: `Slow time-to-first-byte (${data.ttfbMs} ms, target under ${TTFB_THRESHOLD_MS} ms)`,
      description: 'A slow server response delays every other resource and paints on the page.',
      occurrences: 1,
    });
  }

  if (data.domContentLoadedMs !== null && data.domContentLoadedMs > DOM_CONTENT_LOADED_THRESHOLD_MS) {
    findings.push({
      id: 'perf-slow-dom-content-loaded',
      impact: 'serious',
      help: `Slow DOMContentLoaded (${data.domContentLoadedMs} ms, target under ${DOM_CONTENT_LOADED_THRESHOLD_MS} ms)`,
      description: 'Visitors can\'t reliably interact with the page until the DOM is parsed and ready.',
      occurrences: 1,
    });
  }

  if (data.loadTimeMs !== null && data.loadTimeMs > LOAD_TIME_THRESHOLD_MS) {
    findings.push({
      id: 'perf-slow-load-time',
      impact: 'critical',
      help: `Slow full page load (${data.loadTimeMs} ms, target under ${LOAD_TIME_THRESHOLD_MS} ms)`,
      description: 'Every extra second of load time measurably increases visitor abandonment.',
      occurrences: 1,
    });
  }

  if (data.totalTransferBytes > PAGE_WEIGHT_THRESHOLD_BYTES) {
    findings.push({
      id: 'perf-large-page-weight',
      impact: 'serious',
      help: `Heavy page weight (${formatBytes(data.totalTransferBytes)} transferred, target under ${formatBytes(PAGE_WEIGHT_THRESHOLD_BYTES)})`,
      description: 'Large page weight disproportionately hurts visitors on mobile networks.',
      occurrences: 1,
    });
  }

  if (data.requestCount > REQUEST_COUNT_THRESHOLD) {
    findings.push({
      id: 'perf-too-many-requests',
      impact: 'moderate',
      help: `High request count (${data.requestCount} requests, target under ${REQUEST_COUNT_THRESHOLD})`,
      description: 'Each additional request adds connection/latency overhead, especially on mobile.',
      occurrences: 1,
    });
  }

  if (data.domNodeCount > DOM_NODE_COUNT_THRESHOLD) {
    findings.push({
      id: 'perf-large-dom-size',
      impact: 'moderate',
      help: `Large DOM size (${data.domNodeCount} nodes, target under ${DOM_NODE_COUNT_THRESHOLD})`,
      description: 'A large DOM slows down style/layout recalculation and JavaScript execution.',
      occurrences: 1,
    });
  }

  if (data.renderBlockingScripts > 0) {
    findings.push({
      id: 'perf-render-blocking-scripts',
      impact: 'serious',
      help: `${data.renderBlockingScripts} render-blocking script(s) in <head>`,
      description: 'Scripts loaded without async/defer in <head> delay first paint of the page.',
      occurrences: data.renderBlockingScripts,
    });
  }

  if (data.oversizedImages > 0) {
    findings.push({
      id: 'perf-oversized-images',
      impact: 'moderate',
      help: `${data.oversizedImages} image(s) served at more than 2x their displayed size`,
      description: 'Oversized images waste bandwidth and slow down the load, especially on mobile.',
      occurrences: data.oversizedImages,
    });
  }

  return findings;
}
