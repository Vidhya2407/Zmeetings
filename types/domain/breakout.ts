export type BreakoutSessionStatus = 'draft' | 'countdown' | 'active' | 'ended';

export type BreakoutAssignmentMethod = 'auto' | 'manual';

export type BreakoutRoomStatus = 'open' | 'closing' | 'merged';

export type BreakoutParticipantSeed = {
  id: string;
  displayName: string;
  role: string;
};

export type BreakoutRoomSummary = {
  id: string;
  name: string;
  position: number;
  status: BreakoutRoomStatus;
  mergeReadyAt: string | null;
  secondsUntilMerge: number;
  participantCount: number;
  participants: Array<{
    participantId: string;
    participantName: string;
    participantRole: string;
  }>;
};

export type BreakoutAssignmentSummary = {
  participantId: string;
  participantName: string;
  participantRole: string;
  roomId: string;
  roomName: string;
  assignmentMethod: BreakoutAssignmentMethod;
  assignedAt: string;
};

export type BreakoutBroadcastSummary = {
  createdAt: string;
  createdBy: string;
  message: string;
};

export type BreakoutAnnouncementType =
  | 'breakout.starting'
  | 'breakout.started'
  | 'breakout.merging'
  | 'breakout.closed';

export type BreakoutAnnouncementSummary = {
  type: BreakoutAnnouncementType;
  createdAt: string;
  createdBy: string;
  message: string;
};

export type BreakoutHelpRequestSummary = {
  kind: 'help' | 'merge';
  participantId: string;
  participantName: string;
  roomId: string;
  roomName: string;
  requestedAt: string;
  requestedBy: string;
};

export type BreakoutSessionSnapshot = {
  sessionId: string;
  meetingId: string;
  status: BreakoutSessionStatus;
  assignmentMode: BreakoutAssignmentMethod;
  assignmentsLocked: boolean;
  roomCount: number;
  countdownSeconds: number;
  secondsRemaining: number;
  startsAt: string | null;
  closedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  rooms: BreakoutRoomSummary[];
  assignments: BreakoutAssignmentSummary[];
  myAssignment: BreakoutAssignmentSummary | null;
  myHelpRequest: BreakoutHelpRequestSummary | null;
  latestBroadcast: BreakoutBroadcastSummary | null;
  latestAnnouncement: BreakoutAnnouncementSummary | null;
  helpRequests: BreakoutHelpRequestSummary[];
  eventCount: number;
};

export type BreakoutSessionResponse = {
  session: BreakoutSessionSnapshot | null;
};
