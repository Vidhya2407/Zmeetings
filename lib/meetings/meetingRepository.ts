import dbConnect from '@/lib/db/mongodb';
import MeetingModel from '@/lib/models/Meeting';
import { getMeetingCarbonSummary, getMeetingCarbonSummaryMap } from '@/lib/meetings/serverRoomStore';
import type { Meeting, MeetingParticipant } from '@/types/domain/workspace';
import {
  addParticipant as addMockParticipant,
  createMeeting as createMockMeeting,
  getMeeting as getMockMeeting,
  getMeetingByRoomCode as getMockMeetingByRoomCode,
  listMeetings as listMockMeetings,
  patchMeeting as patchMockMeeting,
  removeParticipant as removeMockParticipant,
} from '@/lib/workspace/mockDb';

type MeetingPatchInput = Partial<Pick<Meeting, 'title' | 'status' | 'startsAt' | 'endsAt'>>;

type DataSourceResult<T> = {
  demoMode: boolean;
  value: T;
};

type MeetingParticipantDoc = {
  joinedAt?: Date | string;
  role?: string;
  userId?: string;
};

type MeetingDoc = {
  _id: string;
  attendeesCount: number;
  carbonSavedKg: number;
  endsAt: Date | string;
  hostUserId: string;
  participants: MeetingParticipantDoc[];
  roomCode: string;
  startsAt: Date | string;
  status: Meeting['status'] | string;
  title: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __meetingSeedPromise: Promise<void> | undefined;
}

function normalizeStatus(status: string): Meeting['status'] {
  if (status === 'live') return 'live';
  if (status === 'ended') return 'ended';
  return 'scheduled';
}

function normalizeRole(role: string): MeetingParticipant['role'] {
  if (role === 'host') return 'host';
  if (role === 'cohost') return 'cohost';
  return 'attendee';
}

function toIsoDate(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function serializeMeeting(doc: MeetingDoc, carbonSummary: Meeting['carbonSummary'] = null): Meeting {
  return {
    id: doc._id,
    title: doc.title,
    hostUserId: doc.hostUserId,
    roomCode: (doc.roomCode ?? '').toUpperCase(),
    startsAt: toIsoDate(doc.startsAt),
    endsAt: toIsoDate(doc.endsAt),
    status: normalizeStatus(doc.status),
    attendeesCount: Number.isFinite(doc.attendeesCount) ? Math.max(0, doc.attendeesCount) : 0,
    participants: (doc.participants ?? []).map((participant) => ({
      userId: participant.userId ?? '',
      role: normalizeRole(participant.role ?? 'attendee'),
      joinedAt: toIsoDate(participant.joinedAt),
    })),
    carbonSavedKg: Number.isFinite(doc.carbonSavedKg) ? Math.max(0, doc.carbonSavedKg) : 0,
    carbonSummary,
  };
}

function toMongoDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function randomDigits(length: number) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += Math.floor(Math.random() * 10).toString();
  }
  return out;
}

function randomLetters(length: number) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function ensureMeetingSeeded() {
  if (!globalThis.__meetingSeedPromise) {
    globalThis.__meetingSeedPromise = (async () => {
      const count = await MeetingModel.estimatedDocumentCount();
      if (count > 0) return;

      const fallbackMeetings = listMockMeetings();
      if (!fallbackMeetings.length) return;

      await Promise.all(
        fallbackMeetings.map((meeting) => (
          MeetingModel.updateOne(
            { _id: meeting.id },
            {
              $setOnInsert: {
                _id: meeting.id,
                title: meeting.title,
                hostUserId: meeting.hostUserId,
                roomCode: meeting.roomCode.toUpperCase(),
                startsAt: new Date(meeting.startsAt),
                endsAt: new Date(meeting.endsAt),
                status: meeting.status,
                attendeesCount: meeting.attendeesCount,
                participants: meeting.participants.map((participant) => ({
                  userId: participant.userId,
                  role: participant.role,
                  joinedAt: new Date(participant.joinedAt),
                })),
                carbonSavedKg: meeting.carbonSavedKg,
              },
            },
            { upsert: true },
          )
        )),
      );
    })().finally(() => {
      globalThis.__meetingSeedPromise = undefined;
    });
  }

  await globalThis.__meetingSeedPromise;
}

async function withMeetingDataSource<T>(mongoFn: () => Promise<T>, mockFn: () => T): Promise<DataSourceResult<T>> {
  const connection = await dbConnect();
  if (!connection) {
    return { demoMode: true, value: mockFn() };
  }

  await ensureMeetingSeeded();
  return { demoMode: false, value: await mongoFn() };
}

async function getNextMeetingId() {
  const rows = await MeetingModel.find({ _id: /^m\d+$/ }).select({ _id: 1 }).lean();
  let maxNumericId = 0;
  for (const row of rows as Array<{ _id: string }>) {
    const current = Number.parseInt((row._id ?? '').replace(/^m/, ''), 10);
    if (Number.isFinite(current) && current > maxNumericId) {
      maxNumericId = current;
    }
  }
  return `m${maxNumericId + 1}`;
}

async function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const candidate = `ECO-${randomDigits(4)}-${randomLetters(4)}`;
    const existing = await MeetingModel.findOne({ roomCode: candidate }).select({ _id: 1 }).lean();
    if (!existing) {
      return candidate;
    }
  }

  return `ECO-${Date.now().toString().slice(-4)}-${randomLetters(4)}`;
}

export async function listMeetingsRepo() {
  return withMeetingDataSource(
    async () => {
      const docs = await MeetingModel.find().sort({ startsAt: 1 }).lean();
      const serializedDocs = (docs as MeetingDoc[]);
      const carbonSummaryMap = await getMeetingCarbonSummaryMap(serializedDocs.map((doc) => doc._id));
      return serializedDocs.map((doc) => serializeMeeting(doc, carbonSummaryMap.get(doc._id) ?? null));
    },
    () => listMockMeetings(),
  );
}

export async function getMeetingRepo(meetingId: string) {
  return withMeetingDataSource(
    async () => {
      const doc = await MeetingModel.findById(meetingId).lean();
      if (!doc) return null;
      const carbonSummary = await getMeetingCarbonSummary(meetingId);
      return serializeMeeting(doc as MeetingDoc, carbonSummary);
    },
    () => getMockMeeting(meetingId),
  );
}

export async function getMeetingByRoomCodeRepo(roomCode: string) {
  return withMeetingDataSource(
    async () => {
      const doc = await MeetingModel.findOne({ roomCode: roomCode.trim().toUpperCase() }).lean();
      if (!doc) return null;
      const carbonSummary = await getMeetingCarbonSummary(String((doc as MeetingDoc)._id));
      return serializeMeeting(doc as MeetingDoc, carbonSummary);
    },
    () => getMockMeetingByRoomCode(roomCode),
  );
}

export async function createMeetingRepo(title: string, hostUserId: string, schedule?: { startsAt?: string; endsAt?: string }) {
  return withMeetingDataSource(
    async () => {
      const startsAt = toMongoDate(schedule?.startsAt, new Date(Date.now() + 15 * 60 * 1000));
      const endsAt = toMongoDate(schedule?.endsAt, new Date(startsAt.getTime() + 60 * 60 * 1000));
      const created = await MeetingModel.create({
        _id: await getNextMeetingId(),
        title,
        hostUserId,
        roomCode: await generateUniqueRoomCode(),
        startsAt,
        endsAt,
        status: 'scheduled',
        attendeesCount: 1,
        participants: [{ userId: hostUserId, role: 'host', joinedAt: new Date() }],
        carbonSavedKg: 0.6,
      });

      return serializeMeeting((created.toObject({ depopulate: true }) as MeetingDoc), null);
    },
    () => createMockMeeting(title, hostUserId, schedule),
  );
}

export async function patchMeetingRepo(meetingId: string, updates: MeetingPatchInput) {
  return withMeetingDataSource(
    async () => {
      const meeting = await MeetingModel.findById(meetingId);
      if (!meeting) return null;

      if (typeof updates.title === 'string') {
        meeting.title = updates.title;
      }
      if (typeof updates.status === 'string') {
        meeting.status = normalizeStatus(updates.status);
      }
      if (typeof updates.startsAt === 'string') {
        meeting.startsAt = toMongoDate(updates.startsAt, meeting.startsAt as Date);
      }
      if (typeof updates.endsAt === 'string') {
        meeting.endsAt = toMongoDate(updates.endsAt, meeting.endsAt as Date);
      }

      await meeting.save();
      return serializeMeeting(
        meeting.toObject({ depopulate: true }) as MeetingDoc,
        await getMeetingCarbonSummary(meetingId),
      );
    },
    () => patchMockMeeting(meetingId, updates),
  );
}

export async function addParticipantRepo(meetingId: string, userId: string, role: MeetingParticipant['role']) {
  return withMeetingDataSource(
    async () => {
      const meeting = await MeetingModel.findById(meetingId);
      if (!meeting) return null;

      const alreadyExists = (meeting.participants ?? []).some((participant: MeetingParticipantDoc) => participant.userId === userId);
      if (!alreadyExists) {
        meeting.participants.push({
          userId,
          role,
          joinedAt: new Date(),
        });
        meeting.attendeesCount = Math.max(0, (meeting.attendeesCount ?? 0) + 1);
        await meeting.save();
      }

      return serializeMeeting(
        meeting.toObject({ depopulate: true }) as MeetingDoc,
        await getMeetingCarbonSummary(meetingId),
      );
    },
    () => addMockParticipant(meetingId, userId, role),
  );
}

export async function removeParticipantRepo(meetingId: string, userId: string) {
  return withMeetingDataSource(
    async () => {
      const meeting = await MeetingModel.findById(meetingId);
      if (!meeting) return null;

      const previousCount = (meeting.participants ?? []).length;
      meeting.participants = (meeting.participants ?? []).filter((participant: MeetingParticipantDoc) => participant.userId !== userId);
      const removedCount = Math.max(0, previousCount - meeting.participants.length);
      if (removedCount > 0) {
        meeting.attendeesCount = Math.max(0, (meeting.attendeesCount ?? 0) - removedCount);
        await meeting.save();
      }

      return serializeMeeting(
        meeting.toObject({ depopulate: true }) as MeetingDoc,
        await getMeetingCarbonSummary(meetingId),
      );
    },
    () => removeMockParticipant(meetingId, userId),
  );
}
