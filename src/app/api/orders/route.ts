import { requireUser, sameOrigin } from "@/lib/commerce/auth";
import { sql, limit } from "@/lib/commerce/store";
import { failure, privateHeaders } from "@/lib/commerce/http";
import { dispatchPdf } from "@/lib/commerce/dispatch";
export async function GET() {
  try {
    const u = await requireUser();
    const orders =
      await sql()`SELECT id,kind,url,status,error,created_at FROM scanner_orders WHERE user_id=${u.id} ORDER BY created_at DESC LIMIT 100`;
    return Response.json({ orders }, { headers: privateHeaders });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const u = await requireUser();
    await limit("retry:" + u.id, 3);
    const { id } = await request.json();
    if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id))
      throw new Error("invalid_input");
    const rows =
      await sql()`SELECT id FROM scanner_orders WHERE id=${id} AND user_id=${u.id} AND kind='pdf' AND status IN ('paid','failed')`;
    if (!rows[0]) throw new Error("not_found");
    await dispatchPdf(id);
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
