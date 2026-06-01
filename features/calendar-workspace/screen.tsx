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
  const { data: session, status: sessionStatus } = useSession();
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
  const viewRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const upcomingRefs = React.useRef<Array<HTMLButtonElement | null>>([]);
  const viewOptions = ['month', 'week'] as const;

  const currentCalendarUserId = React.useMemo(() => {
    if (!session?.user?.id) return null;
    return session.user.id === 'demo-user' ? 'u5' : session.user.id;
  }, [session?.user?.id]);

  React.useEffect(() => {
    if (sessionStatus === 'unauthenticated') {
      router.replace(`/login?next=${encodeURIComponent('/calendar')}`);
    }
  }, [router, sessionStatus]);

  const loadCalendar = React.useCallback(async () => {
    if (sessionStatus !== 'authenticated') {
      return;
    }

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
  }, [router, sessionStatus, setEvents, setLoading]);

  React.useEffect(() => {
    if (sessionStatus === 'authenticated') {
      void loadCalendar();
      return;
    }

    setLoading(sessionStatus === 'loading');
  }, [loadCalendar, sessionStatus, setLoading]);

  const filteredEvents = React.useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) => event.title.toLowerCase().includes(query));
  }, [events, globalSearch]);
  const visibleUpcomingEvents = React.useMemo(() => filteredEvents.slice(0, 5), [filteredEvents]);
  const selectedUpcomingIndex = visibleUpcomingEvents.findIndex((event) => event.id === selectedEvent?.id);
  const surfaceGlow = isLight ? '0 18px 42px rgba(15,23,42,0.06)' : '0 18px 40px rgba(0,0,0,0.12)';
  const skeletonBase = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const skeletonSoft = isLight ? 'rgba(15,23,42,0.05)' : 'rgba(255,255,255,0.05)';

  const calendarLabel = React.useMemo(() => {
    const date = new Date(currentDate);
    if (view === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      const sameMonth = weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear();
      if (sameMonth) {
        return `${weekStart.toLocaleDateString(undefined, { month: 'long' })} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
      }
      return `${weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [currentDate, view]);

  const shiftCalendar = (delta: number) => {
    const date = new Date(currentDate);
    if (view === 'week') {
      date.setDate(date.getDate() + (delta * 7));
    } else {
      date.setMonth(date.getMonth() + delta);
    }
    setCurrentDate(date.toISOString());
  };

  const handleViewKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + viewOptions.length) % viewOptions.length;
    } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % viewOptions.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = viewOptions.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    setView(viewOptions[nextIndex]);
    viewRefs.current[nextIndex]?.focus();
  };

  const handleUpcomingKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!visibleUpcomingEvents.length) {
      return;
    }

    let nextIndex: number | null = null;

    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      nextIndex = (index + 1) % visibleUpcomingEvents.length;
    } else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      nextIndex = (index - 1 + visibleUpcomingEvents.length) % visibleUpcomingEvents.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = visibleUpcomingEvents.length - 1;
    }

    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    setSelectedEvent(visibleUpcomingEvents[nextIndex]);
    upcomingRefs.current[nextIndex]?.focus();
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

  if (sessionStatus !== 'authenticated') {
    return (
      <div className="min-w-0 space-y-6">
        <section
          className="rounded-[30px] border p-6"
          style={{
            background: isLight
              ? 'linear-gradient(180deg,rgba(255,255,255,0.94) 0%,rgba(246,250,249,0.94) 100%)'
              : 'linear-gradient(180deg,rgba(15,23,42,0.52) 0%,rgba(8,20,24,0.52) 100%)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            boxShadow: surfaceGlow,
          }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'rgb(0,229,186)' }}>
              {t('workspace.calendar.eyebrow', 'Calendar')}
            </p>
            <h2 className="mt-2 text-[2rem] font-black tracking-[-0.03em]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {t('workspace.calendar.title', 'Plan and optimize team schedules')}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
              {t('workspace.calendar.loading', 'Loading events...')}
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <section
        className="rounded-[30px] border p-6"
        style={{
          background: isLight
            ? 'linear-gradient(180deg,rgba(255,255,255,0.94) 0%,rgba(246,250,249,0.94) 100%)'
            : 'linear-gradient(180deg,rgba(15,23,42,0.52) 0%,rgba(8,20,24,0.52) 100%)',
          borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
          boxShadow: surfaceGlow,
        }}
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.24em]" style={{ color: 'rgb(0,229,186)' }}>
              {t('workspace.calendar.eyebrow', 'Calendar')}
            </p>
            <h2 className="mt-2 text-[2rem] font-black tracking-[-0.03em]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {t('workspace.calendar.title', 'Plan and optimize team schedules')}
            </h2>
            <p className="mt-3 max-w-2xl text-[15px] leading-7" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
              {t('workspace.calendar.subtitle', 'Create events, avoid conflicts, and launch meetings from one timeline.')}
            </p>
          </div>
          <button
            className="brand-gradient-button rounded-2xl px-6 py-3 text-sm font-black uppercase tracking-[0.12em]"
            onClick={() => setScheduleModalOpen(true)}
            type="button"
          >
            {t('workspace.calendar.newEvent', 'Schedule')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            aria-label={t('workspace.calendar.prev', 'Previous')}
            className="inline-flex items-center gap-2 rounded-2xl border bg-[var(--nav-bg)] border-[var(--nav-border)] text-[var(--nav-color)] px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            onClick={() => shiftCalendar(-1)}
            style={{
              '--nav-bg': isLight ? 'rgba(0,229,186,0.08)' : 'rgba(0,229,186,0.12)',
              '--nav-border': 'rgba(0,229,186,0.24)',
              '--nav-color': isLight ? '#047857' : '#5eead4',
              '--nav-hover-bg': 'rgba(0,229,186,0.14)',
              '--nav-hover-border': 'rgba(0,229,186,0.35)',
              '--nav-hover-color': 'rgb(0,229,186)',
            } as React.CSSProperties}
            title={t('workspace.calendar.prev', 'Previous')}
            type="button"
          >
            <span aria-hidden="true" className="text-sm leading-none">&lt;&lt;</span>
            {t('workspace.calendar.prev', 'Prev')}
          </button>
          <p className="rounded-2xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.2em]" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)', color: isLight ? '#334155' : '#cbd5e1' }}>
            {calendarLabel}
          </p>
          <button
            aria-label={t('workspace.calendar.next', 'Next')}
            className="inline-flex items-center gap-2 rounded-2xl border bg-[var(--nav-bg)] border-[var(--nav-border)] text-[var(--nav-color)] px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.12em] transition hover:scale-[1.01] hover:border-[var(--nav-hover-border)] hover:bg-[var(--nav-hover-bg)] hover:text-[var(--nav-hover-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
            onClick={() => shiftCalendar(1)}
            style={{
              '--nav-bg': isLight ? 'rgba(0,229,186,0.08)' : 'rgba(0,229,186,0.12)',
              '--nav-border': 'rgba(0,229,186,0.24)',
              '--nav-color': isLight ? '#047857' : '#5eead4',
              '--nav-hover-bg': 'rgba(0,229,186,0.14)',
              '--nav-hover-border': 'rgba(0,229,186,0.35)',
              '--nav-hover-color': 'rgb(0,229,186)',
            } as React.CSSProperties}
            title={t('workspace.calendar.next', 'Next')}
            type="button"
          >
            {t('workspace.calendar.next', 'Next')}
            <span aria-hidden="true" className="text-sm leading-none">&gt;&gt;</span>
          </button>

          <div aria-label={t('workspace.calendar.viewLabel', 'Calendar view')} className="flex items-center gap-1 sm:ml-auto" role="radiogroup">
            {viewOptions.map((option, index) => (
              <button
                key={option}
                ref={(element) => {
                  viewRefs.current[index] = element;
                }}
                aria-checked={view === option}
                className="rounded-xl px-3.5 py-2.5 text-[11px] font-black uppercase tracking-[0.16em]"
                onClick={() => setView(option)}
                onKeyDown={(event) => handleViewKeyDown(event, index)}
                role="radio"
                style={{
                  background: view === option ? 'rgba(0,229,186,0.16)' : 'transparent',
                  color: view === option ? 'rgb(0,229,186)' : (isLight ? '#64748b' : '#94a3b8'),
                }}
                tabIndex={view === option ? 0 : -1}
                type="button"
              >
                {t(`workspace.calendar.view.${option}`, option)}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 space-y-4">
          {loading ? (
            <div
              className="rounded-[28px] border p-6"
              style={{
                background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)',
                borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="h-3 w-28 rounded-full" style={{ background: skeletonBase }} />
                  <div className="mt-3 h-7 w-52 rounded-full" style={{ background: skeletonSoft }} />
                </div>
                <div className="h-10 w-28 rounded-2xl" style={{ background: skeletonSoft }} />
              </div>
              <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={`calendar-loading-card-${index}`}
                    className="rounded-2xl border p-4"
                    style={{
                      background: isLight ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.03)',
                      borderColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="h-3 w-20 rounded-full" style={{ background: skeletonBase }} />
                    <div className="mt-4 space-y-2.5">
                      <div className="h-10 rounded-xl" style={{ background: skeletonSoft }} />
                      <div className="h-10 rounded-xl" style={{ background: skeletonSoft }} />
                      <div className="h-10 rounded-xl" style={{ background: skeletonSoft }} />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-5 text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                {t('workspace.calendar.loading', 'Loading events...')}
              </p>
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
          className="rounded-[28px] border p-5 xl:sticky xl:top-6"
          style={{
            background: isLight
              ? 'linear-gradient(180deg,rgba(255,255,255,0.94) 0%,rgba(247,250,252,0.94) 100%)'
              : 'linear-gradient(180deg,rgba(15,23,42,0.48) 0%,rgba(8,20,24,0.48) 100%)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            boxShadow: isLight ? '0 16px 38px rgba(15,23,42,0.05)' : '0 16px 36px rgba(0,0,0,0.10)',
          }}
        >
          <h3 className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
            {t('workspace.calendar.upcoming', 'Upcoming')}
          </h3>

          <div aria-label={t('workspace.calendar.upcoming', 'Upcoming')} className="mt-4 space-y-3">
            {loading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`upcoming-loading-${index}`}
                  className="rounded-[22px] border px-4 py-4"
                  style={{
                    background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.03)',
                    borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
                  }}
                >
                  <div className="h-4 w-28 rounded-full" style={{ background: skeletonBase }} />
                  <div className="mt-3 h-3 w-full rounded-full" style={{ background: skeletonSoft }} />
                  <div className="mt-2 h-3 w-3/4 rounded-full" style={{ background: skeletonSoft }} />
                </div>
              ))
            ) : (
              visibleUpcomingEvents.map((event, index) => (
                <button
                  key={event.id}
                  ref={(element) => {
                    upcomingRefs.current[index] = element;
                  }}
                  aria-pressed={selectedEvent?.id === event.id}
                  className="w-full rounded-[22px] border px-4 py-4 text-left transition"
                  onClick={() => setSelectedEvent(event)}
                  onKeyDown={(keyboardEvent) => handleUpcomingKeyDown(keyboardEvent, index)}
                  style={{
                    background: selectedEvent?.id === event.id
                      ? (isLight ? 'rgba(236,253,245,0.96)' : 'rgba(13,148,136,0.12)')
                      : (isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.03)'),
                    borderColor: selectedEvent?.id === event.id
                      ? 'rgba(0,229,186,0.32)'
                      : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)'),
                    boxShadow: selectedEvent?.id === event.id
                      ? (isLight ? '0 10px 24px rgba(16,185,129,0.10)' : '0 10px 24px rgba(13,148,136,0.14)')
                      : 'none',
                  }}
                  tabIndex={selectedUpcomingIndex >= 0 ? (selectedUpcomingIndex === index ? 0 : -1) : (index === 0 ? 0 : -1)}
                  type="button"
                >
                  <p className="text-sm font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{event.title}</p>
                  <p className="mt-1 text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                    {new Date(event.startsAt).toLocaleString()}
                    {event.attendeeUserIds.length > 0 ? ` | ${event.attendeeUserIds.length} invited` : ''}
                  </p>
                </button>
              ))
            )}
          </div>

          {selectedEvent && !loading ? (
            <div className="mt-5 rounded-2xl border p-4" style={{ borderColor: 'rgba(0,229,186,0.25)', background: 'rgba(0,229,186,0.08)' }}>
              <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: 'rgb(0,229,186)' }}>
                {t('workspace.calendar.selected', 'Selected')}
              </p>
              <p className="mt-2 text-base font-black tracking-[-0.01em]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{selectedEvent.title}</p>
              <p className="mt-2 text-sm leading-6" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>
                {new Date(selectedEvent.startsAt).toLocaleString()} - {new Date(selectedEvent.endsAt).toLocaleTimeString()}
              </p>
              {selectedEvent.timezone ? (
                <p className="mt-1 text-[11px] font-semibold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {selectedEvent.timezone}
                </p>
              ) : null}
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
            <div className="mt-5 flex justify-end gap-3">
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
