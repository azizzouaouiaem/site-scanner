import { t } from '@/lib/i18n';
import { formatMinutes } from '@/lib/scoring';
import { useEffect, useState } from 'react';
import type { AxeImpact, Language, ScanType } from '@/lib/types';

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
  businessImpacts: Array<{ ruleId: string; impact: AxeImpact; statement: string }>;
  finalUrl: string;
  reportUrl: string | null;
  reportHtml: string | null;
}

const IMPACT_DOT: Record<AxeImpact, string> = {
  critical: 'bg-[#ff3b3b]',
  serious: 'bg-[#ff8a3b]',
  moderate: 'bg-[#ffd23b]',
  minor: 'bg-[#8a8f98]',
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
      if (event.key === 'Escape') setIsReportOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isReportOpen]);

  return (
    <div className="flex flex-1 flex-col">
      <h1 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">{strings.resultsTitle}</h1>
      <p className="mt-2 text-sm text-white/50">{strings.resultsSubtitle()}</p>

      {summary.score > 95 && (
        <div className="mt-6 rounded-2xl border border-[#5bffb0]/30 bg-[#5bffb0]/10 p-5 text-center text-sm font-semibold text-[#baffd9]">
          {strings.congratulations}
        </div>
      )}

      <div className="mt-8 rounded-3xl border border-white/10 bg-[var(--surface)] p-8 text-center">
        <div className="text-xs uppercase tracking-widest text-white/40">{strings.scoreLabel[summary.scanType]}</div>
        <div className="mt-2 text-6xl font-extrabold text-white">{summary.score}</div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5 text-center">
          <div className="text-2xl font-extrabold text-white">{summary.totalIssues}</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-white/40">
            {strings.totalIssuesLabel}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-[var(--surface)] p-5 text-center">
          <div className="text-2xl font-extrabold text-white">{formatMinutes(summary.totals.manualMinutes)}</div>
          <div className="mt-1 text-[11px] uppercase tracking-widest text-white/40">
            {strings.manualTimeLabel}
          </div>
        </div>
      </div>

      {summary.topIssues.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/40">
            {strings.topIssuesTitle}
          </div>
          <ul className="mt-4 flex flex-col gap-4">
            {summary.topIssues.map((issue) => (
              <li key={issue.ruleId} className="flex items-start gap-3">
                <span className={`mt-1.5 size-2 shrink-0 rounded-full ${IMPACT_DOT[issue.impact]}`} />
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{issue.help}</div>
                  <div className="text-xs text-white/40">{strings.occurrences(issue.occurrences)}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.businessImpacts.length > 0 && (
        <div className="mt-6 rounded-2xl border border-white/10 bg-[var(--surface)] p-5">
          <div className="text-xs font-bold uppercase tracking-widest text-white/40">
            {strings.businessImpactsTitle}
          </div>
          <ol className="mt-4 flex flex-col gap-3">
            {summary.businessImpacts.map((item, index) => (
              <li key={item.ruleId} className="flex items-start gap-3">
                <span className="mt-0.5 shrink-0 text-xs font-extrabold text-white/30">{index + 1}.</span>
                <span className="text-sm leading-snug text-white/80">{item.statement}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {summary.score <= 95 && (
      <div className="mt-6 rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-transparent p-8 text-center">
        <div className="text-xs uppercase tracking-widest text-white/40">{strings.automatedTimeLabel}</div>
        <div className="mt-2 text-4xl font-extrabold text-[#5bffb0]">
          {formatMinutes(summary.totals.automatedMinutes)}
        </div>
        <a
          href={`mailto:${process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'aziz.zouaoui.aem@gmail.com'}`}
          className="mt-5 inline-block rounded-full bg-[var(--accent)] px-6 py-3 text-xs font-extrabold uppercase tracking-widest text-white transition hover:brightness-110"
        >
          {strings.contactCta}
        </a>
      </div>
      )}

      {summary.score <= 95 && (summary.reportUrl || summary.reportHtml) && (
        <button
          type="button"
          onClick={() => setIsReportOpen(true)}
          className="report-cta mt-6 self-center"
        >
          <span className="report-cta__label">{strings.viewHtmlReport}</span>
          <span aria-hidden="true" className="report-cta__arrow">↗</span>
        </button>
      )}

      <button
        type="button"
        onClick={onReset}
        className="mt-8 self-center text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white"
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
              srcDoc={summary.reportUrl ? undefined : summary.reportHtml ?? undefined}
              className="report-modal__frame"
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
