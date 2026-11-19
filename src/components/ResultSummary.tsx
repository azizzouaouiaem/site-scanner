import { t } from "@/lib/i18n";
import { formatMinutes } from "@/lib/scoring";
import { useEffect, useState } from "react";
import type { AxeImpact, Language, ScanType } from "@/lib/types";

export interface ScanSummary {
  score: number;
  scanType: ScanType;
  totalIssues: number;
  counts: Record<AxeImpact, number>;
  totals: { manualMinutes: number; automatedMinutes: number };
  topIssues: Array<{
    ruleId: string;
    impact: AxeImpact;
    help: string;
    occurrences: number;
    manualFixMinutes: number;
    automatedFixMinutes: number;
  }>;
  businessImpacts: Array<{
    ruleId: string;
    impact: AxeImpact;
    statement: string;
  }>;
  finalUrl: string;
  reportUrl: string | null;
  reportHtml: string | null;
}

const IMPACT_DOT: Record<AxeImpact, string> = {
  critical: "bg-[#ff3b3b]",
  serious: "bg-[#ff8a3b]",
  moderate: "bg-[#ffd23b]",
  minor: "bg-[#8a8f98]",
};

export default function ResultSummary({
  summary,
  language,
  onReset,
}: Readonly<{
  summary: ScanSummary;
  language: Language;
  onReset: () => void;
}>) {
  const strings = t(language);
  const [isReportOpen, setIsReportOpen] = useState(false);

  useEffect(() => {
    if (!isReportOpen) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsReportOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isReportOpen]);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
        {strings.resultsTitle}
      </h1>
      <p className="mt-2 text-sm text-white/75">{strings.resultsSubtitle()}</p>

      {summary.score > 95 && (
        <div className="mt-6 rounded-2xl border border-[#5bffb0]/30 bg-[#5bffb0]/10 p-5 text-center text-sm font-semibold text-[#baffd9]">
          {strings.congratulations}
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-white/10 bg-[var(--surface)] p-8 text-center">
        <div className="text-xs uppercase tracking-widest text-white/75">
          {strings.scoreLabel[summary.scanType]}
        </div>
        <div className="mt-2 text-6xl font-extrabold text-white">
          {summary.score}
        </div>
      </div>

      <p className="mt-4 text-sm text-white/70">
        {language === "fr"
          ? "Indice Site Scanner v2, limité aux contrôles automatiques applicables. Ce score ne certifie ni conformité WCAG, ni classement SEO, ni visibilité IA. Performance : mesure de laboratoire, sans données terrain Core Web Vitals."
          : "Site Scanner v2 index, limited to applicable automated checks. This is not WCAG certification, a ranking prediction, or measured AI visibility. Performance is a lab measurement, without field Core Web Vitals."}{" "}
        <a className="underline" href="/methodology">
          {language === "fr" ? "Méthode" : "Methodology"}
        </a>
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5 text-center">
          <div className="text-2xl font-extrabold text-white">
            {summary.totalIssues}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-white/75">
            {strings.totalIssuesLabel}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5 text-center">
          <div className="text-2xl font-extrabold text-white">
            {formatMinutes(summary.totals.manualMinutes)}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-white/75">
            {strings.manualTimeLabel}
          </div>
        </div>
      </div>

      {summary.topIssues.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/75">
            {strings.topIssuesTitle}
          </div>
          <ul className="mt-4 flex flex-col gap-4">
            {summary.topIssues.map((issue) => (
              <li key={issue.ruleId} className="flex items-start gap-3">
                <span
                  className={`mt-1.5 size-2 shrink-0 rounded-full ${IMPACT_DOT[issue.impact]}`}
                />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {issue.help}
                  </div>
                  <div className="text-xs text-white/75">
                    {strings.occurrences(issue.occurrences)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.businessImpacts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/75">
            {strings.businessImpactsTitle}
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            {summary.businessImpacts.map((item, index) => (
              <li key={item.ruleId} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-xs font-extrabold text-white/75">
                  {index + 1}.
                </span>
                <span className="text-sm leading-snug text-white/80">
                  {item.statement}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {(summary.reportUrl || summary.reportHtml) && (
        <button
          type="button"
          onClick={() => setIsReportOpen(true)}
          className="report-cta mt-6 self-center"
        >
          <span className="report-cta__label">{strings.viewHtmlReport}</span>
          <span aria-hidden="true" className="report-cta__arrow">
            ↗
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-8 self-center text-xs font-bold uppercase tracking-widest text-white/75 hover:text-white"
      >
        &larr; {strings.submit}
      </button>

      {isReportOpen && (summary.reportUrl || summary.reportHtml) && (
        <dialog
          open
          className="report-modal"
          aria-label={strings.viewHtmlReport}
        >
          <div className="report-modal__panel">
            <div className="report-modal__header">
              <span>{strings.viewHtmlReport}</span>
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="report-modal__close"
                aria-label={strings.closeReport}
              >
                ×
              </button>
            </div>
            <iframe
              title={strings.viewHtmlReport}
              src={summary.reportUrl ?? undefined}
              srcDoc={
                summary.reportUrl
                  ? undefined
                  : (summary.reportHtml ?? undefined)
              }
              sandbox=""
              className="report-modal__frame"
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
