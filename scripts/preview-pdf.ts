import { writeFile } from "node:fs/promises";
import { renderPdf, technicalHtml } from "../src/lib/commerce/pdf";
import { scoreFinding, countByImpact, computeTotals } from "../src/lib/scoring";
import type { ScanReport } from "../src/lib/types";
async function main() {
  const issue = scoreFinding({
    id: "label",
    impact: "critical",
    help: "Champ de formulaire sans étiquette accessible",
    description: "Un champ de recherche ne possède pas de nom accessible.",
    sampleTargets: ['form.search input[type="search"]'],
    occurrences: 1,
  });
  const reports: ScanReport[] = [
    {
      url: "https://example.com",
      finalUrl: "https://example.com",
      language: "fr",
      scanType: "accessibility",
      scannedAt: new Date().toISOString(),
      score: 72,
      counts: countByImpact([issue]),
      totalIssues: 1,
      passedRuleCount: 15,
      issues: [issue],
      businessImpacts: [],
      totals: computeTotals([issue]),
      methodologyVersion: "2",
      observations: { incompleteRuleCount: 2 },
    },
  ];
  const advice = {
    items: [
      {
        id: "accessibility:label",
        diagnosis:
          "Le contrôle automatique signale un champ sans nom accessible. Le sélecteur ci-dessous est un échantillon du problème.",
        steps: [
          "Identifier le champ dans le composant source.",
          "Associer un élément label visible au champ via les attributs for et id. Préserver les styles et la traduction.",
          "Tester au clavier et avec un lecteur d’écran.",
        ],
        example:
          '<label for="site-search">Rechercher dans le site</label>\n<input id="site-search" type="search" name="q">',
        verification:
          "Relancer axe-core et vérifier que la règle label ne signale plus ce champ. Vérifier le nom calculé dans l’arbre d’accessibilité.",
        limits:
          "Exemple indicatif : le dépôt source n’a pas été inspecté. Une revue humaine reste nécessaire.",
      },
    ],
  };
  const html = technicalHtml(reports, advice);
  await writeFile("output/pdf/sample.html", html);
  await writeFile("output/pdf/sample.pdf", await renderPdf(html));
  console.log("PDF fixture rendered");
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
