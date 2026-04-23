'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useHydrated } from '@/hooks/useHydrated';
import { useNotificationStore } from '@/lib/stores/notificationStore';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { useAppTranslations } from '@/lib/utils/translations';
import GlobalQuickControls from './GlobalQuickControls';

const titleByPath: Record<string, { key: string; fallback: string }> = {
  '/meet': { key: 'workspace.topbar.meet', fallback: 'Meet Now' },
  '/chat': { key: 'workspace.topbar.chat', fallback: 'Chat' },
  '/people': { key: 'workspace.topbar.people', fallback: 'People' },
  '/calendar': { key: 'workspace.topbar.calendar', fallback: 'Calendar' },
  '/activity': { key: 'workspace.topbar.activity', fallback: 'Activity' },
  '/recordings': { key: 'workspace.topbar.recordings', fallback: 'Recordings' },
  '/impact': { key: 'workspace.topbar.impact', fallback: 'Impact' },
  '/settings': { key: 'workspace.topbar.settings', fallback: 'Settings' },
  '/dashboard': { key: 'workspace.topbar.dashboard', fallback: 'Dashboard' },
};

export default function WorkspaceTopbar() {
  const { t, language } = useAppTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const globalSearch = useWorkspaceStore((state) => state.globalSearch);
  const setGlobalSearch = useWorkspaceStore((state) => state.setGlobalSearch);
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const toggleNotifications = useNotificationStore((state) => state.toggle);
  const unreadCount = useNotificationStore((state) => state.unreadCount());
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);
  const profileMenuRef = React.useRef<HTMLDivElement | null>(null);

  const basePath = React.useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts.length > 0 ? `/${parts[0]}` : '/meet';
  }, [pathname]);

  const languageLabel = language === 'de' ? 'Deutsch' : 'English';
  const themeLabel = isLight ? t('workspace.profile.light', 'Light') : t('workspace.profile.dark', 'Dark');
  const profileName = session?.user?.name ?? 'ZSTREAM Demo';
  const profileEmail = session?.user?.email ?? 'demo@zstream.app';
  const profileRole = session?.user?.role ?? 'user';
  const estimatedCarbonCredits = ((session?.user?.carbonPoints ?? 0) / 100).toFixed(2);

  React.useEffect(() => {
    setProfileOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProfileOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleLogout = React.useCallback(async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setProfileOpen(false);
    try {
      await signOut({ callbackUrl: '/login' });
    } catch {
      setIsLoggingOut(false);
      router.push('/login');
    }
  }, [isLoggingOut, router]);

  return (
    <header
      className="sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 md:px-6"
      style={{
        background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(10,15,24,0.82)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
      }}
    >
      <div>
        <p className="text-sm font-black uppercase tracking-[0.16em]" style={{ color: isLight ? '#64748b' : '#6b7280' }}>
          {t('workspace.topbar.workspace', 'Workspace')}
        </p>
        <h1 className="text-lg font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
          {titleByPath[basePath] ? t(titleByPath[basePath].key, titleByPath[basePath].fallback) : t('workspace.topbar.default', 'ZMeetings')}
        </h1>
      </div>

      <div className="w-full max-w-[360px]">
        <input
          className="h-10 w-full rounded-xl border px-3 text-sm outline-none"
          onChange={(event) => setGlobalSearch(event.target.value)}
          placeholder={t('workspace.topbar.searchPlaceholder', 'Search meetings, people, chats...')}
          style={{
            background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)',
            borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
            color: isLight ? '#0f172a' : '#ffffff',
          }}
          value={globalSearch}
        />
      </div>

      <div className="flex items-center gap-2">
        <GlobalQuickControls mode="inline" />

        <button
          aria-label={t('workspace.profile.notifications', 'Notifications')}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border"
          onClick={toggleNotifications}
          style={{
            background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)',
            borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
            color: isLight ? '#475569' : '#e2e8f0',
          }}
          type="button"
        >
          <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 0 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-[18px] rounded-full bg-rose-500 px-1 py-0.5 text-center text-sm font-black text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          ) : null}
        </button>

        <div className="relative" ref={profileMenuRef}>
          <button
            aria-expanded={profileOpen}
            aria-label={t('workspace.profile.profile', 'Profile')}
            className="flex h-10 w-10 items-center justify-center rounded-xl border"
            onClick={() => setProfileOpen((open) => !open)}
            style={{
              background: profileOpen
                ? (isLight ? 'rgba(0,229,186,0.12)' : 'rgba(0,229,186,0.16)')
                : (isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)'),
              borderColor: profileOpen
                ? 'rgba(0,229,186,0.35)'
                : (isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)'),
              color: isLight ? '#475569' : '#e2e8f0',
            }}
            type="button"
          >
            <svg aria-hidden className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M5 20a7 7 0 0 1 14 0" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="12" cy="8" r="4" />
            </svg>
          </button>

          {profileOpen ? (
            <div
              className="absolute right-0 top-[calc(100%+10px)] z-[75] w-[280px] rounded-[26px] border p-3 shadow-2xl"
              style={{
                background: isLight ? 'rgba(245,247,249,0.98)' : 'rgba(15,20,30,0.97)',
                borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)',
                color: isLight ? '#0f172a' : '#f8fafc',
              }}
            >
              <div className="rounded-2xl p-3" style={{ background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)', border: `1px solid ${isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'}` }}>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black" style={{ background: 'linear-gradient(135deg, rgba(0,180,255,0.95), rgba(0,229,186,0.95))', color: '#032028' }}>
                    Z
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{profileName}</p>
                    <p className="truncate text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{profileEmail}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full px-2 py-0.5 text-sm font-black uppercase tracking-[0.12em]" style={{ background: 'rgba(16,185,129,0.16)', color: isLight ? '#047857' : '#6ee7b7' }}>
                    {profileRole}
                  </span>
                  <span className="rounded-full px-2 py-0.5 text-sm font-bold" style={{ background: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)', color: isLight ? '#475569' : '#cbd5e1' }}>
                    ID {session?.user?.id ?? 'demo-user'}
                  </span>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl p-2.5" style={{ background: isLight ? 'rgba(0,229,186,0.12)' : 'rgba(0,229,186,0.14)' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: isLight ? '#047857' : '#5eead4' }}>{t('workspace.profile.estimatedCredits', 'Est. carbon credits')}</p>
                  <p className="mt-1 text-xl font-black leading-none" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{estimatedCarbonCredits}</p>
                </div>
                <div className="rounded-2xl p-2.5" style={{ background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-black uppercase tracking-[0.1em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{t('workspace.profile.status', 'Status')}</p>
                  <p className="mt-1 text-xl font-black leading-none" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{t('workspace.profile.active', 'Active')}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <ProfileInfoRow isLight={isLight} label={t('workspace.profile.plan', 'Plan')} value={t('workspace.profile.betaAccess', 'Beta access')} />
                <ProfileInfoRow isLight={isLight} label={t('workspace.profile.language', 'Language')} value={languageLabel} />
                <ProfileInfoRow isLight={isLight} label={t('workspace.profile.theme', 'Theme')} value={themeLabel} />
              </div>

              <div className="mt-3">
                <button
                  className="w-full rounded-xl px-3 py-2 text-xs font-black uppercase tracking-[0.12em]"
                  onClick={() => {
                    setProfileOpen(false);
                    router.push('/impact');
                  }}
                  style={{
                    background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.14)'}`,
                    color: 'rgb(0,229,186)',
                  }}
                  type="button"
                >
                  {t('workspace.profile.impactOpen', 'Open impact')}
                </button>
              </div>

              <button
                className="mt-3 w-full rounded-xl px-3 py-2 text-sm font-black uppercase tracking-[0.12em]"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                style={{
                  background: isLight ? 'rgba(239,68,68,0.08)' : 'rgba(239,68,68,0.16)',
                  border: `1px solid ${isLight ? 'rgba(239,68,68,0.28)' : 'rgba(248,113,113,0.35)'}`,
                  color: isLight ? '#b91c1c' : '#fca5a5',
                  opacity: isLoggingOut ? 0.7 : 1,
                }}
                type="button"
              >
                {isLoggingOut ? t('workspace.profile.loggingOut', 'Logging out...') : t('workspace.profile.logout', 'Log out')}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ProfileInfoRow({ isLight, label, value }: { isLight: boolean; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)' }}>
      <span className="text-sm font-semibold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{label}</span>
      <span className="text-sm font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{value}</span>
    </div>
  );
}
