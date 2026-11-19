import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import type { ScanReport } from "../types";
import {
  evidence,
  recommendationInstructions,
  validateAdvice,
} from "./advice-contract";
import { copilotConfigured } from "./ai-config";
import type {
  CopilotClientOptions,
  CreateSessionOptions,
} from "@microsoft/copilot-sdk";
interface ReportClient {
  start(): Promise<void>;
  getAuthStatus(): Promise<{ isAuthenticated: boolean }>;
  createSession(options: CreateSessionOptions): Promise<{
    sendAndWait(
      options: { prompt: string },
      timeout: number,
    ): Promise<{ data: { content: string } } | undefined>;
    disconnect(): Promise<void>;
  }>;
  forceStop(): Promise<void>;
}
type ClientFactory = (options: CopilotClientOptions) => ReportClient;
export function copilotRuntimePath() {
  const platform = `${process.platform}-${process.arch}`;
  // Use Node's resolver, not webpack's numeric module IDs for package.json.
  const require = process
    .getBuiltinModule("node:module")
    .createRequire(join(process.cwd(), "package.json"));
  const root = dirname(
    require.resolve(`@microsoft/copilot-sdk-${platform}/package.json`),
  );
  return join(
    root,
    "prebuilds",
    platform,
    process.platform === "win32" ? "copilot-runtime.exe" : "copilot-runtime",
  );
}

export class CopilotReportError extends Error {
  constructor(readonly reason: string) {
    super("copilot_" + reason);
  }
}
export function copilotRuntimeEnvironment(directory: string) {
  // Replace inherited env: other application credentials stay out of the agent.
  return {
    PATH: process.env.PATH,
    HOME: directory,
    TMPDIR: directory,
    TMP: directory,
    TEMP: directory,
    LANG: "C.UTF-8",
  };
}
async function bounded<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new CopilotReportError("timeout")), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
export function safeCopilotError(error: unknown) {
  if (error instanceof CopilotReportError) return error;
  // Classify in memory; never expose SDK/provider messages, tokens or prompts.
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  const reason = /timeout|timed out/.test(message)
    ? "timeout"
    : /401|unauthoriz|authentication|not authenticated/.test(message)
      ? "authentication_failed"
      : /quota|billing|budget|usage.limit/.test(message)
        ? "usage_unavailable"
        : /403|forbidden|permission|policy/.test(message)
          ? "access_denied"
          : /glibc|exec format|dlopen|shared librar/.test(message)
            ? "runtime_incompatible"
            : /cannot find|enoent|not found|runtime.*missing/.test(message)
              ? "runtime_missing"
              : /incomplete_ai_report|json|unexpected token/.test(message)
                ? "invalid_output"
                : "request_failed";
  return new CopilotReportError(reason);
}
export function parseCopilotAdvice(text: string, ids: string[]) {
  if (Buffer.byteLength(text) > 1024 * 1024)
    throw new CopilotReportError("invalid_output");
  return validateAdvice(
    JSON.parse(
      text.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1"),
    ),
    ids,
  );
}
export async function recommendCopilot(
  reports: ScanReport[],
  ids: string[],
  factory?: ClientFactory,
) {
  if (!copilotConfigured()) throw new CopilotReportError("not_configured");
  if (!ids.length) return { items: [] };
  const prompt = JSON.stringify(
    evidence(reports).filter((i) => ids.includes(i.id)),
  );
  if (Buffer.byteLength(prompt) > 180000)
    throw new CopilotReportError("input_too_large");
  const directory = await mkdtemp(join(tmpdir(), "scanner-copilot-"));
  let client: ReportClient | undefined;
  try {
    const { CopilotClient, RuntimeConnection } =
      await import("@microsoft/copilot-sdk");
    const work = join(directory, "work");
    await mkdir(work);
    client = (factory ?? ((options) => new CopilotClient(options)))({
      mode: "empty",
      github: {
        token: process.env.COPILOT_GITHUB_TOKEN,
        useLoggedInUser: false,
      },
      runtime: RuntimeConnection.forSpawnedStdio({
        path: copilotRuntimePath(),
        baseDirectory: join(directory, "state"),
        workingDirectory: work,
        env: copilotRuntimeEnvironment(directory),
        sessionIdleTimeoutSeconds: 150,
      }),
      observability: { logLevel: "none", telemetry: { captureContent: false } },
      clientInfo: {
        applicationName: "site-scanner",
        applicationVersion: "2.0.0",
      },
    });
    const activeClient = client;
    return await bounded(
      (async () => {
        await activeClient.start();
        const auth = await activeClient.getAuthStatus();
        if (!auth.isAuthenticated)
          throw new CopilotReportError("authentication_failed");
        const session = await activeClient.createSession({
          model: process.env.COPILOT_MODEL || "auto",
          workingDirectory: work,
          enableConfigDiscovery: false,
          tools: { availableTools: [] },
          permissions: {
            onRequest: () => ({ kind: "denied-interactively-by-user" }),
          },
          skills: { enabled: false },
          systemMessage: {
            mode: "replace",
            content: recommendationInstructions(reports),
          },
          state: {
            infiniteSessions: { enabled: false },
            skipEmbeddingRetrieval: true,
            enableCrossSessionStore: false,
            embeddingCacheStorage: "in-memory",
          },
          github: { telemetryEnabled: false },
        });
        try {
          const message = await session.sendAndWait({ prompt }, 90000);
          if (typeof message?.data.content !== "string")
            throw new CopilotReportError("invalid_output");
          return parseCopilotAdvice(message.data.content, ids);
        } finally {
          await bounded(session.disconnect(), 3000).catch(() => undefined);
        }
      })(),
      120000,
    );
  } catch (error) {
    throw safeCopilotError(error);
  } finally {
    if (client) await bounded(client.forceStop(), 5000).catch(() => undefined);
    await rm(directory, { recursive: true, force: true }).catch(
      () => undefined,
    );
  }
}
