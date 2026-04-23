import { randomUUID } from 'node:crypto';
import dbConnect from '@/lib/db/mongodb';
import BreakoutSessionModel from '@/lib/models/BreakoutSession';
import BreakoutRoomModel from '@/lib/models/BreakoutRoom';
import BreakoutAssignmentModel from '@/lib/models/BreakoutAssignment';
import BreakoutEventModel from '@/lib/models/BreakoutEvent';
import { resolveMeetingCarbonRoomScope } from '@/lib/meetings/carbonRoomScope';
import { clearMeetingRoomParticipants } from '@/lib/meetings/serverRoomStore';
import type {
  BreakoutAssignmentMethod,
  BreakoutAssignmentSummary,
  BreakoutAnnouncementSummary,
  BreakoutAnnouncementType,
  BreakoutBroadcastSummary,
  BreakoutHelpRequestSummary,
  BreakoutParticipantSeed,
  BreakoutRoomStatus,
  BreakoutSessionSnapshot,
  BreakoutSessionStatus,
} from '@/types/domain/breakout';

type DataSourceResult<T> = {
  demoMode: boolean;
  value: T;
};

type BreakoutSessionRecord = {
  id: string;
  meetingId: string;
  createdBy: string;
  status: BreakoutSessionStatus;
  assignmentMode: BreakoutAssignmentMethod;
  roomCount: number;
  countdownSeconds: number;
  startsAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type BreakoutRoomRecord = {
  id: string;
  sessionId: string;
  meetingId: string;
  name: string;
  position: number;
  status: BreakoutRoomStatus;
  mergeReadyAt: Date | null;
  mergedAt: Date | null;
  mergeRequestedBy: string | null;
};

type BreakoutAssignmentRecord = {
  id: string;
  sessionId: string;
  meetingId: string;
  roomId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  assignmentMethod: BreakoutAssignmentMethod;
  assignedBy: string;
  assignedAt: Date;
};

type BreakoutEventRecord = {
  id: string;
  sessionId: string;
  meetingId: string;
  type: string;
  message: string;
  payload: Record<string, unknown> | null;
  createdBy: string;
  createdAt: Date;
};

type ManualAssignmentInput = {
  participantId: string;
  participantName: string;
  participantRole: string;
  roomId: string;
};

type BreakoutBundle = {
  assignments: BreakoutAssignmentRecord[];
  eventCount: number;
  events: BreakoutEventRecord[];
  helpRequests: BreakoutHelpRequestSummary[];
  latestAnnouncement: BreakoutAnnouncementSummary | null;
  latestBroadcast: BreakoutBroadcastSummary | null;
  rooms: BreakoutRoomRecord[];
  session: BreakoutSessionRecord;
};

type BreakoutMemoryStore = {
  sessions: Map<string, BreakoutSessionRecord>;
  rooms: Map<string, BreakoutRoomRecord>;
  assignmentsBySession: Map<string, Map<string, BreakoutAssignmentRecord>>;
  eventsBySession: Map<string, BreakoutEventRecord[]>;
};

declare global {
  // eslint-disable-next-line no-var
  var __breakoutMemoryStore: BreakoutMemoryStore | undefined;
}

function getMemoryStore() {
  if (!globalThis.__breakoutMemoryStore) {
    globalThis.__breakoutMemoryStore = {
      sessions: new Map(),
      rooms: new Map(),
      assignmentsBySession: new Map(),
      eventsBySession: new Map(),
    };
  }
  return globalThis.__breakoutMemoryStore;
}

function createEntityId(prefix: string) {
  return `${prefix}-${randomUUID().replace(/-/g, '').slice(0, 16)}`;
}

function isModeratorLikeRole(role: string) {
  const normalized = role.trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized.includes('host')
    || normalized.includes('cohost')
    || normalized.includes('moderator')
    || normalized.includes('admin')
    || normalized.includes('owner')
  );
}

function normalizeRoomCount(value: number) {
  if (!Number.isFinite(value)) return 2;
  return Math.min(20, Math.max(1, Math.round(value)));
}

function normalizeCountdownSeconds(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(7200, Math.max(0, Math.round(value)));
}

function normalizeBreakoutMessage(value: string) {
  return value.trim().slice(0, 1000);
}

function isRoomLeadRole(role: string) {
  return role.trim().toLowerCase() === 'room lead';
}

function toDate(value: Date | string | undefined | null, fallback: Date | null = null) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed;
}

function serializeSession(doc: {
  _id: string;
  meetingId: string;
  createdBy: string;
  status: string;
  assignmentMode: string;
  roomCount: number;
  countdownSeconds: number;
  startsAt?: Date | string | null;
  endedAt?: Date | string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}): BreakoutSessionRecord {
  const now = new Date();
  const status = (doc.status === 'countdown' || doc.status === 'active' || doc.status === 'ended') ? doc.status : 'draft';
  const assignmentMode = doc.assignmentMode === 'auto' ? 'auto' : 'manual';
  return {
    id: doc._id,
    meetingId: doc.meetingId,
    createdBy: doc.createdBy,
    status,
    assignmentMode,
    roomCount: normalizeRoomCount(doc.roomCount),
    countdownSeconds: normalizeCountdownSeconds(doc.countdownSeconds),
    startsAt: toDate(doc.startsAt, null),
    endedAt: toDate(doc.endedAt, null),
    createdAt: toDate(doc.createdAt, now) ?? now,
    updatedAt: toDate(doc.updatedAt, now) ?? now,
  };
}

function serializeRoom(doc: {
  _id: string;
  sessionId: string;
  meetingId: string;
  name: string;
  position: number;
  status?: string;
  mergeReadyAt?: Date | string | null;
  mergedAt?: Date | string | null;
  mergeRequestedBy?: string | null;
}): BreakoutRoomRecord {
  return {
    id: doc._id,
    sessionId: doc.sessionId,
    meetingId: doc.meetingId,
    name: doc.name,
    position: Number.isFinite(doc.position) ? Math.max(1, Math.round(doc.position)) : 1,
    status: doc.status === 'closing' || doc.status === 'merged' ? doc.status : 'open',
    mergeReadyAt: toDate(doc.mergeReadyAt, null),
    mergedAt: toDate(doc.mergedAt, null),
    mergeRequestedBy: doc.mergeRequestedBy?.trim() || null,
  };
}

function serializeAssignment(doc: {
  _id: string;
  sessionId: string;
  meetingId: string;
  roomId: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  assignmentMethod: string;
  assignedBy: string;
  assignedAt?: Date | string;
}): BreakoutAssignmentRecord {
  return {
    id: doc._id,
    sessionId: doc.sessionId,
    meetingId: doc.meetingId,
    roomId: doc.roomId,
    participantId: doc.participantId,
    participantName: doc.participantName,
    participantRole: doc.participantRole,
    assignmentMethod: doc.assignmentMethod === 'auto' ? 'auto' : 'manual',
    assignedBy: doc.assignedBy,
    assignedAt: toDate(doc.assignedAt, new Date()) ?? new Date(),
  };
}

function buildSnapshot(
  session: BreakoutSessionRecord,
  rooms: BreakoutRoomRecord[],
  assignments: BreakoutAssignmentRecord[],
  latestBroadcast: BreakoutBroadcastSummary | null,
  latestAnnouncement: BreakoutAnnouncementSummary | null,
  helpRequests: BreakoutHelpRequestSummary[],
  participantId?: string,
  eventCount = 0,
): BreakoutSessionSnapshot {
  const sortedRooms = [...rooms].sort((a, b) => a.position - b.position);
  const roomNameById = new Map(sortedRooms.map((room) => [room.id, room.name]));
  const assignmentsSummary: BreakoutAssignmentSummary[] = assignments.map((assignment) => ({
    participantId: assignment.participantId,
    participantName: assignment.participantName,
    participantRole: assignment.participantRole,
    roomId: assignment.roomId,
    roomName: roomNameById.get(assignment.roomId) ?? 'Breakout Room',
    assignmentMethod: assignment.assignmentMethod,
    assignedAt: assignment.assignedAt.toISOString(),
  }));

  const roomAssignments = new Map<string, BreakoutAssignmentSummary[]>();
  for (const assignment of assignmentsSummary) {
    const current = roomAssignments.get(assignment.roomId) ?? [];
    current.push(assignment);
    roomAssignments.set(assignment.roomId, current);
  }

  const now = Date.now();
  let secondsRemaining = 0;
  if (session.status === 'countdown' && session.startsAt) {
    secondsRemaining = Math.max(0, Math.ceil((session.startsAt.getTime() - now) / 1000));
  }

  const myAssignment = participantId
    ? assignmentsSummary.find((assignment) => assignment.participantId === participantId) ?? null
    : null;
  const myHelpRequest = participantId
    ? helpRequests.find((request) => request.participantId === participantId) ?? null
    : null;

  return {
    sessionId: session.id,
    meetingId: session.meetingId,
    status: session.status,
    assignmentMode: session.assignmentMode,
    assignmentsLocked: session.status !== 'draft',
    roomCount: session.roomCount,
    countdownSeconds: session.countdownSeconds,
    secondsRemaining,
    startsAt: session.startsAt ? session.startsAt.toISOString() : null,
    closedAt: session.endedAt ? session.endedAt.toISOString() : null,
    endedAt: session.endedAt ? session.endedAt.toISOString() : null,
    createdAt: session.createdAt.toISOString(),
    rooms: sortedRooms.map((room) => {
      const participants = (roomAssignments.get(room.id) ?? []).map((assignment) => ({
        participantId: assignment.participantId,
        participantName: assignment.participantName,
        participantRole: assignment.participantRole,
      }));

      let secondsUntilMerge = 0;
      if (room.status === 'closing' && room.mergeReadyAt) {
        secondsUntilMerge = Math.max(0, Math.ceil((room.mergeReadyAt.getTime() - now) / 1000));
      }

      return {
        id: room.id,
        name: room.name,
        position: room.position,
        status: room.status,
        mergeReadyAt: room.mergeReadyAt ? room.mergeReadyAt.toISOString() : null,
        secondsUntilMerge,
        participantCount: participants.length,
        participants,
      };
    }),
    assignments: assignmentsSummary.sort((left, right) => left.participantName.localeCompare(right.participantName)),
    myAssignment,
    myHelpRequest,
    latestBroadcast,
    latestAnnouncement,
    helpRequests,
    eventCount,
  };
}

function createRoomName(position: number) {
  return `Breakout Room ${position}`;
}

function createAssignmentId(sessionId: string, participantId: string) {
  return `ba-${sessionId}-${participantId}`.slice(0, 190);
}

const BREAKOUT_ANNOUNCEMENT_TYPES = new Set<BreakoutAnnouncementType>([
  'breakout.starting',
  'breakout.started',
  'breakout.merging',
  'breakout.closed',
]);

function isBreakoutAnnouncementType(type: string): type is BreakoutAnnouncementType {
  return BREAKOUT_ANNOUNCEMENT_TYPES.has(type as BreakoutAnnouncementType);
}

function toAnnouncementSummary(event: BreakoutEventRecord): BreakoutAnnouncementSummary | null {
  if (!isBreakoutAnnouncementType(event.type)) {
    return null;
  }

  return {
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    createdBy: event.createdBy,
    message: event.message,
  };
}

function toActiveHelpRequests(
  events: BreakoutEventRecord[],
  roomNameById: Map<string, string>,
): BreakoutHelpRequestSummary[] {
  const activeRequests = new Map<string, BreakoutHelpRequestSummary>();
  const chronologicalEvents = [...events].sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());

  for (const event of chronologicalEvents) {
    if (event.type === 'breakout.help_requested') {
      const participantId = String(event.payload?.participantId ?? '').trim();
      const roomId = String(event.payload?.roomId ?? '').trim();
      if (!participantId || !roomId) {
        continue;
      }
      activeRequests.set(participantId, {
        kind: event.payload?.kind === 'merge' ? 'merge' : 'help',
        participantId,
        participantName: String(event.payload?.participantName ?? event.message).trim() || 'Participant',
        roomId,
        roomName: roomNameById.get(roomId) ?? (String(event.payload?.roomName ?? 'Breakout Room').trim() || 'Breakout Room'),
        requestedAt: event.createdAt.toISOString(),
        requestedBy: event.createdBy,
      });
      continue;
    }

    if (event.type === 'breakout.help_cleared') {
      const participantId = String(event.payload?.participantId ?? '').trim();
      if (participantId) {
        activeRequests.delete(participantId);
      }
    }
  }

  return Array.from(activeRequests.values()).sort((left, right) => left.requestedAt.localeCompare(right.requestedAt));
}

async function appendBreakoutEvent(
  useMongo: boolean,
  event: Omit<BreakoutEventRecord, 'id'>,
) {
  if (useMongo) {
    await BreakoutEventModel.create({
      sessionId: event.sessionId,
      meetingId: event.meetingId,
      type: event.type,
      message: event.message,
      payload: event.payload,
      createdBy: event.createdBy,
      createdAt: event.createdAt,
    });
    return;
  }

  const store = getMemoryStore();
  const list = store.eventsBySession.get(event.sessionId) ?? [];
  list.unshift({
    id: createEntityId('be'),
    ...event,
  });
  store.eventsBySession.set(event.sessionId, list);
}

async function getSessionBundle(
  useMongo: boolean,
  sessionId: string,
): Promise<BreakoutBundle | null> {
  if (useMongo) {
    const [sessionDoc, roomDocs, assignmentDocs, eventDocs] = await Promise.all([
      BreakoutSessionModel.findById(sessionId).lean(),
      BreakoutRoomModel.find({ sessionId }).sort({ position: 1 }).lean(),
      BreakoutAssignmentModel.find({ sessionId }).lean(),
      BreakoutEventModel.find({ sessionId }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!sessionDoc) return null;
    const rooms = (roomDocs as Array<{
      _id: string;
      sessionId: string;
      meetingId: string;
      name: string;
      position: number;
      status?: string;
      mergeReadyAt?: Date | string | null;
      mergedAt?: Date | string | null;
      mergeRequestedBy?: string | null;
    }>).map(serializeRoom);
    const events = (eventDocs as Array<{
      _id?: string;
      sessionId: string;
      meetingId: string;
      type: string;
      message: string;
      payload?: Record<string, unknown> | null;
      createdBy: string;
      createdAt?: Date | string;
    }>).map((event, index) => ({
      id: String(event._id ?? `${sessionId}-event-${index}`),
      sessionId: event.sessionId,
      meetingId: event.meetingId,
      type: event.type,
      message: event.message,
      payload: event.payload ?? null,
      createdBy: event.createdBy,
      createdAt: toDate(event.createdAt, new Date()) ?? new Date(),
    }));
    const latestBroadcastEvent = events.find((event) => event.type === 'broadcast_message') ?? null;
    const latestAnnouncementEvent = events.find((event) => isBreakoutAnnouncementType(event.type)) ?? null;
    const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
    return {
      session: serializeSession(sessionDoc as {
        _id: string;
        meetingId: string;
        createdBy: string;
        status: string;
        assignmentMode: string;
        roomCount: number;
        countdownSeconds: number;
        startsAt?: Date | string | null;
        endedAt?: Date | string | null;
        createdAt?: Date | string;
        updatedAt?: Date | string;
      }),
      rooms,
      assignments: (assignmentDocs as Array<{
        _id: string;
        sessionId: string;
        meetingId: string;
        roomId: string;
        participantId: string;
        participantName: string;
        participantRole: string;
        assignmentMethod: string;
        assignedBy: string;
        assignedAt?: Date | string;
      }>).map(serializeAssignment),
      eventCount: events.length,
      events,
      helpRequests: toActiveHelpRequests(events, roomNameById),
      latestAnnouncement: latestAnnouncementEvent
        ? toAnnouncementSummary(latestAnnouncementEvent)
        : null,
      latestBroadcast: latestBroadcastEvent
        ? {
            createdAt: latestBroadcastEvent.createdAt.toISOString(),
            createdBy: latestBroadcastEvent.createdBy,
            message: latestBroadcastEvent.message,
          }
        : null,
    };
  }

  const store = getMemoryStore();
  const session = store.sessions.get(sessionId);
  if (!session) return null;
  const rooms = Array.from(store.rooms.values()).filter((room) => room.sessionId === sessionId);
  const assignments = Array.from(store.assignmentsBySession.get(sessionId)?.values() ?? []);
  const events = store.eventsBySession.get(sessionId) ?? [];
  const latestBroadcastEvent = events.find((event) => event.type === 'broadcast_message') ?? null;
  const latestAnnouncementEvent = events.find((event) => isBreakoutAnnouncementType(event.type)) ?? null;
  const eventCount = events.length;
  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));
  return {
    session,
    rooms,
    assignments,
    eventCount,
    events,
    helpRequests: toActiveHelpRequests(events, roomNameById),
    latestAnnouncement: latestAnnouncementEvent
      ? toAnnouncementSummary(latestAnnouncementEvent)
      : null,
    latestBroadcast: latestBroadcastEvent
      ? {
          createdAt: latestBroadcastEvent.createdAt.toISOString(),
          createdBy: latestBroadcastEvent.createdBy,
          message: latestBroadcastEvent.message,
        }
      : null,
  };
}

async function completeMergedRooms(
  useMongo: boolean,
  bundle: BreakoutBundle,
  dueRooms: BreakoutRoomRecord[],
) {
  const mergedAt = new Date();
  const roomIds = dueRooms.map((room) => room.id);

  if (useMongo) {
    await Promise.all([
      BreakoutRoomModel.updateMany(
        { _id: { $in: roomIds } },
        {
          $set: {
            status: 'merged',
            mergedAt,
          },
          $unset: {
            mergeReadyAt: 1,
            mergeRequestedBy: 1,
          },
        },
      ),
      BreakoutAssignmentModel.deleteMany({
        sessionId: bundle.session.id,
        roomId: { $in: roomIds },
      }),
    ]);
  } else {
    const store = getMemoryStore();
    for (const roomId of roomIds) {
      const room = store.rooms.get(roomId);
      if (room) {
        room.status = 'merged';
        room.mergeReadyAt = null;
        room.mergedAt = mergedAt;
        room.mergeRequestedBy = null;
        store.rooms.set(roomId, room);
      }
    }

    const assignmentMap = store.assignmentsBySession.get(bundle.session.id) ?? new Map<string, BreakoutAssignmentRecord>();
    for (const assignment of Array.from(assignmentMap.values())) {
      if (roomIds.includes(assignment.roomId)) {
        assignmentMap.delete(assignment.participantId);
      }
    }
    store.assignmentsBySession.set(bundle.session.id, assignmentMap);
  }

  for (const room of dueRooms) {
    await clearMeetingRoomParticipants(
      resolveMeetingCarbonRoomScope({
        breakoutRoomId: room.id,
        breakoutRoomName: room.name,
        breakoutSessionId: room.sessionId,
        meetingId: bundle.session.meetingId,
      }).roomKey,
      resolveMeetingCarbonRoomScope({
        breakoutRoomId: room.id,
        breakoutRoomName: room.name,
        breakoutSessionId: room.sessionId,
        meetingId: bundle.session.meetingId,
      }),
    );
    await appendBreakoutEvent(useMongo, {
      sessionId: bundle.session.id,
      meetingId: bundle.session.meetingId,
      type: 'room_merged',
      message: `${room.name} merged back to the main room.`,
      payload: {
        roomId: room.id,
      },
      createdBy: room.mergeRequestedBy ?? 'system',
      createdAt: mergedAt,
    });
  }
}

async function maybeEndSessionAfterMerge(useMongo: boolean, bundle: BreakoutBundle) {
  const remainingOpenRooms = bundle.rooms.filter((room) => room.status !== 'merged');
  if (remainingOpenRooms.length) {
    return;
  }

  const now = new Date();
  if (useMongo) {
    await BreakoutSessionModel.updateOne(
      { _id: bundle.session.id, status: { $ne: 'ended' } },
      {
        $set: {
          status: 'ended',
          endedAt: now,
          updatedAt: now,
        },
      },
    );
  } else {
    const store = getMemoryStore();
    const session = store.sessions.get(bundle.session.id);
    if (session) {
      session.status = 'ended';
      session.endedAt = now;
      session.updatedAt = now;
      store.sessions.set(bundle.session.id, session);
    }
  }

  await appendBreakoutEvent(useMongo, {
    sessionId: bundle.session.id,
    meetingId: bundle.session.meetingId,
    type: 'breakout.closed',
    message: 'All breakout rooms rejoined the main room. Breakout is closed.',
    payload: null,
    createdBy: 'system',
    createdAt: now,
  });
}

async function syncBreakoutSessionState(useMongo: boolean, sessionId: string) {
  const bundle = await getSessionBundle(useMongo, sessionId);
  if (!bundle) return null;
  const { session } = bundle;

  if (session.status !== 'countdown' || !session.startsAt) {
    const dueRooms = bundle.rooms.filter((room) => room.status === 'closing' && room.mergeReadyAt && room.mergeReadyAt.getTime() <= Date.now());
    if (!dueRooms.length) {
      return bundle;
    }

    await completeMergedRooms(useMongo, bundle, dueRooms);
    const updated = await getSessionBundle(useMongo, sessionId);
    if (!updated) return null;
    await maybeEndSessionAfterMerge(useMongo, updated);
    return getSessionBundle(useMongo, sessionId);
  }
  if (session.startsAt.getTime() > Date.now()) {
    const dueRooms = bundle.rooms.filter((room) => room.status === 'closing' && room.mergeReadyAt && room.mergeReadyAt.getTime() <= Date.now());
    if (!dueRooms.length) {
      return bundle;
    }

    await completeMergedRooms(useMongo, bundle, dueRooms);
    const updated = await getSessionBundle(useMongo, sessionId);
    if (!updated) return null;
    await maybeEndSessionAfterMerge(useMongo, updated);
    return getSessionBundle(useMongo, sessionId);
  }

  if (useMongo) {
    await BreakoutSessionModel.updateOne(
      { _id: session.id, status: 'countdown' },
      {
        $set: {
          status: 'active',
          updatedAt: new Date(),
        },
      },
    );
  } else {
    const store = getMemoryStore();
    const existing = store.sessions.get(session.id);
    if (existing && existing.status === 'countdown') {
      existing.status = 'active';
      existing.updatedAt = new Date();
      store.sessions.set(session.id, existing);
    }
  }

  await appendBreakoutEvent(useMongo, {
    sessionId: session.id,
    meetingId: session.meetingId,
    type: 'breakout.started',
    message: 'Breakout countdown completed. Participants are moving into assigned rooms now.',
    payload: null,
    createdBy: 'system',
    createdAt: new Date(),
  });
  const updated = await getSessionBundle(useMongo, session.id);
  if (!updated) return null;
  const dueRooms = updated.rooms.filter((room) => room.status === 'closing' && room.mergeReadyAt && room.mergeReadyAt.getTime() <= Date.now());
  if (dueRooms.length) {
    await completeMergedRooms(useMongo, updated, dueRooms);
  }
  const finalBundle = await getSessionBundle(useMongo, session.id);
  if (!finalBundle) return null;
  await maybeEndSessionAfterMerge(useMongo, finalBundle);
  return getSessionBundle(useMongo, session.id);
}

async function findCurrentSessionId(useMongo: boolean, meetingId: string) {
  if (useMongo) {
    const doc = await BreakoutSessionModel.findOne({
      meetingId,
      status: { $ne: 'ended' },
    }).sort({ createdAt: -1 }).select({ _id: 1 }).lean();
    if (!doc) return null;
    return String((doc as { _id: string })._id);
  }

  const store = getMemoryStore();
  const sessions = Array.from(store.sessions.values())
    .filter((session) => session.meetingId === meetingId && session.status !== 'ended')
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());
  return sessions[0]?.id ?? null;
}

async function endExistingOpenSessions(useMongo: boolean, meetingId: string) {
  const now = new Date();
  if (useMongo) {
    await BreakoutSessionModel.updateMany(
      { meetingId, status: { $ne: 'ended' } },
      { $set: { status: 'ended', endedAt: now, updatedAt: now } },
    );
    return;
  }

  const store = getMemoryStore();
  for (const session of store.sessions.values()) {
    if (session.meetingId === meetingId && session.status !== 'ended') {
      session.status = 'ended';
      session.endedAt = now;
      session.updatedAt = now;
      store.sessions.set(session.id, session);
    }
  }
}

function normalizeParticipants(input: BreakoutParticipantSeed[]) {
  const seen = new Set<string>();
  return input
    .map((participant) => ({
      id: participant.id.trim(),
      displayName: participant.displayName.trim() || 'Participant',
      role: participant.role.trim() || 'attendee',
    }))
    .filter((participant) => {
      if (!participant.id) return false;
      if (seen.has(participant.id)) return false;
      seen.add(participant.id);
      return true;
    });
}

function toManualAssignments(input: ManualAssignmentInput[]) {
  return input
    .map((assignment) => ({
      participantId: assignment.participantId.trim(),
      participantName: assignment.participantName.trim() || 'Participant',
      participantRole: assignment.participantRole.trim() || 'attendee',
      roomId: assignment.roomId.trim(),
    }))
    .filter((assignment) => assignment.participantId && assignment.roomId);
}

function getUnassignedParticipants(
  assignments: BreakoutAssignmentRecord[],
  participantsInput: BreakoutParticipantSeed[],
) {
  const assignedParticipantIds = new Set(assignments.map((assignment) => assignment.participantId));
  return normalizeParticipants(participantsInput)
    .filter((participant) => !isModeratorLikeRole(participant.role))
    .filter((participant) => !assignedParticipantIds.has(participant.id));
}

export async function createBreakoutSessionService(
  meetingId: string,
  createdByUserId: string,
  roomCountInput: number,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const roomCount = normalizeRoomCount(roomCountInput);
  const now = new Date();
  const sessionId = createEntityId('bs');
  const rooms: BreakoutRoomRecord[] = Array.from({ length: roomCount }, (_, index) => ({
    id: createEntityId('br'),
    sessionId,
    meetingId,
    name: createRoomName(index + 1),
    position: index + 1,
    status: 'open',
    mergeReadyAt: null,
    mergedAt: null,
    mergeRequestedBy: null,
  }));

  await endExistingOpenSessions(useMongo, meetingId);

  if (useMongo) {
    await BreakoutSessionModel.create({
      _id: sessionId,
      meetingId,
      createdBy: createdByUserId,
      status: 'draft',
      assignmentMode: 'manual',
      roomCount,
      countdownSeconds: 0,
      startsAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    await BreakoutRoomModel.insertMany(
      rooms.map((room) => ({
        _id: room.id,
        sessionId: room.sessionId,
        meetingId: room.meetingId,
        name: room.name,
        position: room.position,
        status: room.status,
        mergeReadyAt: room.mergeReadyAt,
        mergedAt: room.mergedAt,
        mergeRequestedBy: room.mergeRequestedBy,
      })),
    );
  } else {
    const store = getMemoryStore();
    store.sessions.set(sessionId, {
      id: sessionId,
      meetingId,
      createdBy: createdByUserId,
      status: 'draft',
      assignmentMode: 'manual',
      roomCount,
      countdownSeconds: 0,
      startsAt: null,
      endedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    for (const room of rooms) {
      store.rooms.set(room.id, room);
    }
    store.assignmentsBySession.set(sessionId, new Map());
    store.eventsBySession.set(sessionId, []);
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'session_created',
    message: `Breakout set created with ${roomCount} rooms.`,
    payload: { roomCount },
    createdBy: createdByUserId,
    createdAt: now,
  });

  const bundle = await getSessionBundle(useMongo, sessionId);
  if (!bundle) {
    throw new Error('Unable to initialize breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(bundle.session, bundle.rooms, bundle.assignments, bundle.latestBroadcast, bundle.latestAnnouncement, bundle.helpRequests, undefined, bundle.eventCount),
  };
}

export async function autoAssignBreakoutParticipantsService(
  meetingId: string,
  sessionId: string,
  participantsInput: BreakoutParticipantSeed[],
  assignedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status === 'ended') {
    throw new Error('Breakout session is already ended.');
  }
  if (bundle.session.status !== 'draft') {
    throw new Error('Assignments are locked after breakout start. Use manual moves during the breakout.');
  }
  if (!bundle.rooms.length) {
    throw new Error('Breakout session has no rooms.');
  }

  const participants = normalizeParticipants(participantsInput)
    .filter((participant) => !isModeratorLikeRole(participant.role));
  if (!participants.length) {
    throw new Error('No attendee participants available for auto assignment.');
  }

  const sortedRooms = bundle.rooms
    .filter((room) => room.status === 'open')
    .sort((left, right) => left.position - right.position);
  if (!sortedRooms.length) {
    throw new Error('No open breakout rooms available for assignment.');
  }
  const assignments: BreakoutAssignmentRecord[] = participants.map((participant, index) => {
    const room = sortedRooms[index % sortedRooms.length];
    return {
      id: createAssignmentId(sessionId, participant.id),
      sessionId,
      meetingId,
      roomId: room.id,
      participantId: participant.id,
      participantName: participant.displayName,
      participantRole: participant.role,
      assignmentMethod: 'auto',
      assignedBy: assignedByUserId,
      assignedAt: new Date(),
    };
  });

  if (useMongo) {
    await BreakoutAssignmentModel.deleteMany({ sessionId });
    await BreakoutAssignmentModel.insertMany(
      assignments.map((assignment) => ({
        _id: assignment.id,
        sessionId: assignment.sessionId,
        meetingId: assignment.meetingId,
        roomId: assignment.roomId,
        participantId: assignment.participantId,
        participantName: assignment.participantName,
        participantRole: assignment.participantRole,
        assignmentMethod: assignment.assignmentMethod,
        assignedBy: assignment.assignedBy,
        assignedAt: assignment.assignedAt,
      })),
    );
    await BreakoutSessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          assignmentMode: 'auto',
          updatedAt: new Date(),
        },
      },
    );
  } else {
    const store = getMemoryStore();
    const assignmentMap = new Map<string, BreakoutAssignmentRecord>();
    for (const assignment of assignments) {
      assignmentMap.set(assignment.participantId, assignment);
    }
    store.assignmentsBySession.set(sessionId, assignmentMap);
    const current = store.sessions.get(sessionId);
    if (current) {
      current.assignmentMode = 'auto';
      current.updatedAt = new Date();
      store.sessions.set(sessionId, current);
    }
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'participants_auto_assigned',
    message: `${assignments.length} participants auto-assigned across ${sortedRooms.length} rooms.`,
    payload: {
      roomCount: sortedRooms.length,
      participantCount: assignments.length,
    },
    createdBy: assignedByUserId,
    createdAt: new Date(),
  });

  const updated = await getSessionBundle(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout assignments.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

export async function manualAssignBreakoutParticipantsService(
  meetingId: string,
  sessionId: string,
  assignmentsInput: ManualAssignmentInput[],
  assignedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status === 'ended') {
    throw new Error('Breakout session is already ended.');
  }
  if (bundle.session.status === 'countdown') {
    throw new Error('Assignments are locked while the breakout countdown is running.');
  }

  const assignments = toManualAssignments(assignmentsInput);
  if (!assignments.length) {
    throw new Error('At least one manual assignment is required.');
  }

  const roomIds = new Set(bundle.rooms.filter((room) => room.status === 'open').map((room) => room.id));
  for (const assignment of assignments) {
    if (!roomIds.has(assignment.roomId)) {
      throw new Error('One or more assignments target invalid breakout rooms.');
    }
  }

  if (useMongo) {
    await BreakoutAssignmentModel.bulkWrite(
      assignments.map((assignment) => ({
        updateOne: {
          filter: { sessionId, participantId: assignment.participantId },
          update: {
            $set: {
              meetingId,
              roomId: assignment.roomId,
              participantName: assignment.participantName,
              participantRole: assignment.participantRole,
              assignmentMethod: 'manual',
              assignedBy: assignedByUserId,
              assignedAt: new Date(),
            },
            $setOnInsert: {
              _id: createAssignmentId(sessionId, assignment.participantId),
              sessionId,
              participantId: assignment.participantId,
            },
          },
          upsert: true,
        },
      })),
    );
    await BreakoutSessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          assignmentMode: 'manual',
          updatedAt: new Date(),
        },
      },
    );
  } else {
    const store = getMemoryStore();
    const assignmentMap = store.assignmentsBySession.get(sessionId) ?? new Map<string, BreakoutAssignmentRecord>();
    for (const assignment of assignments) {
      assignmentMap.set(assignment.participantId, {
        id: createAssignmentId(sessionId, assignment.participantId),
        sessionId,
        meetingId,
        roomId: assignment.roomId,
        participantId: assignment.participantId,
        participantName: assignment.participantName,
        participantRole: assignment.participantRole,
        assignmentMethod: 'manual',
        assignedBy: assignedByUserId,
        assignedAt: new Date(),
      });
    }
    store.assignmentsBySession.set(sessionId, assignmentMap);
    const current = store.sessions.get(sessionId);
    if (current) {
      current.assignmentMode = 'manual';
      current.updatedAt = new Date();
      store.sessions.set(sessionId, current);
    }
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'participants_manually_assigned',
    message: `${assignments.length} participants manually assigned.`,
    payload: {
      assignmentCount: assignments.length,
    },
    createdBy: assignedByUserId,
    createdAt: new Date(),
  });

  const updated = await getSessionBundle(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout assignments.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

export async function broadcastBreakoutMessageService(
  meetingId: string,
  sessionId: string,
  messageInput: string,
  sentByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status === 'ended') {
    throw new Error('Breakout session is already ended.');
  }

  const message = normalizeBreakoutMessage(messageInput);
  if (!message) {
    throw new Error('Broadcast message is required.');
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'broadcast_message',
    message,
    payload: { message },
    createdBy: sentByUserId,
    createdAt: new Date(),
  });

  const updated = await syncBreakoutSessionState(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

async function scheduleRoomMerge(
  useMongo: boolean,
  sessionId: string,
  roomIds: string[],
  countdownSeconds: number,
  requestedByUserId: string,
) {
  const now = new Date();
  const mergeReadyAt = new Date(now.getTime() + (countdownSeconds * 1000));

  if (useMongo) {
    await BreakoutRoomModel.updateMany(
      { _id: { $in: roomIds } },
      {
        $set: {
          status: 'closing',
          mergeReadyAt,
          mergeRequestedBy: requestedByUserId,
          mergedAt: null,
        },
      },
    );
    return;
  }

  const store = getMemoryStore();
  for (const roomId of roomIds) {
    const room = store.rooms.get(roomId);
    if (!room) continue;
    room.status = 'closing';
    room.mergeReadyAt = mergeReadyAt;
    room.mergedAt = null;
    room.mergeRequestedBy = requestedByUserId;
    store.rooms.set(roomId, room);
  }
}

export async function mergeBreakoutRoomService(
  meetingId: string,
  sessionId: string,
  roomId: string,
  countdownSecondsInput: number,
  requestedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status === 'ended') {
    throw new Error('Breakout session is already ended.');
  }

  const room = bundle.rooms.find((entry) => entry.id === roomId);
  if (!room) {
    throw new Error('Breakout room not found.');
  }
  if (room.status === 'merged') {
    throw new Error('Breakout room is already merged.');
  }

  const countdownSeconds = normalizeCountdownSeconds(countdownSecondsInput);
  await scheduleRoomMerge(useMongo, sessionId, [roomId], countdownSeconds, requestedByUserId);
  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.merging',
    message: countdownSeconds > 0
      ? `${room.name} is merging back to the main room in ${countdownSeconds} seconds.`
      : `${room.name} is merging back to the main room now.`,
    payload: {
      countdownSeconds,
      roomId,
      roomName: room.name,
    },
    createdBy: requestedByUserId,
    createdAt: new Date(),
  });

  const updated = await syncBreakoutSessionState(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

export async function mergeAllBreakoutRoomsService(
  meetingId: string,
  sessionId: string,
  countdownSecondsInput: number,
  requestedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status === 'ended') {
    throw new Error('Breakout session is already ended.');
  }

  const roomIds = bundle.rooms
    .filter((room) => room.status !== 'merged')
    .map((room) => room.id);
  if (!roomIds.length) {
    throw new Error('All breakout rooms are already merged.');
  }

  const countdownSeconds = normalizeCountdownSeconds(countdownSecondsInput);
  await scheduleRoomMerge(useMongo, sessionId, roomIds, countdownSeconds, requestedByUserId);
  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.merging',
    message: countdownSeconds > 0
      ? `All breakout rooms are merging back to the main room in ${countdownSeconds} seconds.`
      : 'All breakout rooms are merging back to the main room now.',
    payload: {
      countdownSeconds,
      roomCount: roomIds.length,
      roomIds,
    },
    createdBy: requestedByUserId,
    createdAt: new Date(),
  });

  const updated = await syncBreakoutSessionState(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

export async function startBreakoutSessionService(
  meetingId: string,
  sessionId: string,
  countdownSecondsInput: number,
  participantsInput: BreakoutParticipantSeed[],
  startedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await getSessionBundle(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status === 'ended') {
    throw new Error('Breakout session is already ended.');
  }
  if (bundle.session.status === 'active') {
    throw new Error('Breakout session is already active.');
  }
  if (!bundle.assignments.length) {
    throw new Error('Assign attendees before starting breakout.');
  }

  const unassignedParticipants = getUnassignedParticipants(bundle.assignments, participantsInput);
  if (unassignedParticipants.length) {
    throw new Error('Assign every attendee before starting breakout.');
  }

  const countdownSeconds = normalizeCountdownSeconds(countdownSecondsInput);
  const now = new Date();
  const startsAt = new Date(now.getTime() + (countdownSeconds * 1000));
  const status: BreakoutSessionStatus = countdownSeconds > 0 ? 'countdown' : 'active';

  if (useMongo) {
    await BreakoutSessionModel.updateOne(
      { _id: sessionId },
      {
        $set: {
          status,
          countdownSeconds,
          startsAt,
          endedAt: null,
          updatedAt: now,
        },
      },
    );
  } else {
    const store = getMemoryStore();
    const session = store.sessions.get(sessionId);
    if (session) {
      session.status = status;
      session.countdownSeconds = countdownSeconds;
      session.startsAt = startsAt;
      session.endedAt = null;
      session.updatedAt = now;
      store.sessions.set(sessionId, session);
    }
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: countdownSeconds > 0 ? 'breakout.starting' : 'breakout.started',
    message: countdownSeconds > 0
      ? `Breakout starting in ${countdownSeconds} seconds. Assignments are locked and participants will move into their rooms when the timer ends.`
      : 'Breakout started immediately. Participants are moving into their assigned rooms now.',
    payload: {
      countdownSeconds,
      status,
    },
    createdBy: startedByUserId,
    createdAt: now,
  });

  const updated = await getSessionBundle(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

export async function endBreakoutSessionService(
  meetingId: string,
  sessionId: string,
  endedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await getSessionBundle(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }

  const now = new Date();
  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.merging',
    message: 'All breakout rooms are merging back to the main room now.',
    payload: {
      roomIds: bundle.rooms.map((room) => room.id),
    },
    createdBy: endedByUserId,
    createdAt: now,
  });
  await Promise.all(bundle.rooms.map((room) => {
    const scope = resolveMeetingCarbonRoomScope({
      breakoutRoomId: room.id,
      breakoutRoomName: room.name,
      breakoutSessionId: room.sessionId,
      meetingId,
    });
    return clearMeetingRoomParticipants(scope.roomKey, scope);
  }));
  if (useMongo) {
    await Promise.all([
      BreakoutSessionModel.updateOne(
        { _id: sessionId },
        {
          $set: {
            status: 'ended',
            endedAt: now,
            updatedAt: now,
          },
        },
      ),
      BreakoutRoomModel.updateMany(
        { sessionId },
        {
          $set: {
            status: 'merged',
            mergedAt: now,
          },
          $unset: {
            mergeReadyAt: 1,
            mergeRequestedBy: 1,
          },
        },
      ),
      BreakoutAssignmentModel.deleteMany({ sessionId }),
    ]);
  } else {
    const store = getMemoryStore();
    const session = store.sessions.get(sessionId);
    if (session) {
      session.status = 'ended';
      session.endedAt = now;
      session.updatedAt = now;
      store.sessions.set(sessionId, session);
    }
    for (const room of store.rooms.values()) {
      if (room.sessionId !== sessionId) continue;
      room.status = 'merged';
      room.mergeReadyAt = null;
      room.mergedAt = now;
      room.mergeRequestedBy = null;
      store.rooms.set(room.id, room);
    }
    store.assignmentsBySession.set(sessionId, new Map());
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.closed',
    message: 'Breakout rooms closed. Final breakout metrics are rolled into the meeting summary.',
    payload: null,
    createdBy: endedByUserId,
    createdAt: now,
  });

  const updated = await getSessionBundle(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, undefined, updated.eventCount),
  };
}

export async function requestBreakoutHelpService(
  meetingId: string,
  sessionId: string,
  participantId: string,
  participantName: string,
  requestedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status !== 'active') {
    throw new Error('Help requests are available only during an active breakout.');
  }

  const assignment = bundle.assignments.find((entry) => entry.participantId === participantId);
  if (!assignment) {
    throw new Error('Participant is not assigned to an active breakout room.');
  }

  const room = bundle.rooms.find((entry) => entry.id === assignment.roomId);
  if (!room || room.status === 'merged') {
    throw new Error('Assigned breakout room is no longer active.');
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.help_requested',
    message: `${participantName.trim() || 'Participant'} requested host help in ${room.name}.`,
    payload: {
      kind: 'help',
      participantId,
      participantName: participantName.trim() || 'Participant',
      roomId: room.id,
      roomName: room.name,
    },
    createdBy: requestedByUserId,
    createdAt: new Date(),
  });

  const updated = await syncBreakoutSessionState(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, participantId, updated.eventCount),
  };
}

export async function requestBreakoutMergeService(
  meetingId: string,
  sessionId: string,
  participantId: string,
  participantName: string,
  requestedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }
  if (bundle.session.status !== 'active') {
    throw new Error('Merge requests are available only during an active breakout.');
  }

  const assignment = bundle.assignments.find((entry) => entry.participantId === participantId);
  if (!assignment) {
    throw new Error('Participant is not assigned to an active breakout room.');
  }
  if (!isRoomLeadRole(assignment.participantRole)) {
    throw new Error('Only the room lead can request a merge for this breakout room.');
  }

  const room = bundle.rooms.find((entry) => entry.id === assignment.roomId);
  if (!room || room.status === 'merged') {
    throw new Error('Assigned breakout room is no longer active.');
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.help_requested',
    message: `${participantName.trim() || assignment.participantName} requested to merge ${room.name}.`,
    payload: {
      kind: 'merge',
      participantId,
      participantName: participantName.trim() || assignment.participantName,
      roomId: room.id,
      roomName: room.name,
    },
    createdBy: requestedByUserId,
    createdAt: new Date(),
  });

  const updated = await syncBreakoutSessionState(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, participantId, updated.eventCount),
  };
}

export async function clearBreakoutHelpRequestService(
  meetingId: string,
  sessionId: string,
  participantId: string,
  clearedByUserId: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle || bundle.session.meetingId !== meetingId) {
    throw new Error('Breakout session not found.');
  }

  await appendBreakoutEvent(useMongo, {
    sessionId,
    meetingId,
    type: 'breakout.help_cleared',
    message: 'Breakout help request cleared.',
    payload: {
      participantId,
    },
    createdBy: clearedByUserId,
    createdAt: new Date(),
  });

  const updated = await syncBreakoutSessionState(useMongo, sessionId);
  if (!updated) {
    throw new Error('Unable to load breakout session.');
  }
  return {
    demoMode: !useMongo,
    value: buildSnapshot(updated.session, updated.rooms, updated.assignments, updated.latestBroadcast, updated.latestAnnouncement, updated.helpRequests, participantId, updated.eventCount),
  };
}

export async function getCurrentBreakoutSessionService(
  meetingId: string,
  participantId?: string,
): Promise<DataSourceResult<BreakoutSessionSnapshot | null>> {
  const connection = await dbConnect();
  const useMongo = Boolean(connection);
  const sessionId = await findCurrentSessionId(useMongo, meetingId);
  if (!sessionId) {
    return { demoMode: !useMongo, value: null };
  }

  const bundle = await syncBreakoutSessionState(useMongo, sessionId);
  if (!bundle) {
    return { demoMode: !useMongo, value: null };
  }

  return {
    demoMode: !useMongo,
    value: buildSnapshot(bundle.session, bundle.rooms, bundle.assignments, bundle.latestBroadcast, bundle.latestAnnouncement, bundle.helpRequests, participantId, bundle.eventCount),
  };
}
