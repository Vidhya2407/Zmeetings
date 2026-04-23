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

  if (resolvedMode === 'hidden') {
    return null;
  }

  const layoutClass =
    resolvedMode === 'floating'
      ? 'fixed right-4 top-4 z-[80] rounded-2xl border px-2 py-1.5 shadow-xl'
      : 'rounded-2xl border px-2 py-1.5 shadow-xl';

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
      <div className="flex items-center gap-1">
        <button
          className="rounded-md px-2.5 py-1 text-sm font-black tracking-[0.06em] transition-colors"
          onClick={() => setLanguage('en')}
          style={{
            background: resolvedLanguage === 'en' ? 'rgba(0,229,186,0.2)' : 'transparent',
            color: resolvedLanguage === 'en' ? 'rgb(0,229,186)' : textMuted,
          }}
          type="button"
        >
          EN
        </button>
        <button
          className="rounded-md px-2.5 py-1 text-sm font-black tracking-[0.06em] transition-colors"
          onClick={() => setLanguage('de')}
          style={{
            background: resolvedLanguage === 'de' ? 'rgba(0,229,186,0.2)' : 'transparent',
            color: resolvedLanguage === 'de' ? 'rgb(0,229,186)' : textMuted,
          }}
          type="button"
        >
          DE
        </button>
        <span
          aria-hidden
          className="mx-0.5 h-4 w-px"
          style={{ background: isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.2)' }}
        />
        <button
          aria-label={t('workspace.profile.light', 'Light')}
          className="flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-black tracking-[0.06em] transition-colors"
          onClick={() => setTheme('light')}
          style={{
            background: resolvedTheme === 'light' ? 'rgba(0,229,186,0.2)' : 'transparent',
            color: resolvedTheme === 'light' ? 'rgb(0,229,186)' : textMuted,
          }}
          type="button"
        >
          <SunIcon />
        </button>
        <button
          aria-label={t('workspace.profile.dark', 'Dark')}
          className="flex items-center justify-center rounded-md px-2.5 py-1 text-sm font-black tracking-[0.06em] transition-colors"
          onClick={() => setTheme('dark')}
          style={{
            background: resolvedTheme === 'dark' ? 'rgba(0,229,186,0.2)' : 'transparent',
            color: resolvedTheme === 'dark' ? 'rgb(0,229,186)' : textMuted,
          }}
          type="button"
        >
          <MoonIcon />
        </button>
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
