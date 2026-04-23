import dbConnect from '@/lib/db/mongodb';
import WorkspaceProfileModel from '@/lib/models/WorkspaceProfile';
import type { Presence, WorkspaceUser } from '@/types/domain/workspace';
import { listUsers as listMockUsers, updateUserPresence as updateMockUserPresence } from '@/lib/workspace/mockDb';

type DataSourceResult<T> = {
  demoMode: boolean;
  value: T;
};

type ProfileDoc = {
  _id: string;
  avatarInitials: string;
  carbonSavedKg?: number;
  email: string;
  name: string;
  presence?: Presence | string;
  title: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __peopleSeedPromise: Promise<void> | undefined;
}

function normalizePresence(value: string | undefined): Presence {
  if (value === 'online' || value === 'away' || value === 'busy') return value;
  return 'offline';
}

function serializeProfile(doc: ProfileDoc): WorkspaceUser {
  return {
    id: doc._id,
    name: doc.name,
    title: doc.title,
    email: doc.email,
    avatarInitials: doc.avatarInitials,
    presence: normalizePresence(doc.presence),
    carbonSavedKg: Number.isFinite(doc.carbonSavedKg) ? Math.max(0, doc.carbonSavedKg ?? 0) : 0,
  };
}

async function ensurePeopleSeeded() {
  if (!globalThis.__peopleSeedPromise) {
    globalThis.__peopleSeedPromise = (async () => {
      const count = await WorkspaceProfileModel.estimatedDocumentCount();
      if (count > 0) return;

      const mockUsers = listMockUsers();
      if (!mockUsers.length) return;

      await Promise.all(
        mockUsers.map((user) => (
          WorkspaceProfileModel.updateOne(
            { _id: user.id },
            {
              $setOnInsert: {
                _id: user.id,
                name: user.name,
                title: user.title,
                email: user.email,
                avatarInitials: user.avatarInitials,
                presence: user.presence,
                carbonSavedKg: user.carbonSavedKg,
              },
            },
            { upsert: true },
          )
        )),
      );
    })().finally(() => {
      globalThis.__peopleSeedPromise = undefined;
    });
  }

  await globalThis.__peopleSeedPromise;
}

async function withPeopleDataSource<T>(mongoFn: () => Promise<T>, mockFn: () => T): Promise<DataSourceResult<T>> {
  const connection = await dbConnect();
  if (!connection) {
    return { demoMode: true, value: mockFn() };
  }

  await ensurePeopleSeeded();
  return { demoMode: false, value: await mongoFn() };
}

export async function listUsersRepo(query?: string) {
  return withPeopleDataSource(
    async () => {
      const normalizedQuery = query?.trim();
      let docs: ProfileDoc[];
      if (!normalizedQuery) {
        docs = (await WorkspaceProfileModel.find().sort({ name: 1 }).lean()) as ProfileDoc[];
      } else {
        const pattern = new RegExp(normalizedQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        docs = (await WorkspaceProfileModel.find({
          $or: [
            { name: pattern },
            { email: pattern },
            { title: pattern },
          ],
        }).sort({ name: 1 }).lean()) as ProfileDoc[];
      }
      return docs.map(serializeProfile);
    },
    () => listMockUsers(query),
  );
}

export async function updateUserPresenceRepo(userId: string, presence: Presence) {
  return withPeopleDataSource(
    async () => {
      const profile = await WorkspaceProfileModel.findById(userId);
      if (!profile) return null;
      profile.presence = presence;
      await profile.save();
      return serializeProfile(profile.toObject({ depopulate: true }) as ProfileDoc);
    },
    () => updateMockUserPresence(userId, presence),
  );
}
