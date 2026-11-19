import { randomUUID } from "node:crypto";
import { z } from "zod";
import { hash, newToken, origin, sameOrigin } from "@/lib/commerce/auth";
import { sql, schema, limit } from "@/lib/commerce/store";
import { mail, escape } from "@/lib/commerce/mail";
import { failure } from "@/lib/commerce/http";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const input = z
      .object({
        email: z.string().trim().email().max(320),
        url: z.string().max(2048).optional(),
        kind: z.enum(["site", "pdf"]).optional(),
        language: z.enum(["fr", "en"]).optional(),
      })
      .safeParse(await request.json());
    if (!input.success) throw new Error("invalid_input");
    const email = input.data.email.toLowerCase();
    await schema();
    await limit(
      "login-ip:" +
        hash(
          request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            "unknown",
        ),
      10,
    );
    await limit("login:" + hash(email), 3);
    const rows =
      await sql()`INSERT INTO scanner_users(id,email) VALUES (${randomUUID()},${email}) ON CONFLICT(email) DO UPDATE SET email=excluded.email RETURNING id`;
    const token = newToken();
    await sql()`INSERT INTO scanner_tokens(hash,user_id,kind,expires_at) VALUES (${hash(token)},${rows[0]!.id},'login',now()+interval '15 minutes')`;
    // A GET never consumes the token: email security scanners can safely follow it.
    const parameters = new URLSearchParams({
      token,
      kind: input.data.kind ?? "site",
      language: input.data.language ?? "fr",
    });
    if (input.data.url) parameters.set("url", input.data.url);
    const url = origin() + "/account?" + parameters.toString();
    await mail(
      email,
      "Site Scanner — votre lien de connexion / sign in",
      `<h1>Site Scanner</h1><p><a href="${escape(url)}">Se connecter / Sign in</a></p><p>Lien à usage unique, valable 15 minutes. Ignorez ce message si vous ne l’avez pas demandé.</p>`,
    );
    return Response.json({ ok: true });
  } catch (error) {
    return failure(error);
  }
}
