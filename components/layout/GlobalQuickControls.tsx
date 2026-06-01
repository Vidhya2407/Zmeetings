'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useLanguageStore } from '../../lib/stores/languageStore';
import { useThemeStore } from '../../lib/stores/themeStore';
import { useAppTranslations } from '../../lib/utils/translations';

type GlobalQuickControlsMode = 'auto' | 'floating' | 'inline';

type GlobalQuickControlsProps = {
  mode?: GlobalQuickControlsMode;
  className?: string;
};

const WORKSPACE_ROUTES = new Set(['/activity', '/chat', '/meet', '/impact', '/people', '/calendar', '/recordings', '/settings', '/dashboard', '/meetings']);

function isWorkspacePath(pathname: string): boolean {
  const firstSegment = pathname.split('/').filter(Boolean)[0];
  return firstSegment ? WORKSPACE_ROUTES.has(`/${firstSegment}`) : false;
}

export default function GlobalQuickControls({ mode = 'auto', className = '' }: GlobalQuickControlsProps) {
  const { t } = useAppTranslations();
  const pathname = usePathname();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.set);

  const resolvedLanguage = language;
  const resolvedTheme = theme;
  const isLight = resolvedTheme === 'light';

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.lang = resolvedLanguage;
    document.documentElement.setAttribute('data-theme', resolvedTheme);
  }, [resolvedLanguage, resolvedTheme]);

  const panelBg = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(10,15,24,0.82)';
  const panelBorder = isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.16)';
  const textMuted = isLight ? '#475569' : '#94a3b8';
  const resolvedMode = mode === 'auto' ? (isWorkspacePath(pathname) ? 'hidden' : 'floating') : mode;
  const languageRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const themeRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const languageOptions = [
    { id: 'en', label: 'English', short: 'EN' },
    { id: 'de', label: 'Deutsch', short: 'DE' },
  ] as const;
  const themeOptions = [
    { id: 'light', label: t('workspace.profile.light', 'Light'), icon: <SunIcon /> },
    { id: 'dark', label: t('workspace.profile.dark', 'Dark'), icon: <MoonIcon /> },
  ] as const;

  if (resolvedMode === 'hidden') {
    return null;
  }

  const quickControlBaseClass = 'rounded-xl border px-3 py-1.5 text-sm font-black tracking-[0.06em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent hover:border-[rgba(0,229,186,0.35)] hover:bg-[rgba(0,229,186,0.12)] hover:text-[rgb(0,229,186)]';

  const layoutClass =
    resolvedMode === 'floating'
      ? 'fixed right-4 top-4 z-[80] rounded-[20px] border px-3 py-2 shadow-xl'
      : 'rounded-[20px] border px-3 py-2 shadow-xl';

  const moveFocus = (
    refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
    nextIndex: number,
  ) => {
    refs.current[nextIndex]?.focus();
  };

  const getNextIndex = (currentIndex: number, optionCount: number, direction: -1 | 1) => (
    (currentIndex + direction + optionCount) % optionCount
  );

  const handleRadioGroupKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    refs: React.MutableRefObject<Array<HTMLButtonElement | null>>,
    optionCount: number,
    onSelect: (nextIndex: number) => void,
  ) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = getNextIndex(index, optionCount, -1);
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = getNextIndex(index, optionCount, 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = optionCount - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    onSelect(nextIndex);
    moveFocus(refs, nextIndex);
  };

  return (
    <div
      className={`${layoutClass} ${className}`.trim()}
      data-no-translate="true"
      style={{
        background: panelBg,
        borderColor: panelBorder,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <div aria-label={t('workspace.profile.language', 'Language')} className="flex items-center gap-1.5" role="radiogroup">
          {languageOptions.map((option, index) => {
            const selected = resolvedLanguage === option.id;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  languageRefs.current[index] = element;
                }}
                aria-checked={selected}
                aria-label={option.label}
                className={`${quickControlBaseClass} bg-[var(--quick-bg)] border-[var(--quick-border)] text-[var(--quick-color)] hover:bg-[var(--quick-hover-bg)] hover:border-[var(--quick-hover-border)] hover:text-[var(--quick-hover-color)]`}
                onClick={() => setLanguage(option.id)}
                onKeyDown={(event) => {
                  handleRadioGroupKeyDown(event, index, languageRefs, languageOptions.length, (nextIndex) => {
                    setLanguage(languageOptions[nextIndex].id);
                  });
                }}
                role="radio"
                style={{
                  '--quick-bg': selected ? 'rgba(0,229,186,0.2)' : 'transparent',
                  '--quick-border': selected ? 'rgba(0,229,186,0.28)' : 'transparent',
                  '--quick-color': selected ? 'rgb(0,229,186)' : textMuted,
                  '--quick-hover-bg': 'rgba(0,229,186,0.12)',
                  '--quick-hover-border': 'rgba(0,229,186,0.35)',
                  '--quick-hover-color': 'rgb(0,229,186)',
                } as React.CSSProperties}
                tabIndex={selected ? 0 : -1}
                title={option.label}
                type="button"
              >
                {option.short}
              </button>
            );
          })}
        </div>
        <span
          aria-hidden
          className="mx-0.5 h-4 w-px"
          style={{ background: isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.2)' }}
        />
        <div aria-label={t('workspace.profile.theme', 'Theme')} className="flex items-center gap-1.5" role="radiogroup">
          {themeOptions.map((option, index) => {
            const selected = resolvedTheme === option.id;
            return (
              <button
                key={option.id}
                ref={(element) => {
                  themeRefs.current[index] = element;
                }}
                aria-checked={selected}
                aria-label={option.label}
                className={`flex items-center justify-center ${quickControlBaseClass} bg-[var(--quick-bg)] border-[var(--quick-border)] text-[var(--quick-color)] hover:bg-[var(--quick-hover-bg)] hover:border-[var(--quick-hover-border)] hover:text-[var(--quick-hover-color)]`}
                onClick={() => setTheme(option.id)}
                onKeyDown={(event) => {
                  handleRadioGroupKeyDown(event, index, themeRefs, themeOptions.length, (nextIndex) => {
                    setTheme(themeOptions[nextIndex].id);
                  });
                }}
                role="radio"
                style={{
                  '--quick-bg': selected ? 'rgba(0,229,186,0.2)' : 'transparent',
                  '--quick-border': selected ? 'rgba(0,229,186,0.28)' : 'transparent',
                  '--quick-color': selected ? 'rgb(0,229,186)' : textMuted,
                  '--quick-hover-bg': 'rgba(0,229,186,0.12)',
                  '--quick-hover-border': 'rgba(0,229,186,0.35)',
                  '--quick-hover-color': 'rgb(0,229,186)',
                } as React.CSSProperties}
                tabIndex={selected ? 0 : -1}
                title={option.label}
                type="button"
              >
                {option.icon}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg aria-hidden className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2.5M12 19.5V22M4.93 4.93l1.77 1.77M17.3 17.3l1.77 1.77M2 12h2.5M19.5 12H22M4.93 19.07 6.7 17.3M17.3 6.7l1.77-1.77"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg aria-hidden className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <path
        d="M21 14.5A9 9 0 1 1 12.5 3a7 7 0 1 0 8.5 11.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
}
