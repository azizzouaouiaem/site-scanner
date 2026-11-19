import { cookies } from "next/headers";
import { hash, sameOrigin } from "@/lib/commerce/auth";
import { sql } from "@/lib/commerce/store";
import { failure } from "@/lib/commerce/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const jar = await cookies();
    const token = jar.get("scanner_session")?.value;
    if (token)
      await sql()`DELETE FROM scanner_tokens WHERE hash=${hash(token)}`;
    jar.delete("scanner_session");
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
