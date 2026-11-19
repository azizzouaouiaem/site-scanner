import { test } from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname } from "node:path";
import { copilotThenOpenAi } from "../src/lib/commerce/advice-routing";
import {
  recommendCopilot,
  parseCopilotAdvice,
  copilotRuntimeEnvironment,
  safeCopilotError,
} from "../src/lib/commerce/copilot";
import { readiness } from "../src/lib/commerce/billing";
import type { ScanReport } from "../src/lib/types";
const id = "seo:missing-title";
const advice = {
  items: [
    {
      id,
      diagnosis: "Titre absent",
      steps: ["Ajouter un titre descriptif"],
      example: "<title>Exemple</title>",
      verification: "Inspecter le DOM",
      limits: "Exemple indicatif",
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
        sampleTargets: ["head"],
      },
    ],
  },
] as ScanReport[];

test("secondary providers use Copilot before OpenAI and fall back once on invalid output or failure", async () => {
  let fallbacks = 0;
  const openAi = async () => {
    fallbacks++;
    return advice;
  };
  assert.equal(
    (await copilotThenOpenAi(async () => advice, openAi)).provider,
    "copilot",
  );
  assert.equal(fallbacks, 0);
  assert.equal(
    (
      await copilotThenOpenAi(async () => {
        throw Error("access_denied");
      }, openAi)
    ).provider,
    "openai-compatible",
  );
  assert.equal(
    (
      await copilotThenOpenAi(
        async () => parseCopilotAdvice('{"items":[]}', [id]),
        openAi,
      )
    ).provider,
    "openai-compatible",
  );
  assert.equal(
    (await copilotThenOpenAi(null, openAi)).provider,
    "openai-compatible",
  );
  assert.equal(fallbacks, 3);
  await assert.rejects(
    () =>
      copilotThenOpenAi(
        async () => {
          throw Error("copilot_unavailable");
        },
        async () => {
          throw Error("llm_not_configured");
        },
      ),
    /llm_not_configured/,
  );
});

test("Copilot runs without tools, ambient credentials, config discovery or shared state and cleans up", async (t) => {
  const original = process.env;
  t.after(() => {
    process.env = original;
  });
  process.env = {
    NODE_ENV: "test",
    PATH: original.PATH,
    COPILOT_GITHUB_TOKEN: "copilot-fixture",
    STRIPE_SECRET_KEY: "must-not-reach-runtime",
    DATABASE_URL: "must-not-reach-runtime",
  };
  let directory = "",
    stops = 0,
    disconnects = 0;
  const result = await recommendCopilot(reports, [id], (options) => {
    assert.equal(options.mode, "empty");
    assert.equal(options.github?.token, "copilot-fixture");
    assert.equal(options.github?.useLoggedInUser, false);
    assert.equal(options.runtime?.kind, "spawned-stdio");
    if (options.runtime?.kind !== "spawned-stdio") throw Error("wrong_runtime");
    directory = dirname(options.runtime.workingDirectory!);
    assert.deepEqual(Object.keys(options.runtime.env!).sort(), [
      "HOME",
      "LANG",
      "PATH",
      "TEMP",
      "TMP",
      "TMPDIR",
    ]);
    return {
      start: async () => {},
      getAuthStatus: async () => ({ isAuthenticated: true }),
      createSession: async (config) => {
        assert.deepEqual(config.tools?.availableTools, []);
        assert.equal(config.enableConfigDiscovery, false);
        assert.equal(config.skills?.enabled, false);
        assert.equal(config.state?.enableCrossSessionStore, false);
        assert.equal(config.model, "auto");
        assert.equal(config.systemMessage?.mode, "replace");
        return {
          sendAndWait: async ({ prompt }) => {
            assert(prompt.includes(id));
            assert.equal(prompt.includes("copilot-fixture"), false);
            return {
              data: { content: "```json\n" + JSON.stringify(advice) + "\n```" },
            };
          },
          disconnect: async () => {
            disconnects++;
          },
        };
      },
      forceStop: async () => {
        stops++;
      },
    };
  });
  assert.deepEqual(result, advice);
  assert.equal(stops, 1);
  assert.equal(disconnects, 1);
  await assert.rejects(() => access(directory));
  const env = copilotRuntimeEnvironment("/tmp/fixture");
  assert.equal("STRIPE_SECRET_KEY" in env, false);
  assert.equal("DATABASE_URL" in env, false);
});

test("Copilot auth/provider errors stop the runtime and return bounded safe diagnostics", async (t) => {
  const original = process.env;
  t.after(() => {
    process.env = original;
  });
  process.env = { NODE_ENV: "test", COPILOT_GITHUB_TOKEN: "fixture" };
  let stops = 0;
  await assert.rejects(
    () =>
      recommendCopilot(reports, [id], () => ({
        start: async () => {},
        getAuthStatus: async () => ({ isAuthenticated: false }),
        createSession: async () => {
          throw Error("must_not_call_model");
        },
        forceStop: async () => {
          stops++;
        },
      })),
    /copilot_authentication_failed/,
  );
  assert.equal(stops, 1);
  assert.equal(
    safeCopilotError(Error("401 Unauthorized private-token-value")).message,
    "copilot_authentication_failed",
  );
  assert.equal(
    safeCopilotError(Error("403 forbidden private-details")).message,
    "copilot_access_denied",
  );
  assert.equal(
    safeCopilotError(Error("GLIBC missing private-file")).message,
    "copilot_runtime_incompatible",
  );
  assert.throws(() => parseCopilotAdvice('{"items":[]}', [id]));
});

test("Copilot alone can satisfy PDF provider readiness while payments remain explicitly gated", (t) => {
  const original = process.env;
  t.after(() => {
    process.env = original;
  });
  process.env = {
    NODE_ENV: "test",
    PAYMENTS_ENABLED: "true",
    CRON_SECRET: "fixture",
    DATABASE_URL: "postgresql://fixture",
    STRIPE_SECRET_KEY: "fixture",
    STRIPE_WEBHOOK_SECRET: "fixture",
    RESEND_API_KEY: "fixture",
    RESEND_FROM_EMAIL: "fixture",
    COPILOT_GITHUB_TOKEN: "fixture",
  };
  assert(readiness("pdf"));
  process.env.PAYMENTS_ENABLED = "false";
  assert.equal(readiness("pdf"), false);
});
