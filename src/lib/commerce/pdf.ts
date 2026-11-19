import type { ScanReport } from "../types";
import type { Advice } from "./recommendations";
import { escape } from "./mail";
import { launchBrowser } from "../browser";
export function technicalHtml(reports: ScanReport[], advice: Advice) {
  const fr = reports[0]?.language === "fr";
  const title = fr
    ? "Plan de correction technique"
    : "Technical remediation plan";
  const disclaimer = fr
    ? "Analyse automatisée d’une seule page à un instant donné. Les indices Site Scanner v2 ne sont ni une certification WCAG, ni des scores Lighthouse, ni une mesure de visibilité dans les réponses IA. Les recommandations IA sont fondées sur les constats ci-dessous et doivent être validées dans votre code. Les exemples sont illustratifs ; aucun dépôt source n’a été inspecté."
    : "Automated single-page snapshot. Site Scanner v2 indices are not WCAG certification, Lighthouse scores or measured AI answer visibility. AI recommendations are grounded in the findings below and require source-code review. Examples are illustrative; no source repository was inspected.";
  return `<!doctype html><html lang="${fr ? "fr" : "en"}"><head><meta charset="utf-8"><title>${title}</title><style>@page{size:A4;margin:20mm 16mm}body{font-family:Arial,sans-serif;color:#172034;font-size:11px;line-height:1.6}h1{font-size:29px}h2{font-size:21px;padding-top:20px;color:#b92f31}h3{font-size:15px}p,li{overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f3f6;padding:12px;font-size:10px}article{border-top:1px solid #ddd;padding-top:12px}h2,h3,h4{break-after:avoid}pre, .score{break-inside:avoid}.muted{color:#536174}.score{display:inline-block;padding:12px;background:#f1f3f6;margin:5px}.category{break-before:page}a{color:#274a9b}</style></head><body><p>SITE SCANNER · ${fr ? "Rapport unique" : "One-time report"}</p><h1>${title}</h1><p>${escape(reports[0]?.finalUrl ?? "")}</p><p>${escape(reports[0]?.scannedAt ?? "")}</p><p class="muted">${disclaimer}</p><h2>${fr ? "Synthèse et priorités" : "Overview and priorities"}</h2>${reports.map((r) => `<div class="score">${escape(r.scanType)}<br><strong>${r.score}/100</strong><br>${r.issues.length} ${fr ? "règles en échec" : "failed rules"} · ${r.passedRuleCount} ${fr ? "réussies" : "passed"}</div>`).join("")}<p>${fr ? "Traitez d’abord les constats critiques puis sérieux. Vérifiez chaque correction et relancez le même contrôle dans les mêmes conditions." : "Address critical findings first, then serious findings. Verify each fix and rerun the same check under comparable conditions."}</p>${reports
    .map(
      (r) =>
        `<section class="category"><h2>${escape(r.scanType)} · ${r.score}/100</h2><p>${escape(r.finalUrl)}</p><p class="muted">${fr ? "Observations mesurées" : "Measured observations"} : ${escape(JSON.stringify(r.observations ?? {}))}</p>${r.issues.length === 0 ? `<p>${fr ? "Aucun échec détecté parmi les contrôles applicables. Cela ne remplace pas une revue manuelle." : "No failures detected among applicable checks. This does not replace manual review."}</p>` : ""}${r.issues
          .map((i) => {
            const a = advice.items.find(
              (v) => v.id === r.scanType + ":" + i.ruleId,
            );
            if (!a) throw new Error("missing_recommendation");
            return `<article><h3>${escape(i.help)}</h3><p><strong>${escape(i.impact)} · ${escape(i.ruleId)} · ${i.occurrences} occurrence(s)</strong></p><p>${escape(i.description)}</p>${i.sampleTargets.length ? `<pre>${escape(i.sampleTargets.join("\n"))}</pre>` : ""}<h4>Diagnostic</h4><p>${escape(a.diagnosis)}</p><h4>${fr ? "Correction proposée" : "Proposed fix"}</h4><ol>${a.steps.map((s) => `<li>${escape(s)}</li>`).join("")}</ol>${a.example ? `<h4>${fr ? "Exemple indicatif à adapter" : "Illustrative example to adapt"}</h4><pre>${escape(a.example)}</pre>` : ""}<h4>${fr ? "Validation" : "Verification"}</h4><p>${escape(a.verification)}</p><p class="muted">${escape(a.limits)}</p>${/^https:\/\//.test(i.helpUrl) ? `<p>${escape(i.helpUrl)}</p>` : ""}</article>`;
          })
          .join("")}</section>`,
    )
    .join(
      "",
    )}<section class="category"><h2>${fr ? "Méthodologie et limites" : "Methodology and limits"}</h2><p>${disclaimer}</p><p>${fr ? "Formule : 100 × contrôles réussis / (contrôles réussis + poids des échecs). Poids : critique 6, sérieux 3, modéré 1,5, mineur 0,75. Majoration plafonnée pour les répétitions. Les contrôles axe incomplets demandent une revue humaine. Performance : navigation de laboratoire depuis le serveur, sans données utilisateurs terrain. GEO : accès de robots orientés recherche, texte visible et structure sémantique ; aucune interrogation de moteur IA." : "Formula: 100 × passed checks / (passed checks + weighted failures). Weights: critical 6, serious 3, moderate 1.5, minor 0.75. Repetition penalty is capped. Incomplete axe checks require human review. Performance: server-side lab navigation, without real-user field data. GEO: search-oriented crawler access, visible text and semantic structure; no AI engine is queried."}</p><p>https://site-scanner-ecru.vercel.app/methodology</p></section></body></html>`;
}
export async function renderPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.route("**/*", (r) => r.abort());
    await page.setContent(html, { waitUntil: "load" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        '<div style="width:100%;text-align:center;font-size:9px;color:#666">Site Scanner · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
      margin: { top: "20mm", right: "16mm", bottom: "20mm", left: "16mm" },
    });
  } finally {
    await browser.close();
  }
}
