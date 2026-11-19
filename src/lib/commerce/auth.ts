import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { schema, sql, type User } from "./store";
export const hash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function origin() {
  return (
    process.env.APP_URL ?? "https://site-scanner-ecru.vercel.app"
  ).replace(/\/$/, "");
}
export function sameOrigin(request: Request) {
  if (request.headers.get("origin") !== origin()) throw new Error("forbidden");
}
export async function user(): Promise<User | null> {
  const token = (await cookies()).get("scanner_session")?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  await schema();
  const rows =
    await sql()`SELECT u.* FROM scanner_users u JOIN scanner_tokens t ON u.id=t.user_id WHERE t.hash=${hash(token)} AND t.kind='session' AND t.expires_at>now()`;
  return (rows[0] as User | undefined) ?? null;
}
export async function requireUser() {
  const value = await user();
  if (!value) throw new Error("unauthorized");
  return value;
}
export async function session(userId: string) {
  const token = newToken();
  await sql()`INSERT INTO scanner_tokens(hash,user_id,kind,expires_at) VALUES (${hash(token)},${userId},'session',now()+interval '30 days')`;
  (await cookies()).set("scanner_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 2592000,
  });
}
