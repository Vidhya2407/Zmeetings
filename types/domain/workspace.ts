export type Presence = 'online' | 'away' | 'busy' | 'offline';

export type MeetingRole = 'host' | 'cohost' | 'attendee';

export type WorkspaceNotificationPriority = 'meeting_now' | 'mention' | 'direct' | 'general';

export type ActivityKind =
  | 'meeting_invite'
  | 'meeting_update'
  | 'meeting_recording_ready'
  | 'mention'
  | 'chat_message'
  | 'system';

export interface WorkspaceUser {
  id: string;
  name: string;
  title: string;
  email: string;
  avatarInitials: string;
  presence: Presence;
  carbonSavedKg: number;
}

export interface MeetingParticipant {
  userId: string;
  role: MeetingRole;
  joinedAt: string;
}

export interface MeetingCarbonRoomContribution {
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
}

export interface MeetingCarbonSummary {
  breakoutKg: number;
  breakoutRoomCount: number;
  breakoutSharePercent: number;
  mainRoomKg: number;
  roomCount: number;
  rooms: MeetingCarbonRoomContribution[];
  totalKg: number;
}

export interface Meeting {
  id: string;
  title: string;
  hostUserId: string;
  roomCode: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'live' | 'ended';
  attendeesCount: number;
  participants: MeetingParticipant[];
  carbonSavedKg: number;
  carbonSummary?: MeetingCarbonSummary | null;
}

export interface ChatThread {
  id: string;
  title: string;
  participantUserIds: string[];
  lastMessagePreview: string;
  updatedAt: string;
  unreadCount: number;
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderUserId: string;
  body: string;
  createdAt: string;
  attachments?: ChatAttachment[];
}

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  kind: 'file' | 'image' | 'video';
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  ownerUserId: string;
  attendeeUserIds: string[];
  meetingId: string | null;
  color: 'blue' | 'green' | 'amber' | 'purple';
}

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  priority: WorkspaceNotificationPriority;
  relatedMeetingId: string | null;
  relatedThreadId: string | null;
  targetUserIds?: string[];
}
