import type {
  ActivityItem,
  CalendarEvent,
  ChatMessage,
  ChatThread,
  Meeting,
  MeetingParticipant,
  Presence,
  WorkspaceUser,
} from '@/types/domain/workspace';
import fs from 'node:fs';
import path from 'node:path';

type WorkspaceLanguage = 'en' | 'de';

const now = new Date();
const isoPlusMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60000).toISOString();
const isoPlusDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60000).toISOString();

const users: WorkspaceUser[] = [
  { id: 'u1', name: 'Dr. Sarah Chen', title: 'Environmental Scientist', email: 'sarah@zstream.app', avatarInitials: 'SC', presence: 'online', carbonSavedKg: 4.3 },
  { id: 'u2', name: 'Marcus Webb', title: 'Dev Lead', email: 'marcus@zstream.app', avatarInitials: 'MW', presence: 'busy', carbonSavedKg: 3.8 },
  { id: 'u3', name: 'Amara Diallo', title: 'UX Designer', email: 'amara@zstream.app', avatarInitials: 'AD', presence: 'away', carbonSavedKg: 5.1 },
  { id: 'u4', name: 'Prof. Erik Larsen', title: 'Board Advisor', email: 'erik@zstream.app', avatarInitials: 'EL', presence: 'offline', carbonSavedKg: 2.9 },
  { id: 'u5', name: 'Yuki Tanaka', title: 'Operations Lead', email: 'yuki@zstream.app', avatarInitials: 'YT', presence: 'online', carbonSavedKg: 6.0 },
  { id: 'u6', name: 'Leo Martins', title: 'Growth Lead', email: 'leo@zstream.app', avatarInitials: 'LM', presence: 'online', carbonSavedKg: 4.7 },
];

const participantsFor = (hostUserId: string, attendeeIds: string[]): MeetingParticipant[] => [
  { userId: hostUserId, role: 'host', joinedAt: isoPlusMinutes(-25) },
  ...attendeeIds.map((id) => ({ userId: id, role: 'attendee' as const, joinedAt: isoPlusMinutes(-20) })),
];

const seedMeetings: Meeting[] = [
  {
    id: 'm1',
    title: 'Climate Policy Q&A',
    hostUserId: 'u1',
    roomCode: 'ECO-4829-XKZM',
    startsAt: isoPlusMinutes(25),
    endsAt: isoPlusMinutes(85),
    status: 'scheduled',
    attendeesCount: 84,
    participants: participantsFor('u1', ['u2', 'u3']),
    carbonSavedKg: 2.4,
  },
  {
    id: 'm2',
    title: 'Zero Waste Workshop',
    hostUserId: 'u2',
    roomCode: 'ECO-1138-QVLA',
    startsAt: isoPlusMinutes(120),
    endsAt: isoPlusMinutes(180),
    status: 'scheduled',
    attendeesCount: 124,
    participants: participantsFor('u2', ['u1', 'u5']),
    carbonSavedKg: 3.1,
  },
  {
    id: 'm3',
    title: 'Eco Dev Team Sync',
    hostUserId: 'u5',
    roomCode: 'ECO-2094-BHTR',
    startsAt: isoPlusMinutes(-12),
    endsAt: isoPlusMinutes(33),
    status: 'live',
    attendeesCount: 18,
    participants: participantsFor('u5', ['u1', 'u6']),
    carbonSavedKg: 1.2,
  },
];

declare global {
  // eslint-disable-next-line no-var
  var __zmeetingsMockMeetings: Meeting[] | undefined;
}

const demoMeetingsFilePath = path.join(process.cwd(), '.next', 'zmeetings-demo-meetings.json');

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isMockMeeting(value: unknown): value is Meeting {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    typeof value.hostUserId === 'string' &&
    typeof value.roomCode === 'string' &&
    typeof value.startsAt === 'string' &&
    typeof value.endsAt === 'string' &&
    typeof value.status === 'string' &&
    Array.isArray(value.participants)
  );
}

function loadPersistedMeetings() {
  try {
    if (!fs.existsSync(demoMeetingsFilePath)) return clone(seedMeetings);
    const parsed = JSON.parse(fs.readFileSync(demoMeetingsFilePath, 'utf8')) as unknown;
    if (!Array.isArray(parsed)) return clone(seedMeetings);

    const persistedMeetings = parsed.filter(isMockMeeting);
    return persistedMeetings.length > 0 ? clone(persistedMeetings) : clone(seedMeetings);
  } catch {
    return clone(seedMeetings);
  }
}

function persistMockMeetings() {
  try {
    fs.mkdirSync(path.dirname(demoMeetingsFilePath), { recursive: true });
    fs.writeFileSync(demoMeetingsFilePath, JSON.stringify(meetings, null, 2), 'utf8');
  } catch {
    // Demo persistence is best effort; API calls should still work in memory.
  }
}

const meetings: Meeting[] = globalThis.__zmeetingsMockMeetings ?? loadPersistedMeetings();
globalThis.__zmeetingsMockMeetings = meetings;

const threads: ChatThread[] = [
  {
    id: 't1',
    title: 'Dr. Sarah Chen',
    participantUserIds: ['u1'],
    lastMessagePreview: 'I am sending the full report now.',
    updatedAt: isoPlusMinutes(-15),
    unreadCount: 2,
  },
  {
    id: 't2',
    title: 'Marcus Webb',
    participantUserIds: ['u2'],
    lastMessagePreview: 'Can we move workshop to 2 PM?',
    updatedAt: isoPlusMinutes(-48),
    unreadCount: 0,
  },
  {
    id: 't3',
    title: 'Sustainability Group Chat',
    participantUserIds: ['u1', 'u2', 'u3', 'u5'],
    lastMessagePreview: 'Sarah mentioned you in the group chat.',
    updatedAt: isoPlusDays(-1),
    unreadCount: 1,
  },
];

const messagesByThread: Record<string, ChatMessage[]> = {
  t1: [
    { id: 'msg1', threadId: 't1', senderUserId: 'u1', body: 'Hello! Have you seen the latest carbon footprint analysis?', createdAt: isoPlusMinutes(-65) },
    { id: 'msg2', threadId: 't1', senderUserId: 'u5', body: 'Not yet, just got through morning emails. How does it look?', createdAt: isoPlusMinutes(-58) },
    { id: 'msg3', threadId: 't1', senderUserId: 'u1', body: 'Extremely positive. We saved over 450kg of CO2.', createdAt: isoPlusMinutes(-45) },
  ],
  t2: [
    { id: 'msg4', threadId: 't2', senderUserId: 'u2', body: 'Can we move workshop to 2 PM?', createdAt: isoPlusMinutes(-180) },
  ],
  t3: [
    { id: 'msg5', threadId: 't3', senderUserId: 'u3', body: '@You thanks for the feedback on the sustainability plan.', createdAt: isoPlusDays(-1) },
  ],
};

const events: CalendarEvent[] = [
  { id: 'e1', title: 'Eco Dev Sync', startsAt: isoPlusDays(1), endsAt: isoPlusDays(1.02), timezone: 'Europe/Berlin', ownerUserId: 'u5', attendeeUserIds: ['u1', 'u6'], meetingId: 'm3', color: 'blue' },
  { id: 'e2', title: 'Sustainability Workshop', startsAt: isoPlusDays(1), endsAt: isoPlusDays(1.03), timezone: 'Europe/Berlin', ownerUserId: 'u2', attendeeUserIds: ['u1', 'u5'], meetingId: 'm2', color: 'amber' },
  { id: 'e3', title: 'Board Meeting', startsAt: isoPlusDays(1), endsAt: isoPlusDays(1.05), timezone: 'Europe/Berlin', ownerUserId: 'u4', attendeeUserIds: [], meetingId: null, color: 'green' },
];

const activity: ActivityItem[] = [
  { id: 'a1', kind: 'meeting_recording_ready', title: 'Climate Policy Q&A', body: 'Your meeting recording is ready to view.', createdAt: isoPlusMinutes(-10), read: false, priority: 'meeting_now', relatedMeetingId: 'm1', relatedThreadId: null },
  { id: 'a2', kind: 'mention', title: 'Dr. Sarah Chen', body: 'Mentioned you in Sustainability Group Chat.', createdAt: isoPlusMinutes(-45), read: false, priority: 'mention', relatedMeetingId: null, relatedThreadId: 't3' },
  { id: 'a3', kind: 'meeting_update', title: 'Team Sync', body: 'Meeting has been rescheduled to 4 PM.', createdAt: isoPlusMinutes(-120), read: true, priority: 'general', relatedMeetingId: 'm3', relatedThreadId: null },
];

function addActivityEntry(entry: Omit<ActivityItem, 'id' | 'createdAt' | 'read'> & { createdAt?: string; read?: boolean }) {
  activity.unshift({
    id: `a${activity.length + 1}`,
    createdAt: entry.createdAt ?? new Date().toISOString(),
    read: entry.read ?? false,
    ...entry,
  });
}

export function createActivityItem(entry: Omit<ActivityItem, 'id' | 'createdAt' | 'read'> & { createdAt?: string; read?: boolean }) {
  addActivityEntry(entry);
  return clone(activity[0]);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeLanguage(value?: string | null): WorkspaceLanguage {
  return value === 'de' ? 'de' : 'en';
}

export function listUsers(query?: string) {
  if (!query) return clone(users);
  const q = query.toLowerCase();
  return clone(users.filter((u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.title.toLowerCase().includes(q)));
}

export function getUserByEmail(email: string) {
  const normalized = email.trim().toLowerCase();
  const user = users.find((entry) => entry.email.toLowerCase() === normalized);
  return user ? clone(user) : null;
}

export function updateUserPresence(userId: string, presence: Presence) {
  const user = users.find((u) => u.id === userId);
  if (!user) return null;
  user.presence = presence;
  return clone(user);
}

export function listMeetings() {
  return clone(meetings.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
}

export function getMeeting(meetingId: string) {
  const meeting = meetings.find((m) => m.id === meetingId);
  return meeting ? clone(meeting) : null;
}

export function getMeetingByRoomCode(roomCode: string) {
  const normalized = roomCode.trim().toUpperCase();
  if (!normalized) return null;
  const meeting = meetings.find((m) => m.roomCode.toUpperCase() === normalized);
  return meeting ? clone(meeting) : null;
}

export function createMeeting(title: string, hostUserId: string, schedule?: { startsAt?: string; endsAt?: string }) {
  const maxNumericId = meetings.reduce((maxId, meeting) => {
    const current = Number.parseInt(meeting.id.replace(/^m/, ''), 10);
    return Number.isFinite(current) ? Math.max(maxId, current) : maxId;
  }, 0);
  const id = `m${maxNumericId + 1}`;
  const codeTail = Math.floor(Math.random() * 8999 + 1000);
  const startsAt = schedule?.startsAt ?? isoPlusMinutes(15);
  const endsAt = schedule?.endsAt ?? isoPlusMinutes(75);
  const meeting: Meeting = {
    id,
    title,
    hostUserId,
    roomCode: `ECO-${codeTail}-ZX${Math.floor(Math.random() * 9)}K`,
    startsAt,
    endsAt,
    status: 'scheduled',
    attendeesCount: 1,
    participants: [{ userId: hostUserId, role: 'host', joinedAt: new Date().toISOString() }],
    carbonSavedKg: 0.6,
  };
  meetings.unshift(meeting);
  addActivityEntry({
    kind: 'meeting_update',
    title: meeting.title,
    body: 'Meeting created successfully.',
    priority: 'general',
    relatedMeetingId: meeting.id,
    relatedThreadId: null,
  });
  persistMockMeetings();
  return clone(meeting);
}

export function patchMeeting(meetingId: string, updates: Partial<Pick<Meeting, 'title' | 'status' | 'startsAt' | 'endsAt'>>) {
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;

  const before = {
    title: meeting.title,
    status: meeting.status,
    startsAt: meeting.startsAt,
    endsAt: meeting.endsAt,
  };

  Object.assign(meeting, updates);

  const changedFields: string[] = [];
  if (updates.title && updates.title !== before.title) changedFields.push('title');
  if (updates.status && updates.status !== before.status) changedFields.push('status');
  if (updates.startsAt && updates.startsAt !== before.startsAt) changedFields.push('start time');
  if (updates.endsAt && updates.endsAt !== before.endsAt) changedFields.push('end time');

  if (changedFields.length > 0) {
    addActivityEntry({
      kind: 'meeting_update',
      title: meeting.title,
      body: `Meeting updated: ${changedFields.join(', ')}.`,
      priority: meeting.status === 'live' ? 'meeting_now' : 'general',
      relatedMeetingId: meeting.id,
      relatedThreadId: null,
    });
  }

  persistMockMeetings();
  return clone(meeting);
}

export function addParticipant(meetingId: string, userId: string, role: MeetingParticipant['role'] = 'attendee') {
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;
  if (!meeting.participants.some((p) => p.userId === userId)) {
    meeting.participants.push({ userId, role, joinedAt: new Date().toISOString() });
    meeting.attendeesCount += 1;

    const user = users.find((u) => u.id === userId);
    addActivityEntry({
      kind: 'meeting_invite',
      title: meeting.title,
      body: `${user?.name ?? 'A participant'} was added to the meeting.`,
      priority: role === 'attendee' ? 'direct' : 'general',
      relatedMeetingId: meeting.id,
      relatedThreadId: null,
    });
  }
  persistMockMeetings();
  return clone(meeting);
}

export function removeParticipant(meetingId: string, userId: string) {
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;
  meeting.participants = meeting.participants.filter((p) => p.userId !== userId);
  meeting.attendeesCount = Math.max(0, meeting.attendeesCount - 1);
  persistMockMeetings();
  return clone(meeting);
}

export function listThreads() {
  return clone(threads.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
}

export function findOrCreateDirectThread(userId: string, title: string) {
  const existing = threads.find((thread) => thread.participantUserIds.length === 1 && thread.participantUserIds[0] === userId);
  if (existing) return clone(existing);

  const thread: ChatThread = {
    id: `t${threads.length + 1}`,
    title,
    participantUserIds: [userId],
    lastMessagePreview: 'New conversation started.',
    updatedAt: new Date().toISOString(),
    unreadCount: 0,
  };
  threads.unshift(thread);
  messagesByThread[thread.id] = [];
  return clone(thread);
}

export function listMessages(threadId: string) {
  return clone(messagesByThread[threadId] ?? []);
}

export function addMessage(threadId: string, senderUserId: string, body: string, attachments?: ChatMessage['attachments']) {
  const next: ChatMessage = {
    id: `msg${Object.values(messagesByThread).flat().length + 1}`,
    threadId,
    senderUserId,
    body,
    attachments: attachments?.length ? attachments : undefined,
    createdAt: new Date().toISOString(),
  };
  if (!messagesByThread[threadId]) {
    messagesByThread[threadId] = [];
  }
  messagesByThread[threadId].push(next);
  const thread = threads.find((t) => t.id === threadId);
  if (thread) {
    thread.lastMessagePreview = body.trim() || (attachments?.length === 1 ? attachments[0].name : `Shared ${attachments?.length ?? 0} attachments`);
    thread.updatedAt = next.createdAt;
    thread.unreadCount += 1;
  }
  return clone(next);
}

export function markThreadRead(threadId: string) {
  const thread = threads.find((t) => t.id === threadId);
  if (!thread) return null;
  thread.unreadCount = 0;
  return clone(thread);
}

export function listEvents() {
  return clone(events.sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
}

export function getEvent(eventId: string) {
  const event = events.find((e) => e.id === eventId);
  return event ? clone(event) : null;
}

export function createEvent(input: Omit<CalendarEvent, 'id'>) {
  const event: CalendarEvent = { id: `e${events.length + 1}`, ...input, attendeeUserIds: input.attendeeUserIds ?? [] };
  events.push(event);
  return clone(event);
}

export function patchEvent(eventId: string, updates: Partial<Omit<CalendarEvent, 'id'>>) {
  const event = events.find((e) => e.id === eventId);
  if (!event) return null;
  Object.assign(event, updates);
  return clone(event);
}

export function deleteEvent(eventId: string) {
  const idx = events.findIndex((e) => e.id === eventId);
  if (idx < 0) return false;
  events.splice(idx, 1);
  return true;
}

export function listActivity() {
  const rank: Record<ActivityItem['priority'], number> = {
    meeting_now: 0,
    mention: 1,
    direct: 2,
    general: 3,
  };
  return clone(activity.sort((a, b) => (rank[a.priority] - rank[b.priority]) || b.createdAt.localeCompare(a.createdAt)));
}

export function markActivityRead(id: string) {
  const item = activity.find((entry) => entry.id === id);
  if (!item) return null;
  item.read = true;
  return clone(item);
}

export function getWeeklyCarbonSummary() {
  const totalSavedKg = meetings.reduce((acc, meeting) => acc + meeting.carbonSavedKg, 0);
  const meetingsCount = meetings.length;
  return clone({
    totalSavedKg: Number(totalSavedKg.toFixed(2)),
    meetingsCount,
    avgSavedPerMeetingKg: Number((totalSavedKg / Math.max(1, meetingsCount)).toFixed(2)),
  });
}

export function getMeetingCarbon(meetingId: string, lang?: string | null) {
  const language = normalizeLanguage(lang);
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;
  return clone({
    meetingId,
    title: meeting.title,
    savedKg: meeting.carbonSavedKg,
    participants: meeting.attendeesCount,
    estimateLabel: language === 'de'
      ? `${meeting.carbonSavedKg.toFixed(2)} kg CO2 eingespart`
      : `${meeting.carbonSavedKg.toFixed(2)} kg CO2 saved`,
  });
}

export function getMeetingSummary(meetingId: string, lang?: string | null) {
  const language = normalizeLanguage(lang);
  const meeting = meetings.find((m) => m.id === meetingId);
  if (!meeting) return null;
  return clone({
    meetingId,
    title: meeting.title,
    summary: language === 'de'
      ? 'Die Diskussion konzentrierte sich auf die Abstimmung der Nachhaltigkeits-Roadmap und die Launch-Bereitschaft.'
      : 'Discussion focused on sustainability roadmap alignment and launch readiness.',
    actionItems: language === 'de'
      ? [
          'Aktualisierte Workshop-Zeitlinie mit den Team-Leads teilen.',
          'Deck-Ueberarbeitungen bis morgen 11:00 abschliessen.',
          'Follow-up-Notiz fuer Teilnehmende vorbereiten.',
        ]
      : [
          'Share updated workshop timeline with team leads.',
          'Finalize deck revisions by tomorrow 11:00.',
          'Prepare follow-up note for participants.',
        ],
  });
}
