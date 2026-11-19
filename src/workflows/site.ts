export async function siteWorkflow(cycleId: string) {
  "use workflow";
  console.log("site_cycle_started", cycleId);
  try {
    const config = await cycleConfig(cycleId);
    let urls = [config.url];
    for (let index = 0; index < urls.length && index < 25; index++) {
      const links = await scanPage(cycleId, urls[index]!);
      urls = await extendUrls(config.url, links, urls);
    }
    await finishCycle(cycleId);
  } catch {
    await failCycle(cycleId);
  }
}
async function cycleConfig(id: string) {
  "use step";
  const { sql, active } = await import("@/lib/commerce/store");
  const rows =
    await sql()`SELECT s.*,u.subscription_status FROM scanner_cycles c JOIN scanner_sites s ON s.id=c.site_id JOIN scanner_users u ON u.id=s.user_id WHERE c.id=${id}`;
  const row = rows[0];
  if (!row || !active(row as { subscription_status: string }))
    throw new Error("subscription_inactive");
  await sql()`UPDATE scanner_cycles SET status='running' WHERE id=${id}`;
  return { url: row.url as string };
}
async function scanPage(id: string, url: string): Promise<string[]> {
  "use step";
  const { sql, active } = await import("@/lib/commerce/store");
  const { auditPage } = await import("@/lib/commerce/audit");
  const rows =
    await sql()`SELECT s.language,s.url,u.subscription_status FROM scanner_cycles c JOIN scanner_sites s ON s.id=c.site_id JOIN scanner_users u ON u.id=s.user_id WHERE c.id=${id}`;
  const row = rows[0];
  if (!row || !active(row as { subscription_status: string }))
    throw new Error("subscription_inactive");
  try {
    const result = await auditPage(url, row.language);
    if (new URL(result.reports[0]!.finalUrl).origin !== new URL(row.url).origin)
      throw new Error("cross_origin_redirect");
    await sql()`INSERT INTO scanner_results(cycle_id,url,reports) VALUES (${id},${url},${sql().json(result.reports as never)}) ON CONFLICT(cycle_id,url) DO UPDATE SET reports=excluded.reports,error=NULL`;
    console.log("site_page_saved", id);
    return result.links;
  } catch {
    await sql()`INSERT INTO scanner_results(cycle_id,url,error) VALUES (${id},${url},'page_audit_failed') ON CONFLICT(cycle_id,url) DO UPDATE SET error=excluded.error`;
    return [];
  }
}
async function extendUrls(root: string, links: string[], visited: string[]) {
  "use step";
  const { pageCandidates } = await import("@/lib/commerce/audit");
  return pageCandidates(root, links, visited);
}
async function finishCycle(id: string) {
  "use step";
  const { sql } = await import("@/lib/commerce/store");
  const { mail, escape } = await import("@/lib/commerce/mail");
  const { origin } = await import("@/lib/commerce/auth");
  const { changes } = await import("@/lib/commerce/changes");
  const rows =
    await sql()`SELECT c.*,s.url,u.email FROM scanner_cycles c JOIN scanner_sites s ON s.id=c.site_id JOIN scanner_users u ON u.id=s.user_id WHERE c.id=${id}`;
  const row = rows[0]!;
  const results =
    await sql()`SELECT * FROM scanner_results WHERE cycle_id=${id}`;
  const prior =
    await sql()`SELECT id FROM scanner_cycles WHERE site_id=${row.site_id} AND status IN ('complete','partial') AND created_at<${row.created_at} ORDER BY created_at DESC LIMIT 1`;
  const before = prior[0]
    ? await sql()`SELECT * FROM scanner_results WHERE cycle_id=${prior[0].id}`
    : [];
  const delta = changes(before as never, results as never);
  const errors = results.filter((r) => r.error).length;
  if (!row.notified) {
    await mail(
      row.email,
      "Site Scanner — bilan hebdomadaire / weekly report",
      `<h1>Site Scanner</h1><p>${escape(row.url)}</p><p>${results.length} page(s) · ${errors} erreur(s) / error(s)</p><p>${delta.newIssues} nouveau(x) constat(s) / new finding(s) · ${delta.resolved} résolu(s) / resolved · ${delta.regressions} baisse(s) de score / score regression(s).</p><p>${prior[0] ? "Comparaison avec le bilan précédent, pour les pages communes. / Compared with the previous run, for matching pages." : "Premier bilan : base de comparaison. / First run: baseline."}</p><a href="${escape(origin() + "/account")}">Historique et détails / History and details</a>`,
      "site-cycle:" + id,
    );
  }
  await sql()`UPDATE scanner_cycles SET status=${errors ? "partial" : "complete"},notified=true WHERE id=${id}`;
  console.log("site_cycle_complete", id);
}
async function failCycle(id: string) {
  "use step";
  const { sql } = await import("@/lib/commerce/store");
  const { mail, escape } = await import("@/lib/commerce/mail");
  const { origin } = await import("@/lib/commerce/auth");
  await sql()`UPDATE scanner_cycles SET status='failed' WHERE id=${id} AND status NOT IN ('complete','partial')`;
  const rows =
    await sql()`SELECT u.email FROM scanner_cycles c JOIN scanner_sites s ON s.id=c.site_id JOIN scanner_users u ON u.id=s.user_id WHERE c.id=${id}`;
  if (rows[0])
    await mail(
      rows[0].email,
      "Site Scanner — bilan incomplet / scan failed",
      `<p>Le bilan n’a pas pu être terminé. Consultez l’espace client pour les résultats disponibles. / The scan could not finish. Check your account for available results.</p><a href="${escape(origin() + "/account")}">Site Scanner</a>`,
      "site-failed:" + id,
    );
  console.error("site_cycle_failed", id);
}
