'use client';

import Link from 'next/link';
import type { Meeting } from '@/types/domain/workspace';

export default function UpcomingMeetingsList({
  isLight,
  meetings,
  activeMeetingId,
  onSelectMeeting,
  locale,
  title,
  openCalendarLabel,
  attendingLabel,
}: {
  isLight: boolean;
  meetings: Meeting[];
  activeMeetingId: string | null;
  onSelectMeeting: (meetingId: string) => void;
  locale: string;
  title: string;
  openCalendarLabel: string;
  attendingLabel: string;
}) {
  return (
    <section
      className="rounded-3xl border p-5"
      style={{
        background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
          {title}
        </h2>
        <Link className="text-xs font-bold" href="/calendar" style={{ color: 'rgb(0,229,186)' }}>
          {openCalendarLabel}
        </Link>
      </div>
      <div className="space-y-2">
        {meetings.map((meeting) => (
          <button
            key={meeting.id}
            className="w-full rounded-2xl border px-3 py-2.5 text-left"
            onClick={() => onSelectMeeting(meeting.id)}
            style={{
              background: meeting.id === activeMeetingId
                ? 'rgba(0,229,186,0.16)'
                : (isLight ? 'rgba(248,250,252,0.9)' : 'rgba(255,255,255,0.03)'),
              borderColor: meeting.id === activeMeetingId
                ? 'rgba(0,229,186,0.35)'
                : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.06)'),
            }}
            type="button"
          >
            <p className="text-sm font-bold" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {meeting.title}
            </p>
            <p className="mt-1 text-xs" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
              {new Date(meeting.startsAt).toLocaleString(locale)} | {meeting.attendeesCount} {attendingLabel}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}
