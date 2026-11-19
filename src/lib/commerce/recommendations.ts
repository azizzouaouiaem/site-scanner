import type { ScanReport } from "../types";
import {
  evidence,
  recommendationInstructions,
  validateAdvice,
  type Advice,
} from "./advice-contract";
import { fallbackConfigured, copilotConfigured } from "./ai-config";
import { copilotThenOpenAi } from "./advice-routing";
export * from "./advice-contract";
export { fallbackConfigured } from "./ai-config";
export async function recommendOpenAi(
  reports: ScanReport[],
  ids: string[],
): Promise<Advice> {
  const key = process.env.REPORT_LLM_API_KEY;
  const model = process.env.REPORT_LLM_MODEL;
  const endpoint = process.env.REPORT_LLM_URL;
  if (!fallbackConfigured()) throw new Error("llm_not_configured");
  const response = await fetch(endpoint!, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      model,
      max_completion_tokens: 10000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: recommendationInstructions(reports),
        },
        {
          role: "user",
          content: JSON.stringify(
            evidence(reports).filter((i) => ids.includes(i.id)),
          ),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error("llm_request_failed");
  const body = await response.json();
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new Error("invalid_llm_response");
  return validateAdvice(JSON.parse(content), ids);
}

export async function recommend(
  reports: ScanReport[],
  ids: string[],
): Promise<Advice & { provider: string }> {
  return copilotThenOpenAi(
    copilotConfigured()
      ? async () => {
          const { recommendCopilot } = await import("./copilot");
          return recommendCopilot(reports, ids);
        }
      : null,
    () => recommendOpenAi(reports, ids),
  );
}
