'use client';

import React from 'react';
import { useAppTranslations } from '@/lib/utils/translations';
import type { Presence } from '@/types/domain/workspace';

type PresenceDisplay = {
  color: string;
  labelKey: string;
  titleKey: string;
  labelFallback: string;
  titleFallback: string;
};

const presenceDisplay: Record<Presence, PresenceDisplay> = {
  online: {
    color: '#00e5ba',
    labelKey: 'workspace.presence.online',
    titleKey: 'workspace.presence.onlineTitle',
    labelFallback: 'Online',
    titleFallback: 'Online: available now',
  },
  busy: {
    color: '#ef4444',
    labelKey: 'workspace.presence.busy',
    titleKey: 'workspace.presence.busyTitle',
    labelFallback: 'Busy',
    titleFallback: 'Busy: do not disturb',
  },
  away: {
    color: '#fbbf24',
    labelKey: 'workspace.presence.away',
    titleKey: 'workspace.presence.awayTitle',
    labelFallback: 'Away',
    titleFallback: 'Away: signed in but not active',
  },
  offline: {
    color: '#64748b',
    labelKey: 'workspace.presence.offline',
    titleKey: 'workspace.presence.offlineTitle',
    labelFallback: 'Offline',
    titleFallback: 'Offline: not connected',
  },
};

export function getPresenceDisplay(presence: Presence): PresenceDisplay {
  return presenceDisplay[presence] ?? presenceDisplay.offline;
}

export default function PresenceChip({ isLight, presence }: { isLight?: boolean; presence: Presence }) {
  const { t } = useAppTranslations();
  const display = getPresenceDisplay(presence);
  const label = t(display.labelKey, display.labelFallback);
  const title = t(display.titleKey, display.titleFallback);

  return (
    <span
      aria-label={t('workspace.presence.label', 'Presence: {status}').replace('{status}', label)}
      className="inline-flex h-7 items-center gap-2 rounded-full border px-2.5 text-sm font-black"
      style={{
        background: isLight ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.58)',
        borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)',
        color: isLight ? '#334155' : '#cbd5e1',
      }}
      title={title}
    >
      <span
        aria-hidden
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: display.color }}
      />
      {label}
    </span>
  );
}
