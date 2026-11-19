import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { schema, sql, limit } from "../src/lib/commerce/store";
const configured = !!process.env.TEST_DATABASE_URL;
if (configured) {
  if (!process.env.TEST_DATABASE_URL!.includes("scanner_test_"))
    throw new Error("Test database name must include scanner_test_");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
test(
  "Postgres schema, isolation, durable records and atomic limits",
  { skip: !configured },
  async () => {
    await schema();
    const db = sql();
    const id = randomUUID();
    try {
      await db`INSERT INTO scanner_users(id,email) VALUES (${id},${id + "@example.test"})`;
      const other = randomUUID();
      assert.equal(
        (await db`SELECT id FROM scanner_orders WHERE user_id=${other}`).length,
        0,
      );
      const rls =
        await db`SELECT relname,relrowsecurity FROM pg_class WHERE relname LIKE 'scanner_%' AND relkind='r'`;
      assert.equal(rls.length, 7);
      assert(rls.every((r) => r.relrowsecurity));
      const site = randomUUID();
      await db`INSERT INTO scanner_sites(id,user_id,url,language) VALUES (${site},${id},'https://example.com','fr')`;
      const inserts = await Promise.all(
        [1, 2, 3].map(
          () =>
            db`INSERT INTO scanner_cycles(id,site_id) VALUES (${randomUUID()},${site}) ON CONFLICT DO NOTHING RETURNING id`,
        ),
      );
      assert.equal(inserts.filter((r) => r.length).length, 1);
      const outcomes = await Promise.allSettled(
        [1, 2, 3, 4, 5, 6].map(() => limit("test:" + id, 3)),
      );
      assert.equal(outcomes.filter((r) => r.status === "fulfilled").length, 3);
      await db`DELETE FROM scanner_cycles WHERE site_id=${site}`;
      await db`DELETE FROM scanner_sites WHERE id=${site}`;
    } finally {
      await db`DELETE FROM scanner_users WHERE id=${id}`;
      await db.end();
    }
  },
);
