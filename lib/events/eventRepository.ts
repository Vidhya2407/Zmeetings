import dbConnect from '@/lib/db/mongodb';
import WorkspaceEventModel from '@/lib/models/WorkspaceEvent';
import type { CalendarEvent } from '@/types/domain/workspace';
import {
  createEvent as createMockEvent,
  deleteEvent as deleteMockEvent,
  getEvent as getMockEvent,
  listEvents as listMockEvents,
  patchEvent as patchMockEvent,
} from '@/lib/workspace/mockDb';

type DataSourceResult<T> = {
  demoMode: boolean;
  value: T;
};

type EventCreateInput = Omit<CalendarEvent, 'id'>;
type EventPatchInput = Partial<Omit<CalendarEvent, 'id'>>;

type WorkspaceEventDoc = {
  _id: string;
  attendeeUserIds?: string[];
  color: CalendarEvent['color'] | string;
  endsAt: Date | string;
  meetingId?: string | null;
  ownerUserId: string;
  startsAt: Date | string;
  title: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __eventSeedPromise: Promise<void> | undefined;
}

function toIsoDate(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeColor(value: string): CalendarEvent['color'] {
  if (value === 'green' || value === 'amber' || value === 'purple') return value;
  return 'blue';
}

function toMongoDate(value: string | undefined, fallback: Date) {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function serializeEvent(doc: WorkspaceEventDoc): CalendarEvent {
  return {
    id: doc._id,
    title: doc.title,
    startsAt: toIsoDate(doc.startsAt),
    endsAt: toIsoDate(doc.endsAt),
    ownerUserId: doc.ownerUserId,
    attendeeUserIds: doc.attendeeUserIds ?? [],
    meetingId: doc.meetingId ?? null,
    color: normalizeColor(doc.color),
  };
}

async function withEventDataSource<T>(mongoFn: () => Promise<T>, mockFn: () => T): Promise<DataSourceResult<T>> {
  const connection = await dbConnect();
  if (!connection) {
    return { demoMode: true, value: mockFn() };
  }

  await ensureEventSeeded();
  return { demoMode: false, value: await mongoFn() };
}

async function getNextEventId() {
  const rows = await WorkspaceEventModel.find({ _id: /^e\d+$/ }).select({ _id: 1 }).lean();
  let maxNumericId = 0;
  for (const row of rows as Array<{ _id: string }>) {
    const current = Number.parseInt((row._id ?? '').replace(/^e/, ''), 10);
    if (Number.isFinite(current) && current > maxNumericId) {
      maxNumericId = current;
    }
  }
  return `e${maxNumericId + 1}`;
}

async function ensureEventSeeded() {
  if (!globalThis.__eventSeedPromise) {
    globalThis.__eventSeedPromise = (async () => {
      const count = await WorkspaceEventModel.estimatedDocumentCount();
      if (count > 0) return;

      const fallbackEvents = listMockEvents();
      if (!fallbackEvents.length) return;

      await Promise.all(
        fallbackEvents.map((event) => (
          WorkspaceEventModel.updateOne(
            { _id: event.id },
            {
              $setOnInsert: {
                _id: event.id,
                title: event.title,
                startsAt: new Date(event.startsAt),
                endsAt: new Date(event.endsAt),
                ownerUserId: event.ownerUserId,
                attendeeUserIds: event.attendeeUserIds ?? [],
                meetingId: event.meetingId,
                color: event.color,
              },
            },
            { upsert: true },
          )
        )),
      );
    })().finally(() => {
      globalThis.__eventSeedPromise = undefined;
    });
  }

  await globalThis.__eventSeedPromise;
}

export async function listEventsRepo(userId?: string | null) {
  return withEventDataSource(
    async () => {
      const filter = userId && userId !== 'demo-user'
        ? { $or: [{ ownerUserId: userId }, { attendeeUserIds: userId }] }
        : {};
      const docs = await WorkspaceEventModel.find(filter).sort({ startsAt: 1 }).lean();
      return (docs as WorkspaceEventDoc[]).map(serializeEvent);
    },
    () => {
      const events = listMockEvents();
      if (!userId || userId === 'demo-user') return events;
      return events.filter((event) => event.ownerUserId === userId || event.attendeeUserIds.includes(userId));
    },
  );
}

export async function getEventRepo(eventId: string) {
  return withEventDataSource(
    async () => {
      const doc = await WorkspaceEventModel.findById(eventId).lean();
      return doc ? serializeEvent(doc as WorkspaceEventDoc) : null;
    },
    () => getMockEvent(eventId),
  );
}

export async function createEventRepo(input: EventCreateInput) {
  return withEventDataSource(
    async () => {
      const created = await WorkspaceEventModel.create({
        _id: await getNextEventId(),
        title: input.title,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        ownerUserId: input.ownerUserId,
        attendeeUserIds: input.attendeeUserIds ?? [],
        meetingId: input.meetingId,
        color: input.color,
      });
      return serializeEvent(created.toObject({ depopulate: true }) as WorkspaceEventDoc);
    },
    () => createMockEvent(input),
  );
}

export async function patchEventRepo(eventId: string, updates: EventPatchInput) {
  return withEventDataSource(
    async () => {
      const event = await WorkspaceEventModel.findById(eventId);
      if (!event) return null;

      if (typeof updates.title === 'string') {
        event.title = updates.title;
      }
      if (typeof updates.startsAt === 'string') {
        event.startsAt = toMongoDate(updates.startsAt, event.startsAt as Date);
      }
      if (typeof updates.endsAt === 'string') {
        event.endsAt = toMongoDate(updates.endsAt, event.endsAt as Date);
      }
      if (typeof updates.ownerUserId === 'string') {
        event.ownerUserId = updates.ownerUserId;
      }
      if (Array.isArray(updates.attendeeUserIds)) {
        event.attendeeUserIds = updates.attendeeUserIds;
      }
      if (typeof updates.meetingId !== 'undefined') {
        event.meetingId = updates.meetingId;
      }
      if (typeof updates.color === 'string') {
        event.color = normalizeColor(updates.color);
      }

      await event.save();
      return serializeEvent(event.toObject({ depopulate: true }) as WorkspaceEventDoc);
    },
    () => patchMockEvent(eventId, updates),
  );
}

export async function deleteEventRepo(eventId: string) {
  return withEventDataSource(
    async () => {
      const deleted = await WorkspaceEventModel.findByIdAndDelete(eventId).select({ _id: 1 }).lean();
      return Boolean(deleted);
    },
    () => deleteMockEvent(eventId),
  );
}
