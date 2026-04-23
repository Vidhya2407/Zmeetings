import dbConnect from '@/lib/db/mongodb';
import MeetingRoomStateModel from '@/lib/models/MeetingRoomState';
import {
  calcCameraOffSaving,
  calcMeetingSnapshot,
  calcParticipantRate,
  createParticipantState,
  type MeetingCarbonSnapshot,
  type MeetingMediaState,
  type MeetingParticipantSeed,
  type MeetingParticipantState,
} from './carbonCalc';

type MeetingRoomState = {
  lastAccumulatedAt: Date;
  participantOwners: Record<string, string>;
  participants: MeetingParticipantState[];
  roomLocked: boolean;
  roomId: string;
  startedAt: Date;
  waitingParticipants: MeetingParticipantSeed[];
};

type MeetingRoomDoc = {
  _id: string;
  lastAccumulatedAt?: Date | string;
  participantOwners?: Record<string, string> | Map<string, string>;
  participants?: Array<{
    cumulativeG?: number;
    displayName?: string;
    id?: string;
    joinedAt?: Date | string;
    lastStateChange?: Date | string;
    media?: MeetingMediaState;
    rateGPerMin?: number;
    role?: string;
  }>;
  roomLocked?: boolean;
  startedAt?: Date | string;
  waitingParticipants?: Array<{
    displayName?: string;
    id?: string;
    media?: MeetingMediaState;
    role?: string;
  }>;
};

export type MeetingRoomPayload = {
  cameraOffSaving: ReturnType<typeof calcCameraOffSaving>;
  participants: MeetingParticipantState[];
  roomLocked: boolean;
  roomId: string;
  snapshot: MeetingCarbonSnapshot;
  startedAt: string;
  syncedAt: string;
  waitingParticipants: MeetingParticipantSeed[];
};

type RoomStore = Map<string, MeetingRoomState>;

declare global {
  // eslint-disable-next-line no-var
  var __meetingRoomStoreLegacy: RoomStore | undefined;
}

function getRoomStore(): RoomStore {
  if (!globalThis.__meetingRoomStoreLegacy) {
    globalThis.__meetingRoomStoreLegacy = new Map<string, MeetingRoomState>();
  }

  return globalThis.__meetingRoomStoreLegacy;
}

function cloneParticipant(participant: MeetingParticipantState): MeetingParticipantState {
  return {
    ...participant,
    media: { ...participant.media },
    joinedAt: new Date(participant.joinedAt),
    lastStateChange: new Date(participant.lastStateChange),
  };
}

function cloneParticipantSeed(participant: MeetingParticipantSeed): MeetingParticipantSeed {
  return {
    ...participant,
    media: { ...participant.media },
  };
}

function toDate(value: Date | string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function toNumber(value: number | undefined, fallback = 0) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback;
  return value;
}

function toMapObject(value: Record<string, string> | Map<string, string> | undefined) {
  if (!value) return {} as Record<string, string>;
  if (value instanceof Map) {
    return Object.fromEntries(value.entries());
  }
  return { ...value };
}

function normalizeMedia(value: MeetingMediaState | undefined): MeetingMediaState {
  return {
    camera: Boolean(value?.camera),
    microphone: Boolean(value?.microphone),
    screenShare: Boolean(value?.screenShare),
  };
}

function deserializeMeetingRoom(doc: MeetingRoomDoc): MeetingRoomState {
  const now = new Date();
  return {
    roomId: doc._id,
    startedAt: toDate(doc.startedAt, now),
    lastAccumulatedAt: toDate(doc.lastAccumulatedAt, now),
    roomLocked: Boolean(doc.roomLocked),
    participantOwners: toMapObject(doc.participantOwners),
    participants: (doc.participants ?? []).map((participant) => {
      const media = normalizeMedia(participant.media);
      return {
        id: participant.id ?? '',
        displayName: participant.displayName ?? 'Participant',
        role: participant.role ?? 'attendee',
        media,
        cumulativeG: Math.max(0, toNumber(participant.cumulativeG, 0)),
        rateGPerMin: Math.max(0, toNumber(participant.rateGPerMin, calcParticipantRate(media))),
        joinedAt: toDate(participant.joinedAt, now),
        lastStateChange: toDate(participant.lastStateChange, now),
      };
    }),
    waitingParticipants: (doc.waitingParticipants ?? []).map((participant) => ({
      id: participant.id ?? '',
      displayName: participant.displayName ?? 'Participant',
      role: participant.role ?? 'attendee',
      media: normalizeMedia(participant.media),
    })),
  };
}

async function loadMeetingRoom(roomId: string) {
  const store = getRoomStore();
  const cached = store.get(roomId);
  if (cached) return cached;

  const connection = await dbConnect();
  if (!connection) return null;

  const doc = await MeetingRoomStateModel.findById(roomId).lean();
  if (!doc) return null;
  const hydrated = deserializeMeetingRoom(doc as MeetingRoomDoc);
  store.set(roomId, hydrated);
  return hydrated;
}

async function persistMeetingRoom(room: MeetingRoomState) {
  const store = getRoomStore();
  store.set(room.roomId, room);

  const connection = await dbConnect();
  if (!connection) return;

  await MeetingRoomStateModel.updateOne(
    { _id: room.roomId },
    {
      $set: {
        startedAt: room.startedAt,
        lastAccumulatedAt: room.lastAccumulatedAt,
        roomLocked: room.roomLocked,
        participantOwners: room.participantOwners,
        participants: room.participants.map((participant) => ({
          id: participant.id,
          displayName: participant.displayName,
          role: participant.role,
          media: participant.media,
          cumulativeG: participant.cumulativeG,
          rateGPerMin: participant.rateGPerMin,
          joinedAt: participant.joinedAt,
          lastStateChange: participant.lastStateChange,
        })),
        waitingParticipants: room.waitingParticipants.map((participant) => ({
          id: participant.id,
          displayName: participant.displayName,
          role: participant.role,
          media: participant.media,
        })),
      },
    },
    { upsert: true },
  );
}

function isPrivilegedParticipantRole(role: string) {
  const normalized = role.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized.includes('host') ||
    normalized.includes('cohost') ||
    normalized.includes('admin') ||
    normalized.includes('owner') ||
    normalized.includes('moderator')
  );
}

function syncRoomAccumulation(room: MeetingRoomState) {
  const now = new Date();
  const elapsedMinutes = (now.getTime() - room.lastAccumulatedAt.getTime()) / 60000;

  if (elapsedMinutes > 0) {
    room.participants = room.participants.map((participant) => ({
      ...participant,
      cumulativeG: participant.cumulativeG + (participant.rateGPerMin * elapsedMinutes),
    }));
  }

  room.lastAccumulatedAt = now;
}

export async function ensureMeetingRoom(roomId: string, initialParticipants: MeetingParticipantSeed[] = []) {
  let room = await loadMeetingRoom(roomId);

  if (!room) {
    const now = new Date();
    room = {
      roomId,
      startedAt: now,
      lastAccumulatedAt: now,
      roomLocked: false,
      participants: initialParticipants.map(createParticipantState),
      waitingParticipants: [],
      participantOwners: {},
    };
    await persistMeetingRoom(room);
  } else {
    syncRoomAccumulation(room);
    if (!room.participants.length && initialParticipants.length) {
      room.participants = initialParticipants.map(createParticipantState);
      room.startedAt = new Date();
      room.lastAccumulatedAt = new Date();
      room.waitingParticipants = [];
    }
    await persistMeetingRoom(room);
  }

  return room;
}

export async function joinMeetingParticipant(
  roomId: string,
  participant: MeetingParticipantSeed,
  actorUserId?: string,
) {
  const room = await ensureMeetingRoom(roomId);
  syncRoomAccumulation(room);

  if (actorUserId) {
    room.participantOwners[participant.id] = actorUserId;
  }

  const existingActive = room.participants.find((entry) => entry.id === participant.id);
  if (existingActive) {
    await persistMeetingRoom(room);
    return serializeMeetingRoom(room);
  }

  const waitingIndex = room.waitingParticipants.findIndex((entry) => entry.id === participant.id);
  if (waitingIndex >= 0) {
    if (!room.roomLocked) {
      const [waitingParticipant] = room.waitingParticipants.splice(waitingIndex, 1);
      room.participants.push(createParticipantState(waitingParticipant));
    }
    await persistMeetingRoom(room);
    return serializeMeetingRoom(room);
  }

  if (room.roomLocked && !isPrivilegedParticipantRole(participant.role)) {
    room.waitingParticipants.push(cloneParticipantSeed(participant));
  } else {
    room.participants.push(createParticipantState(participant));
  }

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function updateMeetingParticipantMedia(
  roomId: string,
  participantId: string,
  field: keyof MeetingMediaState,
  value: boolean,
) {
  const room = await ensureMeetingRoom(roomId);
  syncRoomAccumulation(room);

  const participantExists = room.participants.some((participant) => participant.id === participantId);
  if (!participantExists) {
    throw new Error('Meeting participant not found.');
  }

  room.participants = room.participants.map((participant) => {
    if (participant.id !== participantId) return participant;

    const media = { ...participant.media, [field]: value };
    return {
      ...participant,
      media,
      rateGPerMin: calcParticipantRate(media),
      lastStateChange: new Date(),
    };
  });

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function updateMeetingRoomMedia(
  roomId: string,
  field: keyof MeetingMediaState,
  value: boolean,
) {
  const room = await ensureMeetingRoom(roomId);
  syncRoomAccumulation(room);

  room.participants = room.participants.map((participant) => {
    const media = { ...participant.media, [field]: value };
    return {
      ...participant,
      media,
      rateGPerMin: calcParticipantRate(media),
      lastStateChange: new Date(),
    };
  });

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function setMeetingRoomLock(roomId: string, value: boolean) {
  const room = await ensureMeetingRoom(roomId);
  syncRoomAccumulation(room);
  room.roomLocked = value;
  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function admitMeetingWaitingParticipant(roomId: string, participantId: string) {
  const room = await ensureMeetingRoom(roomId);
  syncRoomAccumulation(room);

  const waitingIndex = room.waitingParticipants.findIndex((participant) => participant.id === participantId);
  if (waitingIndex < 0) {
    throw new Error('Waiting participant not found.');
  }

  const [waitingParticipant] = room.waitingParticipants.splice(waitingIndex, 1);
  const existsInActiveRoom = room.participants.some((participant) => participant.id === waitingParticipant.id);
  if (!existsInActiveRoom) {
    room.participants.push(createParticipantState(waitingParticipant));
  }

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function removeMeetingParticipant(roomId: string, participantId: string) {
  const room = await ensureMeetingRoom(roomId);
  syncRoomAccumulation(room);

  const beforeActiveCount = room.participants.length;
  const beforeWaitingCount = room.waitingParticipants.length;
  room.participants = room.participants.filter((participant) => participant.id !== participantId);
  room.waitingParticipants = room.waitingParticipants.filter((participant) => participant.id !== participantId);
  if (room.participantOwners[participantId]) {
    delete room.participantOwners[participantId];
  }

  const removed = beforeActiveCount !== room.participants.length || beforeWaitingCount !== room.waitingParticipants.length;
  if (!removed) {
    throw new Error('Meeting participant not found.');
  }

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function isParticipantOwnedByUser(roomId: string, participantId: string, userId: string) {
  const room = await ensureMeetingRoom(roomId);
  return room.participantOwners[participantId] === userId;
}

export function serializeMeetingRoom(room: MeetingRoomState): MeetingRoomPayload {
  syncRoomAccumulation(room);

  const participants = room.participants.map(cloneParticipant);
  return {
    roomId: room.roomId,
    participants,
    waitingParticipants: room.waitingParticipants.map(cloneParticipantSeed),
    roomLocked: room.roomLocked,
    snapshot: calcMeetingSnapshot(participants, room.startedAt),
    cameraOffSaving: calcCameraOffSaving(participants),
    startedAt: room.startedAt.toISOString(),
    syncedAt: new Date().toISOString(),
  };
}

export async function getMeetingRoom(roomId: string, initialParticipants: MeetingParticipantSeed[] = []) {
  const room = await ensureMeetingRoom(roomId, initialParticipants);
  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}
