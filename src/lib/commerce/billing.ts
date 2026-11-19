import Stripe from "stripe";
import { origin } from "./auth";
import { cursorConfigured } from "./cursor";
import { fallbackConfigured, copilotConfigured } from "./ai-config";
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("payment_not_ready");
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 20000,
    maxNetworkRetries: 1,
  });
}
export function readiness(kind: "site" | "pdf") {
  return Boolean(
    process.env.PAYMENTS_ENABLED === "true" &&
    process.env.CRON_SECRET &&
    (process.env.DATABASE_URL || process.env.POSTGRES_URL) &&
    process.env.STRIPE_SECRET_KEY &&
    process.env.STRIPE_WEBHOOK_SECRET &&
    process.env.RESEND_API_KEY &&
    process.env.RESEND_FROM_EMAIL &&
    (kind !== "pdf" ||
      cursorConfigured() ||
      copilotConfigured() ||
      fallbackConfigured()),
  );
}
export const products = {
  site: {
    amount: 2900,
    name: "Site Scanner — Site (25 pages maximum)",
    recurring: true,
  },
  pdf: {
    amount: 999,
    name: "Site Scanner — PDF technique IA (1 page, 4 audits)",
    recurring: false,
  },
} as const;
export const returnUrl = () => origin() + "/account";
