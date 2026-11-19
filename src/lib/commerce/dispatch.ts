import { randomUUID } from "node:crypto";
import { start } from "workflow/api";
import { HookConflictError } from "workflow/errors";
import { siteWorkflow } from "@/workflows/site";
import { pdfWorkflow } from "@/workflows/pdf";
import { sql } from "./store";
export async function dispatchPdf(id: string) {
  const rows =
    await sql()`UPDATE scanner_orders SET status='queued',error=NULL,run_id=CASE WHEN status='failed' THEN NULL ELSE run_id END,attempt=CASE WHEN status='failed' THEN attempt+1 ELSE attempt END WHERE id=${id} AND kind='pdf' AND (status IN ('paid','failed') OR (status='queued' AND run_id IS NULL)) RETURNING attempt`;
  if (!rows[0]) return;
  const token = "pdf:" + id + ":" + rows[0].attempt;
  try {
    const run = await start(pdfWorkflow, [id], {
      experimental_hook: { token, experimental_minRetention: "30 days" },
    });
    await sql()`UPDATE scanner_orders SET run_id=${run.runId} WHERE id=${id}`;
  } catch (e) {
    if (HookConflictError.is(e)) {
      await sql()`UPDATE scanner_orders SET run_id=${e.conflictingRunId ?? ""} WHERE id=${id}`;
    } else throw e;
  }
}
export async function dispatchSite(siteId: string, initialId?: string) {
  const existing =
    await sql()`SELECT id,run_id FROM scanner_cycles WHERE site_id=${siteId} AND status IN ('queued','running') LIMIT 1`;
  if (existing[0]?.run_id) return;
  const id = existing[0]?.id ?? initialId ?? randomUUID();
  if (!existing[0]) {
    const rows =
      await sql()`INSERT INTO scanner_cycles(id,site_id) VALUES (${id},${siteId}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!rows[0]) return;
  }
  try {
    const run = await start(siteWorkflow, [id], {
      experimental_hook: {
        token: "site:" + id,
        experimental_minRetention: "30 days",
      },
    });
    await sql()`UPDATE scanner_cycles SET run_id=${run.runId} WHERE id=${id}`;
  } catch (e) {
    if (HookConflictError.is(e)) {
      await sql()`UPDATE scanner_cycles SET run_id=${e.conflictingRunId ?? ""} WHERE id=${id}`;
    } else throw e;
  }
  await sql()`UPDATE scanner_sites SET next_run=date_trunc('day',now())+interval '7 days' WHERE id=${siteId}`;
}
