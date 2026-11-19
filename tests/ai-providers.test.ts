import { test } from "node:test";
import assert from "node:assert/strict";
import { cursorFirst } from "../src/lib/commerce/advice-routing";
import {
  cursorAgentId,
  launchCursor,
  pollCursor,
  closeCursor,
  parseCursorAdvice,
} from "../src/lib/commerce/cursor";
import {
  fallbackConfigured,
  recommend,
} from "../src/lib/commerce/recommendations";
import { readiness } from "../src/lib/commerce/billing";
import type { ScanReport } from "../src/lib/types";

const id = "seo:missing-title";
const advice = {
  items: [
    {
      id,
      diagnosis: "Missing page title",
      steps: ["Add a descriptive title"],
      example: "<title>Example</title>",
      verification: "Inspect rendered DOM",
      limits: "Illustrative code; review source",
    },
  ],
};
const reports = [
  {
    scanType: "seo",
    language: "fr",
    finalUrl: "https://example.com",
    issues: [
      {
        ruleId: "missing-title",
        help: "Missing title",
        description: "No title element",
        sampleTargets: ["head"],
        occurrences: 1,
      },
    ],
  },
] as ScanReport[];
const agentId = cursorAgentId("order-fixture", 0);
const runId = "run-00000000-0000-0000-0000-000000000001";
const ticket = { agentId, runId, deadline: Date.now() + 600000 };
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

test("Cursor routing selects a valid result first, waits durably, then cleans up without calling fallback", async () => {
  const calls: string[] = [];
  let polls = 0;
  await cursorFirst({
    start: async () => {
      calls.push("start");
      return ticket;
    },
    poll: async () => {
      calls.push("poll");
      return ++polls === 2;
    },
    pause: async () => {
      calls.push("sleep");
    },
    close: async () => {
      calls.push("close");
    },
    fallback: async () => {
      calls.push("fallback");
    },
  });
  assert.deepEqual(calls, ["start", "poll", "sleep", "poll", "close"]);
});

test("Cursor missing, launch/auth error, run failure and bounded timeout each trigger fallback once", async () => {
  for (const scenario of ["missing", "launch-error", "run-error", "timeout"]) {
    let starts = 0,
      polls = 0,
      pauses = 0,
      closes = 0,
      fallbacks = 0;
    await cursorFirst({
      start: async () => {
        starts++;
        if (scenario === "launch-error") throw Error("401");
        return scenario === "missing" ? null : ticket;
      },
      poll: async () => {
        polls++;
        if (scenario === "run-error") throw Error("invalid_output");
        return false;
      },
      pause: async () => {
        pauses++;
      },
      close: async () => {
        closes++;
        throw Error("provider_offline");
      },
      fallback: async () => {
        fallbacks++;
      },
    });
    assert.equal(starts, 1);
    assert.equal(fallbacks, 1);
    assert.equal(closes, ["timeout", "run-error"].includes(scenario) ? 1 : 0);
    if (scenario === "timeout") {
      assert.equal(polls, 30);
      assert.equal(pauses, 29);
    }
  }
  await assert.rejects(
    () =>
      cursorFirst({
        start: async () => null,
        poll: async () => false,
        pause: async () => {},
        close: async () => {},
        fallback: async () => {
          throw Error("both_unavailable");
        },
      }),
    /both_unavailable/,
  );
});

test("Cursor JSON fences are accepted but incomplete, duplicate, invented or prose responses are rejected", () => {
  assert.deepEqual(
    parseCursorAdvice("```json\n" + JSON.stringify(advice) + "\n```", [id]),
    advice,
  );
  for (const output of [
    JSON.stringify({ items: [] }),
    JSON.stringify({ items: [...advice.items, ...advice.items] }),
    JSON.stringify({ items: [{ ...advice.items[0], id: "invented" }] }),
    "Here is the report: " + JSON.stringify(advice),
  ])
    assert.throws(() => parseCursorAdvice(output, [id]));
});

test("Cursor v1 uses Basic auth, no repository/secrets, stable idempotency and authoritative terminal result", async (t) => {
  const originalEnv = process.env;
  t.after(() => {
    process.env = originalEnv;
  });
  process.env = {
    ...process.env,
    CURSOR_API_KEY: "cursor-fixture",
    CURSOR_MODEL: "",
  };
  const calls: { url: string; init?: RequestInit }[] = [];
  const responses = [
    json({
      agent: { id: agentId },
      run: { id: runId, createdAt: new Date().toISOString() },
    }),
    json({ id: runId, agentId, status: "RUNNING" }),
    json({
      id: runId,
      agentId,
      status: "FINISHED",
      result: JSON.stringify(advice),
    }),
    json({}),
    json({}),
  ];
  t.mock.method(
    globalThis,
    "fetch",
    async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return responses.shift()!;
    },
  );
  const launched = await launchCursor(reports, [id], "order-fixture", 0);
  assert(launched);
  assert.equal(launched.agentId, agentId);
  assert.equal(await pollCursor(launched, [id]), null);
  assert.deepEqual(await pollCursor(launched, [id]), advice);
  await closeCursor(launched);
  const request = JSON.parse(String(calls[0]!.init!.body));
  assert.equal(request.agentId, agentId);
  assert.equal(request.autoCreatePR, false);
  for (const field of ["repos", "env", "envVars", "mcpServers", "model"])
    assert.equal(field in request, false);
  assert(request.prompt.text.includes("Write in French"));
  assert.equal(request.prompt.text.includes("order-fixture"), false);
  assert.equal(
    new Headers(calls[0]!.init!.headers).get("Authorization"),
    "Basic " + Buffer.from("cursor-fixture:").toString("base64"),
  );
  assert(calls.every((c) => c.url.startsWith("https://api.cursor.com/v1/")));
  assert(calls[3]!.url.endsWith("/cancel"));
  assert(calls[4]!.url.endsWith("/archive"));
  assert.equal(cursorAgentId("order-fixture", 0), agentId);
  assert.notEqual(cursorAgentId("order-fixture", 1), agentId);
});

test("Cursor retry recovers a conflict and refuses failed/mismatched/timed-out runs", async (t) => {
  const originalEnv = process.env;
  t.after(() => {
    process.env = originalEnv;
  });
  process.env = { ...process.env, CURSOR_API_KEY: "cursor-fixture" };
  const responses = [
    json({}, 409),
    json({
      id: agentId,
      latestRunId: runId,
      createdAt: new Date().toISOString(),
    }),
    json({ id: runId, agentId, status: "ERROR" }),
    json({
      id: "run-other",
      agentId,
      status: "FINISHED",
      result: JSON.stringify(advice),
    }),
    json({ id: runId, agentId, status: "FINISHED", result: '{"items":[]}' }),
  ];
  let fetches = 0;
  t.mock.method(globalThis, "fetch", async () => {
    fetches++;
    return responses.shift()!;
  });
  assert.equal(
    (await launchCursor(reports, [id], "order-fixture", 0))?.runId,
    runId,
  );
  await assert.rejects(() => pollCursor(ticket, [id]), /cursor_run_failed/);
  await assert.rejects(() => pollCursor(ticket, [id]), /cursor_run_mismatch/);
  await assert.rejects(() => pollCursor(ticket, [id]), /incomplete_ai_report/);
  await assert.rejects(
    () => pollCursor({ ...ticket, deadline: 1 }, [id]),
    /cursor_timeout/,
  );
  assert.equal(fetches, 5);
});

test("existing OpenAI-compatible fallback remains usable and validates exact finding coverage", async (t) => {
  const originalEnv = process.env;
  t.after(() => {
    process.env = originalEnv;
  });
  process.env = {
    ...process.env,
    REPORT_LLM_API_KEY: "fallback-fixture",
    REPORT_LLM_MODEL: "model-fixture",
    REPORT_LLM_URL: "https://api.openai.com/v1/chat/completions",
  };
  assert(fallbackConfigured());
  let body: Record<string, unknown> = {};
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    assert.equal(url, process.env.REPORT_LLM_URL);
    assert.equal(
      new Headers(init.headers).get("Authorization"),
      "Bearer fallback-fixture",
    );
    body = JSON.parse(String(init.body));
    return json({
      choices: [{ message: { content: JSON.stringify(advice) } }],
    });
  });
  assert.deepEqual(await recommend(reports, [id]), advice);
  assert.equal(body.model, "model-fixture");
  assert.deepEqual(body.response_format, { type: "json_object" });
  await assert.rejects(
    () => recommend(reports, ["different-id"]),
    /incomplete_ai_report/,
  );
});

test("PDF readiness accepts Cursor or the fallback while preserving the payments switch", (t) => {
  const originalEnv = process.env;
  t.after(() => {
    process.env = originalEnv;
  });
  process.env = {
    PAYMENTS_ENABLED: "true",
    CRON_SECRET: "fixture",
    DATABASE_URL: "postgresql://fixture",
    STRIPE_SECRET_KEY: "fixture",
    STRIPE_WEBHOOK_SECRET: "fixture",
    RESEND_API_KEY: "fixture",
    RESEND_FROM_EMAIL: "fixture",
  };
  assert.equal(readiness("pdf"), false);
  process.env.CURSOR_API_KEY = "cursor-fixture";
  assert(readiness("pdf"));
  delete process.env.CURSOR_API_KEY;
  Object.assign(process.env, {
    REPORT_LLM_URL: "https://api.openai.com/v1/chat/completions",
    REPORT_LLM_MODEL: "fixture",
    REPORT_LLM_API_KEY: "fixture",
  });
  assert(readiness("pdf"));
  process.env.REPORT_LLM_URL = "bad-url";
  assert.equal(readiness("pdf"), false);
  process.env.CURSOR_API_KEY = "fixture";
  process.env.PAYMENTS_ENABLED = "false";
  assert.equal(readiness("pdf"), false);
});
