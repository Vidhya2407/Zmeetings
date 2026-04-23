import dbConnect from '@/lib/db/mongodb';
import ActivityItemModel from '@/lib/models/ActivityItem';
import type { ActivityItem } from '@/types/domain/workspace';
import {
  createActivityItem as createMockActivityItem,
  listActivity as listMockActivity,
  markActivityRead as markMockActivityRead,
} from '@/lib/workspace/mockDb';

type DataSourceResult<T> = {
  demoMode: boolean;
  value: T;
};

const ACTIVITY_MONGO_TIMEOUT_MS = 5000;

type ActivityDoc = {
  _id: string;
  body: string;
  createdAt: Date | string;
  kind: ActivityItem['kind'] | string;
  priority: ActivityItem['priority'] | string;
  read?: boolean;
  relatedMeetingId?: string | null;
  relatedThreadId?: string | null;
  targetUserIds?: string[];
  title: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __activitySeedPromise: Promise<void> | undefined;
}

function toIsoDate(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeActivityBody(body: string | null | undefined) {
  if (!body) return '';
  return body.replace('Sustainability Panel', 'Sustainability Group Chat');
}

function normalizeKind(value: string): ActivityItem['kind'] {
  if (value === 'meeting_invite' || value === 'meeting_update' || value === 'meeting_recording_ready' || value === 'mention' || value === 'chat_message') {
    return value;
  }
  return 'system';
}

function normalizePriority(value: string): ActivityItem['priority'] {
  if (value === 'meeting_now' || value === 'mention' || value === 'direct') return value;
  return 'general';
}

function serializeActivity(doc: ActivityDoc): ActivityItem {
  return {
    id: doc._id,
    kind: normalizeKind(doc.kind),
    title: doc.title,
    body: normalizeActivityBody(doc.body),
    createdAt: toIsoDate(doc.createdAt),
    read: Boolean(doc.read),
    priority: normalizePriority(doc.priority),
    relatedMeetingId: doc.relatedMeetingId ?? null,
    relatedThreadId: doc.relatedThreadId ?? null,
    targetUserIds: doc.targetUserIds ?? [],
  };
}

async function ensureActivitySeeded() {
  if (!globalThis.__activitySeedPromise) {
    globalThis.__activitySeedPromise = (async () => {
      const count = await ActivityItemModel.estimatedDocumentCount();
      if (count > 0) return;

      const mockItems = listMockActivity();
      if (!mockItems.length) return;

      await Promise.all(
        mockItems.map((item) => (
          ActivityItemModel.updateOne(
            { _id: item.id },
            {
              $setOnInsert: {
                _id: item.id,
                kind: item.kind,
                title: item.title,
                body: item.body,
                createdAt: new Date(item.createdAt),
                read: item.read,
                priority: item.priority,
                relatedMeetingId: item.relatedMeetingId,
                relatedThreadId: item.relatedThreadId,
                targetUserIds: item.targetUserIds ?? [],
              },
            },
            { upsert: true },
          )
        )),
      );
    })().finally(() => {
      globalThis.__activitySeedPromise = undefined;
    });
  }

  await globalThis.__activitySeedPromise;
}

async function withActivityDataSource<T>(mongoFn: () => Promise<T>, mockFn: () => T): Promise<DataSourceResult<T>> {
  const connection = await dbConnect().catch(() => null);
  if (!connection) {
    return { demoMode: true, value: mockFn() };
  }

  try {
    await withTimeout(ensureActivitySeeded());
    return { demoMode: false, value: await withTimeout(mongoFn()) };
  } catch (error) {
    console.warn('Activity data source unavailable, using demo activity feed.', error);
    return { demoMode: true, value: mockFn() };
  }
}

function withTimeout<T>(promise: Promise<T>) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('Activity data source timed out.')), ACTIVITY_MONGO_TIMEOUT_MS);
    }),
  ]);
}

async function getNextActivityId() {
  const rows = await ActivityItemModel.find({ _id: /^a\d+$/ }).select({ _id: 1 }).lean();
  let maxNumericId = 0;
  for (const row of rows as Array<{ _id: string }>) {
    const current = Number.parseInt((row._id ?? '').replace(/^a/, ''), 10);
    if (Number.isFinite(current) && current > maxNumericId) {
      maxNumericId = current;
    }
  }
  return `a${maxNumericId + 1}`;
}

export async function listActivityRepo(userId?: string | null) {
  return withActivityDataSource(
    async () => {
      const filter = userId && userId !== 'demo-user'
        ? { $or: [{ targetUserIds: { $exists: false } }, { targetUserIds: { $size: 0 } }, { targetUserIds: userId }] }
        : {};
      const docs = await ActivityItemModel.find(filter).sort({ createdAt: -1 }).lean();
      return (docs as ActivityDoc[]).map(serializeActivity);
    },
    () => {
      const items = listMockActivity();
      if (!userId || userId === 'demo-user') return items;
      return items.filter((item) => !item.targetUserIds?.length || item.targetUserIds.includes(userId));
    },
  );
}

export async function markActivityReadRepo(id: string) {
  return withActivityDataSource(
    async () => {
      const item = await ActivityItemModel.findById(id);
      if (!item) return null;
      item.read = true;
      await item.save();
      return serializeActivity(item.toObject({ depopulate: true }) as ActivityDoc);
    },
    () => markMockActivityRead(id),
  );
}

type CreateActivityInput = Omit<ActivityItem, 'id' | 'createdAt' | 'read'> & {
  createdAt?: string;
  read?: boolean;
};

export async function createActivityRepo(input: CreateActivityInput) {
  return withActivityDataSource(
    async () => {
      const createdAt = input.createdAt ? new Date(input.createdAt) : new Date();
      const activityItem = await ActivityItemModel.create({
        _id: await getNextActivityId(),
        kind: input.kind,
        title: input.title,
        body: input.body,
        createdAt,
        read: input.read ?? false,
        priority: input.priority,
        relatedMeetingId: input.relatedMeetingId ?? null,
        relatedThreadId: input.relatedThreadId ?? null,
        targetUserIds: input.targetUserIds ?? [],
      });
      return serializeActivity(activityItem.toObject({ depopulate: true }) as ActivityDoc);
    },
    () => createMockActivityItem(input),
  );
}
