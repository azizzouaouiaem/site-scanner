// Run with `vercel env run -e production --project site-scanner -- ...`.
// Only bounded status fields are printed. Secrets and connection URIs stay in memory.
import { sql, schema } from "./store";
import { stripe, readiness, testPayments } from "./billing";
import { origin } from "./auth";
import { cursorConfigured, checkCursorAuth } from "./cursor";
import { fallbackConfigured, copilotConfigured } from "./ai-config";
export async function checkServices() {
  const result: Record<string, unknown> = {
    siteReady: readiness("site"), pdfReady: readiness("pdf"),
    paymentsEnabled: process.env.PAYMENTS_ENABLED === "true",
    testOnly: process.env.PAYMENTS_TEST_ONLY === "true",
  };
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) result.database = "missing";
  else {
    try {
      const parsed = new URL(url);
      if (!["postgres:", "postgresql:"].includes(parsed.protocol))
        throw new Error("invalid_database_uri");
      await schema();
      const tables =
        await sql()`SELECT COUNT(*)::int AS count FROM pg_class WHERE relname LIKE 'scanner_%' AND relkind='r' AND relrowsecurity`;
      result.database = "connected";
      result.rlsTables = tables[0]?.count;
    } catch (error) {
      result.database = "failed";
      result.databaseError =
        error instanceof Error && error.message === "invalid_database_uri"
          ? "invalid_database_uri"
          : ((error as { code?: string }).code ?? "connection_failed");
    }
  }
  if (!process.env.STRIPE_SECRET_KEY) result.stripe = "missing";
  else {
    try {
      await stripe().prices.list({ limit: 1 });
      result.stripe = "connected";
      const endpoints = await stripe().webhookEndpoints.list({ limit: 100 });
      const endpoint = endpoints.data.find(
        (e) =>
          e.url === origin() + "/api/stripe/webhook" && e.status === "enabled",
      );
      result.webhookEndpoint = endpoint ? "configured" : "missing";
      if (endpoint) result.webhookEvents = endpoint.enabled_events;
      result.stripeMode = testPayments()
        ? "test"
        : "live";
    } catch (error) {
      result.stripe = "failed";
      result.stripeError =
        (error as { type?: string }).type ?? "request_failed";
    }
  }
  result.webhookSecret = /^whsec_/.test(process.env.STRIPE_WEBHOOK_SECRET ?? "")
    ? "configured"
    : "missing_or_invalid";
  result.emailSender = /@/.test(process.env.RESEND_FROM_EMAIL ?? "")
    ? "configured"
    : "missing_or_invalid";
  result.emailKey = process.env.RESEND_API_KEY ? "configured" : "missing";
  result.aiEndpoint = process.env.REPORT_LLM_URL ? "configured" : "missing";
  result.aiKey = process.env.REPORT_LLM_API_KEY ? "configured" : "missing";
  result.aiModel = process.env.REPORT_LLM_MODEL ? "configured" : "missing";
  result.cursorKey = cursorConfigured() ? "configured" : "missing";
  result.cursor = await checkCursorAuth();
  result.cursorModel = process.env.CURSOR_MODEL
    ? "configured"
    : "account_default";
  result.copilotKey = copilotConfigured() ? "configured" : "missing";
  result.copilotModel = process.env.COPILOT_MODEL ? "configured" : "auto";
  result.aiPrimary = cursorConfigured()
    ? "cursor-agents"
    : copilotConfigured()
      ? "copilot"
      : "openai-compatible";
  result.aiOrder = [
    cursorConfigured() ? "cursor-agents" : null,
    copilotConfigured() ? "copilot" : null,
    fallbackConfigured() ? "openai-compatible" : null,
  ].filter(Boolean);
  result.aiFallback = fallbackConfigured() ? "configured" : "missing";
  return result;
}
