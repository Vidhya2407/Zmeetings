'use client';

import PresenceChip from '@/components/layout/PresenceChip';
import { useAppTranslations } from '@/lib/utils/translations';
import type { WorkspaceUser } from '@/types/domain/workspace';

export default function ContactCard({
  isLight,
  user,
  onInvite,
  onMessage,
}: {
  isLight: boolean;
  user: WorkspaceUser;
  onInvite: (user: WorkspaceUser) => void;
  onMessage: (user: WorkspaceUser) => void;
}) {
  const { t } = useAppTranslations();

  return (
    <article
      className="min-h-[132px] rounded-3xl border p-5"
      style={{
        background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-base font-black text-emerald-400">
            {user.avatarInitials}
          </div>
          <div>
            <p className="text-base font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {user.name}
            </p>
            <p className="mt-1 text-sm uppercase tracking-[0.12em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
              {user.title}
            </p>
          </div>
        </div>
        <PresenceChip isLight={isLight} presence={user.presence} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          className="rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => onInvite(user)}
          style={{ background: 'rgba(0,229,186,0.15)', color: 'rgb(0,229,186)', border: '1px solid rgba(0,229,186,0.3)' }}
          type="button"
        >
          {t('workspace.people.card.invite', 'Invite to meeting')}
        </button>
        <button
          className="rounded-xl px-4 py-2 text-sm font-bold"
          onClick={() => onMessage(user)}
          style={{
            background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.06)',
            color: isLight ? '#475569' : '#9ca3af',
            border: `1px solid ${isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)'}`,
          }}
          type="button"
        >
          {t('workspace.people.card.message', 'Message')}
        </button>
      </div>
    </article>
  );
}
