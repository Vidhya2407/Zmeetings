import { getMeetingService } from '@/lib/meetings/meetingService';
import type { Meeting, MeetingRole } from '@/types/domain/meeting';

type SessionRole = 'user' | 'creator' | 'admin' | string | undefined;

export type MeetingAuthorization = {
  canModerateMeeting: boolean;
  canViewMeeting: boolean;
  isCohost: boolean;
  isGlobalModerator: boolean;
  isHost: boolean;
  isParticipant: boolean;
  meeting: Meeting | null;
  participantRole: MeetingRole | null;
};

export function isGlobalMeetingModerator(role: SessionRole) {
  return role === 'admin' || role === 'creator';
}

export async function resolveMeetingAuthorization(
  meetingId: string,
  userId: string,
  role: SessionRole,
): Promise<MeetingAuthorization> {
  const meetingResult = await getMeetingService(meetingId);
  const meeting = meetingResult.value;
  const isGlobalModerator = isGlobalMeetingModerator(role);

  if (!meeting) {
    return {
      meeting: null,
      isGlobalModerator,
      participantRole: null,
      isParticipant: false,
      isHost: false,
      isCohost: false,
      canViewMeeting: false,
      canModerateMeeting: false,
    };
  }

  const participantRole = meeting.participants.find((participant) => participant.userId === userId)?.role ?? null;
  const isHost = meeting.hostUserId === userId || participantRole === 'host';
  const isCohost = participantRole === 'cohost';
  const isParticipant = isHost || isCohost || participantRole === 'attendee';
  const canViewMeeting = isGlobalModerator || isParticipant;
  const canModerateMeeting = isGlobalModerator || isHost || isCohost;

  return {
    meeting,
    isGlobalModerator,
    participantRole,
    isParticipant,
    isHost,
    isCohost,
    canViewMeeting,
    canModerateMeeting,
  };
}

