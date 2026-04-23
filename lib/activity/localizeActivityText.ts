import type { ActivityItem } from '@/types/domain/workspace';

type TranslationFn = (key: string, fallback?: string) => string;

type ActivityTextSource = {
  body: string;
  kind?: ActivityItem['kind'];
  relatedMeetingId?: string | null;
  relatedThreadId?: string | null;
  title: string;
};

function replaceTokens(value: string, tokens: Record<string, string>) {
  return Object.entries(tokens).reduce((current, [token, replacement]) => current.replaceAll(`{${token}}`, replacement), value);
}

export function localizeActivityText(item: ActivityTextSource, t: TranslationFn) {
  const body = item.body.trim();
  const exactBodyKeys: Record<string, { fallback: string; key: string }> = {
    'Your meeting recording is ready to view.': {
      fallback: 'Your meeting recording is ready.',
      key: 'workspace.activity.messages.recordingReady',
    },
    'Mentioned you in Sustainability Group Chat.': {
      fallback: 'Mentioned you in Sustainability Group Chat.',
      key: 'workspace.activity.messages.mentionedGroupChat',
    },
    'Meeting has been rescheduled to 4 PM.': {
      fallback: 'Meeting was moved to 4:00 PM.',
      key: 'workspace.activity.messages.meetingRescheduled',
    },
    'Meeting created and ready for attendees.': {
      fallback: 'Meeting created and ready for attendees.',
      key: 'workspace.activity.messages.meetingCreated',
    },
    'Meeting created successfully.': {
      fallback: 'Meeting created successfully.',
      key: 'workspace.activity.messages.meetingCreatedSuccess',
    },
    'Meeting started and ready for attendees.': {
      fallback: 'Meeting started and ready for attendees.',
      key: 'workspace.activity.messages.meetingStartedReady',
    },
    'Meeting is now live.': {
      fallback: 'Meeting is now live.',
      key: 'workspace.activity.messages.meetingLive',
    },
    'Meeting ended. Post-meeting summary and recording are ready.': {
      fallback: 'Meeting ended. Summary and recording are ready.',
      key: 'workspace.activity.messages.meetingEndedRecordingReady',
    },
  };

  const exactMatch = exactBodyKeys[body];
  if (exactMatch) {
    return {
      body: t(exactMatch.key, exactMatch.fallback),
      title: item.title,
    };
  }

  if (item.kind === 'meeting_recording_ready') {
    return {
      body: t('workspace.activity.messages.recordingReady', 'Your meeting recording is ready.'),
      title: item.title,
    };
  }

  if (item.kind === 'meeting_update' && body.startsWith('Meeting updated:')) {
    return {
      body: t('workspace.activity.messages.meetingUpdated', 'Meeting details were updated.'),
      title: item.title,
    };
  }

  if (item.kind === 'meeting_invite' && body.includes('joined as')) {
    return {
      body: t('workspace.activity.messages.memberJoined', 'A participant joined the meeting.'),
      title: item.title,
    };
  }

  if (item.kind === 'meeting_update' && body.endsWith('left the meeting.')) {
    return {
      body: t('workspace.activity.messages.memberLeft', 'A participant left the meeting.'),
      title: item.title,
    };
  }

  const linkedMeetingMatch = body.match(/^Scheduled and linked to a meeting room for (\d+) invited member\(s\)\.$/);
  if (linkedMeetingMatch) {
    return {
      body: replaceTokens(t('workspace.activity.messages.scheduledWithMeeting', 'Scheduled and linked to a meeting room for {count} invited member(s).'), {
        count: linkedMeetingMatch[1] ?? '0',
      }),
      title: item.title,
    };
  }

  const calendarMatch = body.match(/^Scheduled calendar event for (\d+) invited member\(s\)\.$/);
  if (calendarMatch) {
    return {
      body: replaceTokens(t('workspace.activity.messages.scheduledCalendar', 'Scheduled calendar event for {count} invited member(s).'), {
        count: calendarMatch[1] ?? '0',
      }),
      title: item.title,
    };
  }

  if (item.kind === 'mention') {
    return {
      body: t('workspace.activity.messages.mentionedGroupChat', body),
      title: item.title,
    };
  }

  return {
    body: item.body,
    title: item.title,
  };
}
