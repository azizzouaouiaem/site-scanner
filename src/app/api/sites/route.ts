import { requireUser } from "@/lib/commerce/auth";
import { sql } from "@/lib/commerce/store";
import { failure, privateHeaders } from "@/lib/commerce/http";
export async function GET(request: Request) {
  try {
    const u = await requireUser();
    const requested = new URL(request.url).searchParams.get("cycle");
    if (requested && !/^[a-f0-9-]{36}$/.test(requested))
      throw new Error("invalid_input");
    const [sites, cycles] = await Promise.all([
      sql()`SELECT * FROM scanner_sites WHERE user_id=${u.id}`,
      sql()`SELECT c.id,c.status,c.created_at FROM scanner_cycles c JOIN scanner_sites s ON s.id=c.site_id WHERE s.user_id=${u.id} ORDER BY c.created_at DESC LIMIT 52`,
    ]);
    const cycle = requested ?? cycles[0]?.id;
    const results = cycle
      ? await sql()`SELECT r.* FROM scanner_results r JOIN scanner_cycles c ON c.id=r.cycle_id JOIN scanner_sites s ON s.id=c.site_id WHERE s.user_id=${u.id} AND r.cycle_id=${cycle} ORDER BY r.created_at DESC`
      : [];
    return Response.json(
      {
        user: {
          email: u.email,
          status: u.subscription_status,
          hasBilling: !!u.stripe_customer,
        },
        sites,
        cycles,
        results,
      },
      { headers: privateHeaders },
    );
  } catch (e) {
    return failure(e);
  }
}
