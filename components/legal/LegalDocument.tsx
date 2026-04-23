'use client';

import { useHydrated } from '@/hooks/useHydrated';
import { useRouter } from 'next/navigation';
import { useLanguageStore } from '../../lib/stores/languageStore';
import { useThemeStore } from '../../lib/stores/themeStore';

type LocalizedText = {
  en: string;
  de: string;
};

type LegalSection = {
  title: LocalizedText;
  paragraphs?: LocalizedText[];
  bullets?: LocalizedText[];
};

interface LegalDocumentProps {
  eyebrow: LocalizedText;
  title: LocalizedText;
  intro: LocalizedText;
  lastUpdated: LocalizedText;
  sourceNote?: LocalizedText;
  sections: LegalSection[];
  showBackButton?: boolean;
}

function pick(language: 'en' | 'de', value: LocalizedText) {
  return language === 'de' ? value.de : value.en;
}

function getInitialDocumentTheme() {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

export default function LegalDocument({ eyebrow, title, intro, lastUpdated, sourceNote, sections, showBackButton = false }: LegalDocumentProps) {
  const router = useRouter();
  const language = useLanguageStore((state) => state.language);
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : getInitialDocumentTheme()) === 'light';

  const pageBg = isLight
    ? 'linear-gradient(135deg,#eef4f8 0%,#f8fbfd 50%,#edf8f4 100%)'
    : 'linear-gradient(135deg,#07111f 0%,#0a1320 55%,#071814 100%)';
  const headerBg = isLight ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.66)';
  const cardBg = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(15,23,42,0.52)';
  const insetBg = isLight ? 'rgba(248,250,252,0.96)' : 'rgba(2,6,23,0.38)';
  const border = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)';
  const titleColor = isLight ? '#0f172a' : '#ffffff';
  const bodyColor = isLight ? '#334155' : '#cbd5e1';
  const mutedColor = isLight ? '#64748b' : '#94a3b8';
  const accentColor = isLight ? '#047857' : '#34d399';

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  return (
    <section className="legal-document-scope min-h-screen px-6 py-12" style={{ background: pageBg, color: titleColor }}>
      <div className="mx-auto w-full max-w-4xl space-y-8">
        <header className="space-y-4 rounded-3xl border p-8 shadow-[0_24px_80px_rgba(2,8,23,0.14)]" style={{ background: headerBg, borderColor: border }}>
          <p className="text-xs font-black uppercase tracking-[0.28em]" style={{ color: accentColor }}>{pick(language, eyebrow)}</p>
          <h1 className="text-3xl font-black sm:text-4xl" style={{ color: titleColor }}>{pick(language, title)}</h1>
          <p className="text-sm leading-7" style={{ color: bodyColor }}>{pick(language, intro)}</p>
          <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: mutedColor }}>
            {language === 'de' ? 'Zuletzt aktualisiert' : 'Last updated'}: {pick(language, lastUpdated)}
          </p>
          {sourceNote ? <p className="text-xs leading-6" style={{ color: mutedColor }}>{pick(language, sourceNote)}</p> : null}
        </header>

        <div className="space-y-6">
          {sections.map((section) => (
            <section key={pick(language, section.title)} className="rounded-3xl border p-6" style={{ background: cardBg, borderColor: border }}>
              <h2 className="text-xl font-black" style={{ color: titleColor }}>{pick(language, section.title)}</h2>
              {section.paragraphs ? (
                <div className="mt-4 space-y-3">
                  {section.paragraphs.map((paragraph) => (
                    <p key={pick(language, paragraph)} className="text-sm leading-7" style={{ color: bodyColor }}>
                      {pick(language, paragraph)}
                    </p>
                  ))}
                </div>
              ) : null}
              {section.bullets ? (
                <ul className="mt-4 space-y-3">
                  {section.bullets.map((bullet) => (
                    <li key={pick(language, bullet)} className="rounded-2xl border px-4 py-3 text-sm leading-6" style={{ background: insetBg, borderColor: border, color: bodyColor }}>
                      {pick(language, bullet)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {showBackButton ? (
          <div className="flex justify-center pt-2">
            <button
              className="rounded-2xl border px-5 py-3 text-sm font-black transition hover:translate-y-[-1px]"
              onClick={handleBack}
              style={{
                background: 'rgb(0,229,186)',
                borderColor: 'rgb(0,229,186)',
                color: '#060c14',
              }}
              type="button"
            >
              {language === 'de' ? 'Zuruck' : 'Back'}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
