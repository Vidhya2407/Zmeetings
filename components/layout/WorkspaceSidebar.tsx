'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import BrandMark from '@/components/branding/BrandMark';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useWorkspaceStore, type WorkspaceSection } from '@/lib/stores/workspaceStore';
import { useAppTranslations } from '@/lib/utils/translations';

type NavItem = {
  section: WorkspaceSection;
  href: string;
  labelKey: string;
  fallback: string;
  icon: React.ReactNode;
};

const navItems: NavItem[] = [
  { section: 'meet', href: '/meet', labelKey: 'workspace.nav.meet', fallback: 'Meet', icon: <MeetIcon /> },
  { section: 'calendar', href: '/calendar', labelKey: 'workspace.nav.calendar', fallback: 'Calendar', icon: <CalendarIcon /> },
  { section: 'chat', href: '/chat', labelKey: 'workspace.nav.chat', fallback: 'Chat', icon: <ChatIcon /> },
  { section: 'people', href: '/people', labelKey: 'workspace.nav.people', fallback: 'People', icon: <PeopleIcon /> },
  { section: 'recordings', href: '/recordings', labelKey: 'workspace.nav.recordings', fallback: 'Recordings', icon: <RecordingsIcon /> },
  { section: 'impact', href: '/impact', labelKey: 'workspace.nav.impact', fallback: 'Impact', icon: <ImpactIcon /> },
  { section: 'activity', href: '/activity', labelKey: 'workspace.nav.activity', fallback: 'Activity', icon: <ActivityIcon /> },
  { section: 'settings', href: '/settings', labelKey: 'workspace.nav.settings', fallback: 'Settings', icon: <SettingsIcon /> },
];

export default function WorkspaceSidebar() {
  const { pathname, isLight, setActiveSection, t } = useWorkspaceNavTheme();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    const matched = navItems.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
    if (matched) {
      setActiveSection(matched.section);
    }
  }, [pathname, setActiveSection]);

  React.useEffect(() => () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
  }, []);

  const openMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setMenuOpen(true);
  };

  const scheduleCloseMenu = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      setMenuOpen(false);
      closeTimerRef.current = null;
    }, 320);
  };

  const sidebarBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(10,15,24,0.82)';
  const borderColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const surfaceBg = isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.06)';

  const renderDesktopNavItem = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    const label = t(item.labelKey, item.fallback);

    if (!menuOpen) {
      return (
        <Link
          key={item.href}
          href={item.href}
          title={label}
          aria-label={label}
          className="group relative flex h-12 w-full items-center justify-center rounded-xl border transition-colors"
          style={{
            borderColor: active ? 'rgba(0,229,186,0.34)' : 'transparent',
            background: active ? 'rgba(0,229,186,0.16)' : 'transparent',
            color: active ? 'rgb(0,229,186)' : (isLight ? '#334155' : '#cbd5e1'),
          }}
        >
          <span
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: active ? 'rgba(0,229,186,0.20)' : surfaceBg }}
          >
            {item.icon}
          </span>
          <span
            className="pointer-events-none absolute left-[calc(100%+8px)] top-1/2 z-20 hidden -translate-y-1/2 whitespace-nowrap rounded-lg px-2 py-1 text-sm font-bold shadow-lg group-hover:block"
            style={{ background: isLight ? '#0f172a' : '#e2e8f0', color: isLight ? '#f8fafc' : '#0f172a' }}
          >
            {label}
          </span>
        </Link>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        className="group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors"
        style={{
          borderColor: active ? 'rgba(0,229,186,0.34)' : 'transparent',
          background: active ? 'rgba(0,229,186,0.14)' : 'transparent',
          color: active ? 'rgb(0,229,186)' : (isLight ? '#334155' : '#cbd5e1'),
        }}
      >
        <span
          className="flex h-8 w-8 items-center justify-center rounded-lg"
          style={{ background: active ? 'rgba(0,229,186,0.20)' : surfaceBg }}
        >
          {item.icon}
        </span>
        <span className="text-sm font-bold">{label}</span>
      </Link>
    );
  };

  return (
    <>
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r px-3 py-3 transition-[width] duration-200 ease-out md:flex md:flex-col ${menuOpen ? 'w-[244px]' : 'w-[92px]'}`}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            scheduleCloseMenu();
          }
        }}
        onFocusCapture={openMenu}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleCloseMenu}
        style={{ background: sidebarBg, borderColor }}
      >
        <div className={`mb-3 flex items-center ${menuOpen ? 'justify-start' : 'justify-center'}`}>
          <Link
            href="/meet"
            aria-label="Z Meetings"
            className={`flex items-center gap-2 rounded-xl ${menuOpen ? 'px-3 py-2 text-base' : 'h-10 w-10 justify-center text-base'} font-black`}
            style={{ background: 'rgba(0,229,186,0.15)', color: 'rgb(0,229,186)' }}
          >
            <BrandMark alt="Z Meetings" className="h-6 w-6" size={24} />
            {menuOpen ? <span className="text-sm tracking-[0.12em]">Meetings</span> : null}
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-1.5 overflow-y-auto">
          {navItems.map(renderDesktopNavItem)}
        </nav>
      </aside>
    </>
  );
}

export function MobileWorkspaceNav() {
  const { pathname, isLight, t } = useWorkspaceNavTheme();
  const sidebarBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(10,15,24,0.82)';
  const borderColor = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';

  return (
    <nav
      className="border-t px-2 pb-[max(env(safe-area-inset-bottom),0.25rem)] pt-1 md:hidden"
      style={{
        background: sidebarBg,
        borderColor,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: isLight ? '0 -8px 24px rgba(15,23,42,0.08)' : '0 -10px 28px rgba(0,0,0,0.3)',
      }}
    >
      <div className="flex items-stretch gap-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const label = t(item.labelKey, item.fallback);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl px-1 py-1.5 font-bold"
              style={{
                background: active ? 'rgba(0,229,186,0.14)' : 'transparent',
                color: active ? 'rgb(0,229,186)' : (isLight ? '#475569' : '#94a3b8'),
                border: active ? '1px solid rgba(0,229,186,0.22)' : '1px solid transparent',
              }}
              aria-label={label}
            >
              <span className="mb-0.5 flex h-5 w-5 items-center justify-center">{item.icon}</span>
              <span className="w-full truncate text-center" style={{ fontSize: '10px', lineHeight: '13px' }}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function useWorkspaceNavTheme() {
  const { t } = useAppTranslations();
  const pathname = usePathname();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const setActiveSection = useWorkspaceStore((state) => state.setActiveSection);

  return { isLight, pathname, setActiveSection, t };
}

function iconStroke() {
  return { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
}

function ActivityIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 19h16" {...common} />
      <path d="M7 16V9" {...common} />
      <path d="M12 16V5" {...common} />
      <path d="M17 16v-3" {...common} />
    </svg>
  );
}

function ChatIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v6A2.5 2.5 0 0 1 17.5 15H9l-4 4v-4.5A2.5 2.5 0 0 1 4 12.5z" {...common} />
    </svg>
  );
}

function MeetIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <rect x="3.5" y="6.5" width="12" height="11" rx="2" {...common} />
      <path d="M15.5 10.5 20 8v8l-4.5-2.5" {...common} />
    </svg>
  );
}

function RecordingsIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5" width="16" height="14" rx="2.5" {...common} />
      <path d="m10 9 5 3-5 3V9Z" {...common} />
      <path d="M7 19h10" {...common} />
    </svg>
  );
}

function ImpactIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 18.5h16" {...common} />
      <path d="M7 15.5v-5" {...common} />
      <path d="M12 15.5v-9" {...common} />
      <path d="M17 15.5v-3" {...common} />
      <path d="M7 7.5c2.5 1.2 5.2.6 6.7-1.8 2.2.1 3.8 1.4 4.3 3.5" {...common} />
    </svg>
  );
}

function PeopleIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <circle cx="9" cy="8" r="2.5" {...common} />
      <path d="M3.5 17.5a5.5 5.5 0 0 1 11 0" {...common} />
      <circle cx="16.5" cy="9" r="2" {...common} />
      <path d="M14.5 17.5a4.5 4.5 0 0 1 6 0" {...common} />
    </svg>
  );
}

function CalendarIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <rect x="4" y="5.5" width="16" height="14" rx="2" {...common} />
      <path d="M8 3.5v4M16 3.5v4M4 9.5h16" {...common} />
    </svg>
  );
}

function SettingsIcon() {
  const common = iconStroke();
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="2.5" {...common} />
      <path d="m19 12 1.8-1-.8-2.1-2 .2-1.2-1.5.6-1.9-2-1.1-1.4 1.4h-1.9L10.7 4l-2 1.1.6 1.9-1.2 1.5-2-.2-.8 2.1L5 12l-1.8 1 .8 2.1 2-.2 1.2 1.5-.6 1.9 2 1.1 1.4-1.4h1.9l1.4 1.4 2-1.1-.6-1.9 1.2-1.5 2 .2.8-2.1z" {...common} />
    </svg>
  );
}
