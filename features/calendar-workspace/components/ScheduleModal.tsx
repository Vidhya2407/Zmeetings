'use client';

import React from 'react';
import { useAppTranslations } from '@/lib/utils/translations';
import type { CalendarEvent, Meeting, WorkspaceUser } from '@/types/domain/workspace';

type DraftEventPayload = {
  title: string;
  startsAt: string;
  endsAt: string;
  timezone: string | null;
  ownerUserId: string;
  meetingId: string | null;
  attendeeUserIds: string[];
  createMeeting: boolean;
  color: CalendarEvent['color'];
};

const COMMON_TIMEZONES = [
  'UTC',
  'Europe/Berlin',
  'Europe/London',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function toLocalDateInputValue(dateLike: string | Date) {
  const date = dateLike instanceof Date ? dateLike : new Date(dateLike);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function overlaps(startA: Date, endA: Date, startB: Date, endB: Date) {
  return startA < endB && startB < endA;
}

export default function ScheduleModal({
  isLight,
  open,
  events,
  meetings,
  people,
  defaultDate,
  onClose,
  onSave,
}: {
  isLight: boolean;
  open: boolean;
  events: CalendarEvent[];
  meetings: Meeting[];
  people: WorkspaceUser[];
  defaultDate: string;
  onClose: () => void;
  onSave: (payload: DraftEventPayload) => Promise<void>;
}) {
  const { t } = useAppTranslations();
  const dateInputRef = React.useRef<HTMLInputElement | null>(null);
  const detectedTimezone = React.useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', []);
  const timezoneOptions = React.useMemo(() => Array.from(new Set([detectedTimezone, ...COMMON_TIMEZONES])), [detectedTimezone]);
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(() => toLocalDateInputValue(defaultDate));
  const [time, setTime] = React.useState('10:00');
  const [durationMinutes, setDurationMinutes] = React.useState('60');
  const [timezone, setTimezone] = React.useState(detectedTimezone);
  const [color, setColor] = React.useState<CalendarEvent['color']>('blue');
  const [linkedMeetingId, setLinkedMeetingId] = React.useState<string>('none');
  const [inviteWholeTeam, setInviteWholeTeam] = React.useState(false);
  const [selectedInviteeIds, setSelectedInviteeIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const modalBg = isLight
    ? 'linear-gradient(180deg,rgba(255,255,255,0.98) 0%,rgba(244,249,248,0.98) 100%)'
    : 'linear-gradient(180deg,rgba(9,15,24,0.98) 0%,rgba(8,20,24,0.98) 100%)';
  const borderColor = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.10)';
  const fieldBg = isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.045)';
  const fieldBorder = isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)';
  const titleColor = isLight ? '#0f172a' : '#ffffff';
  const bodyColor = isLight ? '#475569' : '#94a3b8';
  const metaColor = isLight ? '#64748b' : '#a8b7cb';

  React.useEffect(() => {
    if (!open) return;
    setError('');
    setTitle('');
    setDate(toLocalDateInputValue(defaultDate));
    setTime('10:00');
    setDurationMinutes('60');
    setTimezone(detectedTimezone);
    setColor('blue');
    setLinkedMeetingId('none');
    setInviteWholeTeam(false);
    setSelectedInviteeIds([]);
    setSaving(false);
  }, [defaultDate, detectedTimezone, open]);

  if (!open) return null;

  const proposedStart = new Date(`${date}T${time}:00`);
  const duration = Math.max(15, Number.parseInt(durationMinutes, 10) || 60);
  const proposedEnd = new Date(proposedStart.getTime() + duration * 60000);
  const today = toLocalDateInputValue(new Date());
  const selectedDateIsPast = date < today;
  const teamInvitees = people.filter((person) => person.id !== 'u5');
  const attendeeUserIds = inviteWholeTeam ? teamInvitees.map((person) => person.id) : selectedInviteeIds;
  const conflictingEvents = events.filter((event) => overlaps(
    proposedStart,
    proposedEnd,
    new Date(event.startsAt),
    new Date(event.endsAt),
  ));

  const submit = async () => {
    if (!title.trim()) {
      setError('Please add an event title.');
      return;
    }

    if (Number.isNaN(proposedStart.getTime()) || Number.isNaN(proposedEnd.getTime())) {
      setError('Please choose a valid date and time.');
      return;
    }
    if (selectedDateIsPast) {
      setError('Please choose today or a future date.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        startsAt: proposedStart.toISOString(),
        endsAt: proposedEnd.toISOString(),
        timezone,
        ownerUserId: 'u5',
        meetingId: linkedMeetingId === 'none' || linkedMeetingId === 'new' ? null : linkedMeetingId,
        createMeeting: linkedMeetingId === 'new',
        attendeeUserIds,
        color,
      });
      onClose();
    } catch {
      setError('Unable to create event right now.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <button className="absolute inset-0 bg-black/55" onClick={onClose} type="button" />
      <div
        className="relative z-[91] max-h-[90vh] w-full max-w-[860px] overflow-y-auto rounded-[32px] border p-6 md:p-7"
        style={{
          background: modalBg,
          borderColor,
          boxShadow: isLight ? '0 30px 90px rgba(15,23,42,0.16)' : '0 34px 90px rgba(0,0,0,0.34)',
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[540px]">
            <p className="inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em]" style={{ color: isLight ? '#047857' : '#5eead4', borderColor: isLight ? 'rgba(4,120,87,0.18)' : 'rgba(94,234,212,0.18)', background: isLight ? 'rgba(236,253,245,0.92)' : 'rgba(13,148,136,0.14)' }}>
              {t('workspace.calendar.modal.title', 'Schedule event')}
            </p>
            <h3 className="mt-3 text-[1.9rem] font-black tracking-[-0.03em]" style={{ color: titleColor }}>
              {t('workspace.calendar.modal.title', 'Schedule event')}
            </h3>
            <p className="mt-2 text-sm leading-7" style={{ color: bodyColor }}>
              {t('workspace.calendar.modal.subtitle', 'Add a new calendar event and optionally attach it to a meeting room.')}
            </p>
          </div>
          <div className="rounded-2xl border px-4 py-3" style={{ borderColor, background: fieldBg }}>
            <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: metaColor }}>
              {t('workspace.calendar.modal.fields.timezone', 'Time zone')}
            </p>
            <p className="mt-1 text-sm font-bold" style={{ color: titleColor }}>{timezone}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6">
          <label className="grid gap-1.5">
            <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.title', 'Title')}</span>
            <input
              className="h-12 rounded-2xl border px-4 text-[15px] font-medium outline-none"
              onChange={(event) => setTitle(event.target.value)}
              style={{
                background: fieldBg,
                borderColor: fieldBorder,
                color: titleColor,
              }}
              value={title}
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.date', 'Date')}</span>
              <div className="flex gap-2">
                <input
                  ref={dateInputRef}
                  className="h-12 flex-1 rounded-2xl border px-4 text-[15px] font-medium outline-none"
                  min={today}
                  onChange={(event) => setDate(event.target.value)}
                  style={{
                    background: fieldBg,
                    borderColor: selectedDateIsPast
                      ? 'rgba(239,68,68,0.35)'
                      : fieldBorder,
                    color: titleColor,
                  }}
                  type="date"
                  value={date}
                />
                <button
                  type="button"
                  onClick={() => dateInputRef.current?.showPicker?.()}
                  className="grid h-12 w-12 place-items-center rounded-2xl border transition hover:scale-[1.02]"
                  style={{
                    background: fieldBg,
                    borderColor: fieldBorder,
                    color: titleColor,
                  }}
                  aria-label={t('workspace.calendar.modal.fields.openCalendar', 'Open calendar picker')}
                  title={t('workspace.calendar.modal.fields.openCalendar', 'Open calendar picker')}
                >
                  <CalendarIcon />
                </button>
              </div>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.startTime', 'Start time')}</span>
              <input
                className="h-12 rounded-2xl border px-4 text-[15px] font-medium outline-none"
                onChange={(event) => setTime(event.target.value)}
                style={{
                  background: fieldBg,
                  borderColor: fieldBorder,
                  color: titleColor,
                }}
                type="time"
                value={time}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.duration', 'Duration')}</span>
              <select
                className="h-12 rounded-2xl border px-4 text-[15px] font-medium outline-none"
                onChange={(event) => setDurationMinutes(event.target.value)}
                style={{
                  background: fieldBg,
                  borderColor: fieldBorder,
                  color: titleColor,
                }}
                value={durationMinutes}
              >
                <option value="30">{t('workspace.calendar.modal.duration.30', '30 min')}</option>
                <option value="45">{t('workspace.calendar.modal.duration.45', '45 min')}</option>
                <option value="60">{t('workspace.calendar.modal.duration.60', '60 min')}</option>
                <option value="90">{t('workspace.calendar.modal.duration.90', '90 min')}</option>
                <option value="120">{t('workspace.calendar.modal.duration.120', '120 min')}</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.timezone', 'Time zone')}</span>
              <select
                className="h-12 rounded-2xl border px-4 text-[15px] font-medium outline-none"
                onChange={(event) => setTimezone(event.target.value)}
                style={{
                  background: fieldBg,
                  borderColor: fieldBorder,
                  color: titleColor,
                }}
                value={timezone}
              >
                {timezoneOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.color', 'Event color')}</span>
              <select
                className="h-12 rounded-2xl border px-4 text-[15px] font-medium outline-none"
                onChange={(event) => setColor(event.target.value as CalendarEvent['color'])}
                style={{
                  background: fieldBg,
                  borderColor: fieldBorder,
                  color: titleColor,
                }}
                value={color}
              >
                <option value="blue">{t('workspace.calendar.modal.colors.blue', 'Blue')}</option>
                <option value="green">{t('workspace.calendar.modal.colors.green', 'Green')}</option>
                <option value="amber">{t('workspace.calendar.modal.colors.amber', 'Amber')}</option>
                <option value="purple">{t('workspace.calendar.modal.colors.purple', 'Purple')}</option>
              </select>
            </label>
            <label className="grid gap-1.5">
              <span className="text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: metaColor }}>{t('workspace.calendar.modal.fields.linkedMeeting', 'Linked meeting')}</span>
              <select
                className="h-12 rounded-2xl border px-4 text-[15px] font-medium outline-none"
                onChange={(event) => setLinkedMeetingId(event.target.value)}
                style={{
                  background: fieldBg,
                  borderColor: fieldBorder,
                  color: titleColor,
                }}
                value={linkedMeetingId}
              >
                <option value="none">{t('workspace.calendar.modal.none', 'None')}</option>
                <option value="new">{t('workspace.calendar.modal.createMeeting', 'Create new meeting room')}</option>
                {meetings.map((meeting) => (
                  <option key={meeting.id} value={meeting.id}>{meeting.title}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="rounded-[26px] border p-5" style={{ borderColor, background: fieldBg }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em]" style={{ color: metaColor }}>
                  {t('workspace.calendar.modal.invites.title', 'Invite')}
                </p>
                <p className="mt-3 text-sm leading-6" style={{ color: bodyColor }}>
                  {t('workspace.calendar.modal.invites.subtitle', 'Selected people get this event in their calendar and activity feed.')}
                </p>
              </div>
              <button
                aria-pressed={inviteWholeTeam}
                className="rounded-2xl border px-4 py-2.5 text-[11px] font-black uppercase tracking-[0.14em]"
                onClick={() => setInviteWholeTeam((value) => !value)}
                style={{
                  background: inviteWholeTeam ? 'rgba(0,229,186,0.16)' : 'transparent',
                  borderColor: inviteWholeTeam ? 'rgba(0,229,186,0.32)' : (isLight ? 'rgba(15,23,42,0.14)' : 'rgba(255,255,255,0.12)'),
                  color: inviteWholeTeam ? 'rgb(0,161,127)' : (isLight ? '#475569' : '#cbd5e1'),
                }}
                type="button"
              >
                {t('workspace.calendar.modal.invites.wholeTeam', 'Whole team')}
              </button>
            </div>

            {!inviteWholeTeam ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {teamInvitees.map((person) => {
                  const selected = selectedInviteeIds.includes(person.id);
                  return (
                    <button
                      aria-pressed={selected}
                      className="flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition"
                      key={person.id}
                      onClick={() => setSelectedInviteeIds((current) => (
                        current.includes(person.id) ? current.filter((id) => id !== person.id) : [...current, person.id]
                      ))}
                      style={{
                        background: selected ? 'rgba(0,229,186,0.12)' : (isLight ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.03)'),
                        borderColor: selected ? 'rgba(0,229,186,0.30)' : (isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.08)'),
                      }}
                      type="button"
                    >
                      <span
                        className="flex h-9 w-9 items-center justify-center rounded-2xl text-[11px] font-black"
                        style={{ background: 'rgba(0,229,186,0.14)', color: 'rgb(0,161,127)' }}
                      >
                        {person.avatarInitials}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{person.name}</span>
                        <span className="block truncate text-[11px]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{person.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold" style={{ borderColor: 'rgba(0,229,186,0.22)', color: 'rgb(0,161,127)' }}>
                {t('workspace.calendar.modal.invites.wholeTeamSelected', 'Everyone on the workspace team will be invited.')}
              </p>
            )}
          </div>
        </div>

        {conflictingEvents.length > 0 ? (
          <div
            className="mt-4 rounded-2xl border px-4 py-3 text-sm"
            style={{
              background: isLight ? 'rgba(254,252,232,0.88)' : 'rgba(251,191,36,0.10)',
              borderColor: isLight ? 'rgba(217,119,6,0.25)' : 'rgba(251,191,36,0.3)',
              color: isLight ? '#92400e' : '#fcd34d',
            }}
          >
            {t('workspace.calendar.modal.conflictPrefix', 'Conflict warning:')} {conflictingEvents.length} {t('workspace.calendar.modal.conflictSuffix', 'overlapping event(s) on this slot.')}
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm leading-6 text-rose-200">
            {error === 'Please add an event title.'
              ? t('workspace.calendar.modal.errors.title', 'Please add an event title.')
              : error === 'Please choose a valid date and time.'
                ? t('workspace.calendar.modal.errors.datetime', 'Please choose a valid date and time.')
                : error === 'Please choose today or a future date.'
                  ? t('workspace.calendar.modal.errors.pastDate', 'Please choose today or a future date.')
                : error === 'Unable to create event right now.'
                  ? t('workspace.calendar.modal.errors.create', 'Unable to create event right now.')
                  : error}
          </div>
        ) : null}

        <div className="mt-6 flex items-center justify-end gap-3 pb-1">
          <button
            className="rounded-2xl border px-5 py-3 text-sm font-bold"
            onClick={onClose}
            style={{
              background: fieldBg,
              borderColor: fieldBorder,
              color: isLight ? '#334155' : '#cbd5e1',
            }}
            type="button"
          >
            {t('workspace.calendar.modal.cancel', 'Cancel')}
          </button>
          <button
            className="brand-gradient-button rounded-2xl px-5 py-3 text-sm font-black uppercase tracking-[0.12em]"
            disabled={saving}
            onClick={() => void submit()}
            type="button"
          >
            {saving ? t('workspace.calendar.modal.saving', 'Saving...') : t('workspace.calendar.modal.save', 'Save event')}
          </button>
        </div>
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
