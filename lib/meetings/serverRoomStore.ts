import dbConnect from '@/lib/db/mongodb';
import MeetingRoomStateModel from '@/lib/models/MeetingRoomState';
import type { MeetingCarbonSummary } from '@/types/domain/meetingCarbon';
import {
  resolveMeetingCarbonRoomScope,
  type MeetingCarbonRoomScope,
  type MeetingCarbonRoomType,
} from './carbonRoomScope';
import {
  calcCameraOffSaving,
  calcMeetingSnapshot,
  calcParticipantRate,
  createParticipantState,
  type MeetingCarbonSnapshot,
  type MeetingMediaState,
  type MeetingNetworkQualityLevel,
  type MeetingParticipantNetworkDetails,
  type MeetingParticipantSeed,
  type MeetingParticipantState,
} from './carbonCalc';

type MeetingRoomState = {
  breakoutRoomId: string | null;
  breakoutSessionId: string | null;
  lastAccumulatedAt: Date;
  meetingId: string;
  participantOwners: Record<string, string>;
  participants: MeetingParticipantState[];
  roomKey: string;
  roomLabel: string;
  roomLocked: boolean;
  roomType: MeetingCarbonRoomType;
  recordingEnabled: boolean;
  startedAt: Date;
  transcriptEnabled: boolean;
  waitingParticipants: MeetingParticipantSeed[];
};

type MeetingRoomDoc = {
  _id: string;
  breakoutRoomId?: string | null;
  breakoutSessionId?: string | null;
  lastAccumulatedAt?: Date | string;
  meetingId?: string;
  participantOwners?: Record<string, string> | Map<string, string>;
  participants?: Array<{
    cumulativeG?: number;
    displayName?: string;
    id?: string;
    joinedAt?: Date | string;
    lastStateChange?: Date | string;
    media?: MeetingMediaState;
    network?: Partial<MeetingParticipantNetworkDetails> | null;
    rateGPerMin?: number;
    role?: string;
  }>;
  roomLabel?: string;
  roomLocked?: boolean;
  roomType?: MeetingCarbonRoomType | string;
  recordingEnabled?: boolean;
  startedAt?: Date | string;
  transcriptEnabled?: boolean;
  waitingParticipants?: Array<{
    displayName?: string;
    id?: string;
    media?: MeetingMediaState;
    network?: Partial<MeetingParticipantNetworkDetails> | null;
    role?: string;
  }>;
};

export type MeetingRoomPayload = {
  breakoutRoomId: string | null;
  breakoutSessionId: string | null;
  cameraOffSaving: ReturnType<typeof calcCameraOffSaving>;
  meetingId: string;
  participants: MeetingParticipantState[];
  roomKey: string;
  roomLabel: string;
  roomLocked: boolean;
  roomType: MeetingCarbonRoomType;
  recordingEnabled: boolean;
  snapshot: MeetingCarbonSnapshot;
  startedAt: string;
  syncedAt: string;
  transcriptEnabled: boolean;
  waitingParticipants: MeetingParticipantSeed[];
};

export type MeetingRoomFeature = 'recordingEnabled' | 'transcriptEnabled';

type MeetingRoomCarbonContribution = NonNullable<MeetingCarbonSummary['rooms']>[number];

type RoomStore = Map<string, MeetingRoomState>;

declare global {
  // eslint-disable-next-line no-var
  var __meetingRoomStore: RoomStore | undefined;
}

function getRoomStore(): RoomStore {
  if (!globalThis.__meetingRoomStore) {
    globalThis.__meetingRoomStore = new Map<string, MeetingRoomState>();
  }

  return globalThis.__meetingRoomStore;
}

function cloneParticipant(participant: MeetingParticipantState): MeetingParticipantState {
  return {
    ...participant,
    media: { ...participant.media },
    network: cloneNetworkDetails(participant.network),
    joinedAt: new Date(participant.joinedAt),
    lastStateChange: new Date(participant.lastStateChange),
  };
}

function cloneParticipantSeed(participant: MeetingParticipantSeed): MeetingParticipantSeed {
  return {
    ...participant,
    media: { ...participant.media },
    network: cloneNetworkDetails(participant.network),
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

function isNetworkQualityLevel(value: unknown): value is MeetingNetworkQualityLevel {
  return value === 'excellent' || value === 'good' || value === 'fair' || value === 'poor' || value === 'offline';
}

function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : null;
}

function normalizeOptionalString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function cloneNetworkDetails(value?: Partial<MeetingParticipantNetworkDetails> | null): MeetingParticipantNetworkDetails | null {
  if (!value) return null;
  return normalizeNetworkDetails(value);
}

function normalizeNetworkDetails(
  value?: Partial<MeetingParticipantNetworkDetails> | null,
  fallbackDate = new Date(),
): MeetingParticipantNetworkDetails | null {
  if (!value) return null;
  const updatedAt = toDate(value.updatedAt, fallbackDate);

  return {
    downlinkMbps: normalizeOptionalNumber(value.downlinkMbps),
    effectiveType: normalizeOptionalString(value.effectiveType, 24),
    isOnline: value.isOnline !== false,
    level: isNetworkQualityLevel(value.level) ? value.level : 'good',
    locale: normalizeOptionalString(value.locale, 40),
    locationLabel: normalizeOptionalString(value.locationLabel, 160),
    rttMs: normalizeOptionalNumber(value.rttMs),
    timezone: normalizeOptionalString(value.timezone, 80),
    updatedAt,
  };
}

function toNullableId(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeRoomStateScope(roomKey: string, scope?: Partial<MeetingCarbonRoomScope>): Pick<MeetingRoomState, 'breakoutRoomId' | 'breakoutSessionId' | 'meetingId' | 'roomKey' | 'roomLabel' | 'roomType'> {
  const normalized = resolveMeetingCarbonRoomScope({
    meetingId: scope?.meetingId ?? roomKey,
    breakoutSessionId: scope?.breakoutSessionId ?? null,
    breakoutRoomId: scope?.breakoutRoomId ?? null,
    breakoutRoomName: scope?.roomLabel ?? null,
  });

  return {
    breakoutRoomId: normalized.breakoutRoomId,
    breakoutSessionId: normalized.breakoutSessionId,
    meetingId: normalized.meetingId,
    roomKey,
    roomLabel: scope?.roomLabel?.trim() || normalized.roomLabel,
    roomType: scope?.roomType ?? normalized.roomType,
  };
}

function areMediaStatesEqual(left: MeetingMediaState, right: MeetingMediaState) {
  return (
    left.camera === right.camera
    && left.microphone === right.microphone
    && left.screenShare === right.screenShare
  );
}

function deserializeMeetingRoom(doc: MeetingRoomDoc): MeetingRoomState {
  const now = new Date();
  const fallbackScope = normalizeRoomStateScope(doc._id, {
    breakoutRoomId: toNullableId(doc.breakoutRoomId),
    breakoutSessionId: toNullableId(doc.breakoutSessionId),
    meetingId: doc.meetingId?.trim() || doc._id,
    roomLabel: doc.roomLabel?.trim() || undefined,
    roomType: doc.roomType === 'breakout' ? 'breakout' : 'main',
  });
  return {
    ...fallbackScope,
    startedAt: toDate(doc.startedAt, now),
    lastAccumulatedAt: toDate(doc.lastAccumulatedAt, now),
    roomLocked: Boolean(doc.roomLocked),
    recordingEnabled: Boolean(doc.recordingEnabled),
    transcriptEnabled: Boolean(doc.transcriptEnabled),
    participantOwners: toMapObject(doc.participantOwners),
    participants: (doc.participants ?? []).map((participant) => {
      const media = normalizeMedia(participant.media);
      return {
        id: participant.id ?? '',
        displayName: participant.displayName ?? 'Participant',
        role: participant.role ?? 'attendee',
        media,
        network: normalizeNetworkDetails(participant.network, now),
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
      network: normalizeNetworkDetails(participant.network, now),
    })),
  };
}

async function loadMeetingRoom(roomKey: string, scope?: Partial<MeetingCarbonRoomScope>) {
  const store = getRoomStore();
  const cached = store.get(roomKey);
  if (cached) {
    cached.recordingEnabled = Boolean(cached.recordingEnabled);
    cached.transcriptEnabled = Boolean(cached.transcriptEnabled);
    if (scope && (!cached.roomLabel || cached.roomLabel === 'Main Room' || cached.roomLabel.startsWith('Breakout '))) {
      const nextScope = normalizeRoomStateScope(roomKey, {
        ...scope,
        meetingId: scope.meetingId ?? cached.meetingId,
      });
      cached.roomLabel = nextScope.roomLabel;
      cached.roomType = nextScope.roomType;
      cached.breakoutSessionId = nextScope.breakoutSessionId;
      cached.breakoutRoomId = nextScope.breakoutRoomId;
      cached.meetingId = nextScope.meetingId;
    }
    return cached;
  }

  const connection = await dbConnect();
  if (!connection) return null;

  const doc = await MeetingRoomStateModel.findById(roomKey).lean();
  if (!doc) return null;
  const hydrated = deserializeMeetingRoom(doc as MeetingRoomDoc);
  if (scope) {
    const nextScope = normalizeRoomStateScope(roomKey, {
      ...scope,
      meetingId: scope.meetingId ?? hydrated.meetingId,
    });
    hydrated.roomLabel = nextScope.roomLabel;
    hydrated.roomType = nextScope.roomType;
    hydrated.breakoutSessionId = nextScope.breakoutSessionId;
    hydrated.breakoutRoomId = nextScope.breakoutRoomId;
    hydrated.meetingId = nextScope.meetingId;
  }
  store.set(roomKey, hydrated);
  return hydrated;
}

async function persistMeetingRoom(room: MeetingRoomState) {
  const store = getRoomStore();
  store.set(room.roomKey, room);

  const connection = await dbConnect();
  if (!connection) return;

  await MeetingRoomStateModel.updateOne(
    { _id: room.roomKey },
    {
      $set: {
        meetingId: room.meetingId,
        roomType: room.roomType,
        roomLabel: room.roomLabel,
        breakoutSessionId: room.breakoutSessionId,
        breakoutRoomId: room.breakoutRoomId,
        startedAt: room.startedAt,
        lastAccumulatedAt: room.lastAccumulatedAt,
        roomLocked: room.roomLocked,
        recordingEnabled: room.recordingEnabled,
        transcriptEnabled: room.transcriptEnabled,
        participantOwners: room.participantOwners,
        participants: room.participants.map((participant) => ({
          id: participant.id,
          displayName: participant.displayName,
          role: participant.role,
          media: participant.media,
          network: cloneNetworkDetails(participant.network),
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
          network: cloneNetworkDetails(participant.network),
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
  return ensureMeetingRoomWithScope(roomId, initialParticipants, { meetingId: roomId, roomType: 'main' });
}

export async function ensureMeetingRoomWithScope(
  roomKey: string,
  initialParticipants: MeetingParticipantSeed[] = [],
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  let room = await loadMeetingRoom(roomKey, scope);
  const normalizedScope = normalizeRoomStateScope(roomKey, scope);

  if (!room) {
    const now = new Date();
    room = {
      ...normalizedScope,
      startedAt: now,
      lastAccumulatedAt: now,
      roomLocked: false,
      recordingEnabled: false,
      transcriptEnabled: false,
      participants: initialParticipants.map(createParticipantState),
      waitingParticipants: [],
      participantOwners: {},
    };
    await persistMeetingRoom(room);
  } else {
    syncRoomAccumulation(room);
    room.meetingId = normalizedScope.meetingId;
    room.roomType = normalizedScope.roomType;
    room.roomLabel = normalizedScope.roomLabel;
    room.breakoutSessionId = normalizedScope.breakoutSessionId;
    room.breakoutRoomId = normalizedScope.breakoutRoomId;
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
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, [], scope);
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
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, [], scope);
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
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, [], scope);
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

export async function syncMeetingParticipantsFromSfu(
  roomId: string,
  nextParticipants: MeetingParticipantSeed[],
  actorUserId?: string,
  ownedParticipantIds: string[] = [],
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, [], scope);
  syncRoomAccumulation(room);

  const previousParticipantsById = new Map(
    room.participants.map((participant) => [participant.id, participant]),
  );

  const resolvedParticipants = nextParticipants.map((participant) => {
    const existing = previousParticipantsById.get(participant.id);
    if (!existing) {
      return createParticipantState({
        ...participant,
        network: normalizeNetworkDetails(participant.network),
      });
    }

    const media = normalizeMedia(participant.media);
    const mediaChanged = !areMediaStatesEqual(existing.media, media);
    return {
      ...existing,
      displayName: participant.displayName,
      role: participant.role,
      media,
      network: normalizeNetworkDetails(participant.network) ?? cloneNetworkDetails(existing.network),
      rateGPerMin: calcParticipantRate(media),
      lastStateChange: mediaChanged ? new Date() : existing.lastStateChange,
    };
  });

  const activeParticipantIds = new Set(resolvedParticipants.map((participant) => participant.id));
  room.participants = resolvedParticipants;
  room.waitingParticipants = room.waitingParticipants.filter((participant) => !activeParticipantIds.has(participant.id));

  for (const participantId of Object.keys(room.participantOwners)) {
    if (!activeParticipantIds.has(participantId)) {
      delete room.participantOwners[participantId];
    }
  }

  if (actorUserId) {
    for (const participantId of ownedParticipantIds) {
      if (activeParticipantIds.has(participantId)) {
        room.participantOwners[participantId] = actorUserId;
      }
    }
  }

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function updateMeetingParticipantNetwork(
  roomId: string,
  participantId: string,
  network: Partial<MeetingParticipantNetworkDetails>,
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, [], scope);
  syncRoomAccumulation(room);

  const nextNetwork = normalizeNetworkDetails({
    ...network,
    updatedAt: new Date(),
  });
  if (!nextNetwork) {
    throw new Error('Invalid participant network details.');
  }

  let updated = false;
  room.participants = room.participants.map((participant) => {
    if (participant.id !== participantId) return participant;
    updated = true;
    return {
      ...participant,
      network: nextNetwork,
    };
  });

  room.waitingParticipants = room.waitingParticipants.map((participant) => {
    if (participant.id !== participantId) return participant;
    updated = true;
    return {
      ...participant,
      network: nextNetwork,
    };
  });

  if (!updated) {
    throw new Error('Meeting participant not found.');
  }

  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function setMeetingRoomLock(roomId: string, value: boolean) {
  const room = await ensureMeetingRoomWithScope(roomId);
  syncRoomAccumulation(room);
  room.roomLocked = value;
  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function setMeetingRoomFeature(roomId: string, feature: MeetingRoomFeature, value: boolean) {
  const room = await ensureMeetingRoomWithScope(roomId);
  syncRoomAccumulation(room);
  room[feature] = value;
  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function admitMeetingWaitingParticipant(roomId: string, participantId: string) {
  const room = await ensureMeetingRoomWithScope(roomId);
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
  const room = await ensureMeetingRoomWithScope(roomId);
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
  const room = await ensureMeetingRoomWithScope(roomId);
  return room.participantOwners[participantId] === userId;
}

export function serializeMeetingRoom(room: MeetingRoomState): MeetingRoomPayload {
  syncRoomAccumulation(room);

  const participants = room.participants.map(cloneParticipant);
  return {
    breakoutRoomId: room.breakoutRoomId,
    breakoutSessionId: room.breakoutSessionId,
    participants,
    meetingId: room.meetingId,
    roomKey: room.roomKey,
    roomLabel: room.roomLabel,
    waitingParticipants: room.waitingParticipants.map(cloneParticipantSeed),
    roomLocked: room.roomLocked,
    roomType: room.roomType,
    recordingEnabled: room.recordingEnabled,
    transcriptEnabled: room.transcriptEnabled,
    snapshot: calcMeetingSnapshot(participants, room.startedAt),
    cameraOffSaving: calcCameraOffSaving(participants),
    startedAt: room.startedAt.toISOString(),
    syncedAt: new Date().toISOString(),
  };
}

export async function getMeetingRoom(
  roomId: string,
  initialParticipants: MeetingParticipantSeed[] = [],
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, initialParticipants, scope);
  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

export async function clearMeetingRoomParticipants(
  roomId: string,
  scope?: Partial<MeetingCarbonRoomScope>,
) {
  const room = await ensureMeetingRoomWithScope(roomId, [], scope);
  syncRoomAccumulation(room);
  room.participants = [];
  room.waitingParticipants = [];
  room.participantOwners = {};
  room.lastAccumulatedAt = new Date();
  await persistMeetingRoom(room);
  return serializeMeetingRoom(room);
}

function toRoomContribution(room: MeetingRoomState): MeetingRoomCarbonContribution {
  const payload = serializeMeetingRoom(room);
  return {
    breakoutRoomId: payload.breakoutRoomId,
    breakoutSessionId: payload.breakoutSessionId,
    carbonKg: Number((payload.snapshot.totalCumulativeG / 1000).toFixed(6)),
    durationSeconds: payload.snapshot.durationSeconds,
    label: payload.roomLabel,
    participantCount: payload.snapshot.participantCount,
    roomKey: payload.roomKey,
    roomType: payload.roomType,
    totalCumulativeG: payload.snapshot.totalCumulativeG,
    totalRateGPerMin: payload.snapshot.totalRateGPerMin,
    breakdown: payload.snapshot.breakdown,
  };
}

function buildMeetingCarbonSummary(
  rooms: MeetingRoomState[],
): MeetingCarbonSummary | null {
  const contributions = rooms
    .map(toRoomContribution)
    .filter((room) => room.roomType === 'main' || room.totalCumulativeG > 0 || room.participantCount > 0);
  if (!contributions.length) {
    return null;
  }

  const mainRoom = contributions.find((room) => room.roomType === 'main') ?? null;
  const breakoutRooms = contributions.filter((room) => room.roomType === 'breakout');
  const totalKg = contributions.reduce((sum, room) => sum + room.carbonKg, 0);
  const breakoutKg = breakoutRooms.reduce((sum, room) => sum + room.carbonKg, 0);

  return {
    breakoutKg: Number(breakoutKg.toFixed(6)),
    breakoutRoomCount: breakoutRooms.length,
    breakoutSharePercent: totalKg > 0 ? Number(((breakoutKg / totalKg) * 100).toFixed(2)) : 0,
    mainRoomKg: Number((mainRoom?.carbonKg ?? 0).toFixed(6)),
    roomCount: contributions.length,
    rooms: contributions.sort((left, right) => left.label.localeCompare(right.label)),
    totalKg: Number(totalKg.toFixed(6)),
  };
}

async function loadMeetingRoomsForAggregation(meetingId: string) {
  const store = getRoomStore();
  const memoryRooms = Array.from(store.values())
    .filter((room) => room.meetingId === meetingId || room.roomKey === meetingId)
    .map((room) => {
      syncRoomAccumulation(room);
      return room;
    });

  const connection = await dbConnect();
  if (!connection) {
    return memoryRooms;
  }

  const docs = await MeetingRoomStateModel.find({
    $or: [
      { meetingId },
      { _id: meetingId },
    ],
  }).lean();

  const roomMap = new Map<string, MeetingRoomState>();
  for (const room of memoryRooms) {
    roomMap.set(room.roomKey, room);
  }
  for (const doc of docs as MeetingRoomDoc[]) {
    if (!roomMap.has(doc._id)) {
      roomMap.set(doc._id, deserializeMeetingRoom(doc));
    }
  }

  return Array.from(roomMap.values()).map((room) => {
    syncRoomAccumulation(room);
    return room;
  });
}

export async function getMeetingCarbonSummary(meetingId: string) {
  const rooms = await loadMeetingRoomsForAggregation(meetingId);
  return buildMeetingCarbonSummary(rooms);
}

export async function getMeetingCarbonSummaryMap(meetingIds: string[]) {
  const uniqueMeetingIds = Array.from(new Set(meetingIds.map((meetingId) => meetingId.trim()).filter(Boolean)));
  const summaries = new Map<string, MeetingCarbonSummary | null>();
  if (!uniqueMeetingIds.length) {
    return summaries;
  }

  const store = getRoomStore();
  const roomsByMeetingId = new Map<string, MeetingRoomState[]>();
  for (const room of store.values()) {
    const meetingId = room.meetingId || room.roomKey;
    if (!uniqueMeetingIds.includes(meetingId)) continue;
    syncRoomAccumulation(room);
    const current = roomsByMeetingId.get(meetingId) ?? [];
    current.push(room);
    roomsByMeetingId.set(meetingId, current);
  }

  const connection = await dbConnect();
  if (connection) {
    const docs = await MeetingRoomStateModel.find({
      $or: [
        { meetingId: { $in: uniqueMeetingIds } },
        { _id: { $in: uniqueMeetingIds } },
      ],
    }).lean();

    for (const doc of docs as MeetingRoomDoc[]) {
      const room = deserializeMeetingRoom(doc);
      const meetingId = room.meetingId || room.roomKey;
      const current = roomsByMeetingId.get(meetingId) ?? [];
      if (!current.some((entry) => entry.roomKey === room.roomKey)) {
        current.push(room);
      }
      roomsByMeetingId.set(meetingId, current);
    }
  }

  for (const meetingId of uniqueMeetingIds) {
    summaries.set(meetingId, buildMeetingCarbonSummary(roomsByMeetingId.get(meetingId) ?? []));
  }

  return summaries;
}
