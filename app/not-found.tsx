'use client';

import Link from 'next/link';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';

export default function NotFound() {
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const pageBg = isLight
    ? 'linear-gradient(180deg, #eef6f7 0%, #f8fbfc 46%, #eef7f2 100%)'
    : 'linear-gradient(180deg, #07111f 0%, #0a1320 48%, #071814 100%)';
  const cardBg = isLight ? 'rgba(255,255,255,0.94)' : 'rgba(15,23,42,0.76)';
  const borderColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.10)';
  const eyebrow = isLight ? '#64748b' : '#94a3b8';
  const title = isLight ? '#0f172a' : '#f8fafc';
  const body = isLight ? '#475569' : '#cbd5e1';

  return (
    <main
      className="min-h-screen flex items-center justify-center px-6"
      style={{ background: pageBg }}
    >
      <div
        className="max-w-lg rounded-[2rem] border px-8 py-10 text-center"
        style={{
          background: cardBg,
          borderColor,
          boxShadow: isLight ? '0 20px 60px rgba(15,23,42,0.08)' : '0 24px 70px rgba(0,0,0,0.28)',
        }}
      >
        <p className="text-[11px] font-bold uppercase tracking-[0.3em]" style={{ color: eyebrow }}>
          Not Found
        </p>
        <h1 className="mt-3 text-3xl font-black tracking-tight" style={{ color: title }}>
          This page is not available.
        </h1>
        <p className="mt-4 text-sm leading-relaxed" style={{ color: body }}>
          The link may be outdated, or the content may have moved. You can continue from the login page.
        </p>
        <div className="mt-6">
          <Link
            href="/login"
            className="inline-flex rounded-full px-5 py-2.5 text-sm font-bold"
            style={{ background: 'rgba(0,229,186,0.9)', color: '#042f2e' }}
          >
            Go to Login
          </Link>
        </div>
      </div>
    </main>
  );
}
