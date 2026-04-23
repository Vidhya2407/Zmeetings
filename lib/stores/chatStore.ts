import { create } from 'zustand';
import type { ChatMessage, ChatThread } from '@/types/domain/workspace';

interface ChatState {
  threads: ChatThread[];
  activeThreadId: string | null;
  messages: Record<string, ChatMessage[]>;
  loadingThreads: boolean;
  loadingMessages: boolean;
  setThreads: (threads: ChatThread[]) => void;
  setActiveThreadId: (threadId: string | null) => void;
  setMessages: (threadId: string, messages: ChatMessage[]) => void;
  upsertMessage: (threadId: string, message: ChatMessage) => void;
  markThreadReadLocal: (threadId: string) => void;
  setLoadingThreads: (value: boolean) => void;
  setLoadingMessages: (value: boolean) => void;
}

export const useChatStore = create<ChatState>((set) => ({
  threads: [],
  activeThreadId: null,
  messages: {},
  loadingThreads: false,
  loadingMessages: false,
  setThreads: (threads) =>
    set((state) => ({
      threads,
      activeThreadId: state.activeThreadId ?? threads[0]?.id ?? null,
    })),
  setActiveThreadId: (activeThreadId) => set({ activeThreadId }),
  setMessages: (threadId, threadMessages) =>
    set((state) => ({
      messages: { ...state.messages, [threadId]: threadMessages },
    })),
  upsertMessage: (threadId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [threadId]: [...(state.messages[threadId] ?? []), message],
      },
    })),
  markThreadReadLocal: (threadId) =>
    set((state) => ({
      threads: state.threads.map((thread) => (thread.id === threadId ? { ...thread, unreadCount: 0 } : thread)),
    })),
  setLoadingThreads: (loadingThreads) => set({ loadingThreads }),
  setLoadingMessages: (loadingMessages) => set({ loadingMessages }),
}));
