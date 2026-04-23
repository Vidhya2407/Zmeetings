'use client';

import Image from 'next/image';
import type { ChatMessage } from '@/types/domain/workspace';

export default function MessagePane({
  isLight,
  messages,
  selfUserId,
}: {
  isLight: boolean;
  messages: ChatMessage[];
  selfUserId: string;
}) {
  return (
    <div className="h-full space-y-2 overflow-y-auto px-1 py-1">
      {messages.map((message) => {
        const mine = message.senderUserId === selfUserId;
        const attachments = message.attachments ?? [];
        return (
          <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
            <div
              className="max-w-[78%] rounded-2xl px-3 py-2 text-base"
              style={{
                background: mine ? 'rgba(0,229,186,0.2)' : (isLight ? 'rgba(241,245,249,0.95)' : 'rgba(255,255,255,0.06)'),
                color: mine ? (isLight ? '#064e3b' : '#d1fae5') : (isLight ? '#0f172a' : '#e5e7eb'),
                border: `1px solid ${mine ? 'rgba(0,229,186,0.35)' : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)')}`,
              }}
            >
              {message.body ? <p>{message.body}</p> : null}
              {attachments.length ? (
                <div className="mt-2 grid gap-2">
                  {attachments.map((attachment) => (
                    <AttachmentPreview
                      attachment={attachment}
                      isLight={isLight}
                      key={attachment.id}
                    />
                  ))}
                </div>
              ) : null}
              <p className="mt-1 text-sm opacity-70">{new Date(message.createdAt).toLocaleTimeString()}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AttachmentPreview({
  attachment,
  isLight,
}: {
  attachment: NonNullable<ChatMessage['attachments']>[number];
  isLight: boolean;
}) {
  if (attachment.kind === 'image') {
    return (
      <a href={attachment.dataUrl} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-xl">
        <Image alt={attachment.name} className="h-auto max-h-64 w-full object-cover" height={360} src={attachment.dataUrl} unoptimized width={640} />
      </a>
    );
  }

  if (attachment.kind === 'video') {
    return (
      <video className="max-h-72 w-full rounded-xl" controls src={attachment.dataUrl}>
        <track kind="captions" />
      </video>
    );
  }

  return (
    <a
      className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold"
      download={attachment.name}
      href={attachment.dataUrl}
      style={{
        background: isLight ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.06)',
        borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)',
        color: isLight ? '#0f172a' : '#ffffff',
      }}
    >
      <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
    </a>
  );
}
