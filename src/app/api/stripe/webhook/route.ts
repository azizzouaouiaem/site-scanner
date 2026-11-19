import { validCheckout } from "@/lib/commerce/payment-validation";
import Stripe from "stripe";
import { randomUUID } from "node:crypto";
import { stripe } from "@/lib/commerce/billing";
import { sql, schema } from "@/lib/commerce/store";
import { dispatchPdf, dispatchSite } from "@/lib/commerce/dispatch";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature)
    return new Response("Webhook unavailable", { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(
      await request.text(),
      signature,
      secret,
    );
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }
  try {
    await schema();
    const api = stripe();
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const checkout = await api.checkout.sessions.retrieve(
        (event.data.object as Stripe.Checkout.Session).id,
      );
      if (checkout.payment_status !== "paid")
        return Response.json({ received: true });
      const id = checkout.metadata?.orderId;
      if (!id) return Response.json({ received: true });
      const rows = await sql()`SELECT * FROM scanner_orders WHERE id=${id}`;
      const order = rows[0];
      if (!order) throw new Error("missing_order");
      if (
        !validCheckout(checkout, {
          id: order.id,
          user_id: order.user_id,
          kind: order.kind,
        })
      )
        throw new Error("payment_mismatch");
      const customer =
        typeof checkout.customer === "string"
          ? checkout.customer
          : checkout.customer?.id;
      if (!customer) throw new Error("customer_missing");
      await sql()`UPDATE scanner_users SET stripe_customer=${customer} WHERE id=${order.user_id}`;
      await sql()`UPDATE scanner_orders SET stripe_session=${checkout.id},status=CASE WHEN status='pending' THEN 'paid' ELSE status END WHERE id=${id}`;
      if (order.kind === "pdf") {
        await dispatchPdf(id);
      } else {
        const subId =
          typeof checkout.subscription === "string"
            ? checkout.subscription
            : checkout.subscription?.id;
        if (!subId) throw new Error("subscription_missing");
        const sub = await api.subscriptions.retrieve(subId);
        await sql()`UPDATE scanner_users SET subscription_id=${sub.id},subscription_status=${sub.status} WHERE id=${order.user_id}`;
        const site =
          await sql()`INSERT INTO scanner_sites(id,user_id,url,language) VALUES (${randomUUID()},${order.user_id},${order.url},${order.language}) ON CONFLICT(user_id) DO UPDATE SET url=excluded.url,language=excluded.language RETURNING id`;
        if (sub.status === "active") await dispatchSite(site[0]!.id, id);
      }
    }
    if (
      event.type === "customer.subscription.updated" ||
      event.type === "customer.subscription.deleted" ||
      event.type === "customer.subscription.created"
    ) {
      const received = event.data.object as Stripe.Subscription;
      // Fetch authoritative state: webhook delivery order is not guaranteed.
      const sub = await api.subscriptions.retrieve(received.id);
      await sql()`UPDATE scanner_users SET subscription_status=${sub.status} WHERE subscription_id=${sub.id}`;
    }
    if (event.type === "checkout.session.expired") {
      const expired = event.data.object as Stripe.Checkout.Session;
      await sql()`UPDATE scanner_orders SET status='expired' WHERE stripe_session=${expired.id} AND status='pending'`;
    }
    if (event.type === "charge.refunded") {
      const charge = event.data.object as Stripe.Charge;
      if (charge.refunded && typeof charge.payment_intent === "string") {
        const sessions = await api.checkout.sessions.list({
          payment_intent: charge.payment_intent,
          limit: 1,
        });
        const session = sessions.data[0];
        if (session)
          await sql()`UPDATE scanner_orders SET status='refunded',pdf=NULL WHERE stripe_session=${session.id} AND kind='pdf'`;
      }
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error(
      "stripe_fulfillment_failed",
      event.id,
      error instanceof Error ? error.name : "unknown",
    );
    return new Response("Retry fulfillment", { status: 500 });
  }
}
