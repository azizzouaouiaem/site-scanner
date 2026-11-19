import type { Language } from "./types";

export const translations = {
  en: {
    siteName: {
      accessibility: "Site Scanner",
      seo: "Site Scanner",
      performance: "Site Scanner",
      geo: "Site Scanner",
    },
    heroTitle:
      "Audit your page’s accessibility, SEO, performance and AI readiness",
    heroSubtitle:
      "Enter a URL and get an evidence-based page audit. Track your site weekly or purchase a technical PDF action plan.",
    urlLabel: "Page URL",
    urlPlaceholder: "https://example.com",
    emailLabel: "Your email",
    emailPlaceholder: "you@example.com",
    languageLabel: "Report language",
    scanTypeLabel: "What do you want to audit?",
    scanTypeAccessibility: "Accessibility",
    scanTypeSeo: "SEO",
    scanTypePerformance: "Performance",
    scanTypeGeo: "AI readiness",
    submit: "Scan this page",
    submitting: "Scanning… this can take up to a minute",
    disclaimer: "Free audit of one public page. No account required.",
    collectionNotice:
      "Submitted URLs and technical scan metadata are stored to improve this tool and understand usage.",
    resultsTitle: "Scan complete",
    resultsSubtitle: () => "Your scan results are ready below.",
    viewHtmlReport: "View a preview of the detailed report",
    closeReport: "Close detailed report",
    congratulations:
      "Few issues detected by these automated checks. Review the full report and its limits; manual checks may still be needed.",
    scoreLabel: {
      accessibility: "Accessibility score",
      seo: "SEO score",
      performance: "Performance score",
      geo: "AI technical readiness (indicative)",
    },
    totalIssuesLabel: "Issues found",
    manualTimeLabel: "Estimated manual dev time (for one scanned page)",
    automatedTimeLabel:
      "Illustrative assisted estimate — not a delivery commitment",
    contactCta: "Contact us",
    topIssuesTitle: "Top issues",
    businessImpactsTitle: "Top business impacts",
    errorGeneric: "Something went wrong. Please try again.",
    errorInvalidUrl: "Please enter a valid, public http(s) URL.",
    errorBlockedUrl: "This URL can't be scanned (private/internal address).",
    errorRateLimited:
      "Too many scans from this email recently. Please try again later.",
    errorTimeout: "The page took too long to load. Please try again.",
    errorEmailNotConfigured:
      "Email delivery is not configured on this deployment. Add RESEND_API_KEY and RESEND_FROM_EMAIL in Vercel, then redeploy.",
    impact: {
      critical: "Critical",
      serious: "Serious",
      moderate: "Moderate",
      minor: "Minor",
    },
    occurrences: (n: number) => (n === 1 ? "1 occurrence" : `${n} occurrences`),
  },
  fr: {
    siteName: {
      accessibility: "Site Scanner",
      seo: "Site Scanner",
      performance: "Site Scanner",
      geo: "Site Scanner",
    },
    heroTitle:
      "Analysez votre page : accessibilité, SEO, performance et préparation IA",
    heroSubtitle:
      "Entrez une URL pour obtenir un diagnostic de page. Suivez votre site chaque semaine ou achetez un plan technique en PDF.",
    urlLabel: "URL de la page",
    urlPlaceholder: "https://exemple.com",
    emailLabel: "Votre courriel",
    emailPlaceholder: "vous@exemple.com",
    languageLabel: "Langue du rapport",
    scanTypeLabel: "Que voulez-vous analyser ?",
    scanTypeAccessibility: "Accessibilité",
    scanTypeSeo: "SEO",
    scanTypePerformance: "Performance",
    scanTypeGeo: "Préparation IA",
    submit: "Analyser cette page",
    submitting: "Analyse en cours… jusqu\u2019à une minute",
    disclaimer: "Audit gratuit d’une page publique, sans compte.",
    collectionNotice:
      "Les URLs et métadonnées techniques des analyses sont conservées afin d'améliorer cet outil et d'en comprendre l'utilisation.",
    resultsTitle: "Analyse terminée",
    resultsSubtitle: () =>
      "Les résultats de votre analyse sont prêts ci-dessous.",
    viewHtmlReport: "Voir un aperçu du rapport détaillé",
    closeReport: "Fermer le rapport détaillé",
    congratulations:
      "Peu de problèmes détectés par ces contrôles automatiques. Consultez le rapport complet et ses limites ; des vérifications manuelles restent nécessaires.",
    scoreLabel: {
      accessibility: "Score d'accessibilité",
      seo: "Score SEO",
      performance: "Score de performance",
      geo: "Préparation technique IA (indicative)",
    },
    totalIssuesLabel: "Problèmes détectés",
    manualTimeLabel:
      "Temps de développement manuel estimé (pour une page analysée)",
    automatedTimeLabel:
      "Estimation indicative avec assistance — sans engagement de délai",
    contactCta: "Contactez-nous",
    topIssuesTitle: "Principaux problèmes",
    businessImpactsTitle: "Principaux impacts business",
    errorGeneric: "Une erreur est survenue. Veuillez réessayer.",
    errorInvalidUrl: "Veuillez entrer une URL http(s) publique valide.",
    errorBlockedUrl:
      "Cette URL ne peut pas être analysée (adresse privée/interne).",
    errorRateLimited:
      "Trop de demandes récentes pour ce courriel. Veuillez réessayer plus tard.",
    errorTimeout: "La page a pris trop de temps à charger. Veuillez réessayer.",
    errorEmailNotConfigured:
      "L’envoi de courriels n’est pas configuré sur ce déploiement. Ajoutez RESEND_API_KEY et RESEND_FROM_EMAIL dans Vercel, puis redéployez.",
    impact: {
      critical: "Critique",
      serious: "Sérieux",
      moderate: "Modéré",
      minor: "Mineur",
    },
    occurrences: (n: number) => (n === 1 ? "1 occurrence" : `${n} occurrences`),
  },
} as const;

export function t(language: Language) {
  return translations[language];
}
