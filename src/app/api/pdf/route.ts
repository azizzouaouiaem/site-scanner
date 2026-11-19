import { requireUser } from "@/lib/commerce/auth";
import { sql } from "@/lib/commerce/store";
import { failure, privateHeaders } from "@/lib/commerce/http";
export async function GET(request: Request) {
  try {
    const u = await requireUser();
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[a-f0-9-]{36}$/.test(id)) throw new Error("invalid_input");
    const rows =
      await sql()`SELECT pdf FROM scanner_orders WHERE id=${id} AND user_id=${u.id} AND status='ready' AND kind='pdf'`;
    if (!rows[0]?.pdf) throw new Error("report_not_ready");
    return new Response(new Uint8Array(rows[0].pdf), {
      headers: {
        ...privateHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="site-scanner-report.pdf"',
      },
    });
  } catch (e) {
    return failure(e);
  }
}
