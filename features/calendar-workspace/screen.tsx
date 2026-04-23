'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useHydrated } from '@/hooks/useHydrated';
import { useCalendarStore } from '@/lib/stores/calendarStore';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useWorkspaceStore } from '@/lib/stores/workspaceStore';
import { useAppTranslations } from '@/lib/utils/translations';
import type { CalendarEvent, Meeting, WorkspaceUser } from '@/types/domain/workspace';
import MonthGrid from './components/MonthGrid';
import ScheduleModal from './components/ScheduleModal';

type CancelDialogState = {
  event: CalendarEvent;
  message?: string;
  type: 'blocked' | 'confirm' | 'error';
};

export default function CalendarWorkspaceScreen() {
  const { t } = useAppTranslations();
  const router = useRouter();
  const { data: session } = useSession();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const globalSearch = useWorkspaceStore((state) => state.globalSearch);
  const {
    events,
    currentDate,
    view,
    scheduleModalOpen,
    loading,
    setEvents,
    setCurrentDate,
    setView,
    setScheduleModalOpen,
    setLoading,
  } = useCalendarStore();
  const [selectedEvent, setSelectedEvent] = React.useState<CalendarEvent | null>(null);
  const [cancelDialog, setCancelDialog] = React.useState<CancelDialogState | null>(null);
  const [cancelingEventId, setCancelingEventId] = React.useState<string | null>(null);
  const [meetings, setMeetings] = React.useState<Meeting[]>([]);
  const [people, setPeople] = React.useState<WorkspaceUser[]>([]);

  const currentCalendarUserId = React.useMemo(() => {
    if (!session?.user?.id) return null;
    return session.user.id === 'demo-user' ? 'u5' : session.user.id;
  }, [session?.user?.id]);

  const loadCalendar = React.useCallback(async () => {
    setLoading(true);
    try {
      const [eventsRes, meetingsRes, peopleRes] = await Promise.all([
        fetch('/api/events', { cache: 'no-store' }),
        fetch('/api/meetings', { cache: 'no-store' }),
        fetch('/api/people', { cache: 'no-store' }),
      ]);
      if (eventsRes.status === 401 || meetingsRes.status === 401) {
        router.push(`/login?next=${encodeURIComponent('/calendar')}`);
        return;
      }
      const eventsBody = await eventsRes.json();
      const meetingsBody = await meetingsRes.json();
      const peopleBody = await peopleRes.json();
      setEvents(eventsBody?.data?.events ?? []);
      setMeetings(meetingsBody?.data?.meetings ?? []);
      setPeople(peopleBody?.data?.people ?? []);
    } finally {
      setLoading(false);
    }
  }, [router, setEvents, setLoading]);

  React.useEffect(() => {
    void loadCalendar();
  }, [loadCalendar]);

  const filteredEvents = React.useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => event.title.toLowerCase().includes(query));
  }, [events, globalSearch]);

  const monthLabel = React.useMemo(() => (
    new Date(currentDate).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  ), [currentDate]);

  const shiftMonth = (delta: number) => {
    const date = new Date(currentDate);
    date.setMonth(date.getMonth() + delta);
    setCurrentDate(date.toISOString());
  };

  const getHostName = React.useCallback((event: CalendarEvent) => (
    people.find((person) => person.id === event.ownerUserId)?.name ?? 'the host'
  ), [people]);

  const handleCancelClick = (event: CalendarEvent) => {
    if (event.ownerUserId !== currentCalendarUserId) {
      setCancelDialog({
        event,
        message: `Only ${getHostName(event)} can cancel this event.`,
        type: 'blocked',
      });
      return;
    }

    setCancelDialog({ event, type: 'confirm' });
  };

  const confirmCancelEvent = async (event: CalendarEvent) => {
    setCancelingEventId(event.id);
    try {
      const response = await fetch(`/api/events/${encodeURIComponent(event.id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        setCancelDialog({
          event,
          message: body?.error ?? 'Unable to cancel this event right now.',
          type: response.status === 403 ? 'blocked' : 'error',
        });
        return;
      }

      setCancelDialog(null);
      setSelectedEvent(null);
      await loadCalendar();
    } finally {
      setCancelingEventId(null);
    }
  };

  return (
    <div className="space-y-5">
      <section
        className="rounded-3xl border p-5 md:p-6"
        style={{
          background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
          borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'rgb(0,229,186)' }}>
              {t('workspace.calendar.eyebrow', 'Calendar')}
            </p>
            <h2 className="mt-2 text-3xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {t('workspace.calendar.title', 'Plan and optimize team schedules')}
            </h2>
            <p className="mt-2 text-sm" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
              {t('workspace.calendar.subtitle', 'Create events, avoid conflicts, and launch meetings from one timeline.')}
            </p>
          </div>
          <button
            className="rounded-xl px-4 py-2.5 text-sm font-black"
            onClick={() => setScheduleModalOpen(true)}
            style={{ background: 'rgba(0,229,186,0.9)', color: '#041110' }}
            type="button"
          >
            {t('workspace.calendar.newEvent', 'Schedule')}
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="rounded-xl border px-3 py-2 text-xs font-bold"
            onClick={() => shiftMonth(-1)}
            style={{
              background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)',
              borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
              color: isLight ? '#334155' : '#cbd5e1',
            }}
            type="button"
          >
            {t('workspace.calendar.prev', 'Prev')}
          </button>
          <p className="rounded-xl border px-3 py-2 text-xs font-black uppercase tracking-[0.2em]" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)', color: isLight ? '#334155' : '#cbd5e1' }}>
            {monthLabel}
          </p>
          <button
            className="rounded-xl border px-3 py-2 text-xs font-bold"
            onClick={() => shiftMonth(1)}
            style={{
              background: isLight ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.05)',
              borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
              color: isLight ? '#334155' : '#cbd5e1',
            }}
            type="button"
          >
            {t('workspace.calendar.next', 'Next')}
          </button>

          <div className="ml-auto flex items-center gap-1">
            {(['month', 'week'] as const).map((option) => (
              <button
                key={option}
                className="rounded-lg px-3 py-2 text-xs font-black uppercase tracking-[0.14em]"
                onClick={() => setView(option)}
                style={{
                  background: view === option ? 'rgba(0,229,186,0.16)' : 'transparent',
                  color: view === option ? 'rgb(0,229,186)' : (isLight ? '#64748b' : '#94a3b8'),
                }}
                type="button"
              >
                {t(`workspace.calendar.view.${option}`, option)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section className="space-y-4">
          {loading ? (
            <div
              className="rounded-3xl border p-6 text-sm"
              style={{
                background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
                borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
                color: isLight ? '#64748b' : '#94a3b8',
              }}
            >
              {t('workspace.calendar.loading', 'Loading events...')}
            </div>
          ) : (
            <MonthGrid
              currentDate={currentDate}
              events={filteredEvents}
              isLight={isLight}
              onSelectEvent={(event) => {
                setSelectedEvent(event);
              }}
              view={view}
            />
          )}
        </section>

        <aside
          className="rounded-3xl border p-5"
          style={{
            background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
          }}
        >
          <h3 className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
            {t('workspace.calendar.upcoming', 'Upcoming')}
          </h3>

          <div className="mt-3 space-y-2">
            {filteredEvents.slice(0, 5).map((event) => (
              <button
                key={event.id}
                className="w-full rounded-2xl border px-3 py-2 text-left"
                onClick={() => setSelectedEvent(event)}
                style={{
                  background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.03)',
                  borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
                }}
                type="button"
              >
                <p className="text-sm font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{event.title}</p>
                <p className="mt-1 text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {new Date(event.startsAt).toLocaleString()}
                  {event.attendeeUserIds.length > 0 ? ` | ${event.attendeeUserIds.length} invited` : ''}
                </p>
              </button>
            ))}
          </div>

          {selectedEvent ? (
            <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: 'rgba(0,229,186,0.25)', background: 'rgba(0,229,186,0.08)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgb(0,229,186)' }}>
                {t('workspace.calendar.selected', 'Selected')}
              </p>
              <p className="mt-1 text-sm font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{selectedEvent.title}</p>
              <p className="mt-1 text-xs" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                {new Date(selectedEvent.startsAt).toLocaleString()} - {new Date(selectedEvent.endsAt).toLocaleTimeString()}
              </p>
              {selectedEvent.attendeeUserIds.length > 0 ? (
                <p className="mt-2 text-xs font-semibold" style={{ color: isLight ? '#047857' : '#34d399' }}>
                  {selectedEvent.attendeeUserIds.length} invited
                </p>
              ) : null}
              {selectedEvent.meetingId ? (
                <button
                  className="mt-3 rounded-xl border px-3 py-2 text-xs font-bold"
                  onClick={() => router.push(`/meet?meetingId=${encodeURIComponent(selectedEvent.meetingId as string)}`)}
                  style={{ borderColor: 'rgba(0,229,186,0.35)', color: 'rgb(0,229,186)' }}
                  type="button"
                >
                  {t('workspace.calendar.openMeeting', 'Open linked meeting')}
                </button>
              ) : null}
              <button
                className="mt-3 w-full rounded-xl border px-3 py-2 text-xs font-black"
                onClick={() => handleCancelClick(selectedEvent)}
                style={{
                  background: isLight ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.24)',
                  borderColor: isLight ? 'rgba(239,68,68,0.32)' : 'rgba(248,113,113,0.35)',
                  color: isLight ? '#b91c1c' : '#fca5a5',
                }}
                type="button"
              >
                {t('workspace.calendar.cancelEvent', 'Cancel event')}
              </button>
            </div>
          ) : null}
        </aside>
      </div>

      <ScheduleModal
        defaultDate={currentDate}
        events={events}
        isLight={isLight}
        meetings={meetings}
        people={people}
        onClose={() => setScheduleModalOpen(false)}
        onSave={async (payload) => {
          const response = await fetch('/api/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (!response.ok) {
            throw new Error('Unable to create event.');
          }
          await loadCalendar();
        }}
        open={scheduleModalOpen}
      />

      {cancelDialog ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <button
            aria-label="Close cancel event dialog"
            className="absolute inset-0 bg-black/55"
            onClick={() => setCancelDialog(null)}
            type="button"
          />
          <div
            className="relative w-full max-w-md rounded-3xl border p-5 shadow-2xl"
            style={{
              background: isLight ? '#ffffff' : '#111827',
              borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.12)',
            }}
          >
            <h3 className="text-xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {cancelDialog.type === 'confirm'
                ? t('workspace.calendar.cancelConfirmTitle', 'Cancel event?')
                : t('workspace.calendar.hostOnlyTitle', 'Host only')}
            </h3>
            <p className="mt-2 text-sm leading-6" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
              {cancelDialog.type === 'confirm'
                ? t(
                  'workspace.calendar.cancelConfirmBody',
                  `Cancel ${cancelDialog.event.title} for everyone invited?`,
                )
                : cancelDialog.message}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                className="rounded-xl border px-4 py-2 text-sm font-bold"
                onClick={() => setCancelDialog(null)}
                style={{
                  borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)',
                  color: isLight ? '#334155' : '#e5e7eb',
                }}
                type="button"
              >
                {cancelDialog.type === 'confirm' ? t('workspace.common.keep', 'Keep') : t('workspace.common.close', 'Close')}
              </button>
              {cancelDialog.type === 'confirm' ? (
                <button
                  className="rounded-xl px-4 py-2 text-sm font-black"
                  disabled={cancelingEventId === cancelDialog.event.id}
                  onClick={() => void confirmCancelEvent(cancelDialog.event)}
                  style={{
                    background: cancelingEventId === cancelDialog.event.id ? 'rgba(248,113,113,0.5)' : '#ef4444',
                    color: '#ffffff',
                  }}
                  type="button"
                >
                  {cancelingEventId === cancelDialog.event.id
                    ? t('workspace.calendar.canceling', 'Canceling...')
                    : t('workspace.calendar.cancelNow', 'Cancel event')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
