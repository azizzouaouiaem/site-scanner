import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { ScanReport } from "../types";
import {
  launchCursor,
  pollCursor,
  closeCursor,
  type CursorTicket,
} from "./cursor";

// An explicit admin-only smoke test: one synthetic finding, no purchase or email.
const reports = [
  {
    scanType: "seo",
    language: "fr",
    finalUrl: "https://example.com",
    issues: [
      {
        ruleId: "missing-title",
        impact: "moderate",
        help: "La page de test ne contient pas de balise title.",
        description:
          "Constat synthétique pour vérifier la connexion IA, pas un audit réel.",
        sampleTargets: ["head"],
        occurrences: 1,
      },
    ],
  },
] as ScanReport[];
const ids = ["seo:missing-title"];
const ticketSchema = z.object({
  agentId: z.string().regex(/^bc-[a-f0-9-]{36}$/i),
  runId: z.string().regex(/^run-[a-z0-9-]{1,100}$/i),
  deadline: z.number().finite(),
});
function sign(payload: string) {
  if (!process.env.SERVICE_CHECK_TOKEN) throw new Error("unauthorized");
  return createHmac("sha256", process.env.SERVICE_CHECK_TOKEN)
    .update(payload)
    .digest("hex");
}
function encode(ticket: CursorTicket) {
  const payload = Buffer.from(JSON.stringify(ticket)).toString("base64url");
  return payload + "." + sign(payload);
}
function decode(token: string) {
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !/^[a-f0-9]{64}$/.test(signature))
    throw new Error("invalid_input");
  const actual = Buffer.from(signature, "hex");
  if (!timingSafeEqual(actual, Buffer.from(sign(payload), "hex")))
    throw new Error("invalid_input");
  return ticketSchema.parse(
    JSON.parse(Buffer.from(payload, "base64url").toString("utf8")),
  );
}
export async function aiServiceCheck(input: unknown) {
  const body = z
    .object({
      action: z.enum(["cursor-start", "cursor-poll", "cursor-close"]),
      ticket: z.string().max(2000).optional(),
    })
    .parse(input);
  if (body.action === "cursor-start") {
    const { limit } = await import("./store");
    await limit("admin:cursor-service-check", 4);
    const ticket = await launchCursor(
      reports,
      ids,
      "admin-service-check:" + Math.floor(Date.now() / 3600000),
      0,
    );
    if (!ticket) return { status: "missing_configuration", fixture: true };
    return { status: "started", ticket: encode(ticket), fixture: true };
  }
  if (!body.ticket) throw new Error("invalid_input");
  const ticket = decode(body.ticket);
  if (body.action === "cursor-close") {
    await closeCursor(ticket);
    return { status: "closed", fixture: true };
  }
  try {
    const advice = await pollCursor(ticket, ids);
    if (!advice) return { status: "running", fixture: true };
    await closeCursor(ticket);
    return {
      status: "validated",
      provider: "cursor-agents",
      fixture: true,
      advice,
    };
  } catch (error) {
    await closeCursor(ticket);
    throw error;
  }
}
