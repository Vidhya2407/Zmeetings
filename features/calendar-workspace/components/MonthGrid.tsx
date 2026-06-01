'use client';

import type { CalendarEvent } from '@/types/domain/workspace';
import type { CalendarView } from '@/lib/stores/calendarStore';
import { useAppTranslations } from '@/lib/utils/translations';

const EVENT_COLORS: Record<CalendarEvent['color'], { bg: string; border: string; text: string }> = {
  blue: { bg: 'rgba(96,165,250,0.16)', border: 'rgba(96,165,250,0.35)', text: '#93c5fd' },
  green: { bg: 'rgba(16,185,129,0.14)', border: 'rgba(16,185,129,0.35)', text: '#34d399' },
  amber: { bg: 'rgba(251,191,36,0.14)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24' },
  purple: { bg: 'rgba(196,132,252,0.14)', border: 'rgba(196,132,252,0.35)', text: '#c084fc' },
};

function sameDay(isoA: string, isoB: string) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function MonthGrid({
  isLight,
  currentDate,
  events,
  view,
  onSelectEvent,
}: {
  isLight: boolean;
  currentDate: string;
  events: CalendarEvent[];
  view: CalendarView;
  onSelectEvent: (event: CalendarEvent) => void;
}) {
  const { t } = useAppTranslations();
  const date = new Date(currentDate);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const daysInMonth = end.getDate();
  const leadingBlanks = start.getDay();

  if (view === 'week') {
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekDays = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(weekStart);
      day.setDate(weekStart.getDate() + index);
      return day;
    });

    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {weekDays.map((day) => {
          const dayEvents = events.filter((event) => sameDay(event.startsAt, day.toISOString()));
          return (
            <article
              key={day.toISOString()}
              className="rounded-2xl border p-4"
              style={{
                background: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.04)',
                borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
              }}
            >
              <p className="text-xs font-black uppercase tracking-[0.2em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                {day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
              </p>
              <div className="mt-3 space-y-3">
                {dayEvents.length === 0 ? (
                  <p className="text-xs" style={{ color: isLight ? '#94a3b8' : '#64748b' }}>{t('workspace.calendar.noEvents', 'No events')}</p>
                ) : (
                  dayEvents.map((event) => {
                    const tone = EVENT_COLORS[event.color];
                    return (
                      <button
                        key={event.id}
                        className="w-full rounded-xl border px-3 py-2 text-left"
                        onClick={() => onSelectEvent(event)}
                        style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
                        type="button"
                      >
                        <p className="text-xs font-bold">{event.title}</p>
                        <p className="mt-1 text-[10px] opacity-80">{new Date(event.startsAt).toLocaleTimeString()}</p>
                      </button>
                    );
                  })
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  return (
    <div
      className="w-full overflow-x-auto rounded-3xl border"
      style={{
        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b" style={{ borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label) => (
            <div key={label} className="flex items-center px-3 py-3 text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
              {t(`workspace.calendar.days.${label.toLowerCase()}`, label)}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {Array.from({ length: leadingBlanks }).map((_, index) => (
            <div key={`blank-${index}`} className="min-h-28 border-r border-b" style={{ borderColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)' }} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, index) => {
            const day = new Date(date.getFullYear(), date.getMonth(), index + 1);
            const dayEvents = events.filter((event) => sameDay(event.startsAt, day.toISOString()));
            const isToday = sameDay(day.toISOString(), new Date().toISOString());

            return (
              <div
                key={day.toISOString()}
                className="min-h-28 border-r border-b px-2 py-2"
                style={{ borderColor: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.05)' }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-black"
                    style={{
                      background: isToday ? 'rgba(0,229,186,0.2)' : 'transparent',
                      color: isToday ? 'rgb(0,229,186)' : (isLight ? '#334155' : '#cbd5e1'),
                    }}
                  >
                    {index + 1}
                  </span>
                </div>

                <div className="space-y-2">
                  {dayEvents.slice(0, 3).map((event) => {
                    const tone = EVENT_COLORS[event.color];
                    return (
                      <button
                        key={event.id}
                        className="w-full rounded-lg border px-2 py-1 text-left"
                        onClick={() => onSelectEvent(event)}
                        style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
                        type="button"
                      >
                        <p className="truncate text-[10px] font-bold">{event.title}</p>
                      </button>
                    );
                  })}
                  {dayEvents.length > 3 ? (
                    <p className="text-[10px] font-bold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                      +{dayEvents.length - 3} {t('workspace.calendar.more', 'more')}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
