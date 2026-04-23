'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppTranslations } from '@/lib/utils/translations';

type RoleMenuVariant = 'host' | 'attendee';

type MeetingsRoleMenusProps = {
  activeRole: RoleMenuVariant;
  borderColor: string;
  cardBg: string;
  isLight: boolean;
  meetingId?: string | null;
  textMuted: string;
  textPrimary: string;
  textSecondary: string;
};

type RoleMenuItem = {
  href: string;
  label: string;
  helper: string;
};

export default function MeetingsRoleMenus({
  activeRole,
  borderColor,
  cardBg,
  isLight,
  meetingId,
  textMuted,
  textPrimary,
  textSecondary,
}: MeetingsRoleMenusProps) {
  const pathname = usePathname();
  const { isGerman } = useAppTranslations();
  const hostMenuItems: RoleMenuItem[] = [
    {
      href: '/meetings/host',
      label: isGerman ? 'Meeting verwalten' : 'Manage Meeting',
      helper: isGerman ? 'Live-Steuerung und Warteraum' : 'Live controls and waiting room',
    },
    {
      href: '/meet',
      label: isGerman ? 'Meetings-Hub' : 'Meetings Hub',
      helper: isGerman ? 'Zurueck zu allen Meeting-Ablaufen' : 'Back to all meetings flows',
    },
  ];
  const attendeeMenuItems: RoleMenuItem[] = [
    {
      href: '/meetings/attendee',
      label: isGerman ? 'Teilnehmer-Studio' : 'Attendee Studio',
      helper: isGerman ? 'Beitritt und Bereitschaftsansicht' : 'Join flow and readiness view',
    },
    {
      href: '/meet',
      label: isGerman ? 'Meetings-Hub' : 'Meetings Hub',
      helper: isGerman ? 'Zurueck zu allen Meeting-Ablaufen' : 'Back to all meetings flows',
    },
  ];

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <RoleMenuCard
        activeRole={activeRole}
        borderColor={borderColor}
        cardBg={cardBg}
        currentPathname={pathname}
        isLight={isLight}
        items={hostMenuItems}
        meetingId={meetingId}
        role="host"
        textMuted={textMuted}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        title={isGerman ? 'Host' : 'Host'}
      />
      <RoleMenuCard
        activeRole={activeRole}
        borderColor={borderColor}
        cardBg={cardBg}
        currentPathname={pathname}
        isLight={isLight}
        items={attendeeMenuItems}
        meetingId={meetingId}
        role="attendee"
        textMuted={textMuted}
        textPrimary={textPrimary}
        textSecondary={textSecondary}
        title={isGerman ? 'Teilnehmer' : 'Attendee'}
      />
    </div>
  );
}

type RoleMenuCardProps = {
  activeRole: RoleMenuVariant;
  borderColor: string;
  cardBg: string;
  currentPathname: string;
  isLight: boolean;
  items: RoleMenuItem[];
  meetingId?: string | null;
  role: RoleMenuVariant;
  textMuted: string;
  textPrimary: string;
  textSecondary: string;
  title: string;
};

function RoleMenuCard({
  activeRole,
  borderColor,
  cardBg,
  currentPathname,
  isLight,
  items,
  meetingId,
  role,
  textMuted,
  textPrimary,
  textSecondary,
  title,
}: RoleMenuCardProps) {
  const { isGerman } = useAppTranslations();
  const roleIsActive = activeRole === role;
  const accent = role === 'host'
    ? (isLight ? 'rgba(37,99,235,0.16)' : 'rgba(96,165,250,0.2)')
    : (isLight ? 'rgba(5,150,105,0.16)' : 'rgba(16,185,129,0.2)');
  const accentBorder = role === 'host'
    ? (isLight ? 'rgba(37,99,235,0.28)' : 'rgba(96,165,250,0.3)')
    : (isLight ? 'rgba(5,150,105,0.28)' : 'rgba(16,185,129,0.3)');
  const roleLabel = role === 'host'
    ? (isGerman ? 'Rolle: Host' : 'Role: Host')
    : (isGerman ? 'Rolle: Teilnehmer' : 'Role: Attendee');

  return (
    <section
      className="rounded-2xl p-4"
      style={{
        background: roleIsActive ? accent : cardBg,
        border: `1px solid ${roleIsActive ? accentBorder : borderColor}`,
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: textPrimary }}>
          {title}
        </h3>
        <span className="rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em]" style={{ background: isLight ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.06)', color: textMuted }}>
          {roleLabel}
        </span>
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const href = meetingId ? `${item.href}?meetingId=${encodeURIComponent(meetingId)}` : item.href;
          const active = currentPathname === item.href || currentPathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={`${role}-${item.href}`}
              href={href}
              className="block rounded-xl px-3 py-2 transition-colors"
              style={{
                border: `1px solid ${active ? accentBorder : borderColor}`,
                background: active ? accent : (isLight ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.03)'),
              }}
            >
              <div className="text-sm font-bold" style={{ color: textPrimary }}>{item.label}</div>
              <div className="mt-0.5 text-xs" style={{ color: textSecondary }}>{item.helper}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
