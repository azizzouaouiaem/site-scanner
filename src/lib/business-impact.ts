import type { AxeImpact, BusinessImpact, Language, ScanType, ScoredIssue } from './types';

/**
 * Deterministic technical-issue -> business-impact translation. No LLM: a
 * lookup table for common axe-core rules, with a severity-based generic
 * fallback (built from the rule's own `help` text) for the long tail of
 * rules we haven't hand-written a message for.
 */

interface BilingualText {
  en: string;
  fr: string;
}

const ACCESSIBILITY_RULE_MESSAGES: Record<string, BilingualText> = {
  'image-alt': {
    en: 'Product and marketing images are invisible to screen-reader users and to search engines — lost sales content and SEO visibility.',
    fr: "Les images produits/marketing sont invisibles pour les utilisateurs de lecteurs d'écran et pour les moteurs de recherche — perte de contenu commercial et de visibilité SEO.",
  },
  'svg-img-alt': {
    en: 'Icons and inline graphics carry no accessible meaning, so assistive-technology users miss information sighted visitors get for free.',
    fr: "Les icônes et graphiques intégrés ne portent aucune signification accessible : les utilisateurs de technologies d'assistance ratent une information que les visiteurs voyants obtiennent gratuitement.",
  },
  'link-name': {
    en: 'Links with no discernible purpose ("click here", icon-only) confuse assistive-technology users and hurt conversion on your calls-to-action.',
    fr: "Des liens sans intitulé clair (« cliquez ici », icône seule) déroutent les utilisateurs de technologies d'assistance et nuisent à la conversion sur vos appels à l'action.",
  },
  'button-name': {
    en: 'Buttons with no accessible label can\'t be operated by screen-reader or voice-control users — a hard stop in checkout or sign-up flows.',
    fr: "Des boutons sans libellé accessible ne peuvent pas être actionnés par les utilisateurs de lecteurs d'écran ou de commande vocale — un blocage net dans le parcours d'achat ou d'inscription.",
  },
  label: {
    en: 'Form fields without labels are a leading cause of abandoned forms for assistive-technology users — direct lead/revenue loss.',
    fr: "Des champs de formulaire sans étiquette sont l'une des principales causes d'abandon pour les utilisateurs de technologies d'assistance — perte directe de leads et de revenus.",
  },
  'color-contrast': {
    en: 'Low-contrast text is hard to read for low-vision users and anyone on a phone in daylight — a readability issue that affects every visitor.',
    fr: "Un texte à faible contraste est difficile à lire pour les personnes malvoyantes et pour n'importe qui sur son téléphone en plein soleil — un problème de lisibilité qui touche tous les visiteurs.",
  },
  'document-title': {
    en: 'A missing or empty page title breaks browser tabs, bookmarks, search-result snippets, and screen-reader page announcements at once.',
    fr: "Un titre de page manquant ou vide casse en même temps les onglets du navigateur, les favoris, les extraits dans les résultats de recherche et l'annonce de page pour les lecteurs d'écran.",
  },
  'html-has-lang': {
    en: 'Without a declared page language, screen readers mispronounce your content and browsers can mistranslate it for international visitors.',
    fr: "Sans langue déclarée sur la page, les lecteurs d'écran prononcent mal votre contenu et les navigateurs peuvent mal le traduire pour les visiteurs internationaux.",
  },
  'landmark-one-main': {
    en: 'Assistive-technology users lose the "skip to main content" shortcut, forcing them to tab through the entire header on every single page.',
    fr: "Les utilisateurs de technologies d'assistance perdent le raccourci « aller au contenu principal » et doivent parcourir tout l'en-tête sur chaque page.",
  },
  region: {
    en: 'Content that sits outside any landmark is effectively unnavigable for screen-reader users, who browse pages region by region.',
    fr: "Le contenu situé hors de toute région structurelle est pratiquement impossible à parcourir pour les utilisateurs de lecteurs d'écran, qui naviguent région par région.",
  },
  'aria-valid-attr-value': {
    en: 'Broken ARIA attributes actively lie to assistive technology about what a control does — worse for users than having no ARIA at all.',
    fr: "Des attributs ARIA invalides indiquent une information fausse aux technologies d'assistance sur le rôle d'un contrôle — pire que l'absence totale d'ARIA.",
  },
  'aria-allowed-role': {
    en: 'Misused ARIA roles make interactive elements announce themselves incorrectly, confusing screen-reader navigation site-wide.',
    fr: "Des rôles ARIA mal utilisés font que les éléments interactifs s'annoncent incorrectement, ce qui perturbe la navigation au lecteur d'écran sur tout le site.",
  },
  list: {
    en: 'Broken list markup strips grouping/count information ("item 3 of 7") that screen-reader users rely on to browse menus and catalogs.',
    fr: "Un balisage de liste incorrect supprime l'information de regroupement et de position (« élément 3 sur 7 ») utilisée par les lecteurs d'écran pour parcourir menus et catalogues.",
  },
  listitem: {
    en: 'List items outside a proper list container lose their position/count context for screen-reader users browsing menus or product grids.',
    fr: "Des éléments de liste hors d'un conteneur de liste valide perdent leur contexte de position pour les utilisateurs de lecteurs d'écran qui parcourent menus ou grilles produits.",
  },
  'select-name': {
    en: 'An unlabeled dropdown (e.g. country, quantity) can silently block a purchase or application for assistive-technology users.',
    fr: "Un menu déroulant sans nom accessible (ex. pays, quantité) peut bloquer silencieusement un achat ou une demande pour les utilisateurs de technologies d'assistance.",
  },
  'form-field-multiple-labels': {
    en: 'Conflicting labels on the same field make screen readers announce the wrong instructions, causing input errors at checkout or sign-up.',
    fr: "Des étiquettes contradictoires sur un même champ font que le lecteur d'écran annonce la mauvaise consigne, provoquant des erreurs de saisie au paiement ou à l'inscription.",
  },
  'duplicate-id': {
    en: 'Duplicate IDs can make assistive technology jump to or announce the wrong element entirely — unpredictable, hard-to-diagnose failures.',
    fr: "Des identifiants dupliqués peuvent faire pointer une technologie d'assistance vers le mauvais élément — des échecs imprévisibles et difficiles à diagnostiquer.",
  },
  'frame-title': {
    en: 'An untitled iframe (payment widget, map, video) is announced as "frame" with no context, leaving assistive-technology users guessing.',
    fr: "Un iframe sans titre (widget de paiement, carte, vidéo) est annoncé comme « frame » sans contexte, laissant les utilisateurs de technologies d'assistance deviner son contenu.",
  },
  'video-caption': {
    en: 'Uncaptioned video excludes Deaf and hard-of-hearing visitors entirely, and is a common target of accessibility complaints/lawsuits.',
    fr: "Une vidéo sans sous-titres exclut totalement les visiteurs sourds ou malentendants, et c'est une cible fréquente des plaintes et poursuites en accessibilité.",
  },
  'meta-viewport': {
    en: 'Zoom disabled on mobile blocks low-vision users from enlarging text — on a storefront that is likely majority mobile traffic.',
    fr: "Le zoom désactivé sur mobile empêche les personnes malvoyantes d'agrandir le texte — sur un site probablement majoritairement visité depuis un mobile.",
  },
  'heading-order': {
    en: 'Skipped heading levels break the page outline screen-reader users rely on to jump straight to the section they want.',
    fr: "Des niveaux de titre sautés cassent le plan de page que les utilisateurs de lecteurs d'écran utilisent pour aller directement à la section voulue.",
  },
  tabindex: {
    en: 'A broken keyboard tab order sends keyboard-only users (motor impairments, power users) somewhere other than where they expect to land.',
    fr: "Un ordre de tabulation clavier incorrect envoie les utilisateurs au clavier (handicap moteur, utilisateurs avancés) ailleurs que là où ils s'attendent à arriver.",
  },
};

const IMPACT_FALLBACK: Record<AxeImpact, BilingualText> = {
  critical: {
    en: 'A critical barrier can block some visitors from completing a key task entirely — direct revenue loss and legal exposure (ADA/AODA/EN 301 549).',
    fr: "Un obstacle critique peut empêcher certains visiteurs de terminer une action clé — perte directe de revenus et risque légal (ADA/AODA/EN 301 549).",
  },
  serious: {
    en: 'A serious barrier makes a key task much harder for some visitors, pushing them toward a competitor with fewer clicks.',
    fr: "Un obstacle sérieux rend une action clé beaucoup plus difficile pour certains visiteurs, qui se tournent alors vers un concurrent plus simple.",
  },
  moderate: {
    en: 'A moderate barrier degrades the experience for some visitors and adds friction that shows up as lower conversion over time.',
    fr: "Un obstacle modéré dégrade l'expérience de certains visiteurs et ajoute une friction qui finit par se traduire en baisse de conversion.",
  },
  minor: {
    en: 'A minor rough edge — low individual impact, but these add up into a site that reads as unpolished and untrustworthy.',
    fr: "Un défaut mineur pris isolément, mais qui s'accumule et donne l'image d'un site peu soigné et moins digne de confiance.",
  },
};

const SEO_RULE_MESSAGES: Record<string, BilingualText> = {
  'seo-noindex': {
    en: 'The page is invisible to Google/Bing entirely — zero organic traffic from this URL until fixed.',
    fr: "La page est totalement invisible pour Google/Bing — aucun trafic organique possible tant que ce n'est pas corrigé.",
  },
  'seo-missing-title': {
    en: 'Search results show a generic/blank title for this page, hurting click-through rate before visitors even land.',
    fr: 'Les résultats de recherche affichent un titre générique/vide pour cette page, ce qui nuit au taux de clic avant même que le visiteur arrive.',
  },
  'seo-title-length': {
    en: 'A mistuned title length either wastes ranking keywords or gets truncated with "..." in search results.',
    fr: 'Un titre mal dimensionné gaspille des mots-clés de classement ou se retrouve tronqué par "..." dans les résultats de recherche.',
  },
  'seo-missing-meta-description': {
    en: 'Search engines auto-generate the result snippet from random page text, often unappealing and off-message.',
    fr: "Les moteurs de recherche génèrent automatiquement l'extrait à partir d'un texte aléatoire de la page, souvent peu engageant et hors message.",
  },
  'seo-meta-description-length': {
    en: 'A mistuned description gets truncated or under-uses the space search engines give you to sell the click.',
    fr: "Une description mal dimensionnée est tronquée ou sous-utilise l'espace offert par le moteur de recherche pour convaincre du clic.",
  },
  'seo-missing-canonical': {
    en: 'Duplicate/parameterized versions of this URL can split ranking signals instead of consolidating them on one page.',
    fr: "Des versions dupliquées/paramétrées de cette URL peuvent diviser les signaux de classement au lieu de les concentrer sur une seule page.",
  },
  'seo-missing-h1': {
    en: 'Search engines have a harder time identifying the primary topic of the page, weakening relevance for target keywords.',
    fr: "Les moteurs de recherche identifient plus difficilement le sujet principal de la page, ce qui affaiblit la pertinence sur les mots-clés visés.",
  },
  'seo-multiple-h1': {
    en: 'Competing top-level headings dilute topical focus, making it harder to rank strongly for any single keyword.',
    fr: "Des titres de premier niveau concurrents diluent le sujet principal, ce qui complique un bon classement sur un mot-clé précis.",
  },
  'seo-missing-viewport': {
    en: 'The page can be flagged as not mobile-friendly, directly hurting mobile rankings (the majority of search traffic).',
    fr: "La page peut être signalée comme non adaptée au mobile, ce qui nuit directement au classement mobile (majorité du trafic de recherche).",
  },
  'seo-missing-og-tags': {
    en: 'Links shared on social media/messaging apps show a blank or ugly preview card, reducing click-through from shares.',
    fr: "Les liens partagés sur les réseaux sociaux ou messageries affichent un aperçu vide ou peu engageant, ce qui réduit le taux de clic des partages.",
  },
  'seo-missing-structured-data': {
    en: 'The page misses out on rich results (ratings, breadcrumbs, product price/availability) that out-compete plain blue links.',
    fr: "La page passe à côté des résultats enrichis (notes, fil d'Ariane, prix/disponibilité produit) qui surpassent les liens bleus classiques.",
  },
  'seo-missing-lang': {
    en: 'Search engines may serve this page to the wrong regional/language audience, or discount it for ambiguous targeting.',
    fr: "Les moteurs de recherche peuvent proposer cette page à la mauvaise audience régionale/linguistique, ou la déclasser pour ciblage ambigu.",
  },
  'seo-images-missing-alt': {
    en: 'These images are invisible to image search, giving away free organic traffic that competitors with alt text capture instead.',
    fr: "Ces images sont invisibles pour la recherche d'images, ce qui laisse filer un trafic organique gratuit que des concurrents avec texte alternatif captent à la place.",
  },
  'seo-thin-content': {
    en: 'Thin pages struggle to rank against competitors with more comprehensive content for the same search intent.',
    fr: "Les pages avec peu de contenu peinent à se classer face à des concurrents proposant un contenu plus complet pour la même intention de recherche.",
  },
};

const PERFORMANCE_RULE_MESSAGES: Record<string, BilingualText> = {
  'perf-slow-ttfb': {
    en: 'A slow server response delays everything after it, compounding into a slow-feeling page on every single visit.',
    fr: "Une réponse serveur lente retarde tout ce qui suit, ce qui donne une impression de lenteur générale à chaque visite.",
  },
  'perf-slow-dom-content-loaded': {
    en: 'Visitors try to click/scroll before the page is interactive, causing frustration and mis-clicks on a not-yet-ready page.',
    fr: "Les visiteurs essaient de cliquer/défiler avant que la page soit interactive, ce qui provoque frustration et clics ratés.",
  },
  'perf-slow-load-time': {
    en: 'Every extra second of load time is a well-documented conversion killer — a meaningful share of visitors leave before it finishes.',
    fr: "Chaque seconde de chargement supplémentaire est un facteur de perte de conversion bien documenté — une part significative des visiteurs quitte avant la fin.",
  },
  'perf-large-page-weight': {
    en: 'Visitors on mobile data plans pay (in money and time) for this page weight, and many will bounce rather than wait.',
    fr: "Les visiteurs sur forfait mobile paient (en argent et en temps) ce poids de page, et beaucoup repartiront plutôt que d'attendre.",
  },
  'perf-too-many-requests': {
    en: 'Each extra request adds latency, especially over mobile networks — this page pays that tax dozens of times over.',
    fr: "Chaque requête supplémentaire ajoute de la latence, surtout sur réseau mobile — cette page paie ce coût des dizaines de fois.",
  },
  'perf-large-dom-size': {
    en: 'A bloated DOM slows down every interaction (scrolling, animations, search-in-page) for the entire visit, not just load.',
    fr: "Un DOM trop volumineux ralentit chaque interaction (défilement, animations, recherche) pendant toute la visite, pas seulement au chargement.",
  },
  'perf-render-blocking-scripts': {
    en: 'Visitors stare at a blank or unstyled page while these scripts load — a common reason for immediate bounces.',
    fr: "Les visiteurs regardent une page vide ou non stylée pendant le chargement de ces scripts — une cause fréquente d'abandon immédiat.",
  },
  'perf-oversized-images': {
    en: 'Bandwidth is wasted shipping pixels nobody sees, directly inflating load time and mobile data costs for every visitor.',
    fr: "De la bande passante est gaspillée à envoyer des pixels que personne ne voit, ce qui allonge directement le temps de chargement et le coût de données mobiles pour chaque visiteur.",
  },
};

const MESSAGES_BY_SCAN_TYPE: Record<ScanType, Record<string, BilingualText>> = {
  accessibility: ACCESSIBILITY_RULE_MESSAGES,
  seo: SEO_RULE_MESSAGES,
  performance: PERFORMANCE_RULE_MESSAGES,
};

function genericBusinessImpact(issue: ScoredIssue, language: Language): string {
  const help = issue.help.trim().replace(/\.$/, '');
  const helpText = language === 'fr' ? help : help.charAt(0).toUpperCase() + help.slice(1);
  const fallback = IMPACT_FALLBACK[issue.impact][language];
  return language === 'fr' ? `${helpText} : ${fallback}` : `${helpText} — ${fallback}`;
}

export function getTopBusinessImpacts(
  issues: ScoredIssue[],
  language: Language,
  scanType: ScanType = 'accessibility',
  max = 10,
): BusinessImpact[] {
  const messages = MESSAGES_BY_SCAN_TYPE[scanType];
  return issues.slice(0, max).map((issue) => {
    const message = messages[issue.ruleId];
    const statement = message ? message[language] : genericBusinessImpact(issue, language);
    return { ruleId: issue.ruleId, impact: issue.impact, statement };
  });
}
