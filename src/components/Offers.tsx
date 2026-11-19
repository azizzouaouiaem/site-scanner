"use client";
import type { Language } from "@/lib/types";
export default function Offers({
  language,
  url,
}: {
  language: Language;
  url: string;
}) {
  const fr = language === "fr";
  const link = (kind: string) =>
    "/account?kind=" +
    kind +
    "&language=" +
    language +
    (url ? "&url=" + encodeURIComponent(url) : "");
  return (
    <section
      className="mt-14 border-t border-white/15 pt-8"
      aria-label={fr ? "Offres et tarifs" : "Plans and pricing"}
    >
      <h2 className="text-xl font-bold">
        {fr
          ? "Un diagnostic ou un suivi durable"
          : "One audit or ongoing monitoring"}
      </h2>
      <p className="mt-2 text-sm text-white/65">
        {fr
          ? "Prix en dollars canadiens. Le PDF est un achat distinct, sans abonnement."
          : "Prices in Canadian dollars. PDF is a separate one-time purchase."}
      </p>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {[
          {
            name: fr ? "Gratuit" : "Free",
            price: "0 $",
            detail: fr
              ? "1 page, 1 catégorie par analyse. Résultats et constats dans le navigateur."
              : "1 page, 1 category per scan. Results and findings in your browser.",
            kind: null,
            cta: fr ? "Analyser ci-dessus" : "Scan above",
          },
          {
            name: "Site",
            price: "29 $ CA / " + (fr ? "mois" : "month"),
            detail: fr
              ? "1 site, jusqu’à 25 pages accessibles par liens internes. 4 catégories, suivi hebdomadaire, historique et alertes courriel."
              : "1 site, up to 25 pages discovered through internal links. 4 categories, weekly scans, history and email alerts.",
            kind: "site",
            cta: fr ? "Choisir Site" : "Choose Site",
          },
          {
            name: fr ? "PDF technique IA" : "AI technical PDF",
            price: "9,99 $ CA",
            detail: fr
              ? "Achat unique : 1 URL, 4 audits. Recommandations IA par constat, exemples indicatifs et tests de validation. Aucun correctif automatique."
              : "One-time: 1 URL, 4 audits. AI recommendations for each finding, illustrative examples and verification steps. No automatic fixes.",
            kind: "pdf",
            cta: fr ? "Obtenir mon PDF" : "Get my PDF",
          },
        ].map((plan) => (
          <article
            className="rounded-2xl border border-white/15 bg-white/5 p-5"
            key={plan.name}
          >
            <h3 className="font-bold">{plan.name}</h3>
            <p className="mt-2 font-bold text-[#ff817b]">{plan.price}</p>
            <p className="mt-3 text-sm text-white/75">{plan.detail}</p>
            {plan.kind ? (
              <a
                href={link(plan.kind)}
                className="mt-5 inline-block rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-bold"
              >
                {plan.cta}
              </a>
            ) : (
              <p className="mt-5 text-sm text-white/60">{plan.cta}</p>
            )}
          </article>
        ))}
      </div>
      <p className="mt-5 text-xs leading-relaxed text-white/65">
        {fr
          ? "Analyses automatiques, sans garantie de conformité, de classement ou de citation IA. L’IA reçoit les constats techniques et des sélecteurs, jamais vos clés ni vos données de paiement."
          : "Automated checks do not guarantee compliance, rankings or AI citations. AI receives technical findings and sample selectors, never your keys or payment details."}{" "}
        <a className="underline" href="/methodology">
          {fr ? "Méthode et limites" : "Methodology and limits"}
        </a>{" "}
        ·{" "}
        <a className="underline" href="/account">
          {fr ? "Mon espace" : "My account"}
        </a>
      </p>
    </section>
  );
}
