import { create } from 'zustand';
import { useSettingsStore } from './settingsStore';
import type { ActivityItem, WorkspaceNotificationPriority } from '@/types/domain/workspace';

export type NotificationType = 'carbon' | 'content' | 'live' | 'achievement' | 'system' | 'meeting' | 'mention' | 'chat';
export type NotificationSource = 'activity' | 'chat' | 'meeting' | 'system';

export interface Notification {
  activityKind?: ActivityItem['kind'];
  id: string;
  type: NotificationType;
  source: NotificationSource;
  priority: WorkspaceNotificationPriority;
  title: string;
  body: string;
  time: number;
  read: boolean;
  href?: string;
  icon?: string;
  linkedEntityId?: string | null;
}

const SEED: Notification[] = [];

interface NotificationState {
  notifications: Notification[];
  isOpen: boolean;
  unreadCount: () => number;
  open: () => void;
  close: () => void;
  toggle: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clearAll: () => void;
  push: (n: Omit<Notification, 'id' | 'time' | 'read'>) => void;
  syncActivity: (items: ActivityItem[]) => void;
}

function shouldDeliverNotification(type: NotificationType) {
  const settings = useSettingsStore.getState();

  if (!settings.pushNotifications) {
    return false;
  }

  if (type === 'carbon' && !settings.carbonMilestoneAlerts) {
    return false;
  }

  return true;
}

function shouldSyncActivityNotification(item: ActivityItem) {
  const settings = useSettingsStore.getState();
  if (!settings.pushNotifications) {
    return false;
  }
  if (item.kind === 'meeting_recording_ready' && !settings.carbonMilestoneAlerts) {
    return false;
  }
  return true;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: SEED,
  isOpen: false,
  unreadCount: () => get().notifications.filter((n) => !n.read).length,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  markRead: (id) => set((s) => ({ notifications: s.notifications.map((n) => n.id === id ? { ...n, read: true } : n) })),
  markAllRead: () => set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),
  dismiss: (id) => set((s) => ({ notifications: s.notifications.filter((n) => n.id !== id) })),
  clearAll: () => set({ notifications: [] }),
  push: (n) => {
    if (!shouldDeliverNotification(n.type)) {
      return;
    }

    set((s) => ({
      notifications: [
        { ...n, id: `n${Date.now()}`, time: Date.now(), read: false, source: n.source ?? 'system' },
        ...s.notifications,
      ],
    }));
  },
  syncActivity: (items) => {
    const priorityOrder: Record<WorkspaceNotificationPriority, number> = {
      meeting_now: 0,
      mention: 1,
      direct: 2,
      general: 3,
    };

    const fromActivity: Notification[] = items.filter(shouldSyncActivityNotification).map((item) => {
      const type: NotificationType = item.kind === 'mention'
        ? 'mention'
        : item.kind === 'chat_message'
          ? 'chat'
          : item.kind.startsWith('meeting')
            ? 'meeting'
            : 'system';

      const href = item.kind === 'meeting_recording_ready' && item.relatedMeetingId
        ? `/recordings?meetingId=${encodeURIComponent(item.relatedMeetingId)}`
        : item.relatedMeetingId
        ? `/meet?meetingId=${encodeURIComponent(item.relatedMeetingId)}`
        : item.relatedThreadId
          ? `/chat?threadId=${encodeURIComponent(item.relatedThreadId)}`
          : '/activity';

      return {
        id: `activity:${item.id}`,
        activityKind: item.kind,
        type,
        source: 'activity',
        priority: item.priority,
        title: item.title,
        body: item.body,
        time: new Date(item.createdAt).getTime(),
        read: item.read,
        href,
        linkedEntityId: item.relatedMeetingId ?? item.relatedThreadId,
      };
    });

    set((state) => {
      const activityMeetingIds = new Set(
        fromActivity
          .map((notification) => notification.linkedEntityId)
          .filter((value): value is string => Boolean(value)),
      );

      const nonActivity = state.notifications.filter((notification) => {
        if (notification.source === 'activity') {
          return false;
        }

        // Avoid duplicate meeting rows when we push an instant meeting notification
        // and then sync the same meeting update from the activity feed.
        if (notification.type === 'meeting' && notification.linkedEntityId && activityMeetingIds.has(notification.linkedEntityId)) {
          return false;
        }

        return true;
      });

      const merged = [...fromActivity, ...nonActivity];
      merged.sort((a, b) => {
        const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        return pDiff !== 0 ? pDiff : b.time - a.time;
      });
      return { notifications: merged };
    });
  },
}));
