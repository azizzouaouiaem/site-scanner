import Link from "next/link";
export const metadata = { title: "Méthodologie et limites — Site Scanner" };
export default function Methodology() {
  return (
    <main className="mx-auto max-w-3xl space-y-7 px-5 py-12">
      <Link className="underline" href="/">
        ← Site Scanner
      </Link>
      <h1 className="text-3xl font-bold">Méthodologie / Methodology — v2</h1>
      <p>
        Les indices décrivent les contrôles automatiques applicables à une page
        publique au moment de la visite. Ils ne prédisent pas un classement, une
        conversion ou une citation par un moteur IA. Un score de 100 signifie
        seulement qu’aucun échec n’a été détecté parmi ces contrôles.
      </p>
      <p>
        Indices describe applicable automated checks on a public page at scan
        time. A score of 100 only means no failures were detected by those
        checks; it does not guarantee rankings, conversions, compliance or AI
        citations.
      </p>
      <h2 className="text-xl font-bold">Calcul / Calculation</h2>
      <p>
        Score = arrondi de 100 × P / (P + F). P : nombre de contrôles réussis. F
        : somme des poids des règles en échec. Poids : critique 6 ; sérieux 3 ;
        modéré 1,5 ; mineur 0,75. Pour chaque règle : poids × (1 + 0,05 ×
        min(max(occurrences − 1, 0), 9)). Aucun contrôle évalué : indice 0, à
        interpréter comme absence de couverture. Les erreurs de chargement ne
        reçoivent pas de score.
      </p>
      <p>
        Score = round(100 × passed / (passed + weighted failures)). Weights:
        critical 6, serious 3, moderate 1.5, minor 0.75, with a repetition
        multiplier capped at 1.45. No evaluated checks yields 0 (no coverage).
        Navigation errors receive no score. Scores from different versions or
        categories are not interchangeable.
      </p>
      <h2 className="text-xl font-bold">Accessibilité / Accessibility</h2>
      <p>
        axe-core, règles WCAG A/AA jusqu’à 2.2 et bonnes pratiques. Les règles
        inapplicables sont exclues ; les résultats incomplets sont signalés
        séparément et nécessitent une revue humaine. Une analyse automatique ne
        certifie jamais la conformité WCAG.
      </p>
      <p>
        axe-core WCAG A/AA rules through 2.2 and best practices. Inapplicable
        rules are excluded; incomplete checks require manual review. Automated
        testing is not WCAG certification.
      </p>
      <h2 className="text-xl font-bold">
        SEO — 11 familles de contrôles / check families
      </h2>
      <p>
        Indexation meta robots, titre, description, canonical, H1, viewport,
        Open Graph, JSON-LD valide, langue, attribut alt et contenu textuel. Les
        longueurs et le nombre de mots sont des repères contextuels, pas des
        exigences Google. Pas de mesure de backlinks, positionnement, Search
        Console ou indexation effective.
      </p>
      <h2 className="text-xl font-bold">Performance — 8 contrôles / checks</h2>
      <p>
        TTFB &gt; 600 ms, DOMContentLoaded &gt; 2 500 ms, chargement &gt; 4 000
        ms, transfert mesurable &gt; 3 Mo, requêtes &gt; 80, DOM &gt; 1 500
        éléments, scripts bloquants et images surdimensionnées. Mesures de
        laboratoire depuis le serveur, sans émulation réseau mobile ni données
        terrain. Les ressources tierces peuvent masquer leur taille ; la mesure
        de transfert est une borne basse. Ce n’est pas un score Lighthouse ou
        Core Web Vitals.
      </p>
      <h2 className="text-xl font-bold">
        Préparation technique IA / AI technical readiness — 3 contrôles / checks
      </h2>
      <p>
        Accès à l’URL pour OAI-SearchBot et PerplexityBot selon robots.txt,
        présence de texte visible et repère main/article. llms.txt, FAQ, auteur
        et structure de questions sont des observations non pénalisantes. Nous
        n’interrogeons pas ChatGPT ou les autres moteurs pour mesurer les
        citations. Aucun schéma spécial ni fichier llms.txt n’est requis pour
        apparaître dans les fonctionnalités IA de Google.
      </p>
      <p>
        <a
          className="underline"
          href="https://developers.google.com/search/docs/appearance/ai-features"
        >
          Documentation Google sur les fonctionnalités IA / Google AI features
          documentation
        </a>
      </p>
      <h2 className="text-xl font-bold">
        PDF IA et suivi / AI PDF and monitoring
      </h2>
      <p>
        Le PDF à 9,99 $ CA porte sur une seule URL et quatre catégories. Les
        recommandations générées sont rattachées aux constats détectés ; les
        exemples doivent être adaptés dans le code source. L’IA ne fixe pas les
        scores. L’offre Site à 29 $ CA/mois couvre un seul site et jusqu’à 25
        pages découvertes par liens internes sur la même origine, sans URL à
        paramètres. Le suivi hebdomadaire compare les pages communes, avec la
        même version de méthode. Les erreurs et pages bloquées sont affichées.
        Le PDF est vendu séparément.
      </p>
      <p>
        The one-time CA$9.99 AI PDF covers one URL across four categories.
        Recommendations reference detected findings and require human
        validation. AI does not set scores. The CA$29/month Site plan covers one
        site and up to 25 internally linked, same-origin pages, excluding query
        URLs. Weekly comparisons use matching pages and methodology versions.
        PDFs are sold separately.
      </p>
    </main>
  );
}
