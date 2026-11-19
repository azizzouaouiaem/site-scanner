import { test } from "node:test";
import assert from "node:assert/strict";
import Stripe from "stripe";
import { validCheckout } from "../src/lib/commerce/payment-validation";
const order = { id: "order-1", user_id: "user-1", kind: "pdf" };
const session = {
  status: "complete",
  payment_status: "paid",
  client_reference_id: order.id,
  metadata: { orderId: order.id, userId: order.user_id, kind: order.kind },
  currency: "cad",
  amount_total: 999,
  mode: "payment",
} as const;
test("only a complete, paid checkout for the exact order, owner, currency, mode and amount unlocks a purchase", () => {
  assert(validCheckout(session, order));
  for (const change of [
    { status: "open" },
    { payment_status: "unpaid" },
    { client_reference_id: "other" },
    { metadata: { ...session.metadata, userId: "other" } },
    { metadata: { ...session.metadata, kind: "site" } },
    { currency: "usd" },
    { amount_total: 998 },
    { mode: "subscription" },
  ])
    assert.equal(
      validCheckout({ ...session, ...change } as never, order),
      false,
    );
  assert(
    validCheckout(
      {
        ...session,
        amount_total: 2900,
        mode: "subscription",
        metadata: { ...session.metadata, kind: "site" },
      },
      { ...order, kind: "site" },
    ),
  );
});
test("Stripe signature binds the raw payload and rejects tampering, unsigned bodies and stale signatures", () => {
  const stripe = new Stripe("sk_test_fixture");
  const secret = "whsec_fixture";
  const payload = JSON.stringify({
    id: "evt_fixture",
    object: "event",
    type: "checkout.session.completed",
    data: { object: session },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(
    stripe.webhooks.constructEvent(payload, signature, secret).id,
    "evt_fixture",
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload + " ", signature, secret),
  );
  assert.throws(() => stripe.webhooks.constructEvent(payload, "", secret));
  const stale = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: 1,
  });
  assert.throws(() => stripe.webhooks.constructEvent(payload, stale, secret));
});
