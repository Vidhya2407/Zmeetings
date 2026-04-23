export type MeetingStatus = 'scheduled' | 'live' | 'ended';

export type MeetingRole = 'host' | 'cohost' | 'attendee';

export type MeetingParticipant = {
  userId: string;
  role: MeetingRole;
  joinedAt: string;
};

export type MeetingCarbonRoomContribution = {
  breakoutRoomId: string | null;
  breakoutSessionId: string | null;
  carbonKg: number;
  durationSeconds: number;
  label: string;
  participantCount: number;
  roomKey: string;
  roomType: 'main' | 'breakout';
  totalCumulativeG: number;
  totalRateGPerMin: number;
  breakdown: {
    videoContribG: number;
    audioContribG: number;
    screenContribG: number;
    serverContribG: number;
    networkContribG: number;
  };
};

export type MeetingCarbonSummary = {
  breakoutKg: number;
  breakoutRoomCount: number;
  breakoutSharePercent: number;
  mainRoomKg: number;
  roomCount: number;
  rooms: MeetingCarbonRoomContribution[];
  totalKg: number;
};

export type Meeting = {
  id: string;
  title: string;
  hostUserId: string;
  roomCode: string;
  startsAt: string;
  endsAt: string;
  status: MeetingStatus;
  attendeesCount: number;
  participants: MeetingParticipant[];
  carbonSavedKg: number;
  carbonSummary?: MeetingCarbonSummary | null;
};

export type MeetingPatchInput = Partial<Pick<Meeting, 'title' | 'status' | 'startsAt' | 'endsAt'>>;

export type MeetingEventType = 'meeting_created' | 'meeting_updated' | 'meeting_started' | 'meeting_ended' | 'meeting_participant_joined' | 'meeting_participant_left';

export type MeetingServiceResult<T> = {
  demoMode: boolean;
  value: T;
};
