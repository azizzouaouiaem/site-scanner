"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type { ScanReport } from "@/lib/types";
type Cycle = { id: string; status: string; created_at: string };
type Result = {
  cycle_id: string;
  url: string;
  reports: ScanReport[] | null;
  error: string | null;
};
type Order = {
  id: string;
  kind: string;
  url: string;
  status: string;
  created_at: string;
};
type Data = {
  user: { email: string; status: string; hasBilling: boolean };
  sites: { id: string; url: string; next_run: string }[];
  cycles: Cycle[];
  results: Result[];
};
export default function Account({
  authenticated,
  siteReady,
  pdfReady,
}: {
  authenticated: boolean;
  siteReady: boolean;
  pdfReady: boolean;
}) {
  const [logged, setLogged] = useState(authenticated);
  const [email, setEmail] = useState("");
  const [url, setUrl] = useState("");
  const [kind, setKind] = useState<"site" | "pdf">("site");
  const [language, setLanguage] = useState<"fr" | "en">("fr");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Data | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState("");
  const fr = language === "fr";
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setUrl(params.get("url") ?? "");
    setKind(params.get("kind") === "pdf" ? "pdf" : "site");
    setLanguage(params.get("language") === "en" ? "en" : "fr");
    setToken(params.get("token") ?? "");
    if (params.get("token")) history.replaceState(null, "", "/account");
    if (params.get("paid"))
      setMessage(
        "Paiement reçu. Activation en cours via Stripe. / Payment received. Activation is being confirmed.",
      );
    if (params.get("cancelled"))
      setMessage("Paiement annulé. / Payment cancelled.");
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [response, ordersResponse] = await Promise.all([
        fetch(
          "/api/sites" +
            (selected ? "?cycle=" + encodeURIComponent(selected) : ""),
          { cache: "no-store" },
        ),
        fetch("/api/orders", { cache: "no-store" }),
      ]);
      if (response.ok) setData(await response.json());
      else if (response.status === 401) setLogged(false);
      if (ordersResponse.ok) setOrders((await ordersResponse.json()).orders);
    } catch {
      setMessage(
        "Connexion interrompue, actualisez la page. / Connection interrupted; refresh this page.",
      );
    }
  }, [selected]);
  useEffect(() => {
    if (!logged) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [logged, refresh]);
  const errors: Record<string, string> = {
    payment_not_ready: fr
      ? "Le paiement sera disponible après configuration du service. Aucun débit effectué."
      : "Payments will open after service configuration. No charge made.",
    unauthorized: fr
      ? "Lien expiré ou session terminée. Demandez un nouveau lien."
      : "Expired link or session. Request a new link.",
    rate_limited: fr
      ? "Trop de demandes. Réessayez dans 15 minutes."
      : "Too many requests. Retry in 15 minutes.",
    already_subscribed: fr
      ? "Votre offre Site est déjà active."
      : "Your Site plan is already active.",
    database_not_configured: fr
      ? "L’espace client sera disponible après configuration de la base de données."
      : "Accounts will open after database configuration.",
    email_not_configured: fr
      ? "La connexion par courriel est temporairement indisponible."
      : "Email sign-in is temporarily unavailable.",
  };
  async function action(
    path: string,
    body: unknown,
    done?: (value: { url?: string }) => void,
  ) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const value = await r.json();
      if (!r.ok) throw new Error(value.error ?? "request_failed");
      done?.(value);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setMessage(
        errors[code] ??
          (fr
            ? "La demande a échoué. Vérifiez l’URL et réessayez."
            : "Request failed. Check the URL and retry."),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <nav className="flex justify-between">
        <Link href="/" className="font-bold">
          ← Site Scanner
        </Link>
        <button onClick={() => setLanguage(fr ? "en" : "fr")}>
          {fr ? "EN" : "FR"}
        </button>
      </nav>
      <h1 className="mt-10 text-3xl font-bold">
        {fr ? "Mon espace Site Scanner" : "My Site Scanner account"}
      </h1>
      {message && (
        <p role="status" className="mt-5 rounded-xl border border-white/25 p-4">
          {message}
        </p>
      )}
      {!logged ? (
        <section className="mt-8 max-w-lg space-y-5">
          <p>
            {fr
              ? "Connectez-vous par un lien à usage unique avant de payer ou de consulter vos rapports."
              : "Sign in with a one-time email link before paying or viewing reports."}
          </p>
          {token ? (
            <button
              disabled={busy}
              onClick={() =>
                action("/api/auth/verify", { token }, () => {
                  setLogged(true);
                  setToken("");
                })
              }
              className="rounded-full bg-[var(--accent)] px-6 py-3"
            >
              {fr ? "Confirmer ma connexion" : "Confirm sign-in"}
            </button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action("/api/auth/link", { email }, () =>
                  setMessage(
                    fr
                      ? "Consultez votre courriel ; le lien est valable 15 minutes."
                      : "Check your email; the link expires in 15 minutes.",
                  ),
                );
              }}
              className="space-y-4"
            >
              <label className="block">
                {fr ? "Votre courriel" : "Your email"}
                <input
                  required
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/30 bg-white/5 p-3"
                />
              </label>
              <button
                disabled={busy}
                className="rounded-full bg-[var(--accent)] px-6 py-3"
              >
                {busy
                  ? "…"
                  : fr
                    ? "Recevoir mon lien"
                    : "Email my sign-in link"}
              </button>
            </form>
          )}
        </section>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-5">
            <p>
              {data?.user.email} · {data?.user.status}
            </p>
            <button
              disabled={busy}
              onClick={() =>
                action("/api/auth/logout", {}, () => {
                  setLogged(false);
                  setData(null);
                })
              }
              className="underline"
            >
              {fr ? "Déconnexion" : "Sign out"}
            </button>
            {data?.user.hasBilling && (
              <button
                disabled={busy}
                onClick={() =>
                  action("/api/billing", {}, (v) => {
                    if (v.url) location.assign(v.url);
                  })
                }
                className="underline"
              >
                {fr ? "Factures et annulation" : "Invoices and cancellation"}
              </button>
            )}
          </div>
          <section className="mt-8 rounded-2xl border border-white/20 p-6">
            <h2 className="text-xl font-bold">
              {fr ? "Choisir une offre" : "Choose a plan"}
            </h2>
            <form
              className="mt-5 space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void action("/api/checkout", { url, kind, language }, (v) => {
                  if (v.url) location.assign(v.url);
                });
              }}
            >
              <label className="block">
                URL
                <input
                  required
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://exemple.com"
                  className="mt-2 w-full rounded-xl border border-white/30 bg-white/5 p-3"
                />
              </label>
              <fieldset className="space-y-3">
                <legend className="mb-3">
                  {fr
                    ? "Tous les prix sont en dollars canadiens."
                    : "All prices are in Canadian dollars."}
                </legend>
                <label className="block">
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === "site"}
                    onChange={() => setKind("site")}
                  />{" "}
                  Site — 29 $ CA /{" "}
                  {fr
                    ? "mois, renouvellement automatique. 1 site, jusqu’à 25 pages liées, suivi hebdomadaire, historique et alertes. Annulation dans le portail Stripe."
                    : "month, auto-renewing. 1 site, up to 25 linked pages, weekly monitoring, history and alerts. Cancel through the Stripe portal."}
                </label>
                <label className="block">
                  <input
                    type="radio"
                    name="kind"
                    checked={kind === "pdf"}
                    onChange={() => setKind("pdf")}
                  />{" "}
                  PDF — 9,99 $ CA ·{" "}
                  {fr
                    ? "achat unique, 1 URL, 4 audits et recommandations IA. Non inclus dans Site."
                    : "one-time purchase, 1 URL, 4 audits and AI recommendations. Separate from Site."}
                </label>
              </fieldset>
              <p className="text-sm text-white/70">
                {fr
                  ? "La découverte reste sur le même domaine, sans URL à paramètres, jusqu’à 25 pages. Les pages bloquées ou non liées peuvent ne pas être analysées. Les rapports IA proposent des exemples à valider dans votre code ; aucun résultat commercial garanti."
                  : "Discovery stays on the same origin, excludes query-string URLs and stops at 25 pages. Blocked or unlinked pages may not be scanned. AI reports provide examples requiring source-code validation; commercial outcomes are not guaranteed."}
              </p>
              <p className="text-sm text-white/70">
                {fr
                  ? "Pour le PDF, les constats techniques et exemples de sélecteurs sont transmis au fournisseur IA configuré pour rédiger les recommandations."
                  : "For PDF reports, technical findings and sample selectors are sent to the configured AI provider to draft recommendations."}
              </p>
              <button
                disabled={busy || !(kind === "site" ? siteReady : pdfReady)}
                className="rounded-full bg-[var(--accent)] px-6 py-3 font-bold disabled:opacity-50"
              >
                {!(kind === "site" ? siteReady : pdfReady)
                  ? fr
                    ? "Bientôt disponible — configuration en cours"
                    : "Coming soon — setup in progress"
                  : busy
                    ? "…"
                    : fr
                      ? "Continuer vers Stripe"
                      : "Continue to Stripe"}
              </button>
            </form>
          </section>
          <section className="mt-10">
            <h2 className="text-xl font-bold">
              {fr ? "Mes rapports PDF" : "My PDF reports"}
            </h2>
            <div className="mt-4 space-y-4">
              {orders
                .filter((o) => o.kind === "pdf")
                .map((o) => (
                  <article
                    key={o.id}
                    className="rounded-xl border border-white/20 p-4"
                  >
                    <p className="break-all">{o.url}</p>
                    <p>
                      {o.status} ·{" "}
                      {new Date(o.created_at).toLocaleDateString(language)}
                    </p>
                    {o.status === "ready" && (
                      <a
                        href={"/api/pdf?id=" + o.id}
                        className="mt-3 inline-block underline"
                      >
                        {fr ? "Télécharger le PDF" : "Download PDF"}
                      </a>
                    )}
                    {["paid", "failed"].includes(o.status) && (
                      <button
                        disabled={busy}
                        className="mt-3 underline"
                        onClick={() =>
                          action(
                            "/api/orders",
                            { id: o.id },
                            () => void refresh(),
                          )
                        }
                      >
                        {fr
                          ? "Relancer sans nouveau paiement"
                          : "Retry without another payment"}
                      </button>
                    )}
                  </article>
                ))}
              {!orders.some((o) => o.kind === "pdf") && (
                <p className="text-white/65">
                  {fr
                    ? "Aucun achat PDF pour le moment."
                    : "No PDF purchases yet."}
                </p>
              )}
            </div>
          </section>
          <section className="mt-10">
            <h2 className="text-xl font-bold">
              {fr
                ? "Suivi hebdomadaire et historique"
                : "Weekly monitoring and history"}
            </h2>
            {data?.sites.map((s) => (
              <p key={s.id} className="mt-3 break-all">
                {s.url} · {fr ? "Prochain bilan" : "Next scan"} :{" "}
                {new Date(s.next_run).toLocaleDateString(language)}
              </p>
            ))}
            {data?.cycles.length ? (
              <>
                <label className="mt-5 block">
                  {fr ? "Choisir un bilan" : "Select a run"}
                  <select
                    className="ml-3 rounded border border-white/30 bg-[#15151a] p-2"
                    value={selected || data.cycles[0]?.id}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    {data.cycles.map((c) => (
                      <option key={c.id} value={c.id}>
                        {new Date(c.created_at).toLocaleString(language)} ·{" "}
                        {c.status}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="mt-5 space-y-4">
                  {data.results
                    .filter(
                      (r) => r.cycle_id === (selected || data.cycles[0]?.id),
                    )
                    .map((r) => (
                      <article
                        className="rounded-xl border border-white/20 p-4"
                        key={r.url}
                      >
                        <h3 className="break-all font-bold">{r.url}</h3>
                        {r.error ? (
                          <p>
                            {fr
                              ? "Page inaccessible : aucun score attribué."
                              : "Page unavailable: no score assigned."}
                          </p>
                        ) : (
                          r.reports?.map((report) => (
                            <details className="mt-3" key={report.scanType}>
                              <summary className="cursor-pointer">
                                {report.scanType} — {report.score}/100 ·{" "}
                                {report.issues.length}{" "}
                                {fr ? "constats" : "findings"}
                              </summary>
                              <p className="mt-2 text-xs text-white/65">
                                Site Scanner v{report.methodologyVersion} ·{" "}
                                {report.passedRuleCount}{" "}
                                {fr ? "contrôles réussis" : "passed checks"}
                              </p>
                              <ul className="mt-2 space-y-2">
                                {report.issues.map((i) => (
                                  <li key={i.ruleId}>
                                    <strong>
                                      {i.impact} · {i.help}
                                    </strong>
                                    <p>{i.description}</p>
                                    {i.sampleTargets.length > 0 && (
                                      <code className="block break-all text-sm text-white/70">
                                        {i.sampleTargets.join(" | ")}
                                      </code>
                                    )}
                                  </li>
                                ))}
                              </ul>
                              {!report.issues.length && (
                                <p>
                                  {fr
                                    ? "Aucun échec détecté parmi les contrôles applicables."
                                    : "No failures detected among applicable checks."}
                                </p>
                              )}
                            </details>
                          ))
                        )}
                      </article>
                    ))}
                </div>
              </>
            ) : (
              <p className="mt-3 text-white/65">
                {fr
                  ? "Le premier bilan démarre après validation du paiement. Les suivants sont programmés chaque semaine. Les courriels indiquent les nouveaux constats et baisses de score."
                  : "The first scan starts after payment confirmation. Subsequent runs are scheduled weekly. Emails highlight new findings and score regressions."}
              </p>
            )}
          </section>
        </>
      )}
      <footer className="mt-12 text-sm text-white/70">
        <a className="underline" href="/methodology">
          {fr ? "Méthodologie et limites" : "Methodology and limits"}
        </a>
      </footer>
    </main>
  );
}
