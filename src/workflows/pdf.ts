export async function pdfWorkflow(orderId: string) {
  "use workflow";
  console.log("pdf_started", orderId);
  try {
    const ids = await auditOrder(orderId);
    for (let offset = 0; offset < ids.length; offset += 6)
      await adviseOrder(orderId, ids.slice(offset, offset + 6));
    await finishPdf(orderId);
  } catch {
    await failOrder(orderId);
  }
}
async function auditOrder(id: string) {
  "use step";
  const { schema, sql } = await import("@/lib/commerce/store");
  await schema();
  const { auditPage } = await import("@/lib/commerce/audit");
  const { evidence } = await import("@/lib/commerce/recommendations");
  const rows =
    await sql()`SELECT * FROM scanner_orders WHERE id=${id} AND kind='pdf' AND status IN ('paid','queued','processing','ready')`;
  const row = rows[0];
  if (!row) throw new Error("order_not_paid");
  let reports = row.reports;
  await sql()`UPDATE scanner_orders SET status='processing' WHERE id=${id} AND status IN ('paid','queued','processing')`;
  if (!reports) {
    reports = (await auditPage(row.url, row.language)).reports;
    await sql()`UPDATE scanner_orders SET reports=${sql().json(reports)},status='processing' WHERE id=${id} AND status='processing'`;
  }
  console.log("pdf_audited", id);
  return evidence(reports).map((i) => i.id);
}
async function adviseOrder(id: string, ids: string[]) {
  "use step";
  const { sql } = await import("@/lib/commerce/store");
  const { recommend } = await import("@/lib/commerce/recommendations");
  const rows =
    await sql()`SELECT reports,advice FROM scanner_orders WHERE id=${id} AND status='processing'`;
  const row = rows[0]!;
  if (!row.reports) throw new Error("missing_report");
  const prior = row.advice?.items ?? [];
  const remaining = ids.filter(
    (id) => !prior.some((a: { id: string }) => a.id === id),
  );
  if (!remaining.length) return;
  const advice = await recommend(row.reports, remaining);
  await sql()`UPDATE scanner_orders SET advice=${sql().json({ items: [...prior, ...advice.items] })} WHERE id=${id}`;
  console.log("pdf_recommendations_saved", id, remaining.length);
}
async function finishPdf(id: string) {
  "use step";
  const { sql } = await import("@/lib/commerce/store");
  const { renderPdf, technicalHtml } = await import("@/lib/commerce/pdf");
  const { mail, escape } = await import("@/lib/commerce/mail");
  const { origin } = await import("@/lib/commerce/auth");
  const rows =
    await sql()`SELECT o.*,u.email FROM scanner_orders o JOIN scanner_users u ON u.id=o.user_id WHERE o.id=${id}`;
  const row = rows[0]!;
  if (!["processing", "ready"].includes(row.status)) return;
  if (row.status !== "ready") {
    const pdf = await renderPdf(
      technicalHtml(row.reports, row.advice ?? { items: [] }),
    );
    await sql()`UPDATE scanner_orders SET pdf=${pdf},status='ready',error=NULL WHERE id=${id} AND status='processing'`;
  }
  const current = await sql()`SELECT status FROM scanner_orders WHERE id=${id}`;
  if (current[0]?.status !== "ready") return;
  await mail(
    row.email,
    "Site Scanner — votre PDF est prêt / your PDF is ready",
    `<p>Votre rapport est disponible dans votre espace client. / Your report is available in your account.</p><a href="${escape(origin() + "/account")}">Ouvrir / Open</a>`,
    "pdf-ready:" + id,
  );
  console.log("pdf_ready", id);
}
async function failOrder(id: string) {
  "use step";
  const { sql } = await import("@/lib/commerce/store");
  await sql()`UPDATE scanner_orders SET status='failed',error='generation_failed' WHERE id=${id} AND status IN ('paid','queued','processing')`;
  console.error("pdf_failed", id);
}
