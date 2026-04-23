'use client';

import React from 'react';
import { useAppTranslations } from '@/lib/utils/translations';
import type { CalendarEvent, Meeting, WorkspaceUser } from '@/types/domain/workspace';

type DraftEventPayload = {
  title: string;
  startsAt: string;
  endsAt: string;
  ownerUserId: string;
  meetingId: string | null;
  attendeeUserIds: string[];
  createMeeting: boolean;
  color: CalendarEvent['color'];
};

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
  const [title, setTitle] = React.useState('');
  const [date, setDate] = React.useState(() => new Date(defaultDate).toISOString().slice(0, 10));
  const [time, setTime] = React.useState('10:00');
  const [durationMinutes, setDurationMinutes] = React.useState('60');
  const [color, setColor] = React.useState<CalendarEvent['color']>('blue');
  const [linkedMeetingId, setLinkedMeetingId] = React.useState<string>('none');
  const [inviteWholeTeam, setInviteWholeTeam] = React.useState(false);
  const [selectedInviteeIds, setSelectedInviteeIds] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!open) return;
    setError('');
    setTitle('');
    setDate(new Date(defaultDate).toISOString().slice(0, 10));
    setTime('10:00');
    setDurationMinutes('60');
    setColor('blue');
    setLinkedMeetingId('none');
    setInviteWholeTeam(false);
    setSelectedInviteeIds([]);
    setSaving(false);
  }, [defaultDate, open]);

  if (!open) return null;

  const proposedStart = new Date(`${date}T${time}:00`);
  const duration = Math.max(15, Number.parseInt(durationMinutes, 10) || 60);
  const proposedEnd = new Date(proposedStart.getTime() + duration * 60000);
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

    setSaving(true);
    setError('');
    try {
      await onSave({
        title: title.trim(),
        startsAt: proposedStart.toISOString(),
        endsAt: proposedEnd.toISOString(),
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
        className="relative z-[91] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border p-5 md:p-6"
        style={{
          background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(10,15,24,0.95)',
          borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.12)',
        }}
      >
        <h3 className="text-xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
          {t('workspace.calendar.modal.title', 'Schedule event')}
        </h3>
        <p className="mt-1 text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
          {t('workspace.calendar.modal.subtitle', 'Add a new calendar event and optionally attach it to a meeting room.')}
        </p>

        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{t('workspace.calendar.modal.fields.title', 'Title')}</span>
            <input
              className="h-10 rounded-xl border px-3 text-sm outline-none"
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t('workspace.calendar.modal.fields.titlePlaceholder', 'Eco planning sync')}
              style={{
                background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
                borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
                color: isLight ? '#0f172a' : '#ffffff',
              }}
              value={title}
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{t('workspace.calendar.modal.fields.date', 'Date')}</span>
              <input
                className="h-10 rounded-xl border px-3 text-sm outline-none"
                onChange={(event) => setDate(event.target.value)}
                style={{
                  background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
                  borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
                  color: isLight ? '#0f172a' : '#ffffff',
                }}
                type="date"
                value={date}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{t('workspace.calendar.modal.fields.startTime', 'Start time')}</span>
              <input
                className="h-10 rounded-xl border px-3 text-sm outline-none"
                onChange={(event) => setTime(event.target.value)}
                style={{
                  background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
                  borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
                  color: isLight ? '#0f172a' : '#ffffff',
                }}
                type="time"
                value={time}
              />
            </label>
            <label className="grid gap-1.5">
              <span className="text-xs font-bold" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{t('workspace.calendar.modal.fields.duration', 'Duration')}</span>
              <select
                className="h-10 rounded-xl border px-3 text-sm outline-none"
                onChange={(event) => setDurationMinutes(event.target.value)}
                style={{
                  background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
                  borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
                  color: isLight ? '#0f172a' : '#ffffff',
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

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{t('workspace.calendar.modal.fields.color', 'Event color')}</span>
              <select
                className="h-10 rounded-xl border px-3 text-sm outline-none"
                onChange={(event) => setColor(event.target.value as CalendarEvent['color'])}
                style={{
                  background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
                  borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
                  color: isLight ? '#0f172a' : '#ffffff',
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
              <span className="text-xs font-bold" style={{ color: isLight ? '#334155' : '#cbd5e1' }}>{t('workspace.calendar.modal.fields.linkedMeeting', 'Linked meeting')}</span>
              <select
                className="h-10 rounded-xl border px-3 text-sm outline-none"
                onChange={(event) => setLinkedMeetingId(event.target.value)}
                style={{
                  background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
                  borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
                  color: isLight ? '#0f172a' : '#ffffff',
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

          <div className="rounded-2xl border p-4" style={{ borderColor: isLight ? 'rgba(15,23,42,0.10)' : 'rgba(255,255,255,0.10)', background: isLight ? 'rgba(248,250,252,0.82)' : 'rgba(255,255,255,0.03)' }}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em]" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {t('workspace.calendar.modal.invites.title', 'Invite')}
                </p>
                <p className="mt-1 text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
                  {t('workspace.calendar.modal.invites.subtitle', 'Selected people get this event in their calendar and activity feed.')}
                </p>
              </div>
              <button
                aria-pressed={inviteWholeTeam}
                className="rounded-xl border px-3 py-2 text-xs font-bold"
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
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {teamInvitees.map((person) => {
                  const selected = selectedInviteeIds.includes(person.id);
                  return (
                    <button
                      aria-pressed={selected}
                      className="flex items-center gap-3 rounded-xl border px-3 py-2 text-left"
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
                        className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black"
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
              <p className="mt-3 rounded-xl border px-3 py-2 text-xs font-semibold" style={{ borderColor: 'rgba(0,229,186,0.22)', color: 'rgb(0,161,127)' }}>
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
          <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error === 'Please add an event title.'
              ? t('workspace.calendar.modal.errors.title', 'Please add an event title.')
              : error === 'Please choose a valid date and time.'
                ? t('workspace.calendar.modal.errors.datetime', 'Please choose a valid date and time.')
                : error === 'Unable to create event right now.'
                  ? t('workspace.calendar.modal.errors.create', 'Unable to create event right now.')
                  : error}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            className="rounded-xl border px-4 py-2 text-sm font-bold"
            onClick={onClose}
            style={{
              background: isLight ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.05)',
              borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)',
              color: isLight ? '#334155' : '#cbd5e1',
            }}
            type="button"
          >
            {t('workspace.calendar.modal.cancel', 'Cancel')}
          </button>
          <button
            className="rounded-xl px-4 py-2 text-sm font-black"
            disabled={saving}
            onClick={() => void submit()}
            style={{
              background: saving ? 'rgba(0,229,186,0.2)' : 'rgba(0,229,186,0.92)',
              color: '#041110',
            }}
            type="button"
          >
            {saving ? t('workspace.calendar.modal.saving', 'Saving...') : t('workspace.calendar.modal.save', 'Save event')}
          </button>
        </div>
      </div>
    </div>
  );
}
