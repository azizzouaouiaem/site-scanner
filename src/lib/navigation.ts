import type { Page } from "playwright-core";

export class ScanTimeoutError extends Error {}
export class ScanNavigationError extends Error {}
export class ScanAccessDeniedError extends ScanNavigationError {}

// Caller must install SSRF routing and validate the URL before navigating.
export async function openAuditPage(page: Page, url: string) {
  try {
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    if (response && [401, 403, 429].includes(response.status()))
      throw new ScanAccessDeniedError("access_denied");
    if (!response || response.status() >= 400)
      throw new ScanNavigationError("http_error");
    if (/just a moment|access denied|verify you are human/i.test(await page.title()))
      throw new ScanAccessDeniedError("challenge_page");

    // A slow image or tracker must not prevent auditing a parsed document.
    await page.waitForLoadState("load", { timeout: 5_000 }).catch((error) => {
      if (!(error instanceof Error) || error.name !== "TimeoutError") throw error;
    });
    await page.waitForTimeout(1_000);
    return response;
  } catch (error) {
    if (error instanceof ScanNavigationError) throw error;
    if (error instanceof Error && error.name === "TimeoutError")
      throw new ScanTimeoutError("navigation_timeout");
    throw new ScanNavigationError("navigation_failed");
  }
}
