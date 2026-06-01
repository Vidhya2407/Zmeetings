'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useHydrated } from '@/hooks/useHydrated';
import { fetchJsonWithRetry } from '@/lib/api/fetchJsonWithRetry';
import { useThemeStore } from '@/lib/stores/themeStore';
import { useChatStore } from '@/lib/stores/chatStore';
import { useAppTranslations } from '@/lib/utils/translations';
import NetworkQualityBadge from '@/components/meetings/NetworkQualityBadge';
import type { ChatAttachment, ChatMessage, ChatThread } from '@/types/domain/workspace';
import ThreadList from './components/ThreadList';
import MessagePane from './components/MessagePane';
import Composer from './components/Composer';

const SELF_USER_ID = 'u5';
const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024;
const MAX_ATTACHMENTS_PER_MESSAGE = 10;

export default function ChatWorkspaceScreen() {
  return (
    <React.Suspense fallback={<ChatWorkspaceFallback />}>
      <ChatWorkspaceScreenContent />
    </React.Suspense>
  );
}

function ChatWorkspaceScreenContent() {
  const { t } = useAppTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const threadIdFromQuery = searchParams.get('threadId');
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';

  const {
    threads,
    activeThreadId,
    messages,
    setThreads,
    setActiveThreadId,
    setMessages,
    upsertMessage,
    markThreadReadLocal,
  } = useChatStore();

  const [composerValue, setComposerValue] = React.useState('');
  const [composerAttachments, setComposerAttachments] = React.useState<ChatAttachment[]>([]);
  const [chatError, setChatError] = React.useState<string | null>(null);
  const [reconnecting, setReconnecting] = React.useState(false);
  const activeMessages = activeThreadId ? (messages[activeThreadId] ?? []) : [];
  const activeThread = threads.find((thread) => thread.id === activeThreadId);

  React.useEffect(() => {
    const loadThreads = async () => {
      const response = await fetchJsonWithRetry<{ threads: ChatThread[] }>('/api/chat/threads', { cache: 'no-store' });
      if (response.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/chat')}`);
        return;
      }
      if (!response.ok) {
        setReconnecting(true);
        setChatError(response.error ?? t('workspace.chat.errors.loadThreads', 'Unable to load chat threads.'));
        return;
      }

      const threadList = response.data?.threads ?? [];
      setThreads(threadList);
      setReconnecting(false);
      setChatError(null);
      if (threadIdFromQuery && threadList.some((thread: { id: string }) => thread.id === threadIdFromQuery)) {
        setActiveThreadId(threadIdFromQuery);
      }
    };
    void loadThreads();
  }, [router, setActiveThreadId, setThreads, t, threadIdFromQuery]);

  React.useEffect(() => {
    if (!activeThreadId) return;
    const loadMessages = async () => {
      const response = await fetchJsonWithRetry<{ messages: ChatMessage[] }>(`/api/chat/threads/${activeThreadId}/messages`, { cache: 'no-store' });
      if (response.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/chat')}`);
        return;
      }
      if (!response.ok) {
        setReconnecting(true);
        setChatError(response.error ?? t('workspace.chat.errors.syncMessages', 'Unable to sync messages.'));
        return;
      }
      setMessages(activeThreadId, response.data?.messages ?? []);
      markThreadReadLocal(activeThreadId);
      setReconnecting(false);
      setChatError(null);
    };
    void loadMessages();
  }, [activeThreadId, markThreadReadLocal, router, setMessages, t]);

  const handleFileSelect = React.useCallback((files: FileList | null) => {
    if (!files?.length) return;

    const nextFiles = Array.from(files).slice(0, Math.max(0, MAX_ATTACHMENTS_PER_MESSAGE - composerAttachments.length));
    const oversized = nextFiles.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES);
    if (oversized) {
      setChatError(t('workspace.chat.attachments.tooLarge', 'One attachment is too large. Max size is 25 MB.'));
      return;
    }

    void Promise.all(nextFiles.map(readFileAsAttachment))
      .then((nextAttachments) => {
        setComposerAttachments((current) => [...current, ...nextAttachments].slice(0, MAX_ATTACHMENTS_PER_MESSAGE));
        setChatError(null);
      })
      .catch(() => {
        setChatError(t('workspace.chat.attachments.readFailed', 'Unable to attach that file. Please try again.'));
      });
  }, [composerAttachments.length, t]);

  const handleRemoveAttachment = React.useCallback((attachmentId: string) => {
    setComposerAttachments((current) => current.filter((attachment) => attachment.id !== attachmentId));
  }, []);

  const handleSend = React.useCallback(async () => {
    const trimmedBody = composerValue.trim();
    if (!activeThreadId || (!trimmedBody && composerAttachments.length === 0)) return;

    const response = await fetchJsonWithRetry<{ message: ChatMessage }>(`/api/chat/threads/${activeThreadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderUserId: SELF_USER_ID,
        body: trimmedBody,
        attachments: composerAttachments,
      }),
    });
    if (response.unauthorized) {
      router.push(`/login?next=${encodeURIComponent('/chat')}`);
      return;
    }
    if (!response.ok) {
      setReconnecting(true);
      setChatError(response.error ?? t('workspace.chat.errors.sendMessage', 'Unable to send message. Retry.'));
      return;
    }

    const message = response.data?.message;
    if (message) {
      upsertMessage(activeThreadId, message);
      setComposerValue('');
      setComposerAttachments([]);
      setChatError(null);
      setReconnecting(false);
    }
  }, [activeThreadId, composerAttachments, composerValue, router, t, upsertMessage]);

  const retryChatSync = React.useCallback(async () => {
    setChatError(null);
    setReconnecting(true);

    const threadsRes = await fetchJsonWithRetry<{ threads: ChatThread[] }>('/api/chat/threads', { cache: 'no-store' });
    if (threadsRes.unauthorized) {
      router.push(`/login?next=${encodeURIComponent('/chat')}`);
      return;
    }
    if (!threadsRes.ok) {
      setChatError(threadsRes.error ?? t('workspace.chat.errors.restoreConnection', 'Unable to restore chat connection.'));
      return;
    }
    const nextThreads = threadsRes.data?.threads ?? [];
    setThreads(nextThreads);

    if (activeThreadId) {
      const messagesRes = await fetchJsonWithRetry<{ messages: ChatMessage[] }>(`/api/chat/threads/${activeThreadId}/messages`, { cache: 'no-store' });
      if (messagesRes.unauthorized) {
        router.push(`/login?next=${encodeURIComponent('/chat')}`);
        return;
      }
      if (!messagesRes.ok) {
        setChatError(messagesRes.error ?? t('workspace.chat.errors.restoreMessages', 'Unable to restore messages for the active thread.'));
        return;
      }
      setMessages(activeThreadId, messagesRes.data?.messages ?? []);
    }

    setReconnecting(false);
  }, [activeThreadId, router, setMessages, setThreads, t]);

  return (
    <div className="flex min-w-0 flex-col gap-4 pb-4 md:gap-5 md:pb-0 lg:h-[calc(100dvh-8rem)] lg:min-h-0 lg:overflow-hidden">
      <div className="grid shrink-0 min-w-0 gap-6 lg:grid-cols-[minmax(18rem,0.32fr)_minmax(0,0.68fr)]">
        <div className="hidden lg:block" />
        <div className="flex items-center justify-end">
          <NetworkQualityBadge compact isLight={isLight} />
        </div>
      </div>

      {(chatError || reconnecting) ? (
        <section
          className="rounded-3xl border px-4 py-3"
          style={{
            background: isLight ? 'rgba(254,242,242,0.82)' : 'rgba(127,29,29,0.22)',
            borderColor: isLight ? 'rgba(220,38,38,0.2)' : 'rgba(248,113,113,0.35)',
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-base font-semibold" style={{ color: isLight ? '#7f1d1d' : '#fecaca' }}>
              {chatError ?? t('workspace.chat.reconnecting', 'Connection is unstable. Reconnecting to chat...')}
            </p>
            <button
              type="button"
              onClick={() => void retryChatSync()}
              className="rounded-xl px-3 py-2 text-base font-bold"
              style={{
                background: isLight ? 'rgba(220,38,38,0.12)' : 'rgba(248,113,113,0.22)',
                border: `1px solid ${isLight ? 'rgba(220,38,38,0.28)' : 'rgba(248,113,113,0.35)'}`,
                color: isLight ? '#991b1b' : '#fee2e2',
              }}
            >
              {t('workspace.chat.retryNow', 'Retry now')}
            </button>
          </div>
        </section>
      ) : null}

      <div className="grid min-w-0 items-start gap-6 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(18rem,0.32fr)_minmax(0,0.68fr)] lg:items-stretch lg:overflow-hidden">
        <ThreadList
          activeThreadId={activeThreadId}
          isLight={isLight}
          onSelectThread={setActiveThreadId}
          panelId="chat-thread-panel"
          threads={threads}
          title={t('workspace.chat.threadsTitle', 'Threads')}
        />

        <section
          aria-labelledby={activeThreadId ? `chat-thread-tab-${activeThreadId}` : undefined}
          className="min-w-0 overflow-hidden rounded-3xl border p-5 lg:flex lg:min-h-0 lg:flex-col"
          id="chat-thread-panel"
          role="tabpanel"
          style={{
            background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)',
            borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
            boxShadow: isLight ? '0 22px 48px rgba(15,23,42,0.06)' : '0 22px 44px rgba(0,0,0,0.14)',
          }}
          tabIndex={0}
        >
          <div className="shrink-0 border-b pb-4" style={{ borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)' }}>
            <p className="text-[1.05rem] font-black tracking-[-0.02em]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
              {activeThread?.title ?? t('workspace.chat.selectConversation', 'Select a conversation')}
            </p>
            <p className="mt-1 text-sm" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>
              {t('workspace.chat.subtitle', 'Conversation hub for meeting coordination')}
            </p>
          </div>

          <div className={`mt-4 lg:min-h-0 lg:flex-1 ${activeThreadId ? 'h-[34vh] min-h-[220px] sm:h-[42vh] sm:min-h-[260px] md:h-[58vh] md:min-h-[360px] lg:h-auto' : 'h-[20vh] min-h-[140px] sm:h-[26vh] sm:min-h-[180px] md:h-[34vh] md:min-h-[240px] lg:h-auto'}`}>
            <MessagePane isLight={isLight} messages={activeMessages} selfUserId={SELF_USER_ID} />
          </div>

          <div className="shrink-0">
            <Composer
              attachLabel={t('workspace.chat.attachments.attach', 'Attach files, photos, or videos')}
              attachments={composerAttachments}
              disabled={!activeThreadId || (!composerValue.trim() && composerAttachments.length === 0)}
              isLight={isLight}
              onChange={setComposerValue}
              onFileSelect={handleFileSelect}
              onRemoveAttachment={handleRemoveAttachment}
              onSend={handleSend}
              placeholder={t('workspace.chat.composerPlaceholder', 'Type a message...')}
              removeAttachmentLabel={t('workspace.chat.attachments.remove', 'Remove attachment')}
              sendLabel={t('workspace.chat.send', 'Send')}
              value={composerValue}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function readFileAsAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      if (!dataUrl) {
        reject(new Error('Missing file data.'));
        return;
      }

      resolve({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl,
        kind: getAttachmentKind(file),
      });
    };
    reader.readAsDataURL(file);
  });
}

function getAttachmentKind(file: File): ChatAttachment['kind'] {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'file';
}

function ChatWorkspaceFallback() {
  const { t } = useAppTranslations();
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <p className="text-base font-semibold text-slate-400">{t('workspace.chat.loading', 'Loading chat workspace...')}</p>
    </div>
  );
}
