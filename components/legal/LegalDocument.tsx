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
    <section className="legal-document-scope min-h-screen px-6 py-14 md:px-8 md:py-20" style={{ background: pageBg, color: titleColor }}>
      <div className="mx-auto w-full max-w-[52rem] space-y-10">
        <header className="space-y-6 rounded-[34px] border p-8 shadow-[0_24px_80px_rgba(2,8,23,0.14)] md:p-12" style={{ background: headerBg, borderColor: border }}>
          <p className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.28em]" style={{ color: accentColor, borderColor: isLight ? 'rgba(4,120,87,0.18)' : 'rgba(52,211,153,0.2)', background: isLight ? 'rgba(236,253,245,0.92)' : 'rgba(16,185,129,0.12)' }}>{pick(language, eyebrow)}</p>
          <h1 className="max-w-[18ch] text-[2.2rem] font-black tracking-[-0.04em] sm:text-[3rem]" style={{ color: titleColor }}>{pick(language, title)}</h1>
          <p className="max-w-3xl text-[15px] leading-8 md:text-base" style={{ color: bodyColor }}>{pick(language, intro)}</p>
          <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: mutedColor }}>
            {language === 'de' ? 'Zuletzt aktualisiert' : 'Last updated'}: {pick(language, lastUpdated)}
          </p>
          {sourceNote ? (
            <div className="rounded-[24px] border px-5 py-5" style={{ background: insetBg, borderColor: border }}>
              <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: mutedColor }}>
                {language === 'de' ? 'Quelle' : 'Source note'}
              </p>
              <p className="mt-2 text-sm leading-7" style={{ color: bodyColor }}>{pick(language, sourceNote)}</p>
            </div>
          ) : null}
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={pick(language, section.title)} className="rounded-[30px] border p-7 md:p-8" style={{ background: cardBg, borderColor: border, boxShadow: isLight ? '0 16px 40px rgba(15,23,42,0.05)' : '0 18px 42px rgba(0,0,0,0.16)' }}>
              <div className="mb-4 h-1.5 w-20 rounded-full" style={{ background: isLight ? 'linear-gradient(90deg,#10b981,#06b6d4)' : 'linear-gradient(90deg,#34d399,#22d3ee)' }} />
              <h2 className="text-[1.45rem] font-black tracking-[-0.02em]" style={{ color: titleColor }}>{pick(language, section.title)}</h2>
              {section.paragraphs ? (
                <div className="mt-5 space-y-4">
                  {section.paragraphs.map((paragraph) => (
                    <p key={pick(language, paragraph)} className="text-[15px] leading-8 md:text-base" style={{ color: bodyColor }}>
                      {pick(language, paragraph)}
                    </p>
                  ))}
                </div>
              ) : null}
              {section.bullets ? (
                <ul className="mt-5 space-y-4">
                  {section.bullets.map((bullet) => (
                    <li key={pick(language, bullet)} className="rounded-[22px] border px-5 py-4 text-[15px] leading-7 md:py-5" style={{ background: insetBg, borderColor: border, color: bodyColor }}>
                      {pick(language, bullet)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        {showBackButton ? (
          <div className="flex justify-center pb-4 pt-8 md:pb-8 md:pt-10">
            <button
              className="brand-gradient-button rounded-[20px] border px-6 py-3.5 text-sm font-black uppercase tracking-[0.14em] transition hover:translate-y-[-1px]"
              onClick={handleBack}
              style={{
                borderColor: 'rgba(0,229,186,0.4)',
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
