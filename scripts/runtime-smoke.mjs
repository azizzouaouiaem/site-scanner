import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import postgres from "postgres";
const base = process.env.TEST_APP_URL ?? "http://localhost:3000";
if (!process.env.TEST_DATABASE_URL?.includes("scanner_test_"))
  throw new Error("Use a disposable scanner_test_ database");
const db = postgres(process.env.TEST_DATABASE_URL);
const id = randomUUID(),
  otherId = randomUUID(),
  reportId = randomUUID(),
  token = randomBytes(32).toString("hex");
try {
  await db`INSERT INTO scanner_users(id,email) VALUES (${id},${id + "@example.test"}),(${otherId},${otherId + "@example.test"})`;
  await db`INSERT INTO scanner_tokens(hash,user_id,kind,expires_at) VALUES (${createHash("sha256").update(token).digest("hex")},${id},'session',now()+interval '1 hour')`;
  await db`INSERT INTO scanner_orders(id,user_id,kind,url,language,status,pdf) VALUES (${reportId},${otherId},'pdf','https://example.com','fr','ready',${Buffer.from("%PDF-1.4 fixture")})`;
  const headers = {
    cookie: "scanner_session=" + token,
    origin: base,
    "Content-Type": "application/json",
  };
  assert.equal((await fetch(base + "/api/sites")).status, 401);
  assert.equal((await fetch(base + "/api/sites", { headers })).status, 200);
  assert.equal(
    (await fetch(base + "/api/pdf?id=" + reportId, { headers })).status,
    409,
  );
  assert.equal(
    (
      await fetch(base + "/api/checkout", {
        method: "POST",
        headers: { ...headers, origin: "https://attacker.example" },
        body: "{}",
      })
    ).status,
    403,
  );
  const unavailable = await fetch(base + "/api/checkout", {
    method: "POST",
    headers,
    body: JSON.stringify({
      kind: "pdf",
      url: "https://example.com",
      language: "fr",
    }),
  });
  assert.equal(unavailable.status, 503);
  assert.equal(
    (await fetch(base + "/api/stripe/webhook", { method: "POST", body: "{}" }))
      .status,
    400,
  );
  assert.equal((await fetch(base + "/api/cron")).status, 401);
  assert.equal(
    (
      await fetch(base + "/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: "http://127.0.0.1",
          language: "fr",
          scanType: "seo",
        }),
      })
    ).status,
    400,
  );
  console.log(
    "8 runtime checks passed: private history, cross-account PDF denial, CSRF, disabled billing, invalid webhooks, cron auth, SSRF",
  );
} finally {
  await db`DELETE FROM scanner_orders WHERE id=${reportId}`;
  await db`DELETE FROM scanner_tokens WHERE user_id=${id}`;
  await db`DELETE FROM scanner_users WHERE id IN (${id},${otherId})`;
  await db.end();
}
