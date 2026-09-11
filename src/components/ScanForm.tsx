'use client';

import { useState } from 'react';
import { t } from '@/lib/i18n';
import type { Language, ScanType } from '@/lib/types';
import ResultSummary, { type ScanSummary } from './ResultSummary';

type ViewState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; summary: ScanSummary }
  | { status: 'error'; code: string };

const ERROR_KEY_BY_CODE: Record<string, keyof ReturnType<typeof t>> = {
  invalid_url: 'errorInvalidUrl',
  invalid_input: 'errorInvalidUrl',
  blocked_url: 'errorBlockedUrl',
  rate_limited: 'errorRateLimited',
  scan_timeout: 'errorTimeout',
};

const SCAN_TYPE_LABEL_KEY: Record<ScanType, 'scanTypeAccessibility' | 'scanTypeSeo' | 'scanTypePerformance'> = {
  accessibility: 'scanTypeAccessibility',
  seo: 'scanTypeSeo',
  performance: 'scanTypePerformance',
};

export default function ScanForm() {
  const [language, setLanguage] = useState<Language>('en');
  const [scanType, setScanType] = useState<ScanType>('accessibility');
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [view, setView] = useState<ViewState>({ status: 'idle' });

  const strings = t(language);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setView({ status: 'submitting' });

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, language, scanType }),
      });

      const data = await response.json();

      if (!response.ok) {
        setView({ status: 'error', code: data?.error ?? 'generic' });
        return;
      }

      setView({ status: 'success', summary: data as ScanSummary });
    } catch {
      setView({ status: 'error', code: 'generic' });
    }
  }

  function reset() {
    setView({ status: 'idle' });
    setUrl('');
  }

  const errorKey = view.status === 'error' ? ERROR_KEY_BY_CODE[view.code] ?? 'errorGeneric' : null;
  const displayedScanType = view.status === 'success' ? view.summary.scanType : scanType;

  return (
    <div className="flex flex-1 flex-col">
      <header className="mb-10 flex items-center justify-between">
        <span className="text-sm font-extrabold uppercase tracking-[0.2em] text-white/90">
          {strings.siteName[displayedScanType]}
        </span>
        <div className="flex rounded-full border border-white/10 bg-white/5 p-1 text-xs font-bold">
          {(['en', 'fr'] as const).map((lang) => (
            <button
              key={lang}
              type="button"
              onClick={() => setLanguage(lang)}
              className={`rounded-full px-3 py-1.5 uppercase tracking-wider transition ${
                language === lang ? 'bg-[var(--accent)] text-white' : 'text-white/50 hover:text-white'
              }`}
            >
              {lang}
            </button>
          ))}
        </div>
      </header>

      {view.status !== 'success' && (
        <>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl">
            {strings.heroTitle}
          </h1>
          <p className="mt-4 max-w-lg text-sm text-white/60 sm:text-base">{strings.heroSubtitle}</p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                {strings.scanTypeLabel}
              </span>
              <div role="radiogroup" aria-label={strings.scanTypeLabel} className="flex flex-wrap gap-2">
                {(['accessibility', 'seo', 'performance'] as const).map((type) => (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-full border px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition ${
                      scanType === type
                        ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="scanType"
                      value={type}
                      checked={scanType === type}
                      onChange={() => setScanType(type)}
                      className="sr-only"
                    />
                    {strings[SCAN_TYPE_LABEL_KEY[type]]}
                  </label>
                ))}
              </div>
            </div>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                {strings.urlLabel}
              </span>
              <input
                required
                type="url"
                inputMode="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={strings.urlPlaceholder}
                className="rounded-2xl border border-white/10 bg-[var(--surface)] px-5 py-4 text-base text-white outline-none placeholder:text-white/30 focus:border-[var(--accent)]"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-xs font-bold uppercase tracking-widest text-white/50">
                {strings.emailLabel}
              </span>
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={strings.emailPlaceholder}
                className="rounded-2xl border border-white/10 bg-[var(--surface)] px-5 py-4 text-base text-white outline-none placeholder:text-white/30 focus:border-[var(--accent)]"
              />
            </label>

            <button
              type="submit"
              disabled={view.status === 'submitting'}
              className="mt-2 rounded-full bg-[var(--accent)] px-6 py-4 text-sm font-extrabold uppercase tracking-widest text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {view.status === 'submitting' ? strings.submitting : strings.submit}
            </button>

            <p className="mt-1 text-center text-xs text-white/35">{strings.disclaimer}</p>
          </form>

          {errorKey && (
            <p role="alert" className="mt-6 rounded-2xl border border-[var(--accent)]/40 bg-[var(--accent-soft)] px-4 py-3 text-sm text-white">
              {strings[errorKey] as string}
            </p>
          )}

          <p className="mt-auto pt-16 text-center text-[11px] leading-relaxed text-white/25">
            {strings.collectionNotice}
          </p>
        </>
      )}

      {view.status === 'success' && (
        <ResultSummary summary={view.summary} language={language} email={email} onReset={reset} />
      )}
    </div>
  );
}
