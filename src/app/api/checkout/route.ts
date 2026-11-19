import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser, sameOrigin } from "@/lib/commerce/auth";
import { sql, active, limit } from "@/lib/commerce/store";
import { products, stripe, readiness, returnUrl } from "@/lib/commerce/billing";
import { failure } from "@/lib/commerce/http";
import { assertPublicHttpUrl } from "@/lib/ssrf-guard";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await requireUser();
    const parsed = z
      .object({
        kind: z.enum(["site", "pdf"]),
        url: z.string().url().max(2048),
        language: z.enum(["en", "fr"]),
      })
      .safeParse(await request.json());
    if (!parsed.success) throw new Error("invalid_input");
    const { kind, language } = parsed.data;
    if (!readiness(kind)) throw new Error("payment_not_ready");
    if (kind === "site" && active(u)) throw new Error("already_subscribed");
    await limit("checkout:" + u.id, 5);
    const url = (await assertPublicHttpUrl(parsed.data.url)).toString();
    const api = stripe();
    if (kind === "site") {
      const pending =
        await sql()`SELECT stripe_session,created_at FROM scanner_orders WHERE user_id=${u.id} AND kind='site' AND status='pending' LIMIT 1`;
      if (pending[0]) {
        if (pending[0].stripe_session) {
          const existing = await api.checkout.sessions.retrieve(
            pending[0].stripe_session,
          );
          if (existing.status === "open" && existing.url)
            return Response.json({ url: existing.url });
          if (existing.status === "complete")
            throw new Error("already_subscribed");
        } else if (
          Date.now() - new Date(pending[0].created_at).getTime() <
          120000
        )
          throw new Error("checkout_in_progress");
        await sql()`UPDATE scanner_orders SET status='expired' WHERE user_id=${u.id} AND kind='site' AND status='pending'`;
      }
    }
    const id = randomUUID();
    await sql()`INSERT INTO scanner_orders(id,user_id,kind,url,language) VALUES (${id},${u.id},${kind},${url},${language})`;
    const product = products[kind];
    const checkout = await api.checkout.sessions.create(
      {
        mode: kind === "site" ? "subscription" : "payment",
        customer: u.stripe_customer ?? undefined,
        customer_email: u.stripe_customer ? undefined : u.email,
        customer_creation:
          kind === "pdf" && !u.stripe_customer ? "always" : undefined,
        client_reference_id: id,
        metadata: { orderId: id, userId: u.id, kind },
        subscription_data:
          kind === "site" ? { metadata: { userId: u.id } } : undefined,
        allowed_payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "cad",
              unit_amount: product.amount,
              product_data: { name: product.name },
              ...(kind === "site"
                ? { recurring: { interval: "month" as const } }
                : {}),
            },
            quantity: 1,
          },
        ],
        success_url: returnUrl() + "?paid=1",
        cancel_url: returnUrl() + "?cancelled=1",
      },
      { idempotencyKey: "checkout:" + id },
    );
    await sql()`UPDATE scanner_orders SET stripe_session=${checkout.id} WHERE id=${id}`;
    return Response.json({ url: checkout.url });
  } catch (e) {
    return failure(e);
  }
}
