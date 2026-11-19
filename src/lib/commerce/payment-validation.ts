import type Stripe from "stripe";
export function validCheckout(
  checkout: Pick<
    Stripe.Checkout.Session,
    | "status"
    | "payment_status"
    | "client_reference_id"
    | "metadata"
    | "currency"
    | "amount_total"
    | "mode"
  >,
  order: { id: string; user_id: string; kind: string },
) {
  return (
    checkout.status === "complete" &&
    checkout.payment_status === "paid" &&
    checkout.client_reference_id === order.id &&
    checkout.metadata?.orderId === order.id &&
    checkout.metadata?.userId === order.user_id &&
    checkout.metadata?.kind === order.kind &&
    checkout.currency === "cad" &&
    checkout.amount_total === (order.kind === "site" ? 2900 : 999) &&
    checkout.mode === (order.kind === "site" ? "subscription" : "payment")
  );
}
