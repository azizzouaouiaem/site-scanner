import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { openAuditPage, ScanAccessDeniedError, ScanNavigationError } from "../src/lib/navigation";

test("a parsed page remains auditable while an image never finishes loading", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route("https://example.com/**", async (route) => {
      if (route.request().resourceType() === "document")
        await route.fulfill({ contentType: "text/html", body: '<title>Actual content</title><h1>Ready</h1><img src="/slow.png">' });
      // Intentionally leave the image request pending until browser cleanup.
    });
    await openAuditPage(page, "https://example.com/");
    assert.equal(await page.locator("h1").innerText(), "Ready");
    assert.equal(await page.evaluate("document.readyState"), "interactive");
  } finally { await browser.close(); }
});

test("HTTP errors and human verification are rejected, never scored or mislabeled as timeouts", async () => {
  const browser = await chromium.launch();
  try {
    for (const [status, title, error] of [
      [403, "Forbidden", ScanAccessDeniedError],
      [429, "Too many requests", ScanAccessDeniedError],
      [404, "Not found", ScanNavigationError],
      [200, "Verify you are human", ScanAccessDeniedError],
    ] as const) {
      const page = await browser.newPage();
      await page.route("**/*", route => route.fulfill({status, contentType:"text/html", body:`<title>${title}</title>`}));
      await assert.rejects(openAuditPage(page, "https://example.com/"), error);
      await page.close();
    }
  } finally { await browser.close(); }
});
