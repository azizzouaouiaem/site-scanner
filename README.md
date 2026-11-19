# Site Scanner

Bilingual Next.js application: free single-page audits, Site monitoring (CA$29/month,
one website, up to 25 internally linked same-origin pages), and an independent
one-time technical AI PDF (CA$9.99, one URL across four categories).

## Development

Node >=22.13 (production Node 24). `npm ci`, then `npm run dev`.
Local Chromium: `npx playwright-core install chromium`.
`npm run build`, `npm run lint`, `npm test`.

Audits run Chromium and axe-core. GEO measures **technical readiness**, never actual
AI mentions or citations. `/methodology` documents score v2, check counts, thresholds,
manual review and lab measurement limitations. An excellent score retains its report.

## Required production configuration

Configure secrets directly in Vercel → site-scanner → Settings → Environment Variables.
Do not put them in chat, source control or NEXT_PUBLIC variables.

| Variable | Purpose |
|---|---|
| APP_URL | https://site-scanner-ecru.vercel.app (trusted origin, never request Host) |
| DATABASE_URL | Supabase Postgres connection URI, preferably transaction pooler; URL-encode password |
| RESEND_API_KEY | Existing Resend API credential |
| RESEND_FROM_EMAIL | Verified sender for login, PDF delivery and weekly alerts |
| STRIPE_SECRET_KEY | Stripe server key; begin in test mode |
| STRIPE_WEBHOOK_SECRET | Signing secret for the webhook below, matching test/live mode |
| CRON_SECRET | Random server secret protecting the daily dispatcher |
| CURSOR_API_KEY | Cursor Dashboard API key, stored as a Production Secret; preferred report provider |
| CURSOR_MODEL | Optional ID from Cursor GET /v1/models; omit to use the account default (not the key's label) |
| REPORT_LLM_URL | HTTPS OpenAI-compatible chat-completions endpoint for automatic fallback |
| REPORT_LLM_API_KEY | Fallback provider server API key, separate from the Cursor key |
| REPORT_LLM_MODEL | Model identifier supporting JSON-object output and max_completion_tokens |
| PAYMENTS_ENABLED | Set to true **after** provider configuration and end-to-end test checkout/delivery |
| CHROMIUM_PACK_URL | Optional matching @sparticuz/chromium-min Linux pack |

Reports first use Cursor's documented v1 Cloud Agents API with Basic authentication.
One no-repository agent is launched per PDF attempt, without repo access, environment
secrets, MCP servers or PR creation in the request. Its prompt asks for JSON in the final
assistant reply and forbids tools or external actions. Cursor's agent runtime still has
its own capabilities and account policies; this prompt is not a sandbox permission control.
Only audit findings are sent; never email addresses, order IDs or payment data.
The agent ID is deterministic per order attempt, so a retry recovers the existing run
after a lost response instead of starting another charged agent. Workflow sleeps between
status checks without holding a function open. After 10 minutes, an API failure, a failed
run or invalid/incomplete JSON, the application attempts cancellation/archive and uses
the existing REPORT_LLM_* provider in batches of six findings. Completed agents are also
archived. Provider failure cannot fabricate a successful PDF or change its scores.
If Cursor credentials are absent, the configured fallback is used directly. If both
providers fail or the fallback is missing, the order fails and can be retried from the
account without another payment. No findings means no AI request.
See [Cursor v1 reference](https://cursor.com/docs/cloud-agent/api/endpoints).
The customer purchases a report based on observed findings, not source-repository
analysis or guaranteed exhaustive detection. AI never alters scores. Each output
batch must include each supplied finding exactly once. Recommendations and evidence
are persisted, so a failed PDF can be retried without charging again. The AI is not
called for the free or recurring Site audits.

Until configuration is complete, checkout is rejected server-side with 503 and the
account page disables purchase buttons. Free audits remain available. Do not enable
live payments until both the Site and PDF fulfillment paths are tested.

### Supabase

Use a dedicated project or database where possible. The application uses the server
Postgres URI, **not** Supabase's anon/publishable key. Database tables are created in
an advisory-locked transaction on first authenticated use. New `scanner_*` tables and
the legacy `scans` table enable RLS, with no public client policies. Connect using the
server database owner/appropriate migration role. Never expose the database password
or service credentials to the browser. `prepare:false` supports the transaction
pooler. Non-loopback database connections require TLS.

### Stripe

Create a webhook endpoint:

`https://site-scanner-ecru.vercel.app/api/stripe/webhook`

Subscribe to:

- checkout.session.completed
- checkout.session.async_payment_succeeded
- checkout.session.expired
- customer.subscription.created
- customer.subscription.updated
- customer.subscription.deleted
- charge.refunded

Enable the Stripe customer portal for invoices and subscription cancellation.
Prices are created server-side in CAD: 2900 cents monthly or 999 cents one-time.
No price, account identity or entitlement is accepted from client input.
Webhook fulfillment verifies the raw-body signature, retrieves the authoritative
Checkout Session, checks complete/paid state, owner, order, product, exact amount,
currency and mode. Subscription lifecycle events fetch current Stripe state, avoiding
out-of-order event regressions. Fully refunded PDF orders lose download access.
No browser redirect or `paid=1` query grants access. Recurring payment failures disable
monitoring through subscription status; cancellation at period end remains active
until Stripe ends the subscription. Replays do not create duplicate initial cycles.

### Jobs and weekly monitoring

Vercel Workflow SDK checkpoints processing steps; closing a browser does not stop work.
A daily authenticated Vercel Cron dispatcher starts due weekly site cycles and recovers
queued PDF jobs. Each page audit is one workflow step; up to 25 pages are discovered
breadth-first, same origin only, excluding fragments, query URLs, downloads and common
mutating routes. Blocked pages record errors and never receive a fabricated score.
Each scan compares matching pages with the preceding completed/partial cycle using the
same scoring version. Email includes new/resolved rules, score regressions and failures.
Initial cycles establish a baseline. One user can monitor one site per Site subscription.
Historical runs and rule evidence are available in the private account area.

Workflow's generated routes under `src/app/.well-known/workflow/` are ignored by Git.
They are rebuilt by `withWorkflow()` during the Vercel build. Check workflow invocation
limits and usage in Vercel before scaling; no hosting-plan upgrade is performed by code.

## Verification

- `npm test`: score endpoints, independent arithmetic, full failing fixtures and exact
  denominators (SEO 11, performance 8, GEO 3), context-sensitive GEO behavior, SSRF,
  complete AI output, comparable weekly alerts, signed/tampered/stale Stripe events
  and exact Checkout identity/amount/mode validation.
- Set TEST_DATABASE_URL to a **disposable** Postgres DB whose name includes
  `scanner_test_` to include actual schema, RLS, concurrent-cycle and atomic-limit tests.
- `npm run lint` and `npm run build` validate the application and workflow compilation.
- `npx tsx scripts/preview-pdf.ts`: deterministic layout fixture, no provider call.
  Writes ignored PDF/HTML output under output/pdf. It is not a real AI-generated audit.

### Before enabling payments

1. Set Supabase and Stripe **test** credentials on Vercel; configure the endpoint/events
   and customer portal. Configure the selected AI endpoint/model/key.
2. Redeploy; sign in with a real email, complete a test PDF checkout and download the PDF.
   Validate content against its findings, retry behavior and a replay of its webhook.
3. Complete a test Site checkout, verify initial crawl/history and weekly change alerts.
   Test cancellation, renewal failure and a fully refunded PDF. Confirm access isolation.
4. Replace test credentials with matching live credentials/webhook secret, redeploy and
   set PAYMENTS_ENABLED=true for the live release. Review taxes/receipts in your Stripe
   account before taking real payments; the application itself does not add a tax rate.

Provider credentials were not available during initial implementation; no real Stripe
transaction, provider model call or scheduled paid run should be considered verified
until these steps have succeeded. Production Supabase connection/schema initialization
was verified separately on 2026-11-19 (7 scanner tables with RLS).

Private service diagnostics: `/api/admin/services` requires the generated
SERVICE_CHECK_TOKEN bearer secret and returns bounded status fields only.
It can validate schema/RLS and the Stripe connection on Vercel without exporting
production secrets locally. `scripts/check-services.ts` is a local convenience,
but Vercel sensitive production variables are intentionally unavailable locally.
