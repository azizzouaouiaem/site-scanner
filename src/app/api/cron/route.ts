import { timingSafeEqual } from "node:crypto";
import { schema, sql } from "@/lib/commerce/store";
import { dispatchSite, dispatchPdf } from "@/lib/commerce/dispatch";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = "Bearer " + process.env.CRON_SECRET;
  const provided = request.headers.get("authorization") ?? "";
  if (
    !process.env.CRON_SECRET ||
    provided.length !== expected.length ||
    !timingSafeEqual(Buffer.from(provided), Buffer.from(expected))
  )
    return new Response("Unauthorized", { status: 401 });
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL)
    return Response.json({ skipped: "database_not_configured" });
  await schema();
  const sites =
    await sql()`SELECT s.id FROM scanner_sites s JOIN scanner_users u ON u.id=s.user_id WHERE s.next_run<=now() AND u.subscription_status IN ('active','trialing') ORDER BY s.next_run LIMIT 100`;
  const orders =
    await sql()`SELECT id FROM scanner_orders WHERE kind='pdf' AND (status='paid' OR (status='queued' AND run_id IS NULL)) ORDER BY created_at LIMIT 50`;
  for (const site of sites) await dispatchSite(site.id);
  for (const order of orders) await dispatchPdf(order.id);
  return Response.json({ sites: sites.length, orders: orders.length });
}
