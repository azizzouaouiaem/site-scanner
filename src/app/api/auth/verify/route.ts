import { hash, sameOrigin, session } from "@/lib/commerce/auth";
import { sql, schema } from "@/lib/commerce/store";
import { failure } from "@/lib/commerce/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const { token } = await request.json();
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      throw new Error("invalid_input");
    await schema();
    const rows =
      await sql()`UPDATE scanner_tokens SET used=true WHERE hash=${hash(token)} AND kind='login' AND NOT used AND expires_at>now() RETURNING user_id`;
    if (!rows[0]) throw new Error("unauthorized");
    await session(rows[0].user_id);
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
