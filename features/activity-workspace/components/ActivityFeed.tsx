'use client';

import type { ActivityItem } from '@/types/domain/workspace';
import { useAppTranslations } from '@/lib/utils/translations';
import { localizeActivityText } from '@/lib/activity/localizeActivityText';

const iconByKind: Record<ActivityItem['kind'], string> = {
  meeting_invite: 'Invite',
  meeting_update: 'Update',
  meeting_recording_ready: 'Video',
  mention: '@',
  chat_message: 'Chat',
  system: 'Info',
};

function contextLabel(item: ActivityItem) {
  if (item.kind === 'meeting_recording_ready' && item.relatedMeetingId) return 'Open recording';
  if (item.relatedThreadId) return 'Open chat';
  if (item.relatedMeetingId) return 'Open meeting';
  return 'Open';
}

function contextKey(item: ActivityItem) {
  if (item.kind === 'meeting_recording_ready' && item.relatedMeetingId) return 'openRecording';
  if (item.relatedThreadId) return 'openChat';
  if (item.relatedMeetingId) return 'openMeeting';
  return 'open';
}

export default function ActivityFeed({
  items,
  isLight,
  onMarkRead,
  onOpenContext,
}: {
  items: ActivityItem[];
  isLight: boolean;
  onMarkRead: (id: string) => void;
  onOpenContext: (item: ActivityItem) => void;
}) {
  const { language, t } = useAppTranslations();
  const locale = language === 'de' ? 'de-DE' : 'en-US';

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const localized = localizeActivityText(item, t);

        return (
          <article
            key={item.id}
            className="rounded-[26px] border px-4 py-4"
            style={{
              background: item.read
                ? (isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.03)')
                : (isLight ? 'rgba(240,253,250,0.85)' : 'rgba(0,229,186,0.08)'),
              borderColor: item.read
                ? (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)')
                : 'rgba(0,229,186,0.25)',
            }}
          >
            <div className="grid gap-3 md:grid-cols-[auto,minmax(0,1fr),auto] md:items-center">
              <div
                className="inline-flex w-fit shrink-0 items-center justify-center self-start rounded-xl px-2 py-1 text-xs font-black"
                style={{
                  background: 'rgba(0,229,186,0.16)',
                  color: 'rgb(0,229,186)',
                }}
              >
                {t(`workspace.activity.kinds.${item.kind}`, iconByKind[item.kind])}
              </div>

              <div className="min-w-0 flex-1">
                <p
                  className="text-base font-black leading-6"
                  style={{ color: isLight ? '#0f172a' : '#ffffff', hyphens: 'manual', overflowWrap: 'normal', wordBreak: 'normal' }}
                >
                  {localized.title}
                </p>
                <p
                  className="mt-1.5 text-[15px] leading-6"
                  style={{ color: isLight ? '#475569' : '#cbd5e1', hyphens: 'manual', overflowWrap: 'normal', wordBreak: 'normal' }}
                >
                  {localized.body}
                </p>
                <p className="mt-1 text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {new Date(item.createdAt).toLocaleString(locale)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    className="rounded-lg border px-3 py-2 text-sm font-bold leading-none"
                    onClick={() => onOpenContext(item)}
                    style={{
                      borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)',
                      color: isLight ? '#334155' : '#cbd5e1',
                    }}
                    type="button"
                  >
                    {t(`workspace.activity.${contextKey(item)}`, contextLabel(item))}
                  </button>
                  {!item.read ? (
                    <button
                      className="rounded-lg border px-3 py-2 text-sm font-bold leading-none"
                      onClick={() => onMarkRead(item.id)}
                      style={{ borderColor: 'rgba(0,229,186,0.35)', color: 'rgb(0,229,186)' }}
                      type="button"
                    >
                      {t('workspace.activity.markRead', 'Mark read')}
                    </button>
                  ) : null}
                </div>
              </div>
              {!item.read ? (
                <div className="justify-self-start md:justify-self-end">
                  <span className="inline-flex items-center rounded-full bg-emerald-500 px-2 py-1 text-sm font-black leading-none text-[#041110]">
                    {t('workspace.activity.new', 'New')}
                  </span>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
