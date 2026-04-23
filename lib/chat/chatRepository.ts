import dbConnect from '@/lib/db/mongodb';
import ChatMessageModel from '@/lib/models/ChatMessage';
import ChatThreadModel from '@/lib/models/ChatThread';
import type { ChatMessage, ChatThread } from '@/types/domain/workspace';
import {
  addMessage as addMockMessage,
  findOrCreateDirectThread as findOrCreateMockDirectThread,
  listMessages as listMockMessages,
  listThreads as listMockThreads,
  markThreadRead as markMockThreadRead,
} from '@/lib/workspace/mockDb';

type DataSourceResult<T> = {
  demoMode: boolean;
  value: T;
};

type ChatThreadDoc = {
  _id: string;
  lastMessagePreview?: string;
  participantUserIds?: string[];
  title: string;
  unreadCount?: number;
  updatedAt?: Date | string;
};

type ChatMessageDoc = {
  _id: string;
  body: string;
  createdAt?: Date | string;
  senderUserId: string;
  threadId: string;
};

declare global {
  // eslint-disable-next-line no-var
  var __chatSeedPromise: Promise<void> | undefined;
}

function toIsoDate(value: Date | string | undefined) {
  if (!value) return new Date().toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeThreadTitle(title: string) {
  return title === 'Sustainability Panel' ? 'Sustainability Group Chat' : title;
}

function normalizeThreadPreview(preview: string | undefined) {
  if (preview === 'Thanks for the feedback!') return 'Sarah mentioned you in the group chat.';
  return preview ?? '';
}

function serializeThread(doc: ChatThreadDoc): ChatThread {
  return {
    id: doc._id,
    title: normalizeThreadTitle(doc.title),
    participantUserIds: doc.participantUserIds ?? [],
    lastMessagePreview: normalizeThreadPreview(doc.lastMessagePreview),
    updatedAt: toIsoDate(doc.updatedAt),
    unreadCount: Number.isFinite(doc.unreadCount) ? Math.max(0, doc.unreadCount ?? 0) : 0,
  };
}

function serializeMessage(doc: ChatMessageDoc): ChatMessage {
  return {
    id: doc._id,
    threadId: doc.threadId,
    senderUserId: doc.senderUserId,
    body: doc.body,
    createdAt: toIsoDate(doc.createdAt),
  };
}

async function withChatDataSource<T>(mongoFn: () => Promise<T>, mockFn: () => T): Promise<DataSourceResult<T>> {
  const connection = await dbConnect();
  if (!connection) {
    return { demoMode: true, value: mockFn() };
  }

  await ensureChatSeeded();
  return { demoMode: false, value: await mongoFn() };
}

async function getNextMessageId() {
  const rows = await ChatMessageModel.find({ _id: /^msg\d+$/ }).select({ _id: 1 }).lean();
  let maxNumericId = 0;
  for (const row of rows as Array<{ _id: string }>) {
    const current = Number.parseInt((row._id ?? '').replace(/^msg/, ''), 10);
    if (Number.isFinite(current) && current > maxNumericId) {
      maxNumericId = current;
    }
  }
  return `msg${maxNumericId + 1}`;
}

async function getNextThreadId() {
  const rows = await ChatThreadModel.find({ _id: /^t\d+$/ }).select({ _id: 1 }).lean();
  let maxNumericId = 0;
  for (const row of rows as Array<{ _id: string }>) {
    const current = Number.parseInt((row._id ?? '').replace(/^t/, ''), 10);
    if (Number.isFinite(current) && current > maxNumericId) {
      maxNumericId = current;
    }
  }
  return `t${maxNumericId + 1}`;
}

async function ensureChatSeeded() {
  if (!globalThis.__chatSeedPromise) {
    globalThis.__chatSeedPromise = (async () => {
      const count = await ChatThreadModel.estimatedDocumentCount();
      if (count > 0) return;

      const fallbackThreads = listMockThreads();
      if (!fallbackThreads.length) return;

      await Promise.all(
        fallbackThreads.map((thread) => (
          ChatThreadModel.updateOne(
            { _id: thread.id },
            {
              $setOnInsert: {
                _id: thread.id,
                title: thread.title,
                participantUserIds: thread.participantUserIds,
                lastMessagePreview: thread.lastMessagePreview,
                unreadCount: thread.unreadCount,
                updatedAt: new Date(thread.updatedAt),
              },
            },
            { upsert: true },
          )
        )),
      );

      const fallbackMessages = fallbackThreads.flatMap((thread) => listMockMessages(thread.id));
      if (!fallbackMessages.length) return;

      await Promise.all(
        fallbackMessages.map((message) => (
          ChatMessageModel.updateOne(
            { _id: message.id },
            {
              $setOnInsert: {
                _id: message.id,
                threadId: message.threadId,
                senderUserId: message.senderUserId,
                body: message.body,
                createdAt: new Date(message.createdAt),
              },
            },
            { upsert: true },
          )
        )),
      );
    })().finally(() => {
      globalThis.__chatSeedPromise = undefined;
    });
  }

  await globalThis.__chatSeedPromise;
}

export async function listThreadsRepo() {
  return withChatDataSource(
    async () => {
      const docs = await ChatThreadModel.find().sort({ updatedAt: -1 }).lean();
      return (docs as ChatThreadDoc[]).map(serializeThread);
    },
    () => listMockThreads(),
  );
}

export async function findOrCreateDirectThreadRepo(userId: string, title: string) {
  return withChatDataSource(
    async () => {
      const existing = await ChatThreadModel.findOne({
        participantUserIds: { $all: [userId], $size: 1 },
      }).lean();
      if (existing) return serializeThread(existing as ChatThreadDoc);

      const created = await ChatThreadModel.create({
        _id: await getNextThreadId(),
        title,
        participantUserIds: [userId],
        lastMessagePreview: 'New conversation started.',
        unreadCount: 0,
      });
      return serializeThread(created.toObject({ depopulate: true }) as ChatThreadDoc);
    },
    () => findOrCreateMockDirectThread(userId, title),
  );
}

export async function listMessagesRepo(threadId: string) {
  return withChatDataSource(
    async () => {
      const docs = await ChatMessageModel.find({ threadId }).sort({ createdAt: 1 }).lean();
      return (docs as ChatMessageDoc[]).map(serializeMessage);
    },
    () => listMockMessages(threadId),
  );
}

export async function addMessageRepo(threadId: string, senderUserId: string, body: string) {
  return withChatDataSource(
    async () => {
      const thread = await ChatThreadModel.findById(threadId);
      if (!thread) return null;

      const message = await ChatMessageModel.create({
        _id: await getNextMessageId(),
        threadId,
        senderUserId,
        body,
        createdAt: new Date(),
      });

      thread.lastMessagePreview = body;
      thread.unreadCount = Math.max(0, (thread.unreadCount ?? 0) + 1);
      await thread.save();

      return serializeMessage(message.toObject({ depopulate: true }) as ChatMessageDoc);
    },
    () => addMockMessage(threadId, senderUserId, body),
  );
}

export async function markThreadReadRepo(threadId: string) {
  return withChatDataSource(
    async () => {
      const thread = await ChatThreadModel.findById(threadId);
      if (!thread) return null;
      thread.unreadCount = 0;
      await thread.save();
      return serializeThread(thread.toObject({ depopulate: true }) as ChatThreadDoc);
    },
    () => markMockThreadRead(threadId),
  );
}
