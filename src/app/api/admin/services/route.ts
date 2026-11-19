import { timingSafeEqual } from "node:crypto";
import { checkServices } from "@/lib/commerce/check-services";
export const maxDuration = 60;
function authorized(request: Request) {
  const expected = Buffer.from("Bearer " + process.env.SERVICE_CHECK_TOKEN);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return Boolean(
    process.env.SERVICE_CHECK_TOKEN &&
    actual.length === expected.length &&
    timingSafeEqual(actual, expected),
  );
}
export async function GET(request: Request) {
  if (!authorized(request))
    return new Response("Unauthorized", { status: 401 });
  return Response.json(await checkServices(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(request: Request) {
  if (!authorized(request))
    return new Response("Unauthorized", { status: 401 });
  try {
    const { aiServiceCheck } = await import("@/lib/commerce/ai-service-check");
    return Response.json(await aiServiceCheck(await request.json()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "request_failed";
    const safe =
      /^(cursor_[a-z_]+(?:_\d{3})?|incomplete_ai_report|invalid_input|rate_limited)$/.test(
        message,
      )
        ? message
        : "ai_check_failed";
    return Response.json(
      { error: safe },
      {
        status: safe === "rate_limited" ? 429 : 502,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  }
}
