import { timingSafeEqual } from "node:crypto";
import { checkServices } from "@/lib/commerce/check-services";
export const maxDuration = 60;
export async function GET(request: Request) {
  const expected = Buffer.from("Bearer " + process.env.SERVICE_CHECK_TOKEN);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    !process.env.SERVICE_CHECK_TOKEN ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    return new Response("Unauthorized", { status: 401 });
  return Response.json(await checkServices(), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
