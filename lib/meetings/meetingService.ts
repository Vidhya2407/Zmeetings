import { createActivityRepo } from '@/lib/activity/activityRepository';
import {
  addParticipantRepo,
  createMeetingRepo,
  getMeetingRepo,
  listMeetingsRepo,
  patchMeetingRepo,
  removeParticipantRepo,
} from '@/lib/meetings/meetingRepository';
import type { Meeting, MeetingPatchInput, MeetingRole, MeetingServiceResult } from '@/types/domain/meeting';

type MeetingActivityInput = {
  body: string;
  kind: 'meeting_invite' | 'meeting_update' | 'meeting_recording_ready';
  meeting: Meeting;
  priority: 'meeting_now' | 'mention' | 'direct' | 'general';
};

async function emitMeetingActivity(input: MeetingActivityInput) {
  try {
    const activityResult = await createActivityRepo({
      kind: input.kind,
      title: input.meeting.title,
      body: input.body,
      priority: input.priority,
      relatedMeetingId: input.meeting.id,
      relatedThreadId: null,
    });
    return { demoMode: activityResult.demoMode };
  } catch {
    return { demoMode: false };
  }
}

function mergeDemoMode(...flags: boolean[]) {
  return flags.some(Boolean);
}

export async function listMeetingsService(): Promise<MeetingServiceResult<Meeting[]>> {
  const result = await listMeetingsRepo();
  return { demoMode: result.demoMode, value: result.value };
}

export async function getMeetingService(meetingId: string): Promise<MeetingServiceResult<Meeting | null>> {
  const result = await getMeetingRepo(meetingId);
  return { demoMode: result.demoMode, value: result.value };
}

export async function createMeetingService(title: string, hostUserId: string, schedule?: { startsAt?: string; endsAt?: string }): Promise<MeetingServiceResult<Meeting>> {
  const created = await createMeetingRepo(title, hostUserId, schedule);
  const activity = created.demoMode
    ? { demoMode: false }
    : await emitMeetingActivity({
      kind: 'meeting_update',
      meeting: created.value,
      body: 'Meeting created and ready for attendees.',
      priority: 'general',
    });
  return { demoMode: mergeDemoMode(created.demoMode, activity.demoMode), value: created.value };
}

export async function updateMeetingService(
  meetingId: string,
  updates: MeetingPatchInput,
): Promise<MeetingServiceResult<Meeting | null>> {
  const before = await getMeetingRepo(meetingId);
  const updated = await patchMeetingRepo(meetingId, updates);
  if (!updated.value) {
    return { demoMode: mergeDemoMode(before.demoMode, updated.demoMode), value: null };
  }

  const changedFields: string[] = [];
  if (typeof updates.title === 'string' && updates.title !== before.value?.title) changedFields.push('title');
  if (typeof updates.status === 'string' && updates.status !== before.value?.status) changedFields.push('status');
  if (typeof updates.startsAt === 'string' && updates.startsAt !== before.value?.startsAt) changedFields.push('start time');
  if (typeof updates.endsAt === 'string' && updates.endsAt !== before.value?.endsAt) changedFields.push('end time');

  const activity = changedFields.length > 0
    ? (updated.demoMode
      ? { demoMode: false }
      : await emitMeetingActivity({
      kind: 'meeting_update',
      meeting: updated.value,
      body: `Meeting updated: ${changedFields.join(', ')}.`,
      priority: updated.value.status === 'live' ? 'meeting_now' : 'general',
      }))
    : { demoMode: false };

  return { demoMode: mergeDemoMode(before.demoMode, updated.demoMode, activity.demoMode), value: updated.value };
}

export async function startMeetingService(meetingId: string): Promise<MeetingServiceResult<Meeting | null>> {
  const updated = await patchMeetingRepo(meetingId, { status: 'live' });
  if (!updated.value) return { demoMode: updated.demoMode, value: null };
  const activity = updated.demoMode
    ? { demoMode: false }
    : await emitMeetingActivity({
      kind: 'meeting_update',
      meeting: updated.value,
      body: 'Meeting is now live.',
      priority: 'meeting_now',
    });
  return { demoMode: mergeDemoMode(updated.demoMode, activity.demoMode), value: updated.value };
}

export async function endMeetingService(meetingId: string): Promise<MeetingServiceResult<Meeting | null>> {
  const updated = await patchMeetingRepo(meetingId, { status: 'ended' });
  if (!updated.value) return { demoMode: updated.demoMode, value: null };
  const activity = updated.demoMode
    ? { demoMode: false }
    : await emitMeetingActivity({
      kind: 'meeting_recording_ready',
      meeting: updated.value,
      body: 'Meeting ended. Post-meeting summary and recording are ready.',
      priority: 'general',
    });
  return { demoMode: mergeDemoMode(updated.demoMode, activity.demoMode), value: updated.value };
}

export async function joinMeetingService(
  meetingId: string,
  userId: string,
  role: MeetingRole = 'attendee',
): Promise<MeetingServiceResult<Meeting | null>> {
  const before = await getMeetingRepo(meetingId);
  const updated = await addParticipantRepo(meetingId, userId, role);
  if (!updated.value) return { demoMode: mergeDemoMode(before.demoMode, updated.demoMode), value: null };

  const alreadyParticipant = before.value?.participants.some((participant) => participant.userId === userId) ?? false;
  const activity = alreadyParticipant
    ? { demoMode: false }
    : (updated.demoMode
      ? { demoMode: false }
      : await emitMeetingActivity({
      kind: 'meeting_invite',
      meeting: updated.value,
      body: `${userId} joined as ${role}.`,
      priority: role === 'attendee' ? 'direct' : 'general',
      }));

  return { demoMode: mergeDemoMode(before.demoMode, updated.demoMode, activity.demoMode), value: updated.value };
}

export async function leaveMeetingService(meetingId: string, userId: string): Promise<MeetingServiceResult<Meeting | null>> {
  const before = await getMeetingRepo(meetingId);
  const updated = await removeParticipantRepo(meetingId, userId);
  if (!updated.value) return { demoMode: mergeDemoMode(before.demoMode, updated.demoMode), value: null };

  const removed = before.value?.participants.some((participant) => participant.userId === userId) ?? false;
  const activity = removed
    ? (updated.demoMode
      ? { demoMode: false }
      : await emitMeetingActivity({
      kind: 'meeting_update',
      meeting: updated.value,
      body: `${userId} left the meeting.`,
      priority: 'general',
      }))
    : { demoMode: false };

  return { demoMode: mergeDemoMode(before.demoMode, updated.demoMode, activity.demoMode), value: updated.value };
}
