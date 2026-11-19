import { requireUser, sameOrigin } from "@/lib/commerce/auth";
import { stripe, returnUrl } from "@/lib/commerce/billing";
import { failure } from "@/lib/commerce/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await requireUser();
    if (!u.stripe_customer) throw new Error("not_found");
    const portal = await stripe().billingPortal.sessions.create({
      customer: u.stripe_customer,
      return_url: returnUrl(),
    });
    return Response.json({ url: portal.url });
  } catch (e) {
    return failure(e);
  }
}
