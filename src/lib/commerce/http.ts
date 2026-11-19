export function failure(error: unknown) {
  const code = error instanceof Error ? error.message : "request_failed";
  const known: Record<string, number> = {
    unauthorized: 401,
    forbidden: 403,
    rate_limited: 429,
    invalid_input: 400,
    invalid_url: 400,
    subscription_required: 403,
    not_found: 404,
    payment_not_ready: 503,
    database_not_configured: 503,
    email_not_configured: 503,
    report_not_ready: 409,
    checkout_in_progress: 409,
    already_subscribed: 409,
  };
  if (!known[code])
    console.error(
      "request_failed",
      error instanceof Error ? error.name : "unknown",
    );
  return Response.json(
    { error: known[code] ? code : "request_failed" },
    { status: known[code] ?? 500 },
  );
}
export const privateHeaders = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
