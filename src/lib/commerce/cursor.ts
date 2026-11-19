import { createHash } from "node:crypto";
import { z } from "zod";
import type { ScanReport } from "../types";
import { recommendationPrompt, validateAdvice } from "./advice-contract";

// Cursor v1 supports no-repository agents and terminal run results.
// https://cursor.com/docs/cloud-agent/api/endpoints
const API = "https://api.cursor.com/v1";
export const CURSOR_TIMEOUT_MS = 10 * 60 * 1000;
export const cursorConfigured = () => Boolean(process.env.CURSOR_API_KEY);
export async function checkCursorAuth() {
  if (!cursorConfigured()) return "missing";
  try {
    await request("/me");
    return "connected";
  } catch {
    return "failed";
  }
}
const agentIdSchema = z.string().regex(/^bc-[a-f0-9-]{36}$/i);
const runIdSchema = z.string().regex(/^run-[a-z0-9-]{1,100}$/i);
export class CursorApiError extends Error {
  constructor(
    status: number,
    readonly reason?: string,
  ) {
    super(`cursor_http_${status}`);
  }
}
function errorReason(value: unknown) {
  const data = value as {
    code?: unknown;
    error?: unknown;
    message?: unknown;
  } | null;
  const nested = data?.error as { code?: unknown; message?: unknown } | null;
  const codes = [data?.code, nested?.code, data?.error];
  const known = new Set([
    "storage_not_allowed",
    "plan_required",
    "feature_unavailable",
    "repository_access",
    "billing_required",
    "cloud_agents_disabled",
    "background_agents_disabled",
    "spending_limit_exceeded",
    "usage_limit_exceeded",
    "model_not_allowed",
    "insufficient_scope",
    "on_demand_not_enabled",
    "privacy_mode_enabled",
  ]);
  for (const code of codes)
    if (typeof code === "string" && known.has(code)) return code;
  // Classify other provider messages in memory; never return their text.
  const text = [
    data?.message,
    nested?.message,
    typeof data?.error === "string" ? data.error : undefined,
  ]
    .filter((v) => typeof v === "string")
    .join(" ")
    .toLowerCase();
  if (/privacy|storage/.test(text)) return "privacy_or_storage";
  if (/spend|billing|payment|on.demand/.test(text)) return "billing_or_usage";
  if (/subscription|paid plan|pro plan/.test(text))
    return "subscription_required";
  if (/permission|scope|access|enable/.test(text)) return "account_access";
  return undefined;
}
export interface CursorTicket {
  agentId: string;
  runId: string;
  deadline: number;
}
export function cursorAgentId(orderId: string, attempt: number) {
  const h = createHash("sha256")
    .update(`pdf:${orderId}:${attempt}`)
    .digest("hex");
  return `bc-${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
async function request(path: string, method = "GET", body?: unknown) {
  const key = process.env.CURSOR_API_KEY;
  if (!key) throw new Error("cursor_not_configured");
  const response = await fetch(API + path, {
    method,
    headers: {
      Authorization: "Basic " + Buffer.from(key + ":").toString("base64"),
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  let value: unknown;
  try {
    value = await readResponse(response);
  } catch {
    if (!response.ok) throw new CursorApiError(response.status);
    throw new Error("cursor_invalid_response");
  }
  // Only an allowlisted code/category leaves the server, never provider text.
  if (!response.ok)
    throw new CursorApiError(response.status, errorReason(value));
  return value;
}
async function readResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("cursor_empty_response");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1024 * 1024) throw new Error("cursor_response_too_large");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
export async function launchCursor(
  reports: ScanReport[],
  ids: string[],
  orderId: string,
  attempt: number,
): Promise<CursorTicket | null> {
  if (!cursorConfigured() || !ids.length) return null;
  const agentId = cursorAgentId(orderId, attempt);
  const prompt = recommendationPrompt(reports, ids);
  if (Buffer.byteLength(prompt) > 180000)
    throw new Error("cursor_prompt_too_large");
  let value: unknown;
  try {
    value = await request("/agents", "POST", {
      agentId,
      name: "Site Scanner — technical report",
      prompt: {
        text:
          prompt +
          "\nReply with the JSON object as your final assistant reply. Do not create files, run commands, use tools or access any repositories, accounts or external services.",
      },
      autoCreatePR: false,
      ...(process.env.CURSOR_MODEL
        ? { model: { id: process.env.CURSOR_MODEL } }
        : {}),
      // No repos, environments, MCP servers or session secrets are supplied.
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== "cursor_http_409")
      throw error;
    // A retry after a lost response must recover the same run, never launch a second agent.
    const agent = z
      .object({
        id: agentIdSchema,
        latestRunId: runIdSchema,
        createdAt: z.string(),
      })
      .parse(await request(`/agents/${agentId}`));
    const started = Date.parse(agent.createdAt);
    if (agent.id !== agentId || !Number.isFinite(started))
      throw new Error("cursor_agent_mismatch");
    return {
      agentId: agent.id,
      runId: agent.latestRunId,
      deadline: started + CURSOR_TIMEOUT_MS,
    };
  }
  const result = z
    .object({
      agent: z.object({ id: agentIdSchema }),
      run: z.object({ id: runIdSchema, createdAt: z.string() }),
    })
    .parse(value);
  if (result.agent.id !== agentId) throw new Error("cursor_agent_mismatch");
  const started = Date.parse(result.run.createdAt);
  if (!Number.isFinite(started)) throw new Error("cursor_invalid_timestamp");
  return {
    agentId,
    runId: result.run.id,
    deadline: started + CURSOR_TIMEOUT_MS,
  };
}
function runPath(ticket: CursorTicket) {
  return `/agents/${agentIdSchema.parse(ticket.agentId)}/runs/${runIdSchema.parse(ticket.runId)}`;
}
export function parseCursorAdvice(text: string, ids: string[]) {
  // Accept one optional JSON fence, never extract a convenient subset of prose.
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, "$1");
  return validateAdvice(JSON.parse(cleaned), ids);
}
export async function pollCursor(ticket: CursorTicket, ids: string[]) {
  if (!Number.isFinite(ticket.deadline) || Date.now() >= ticket.deadline)
    throw new Error("cursor_timeout");
  const run = z
    .object({
      id: runIdSchema,
      agentId: agentIdSchema,
      status: z.enum([
        "CREATING",
        "RUNNING",
        "WAITING_FOR_BACKGROUND_WORK",
        "FINISHED",
        "ERROR",
        "CANCELLED",
        "EXPIRED",
      ]),
      result: z
        .string()
        .max(1024 * 1024)
        .nullish(),
    })
    .parse(await request(runPath(ticket)));
  if (run.id !== ticket.runId || run.agentId !== ticket.agentId)
    throw new Error("cursor_run_mismatch");
  if (run.status === "FINISHED")
    return parseCursorAdvice(run.result ?? "", ids);
  if (["ERROR", "CANCELLED", "EXPIRED"].includes(run.status))
    throw new Error("cursor_run_failed");
  return null;
}
export async function closeCursor(ticket: CursorTicket) {
  // Both operations are best effort; fallback delivery must survive provider outages.
  await request(runPath(ticket) + "/cancel", "POST").catch(() => undefined);
  await request(
    `/agents/${agentIdSchema.parse(ticket.agentId)}/archive`,
    "POST",
  ).catch(() => undefined);
}
