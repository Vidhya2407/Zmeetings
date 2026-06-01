'use client';

import React from 'react';
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
  const bottomRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  return (
    <div className="h-full min-w-0 overflow-y-auto px-3 py-4 sm:px-4 md:px-5">
      <div className="flex min-h-full flex-col justify-end gap-4">
        {messages.map((message) => {
          const mine = message.senderUserId === selfUserId;
          const attachments = message.attachments ?? [];
          return (
            <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className="w-fit max-w-[74%] rounded-[22px] px-4 py-3 text-sm sm:max-w-[70%] sm:text-[15px] xl:max-w-[64%]"
                style={{
                  background: mine
                    ? (isLight ? 'linear-gradient(135deg,rgba(220,252,231,0.96),rgba(204,251,241,0.96))' : 'linear-gradient(135deg,rgba(6,95,70,0.88),rgba(15,118,110,0.84))')
                    : (isLight ? 'rgba(241,245,249,0.96)' : 'rgba(255,255,255,0.055)'),
                  color: mine ? (isLight ? '#064e3b' : '#ecfeff') : (isLight ? '#0f172a' : '#e5e7eb'),
                  border: `1px solid ${mine ? 'rgba(0,229,186,0.25)' : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)')}`,
                  boxShadow: mine
                    ? (isLight ? '0 14px 28px rgba(16,185,129,0.14)' : '0 16px 34px rgba(15,118,110,0.18)')
                    : (isLight ? '0 12px 24px rgba(15,23,42,0.06)' : '0 12px 24px rgba(0,0,0,0.16)'),
                }}
              >
                {message.body ? <p className="leading-6">{message.body}</p> : null}
                {attachments.length ? (
                  <div className="mt-3 grid gap-2">
                    {attachments.map((attachment) => (
                      <AttachmentPreview
                        attachment={attachment}
                        isLight={isLight}
                        key={attachment.id}
                      />
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 flex justify-end">
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em]" style={{ background: mine ? 'rgba(255,255,255,0.22)' : (isLight ? 'rgba(255,255,255,0.76)' : 'rgba(255,255,255,0.06)'), color: mine ? 'inherit' : (isLight ? '#64748b' : '#94a3b8') }}>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
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
  const cardBg = isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.06)';
  const borderColor = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)';
  const titleColor = isLight ? '#0f172a' : '#ffffff';
  const metaColor = isLight ? '#64748b' : '#94a3b8';

  if (attachment.kind === 'image') {
    return (
      <a
        href={attachment.dataUrl}
        target="_blank"
        rel="noreferrer"
        className="block overflow-hidden rounded-2xl border"
        style={{ background: cardBg, borderColor }}
      >
        <Image alt={attachment.name} className="h-auto max-h-64 w-full object-cover" height={360} src={attachment.dataUrl} unoptimized width={640} />
        <div className="px-3 py-2">
          <p className="truncate text-sm font-black" style={{ color: titleColor }}>{attachment.name}</p>
          <p className="text-xs font-semibold" style={{ color: metaColor }}>{formatFileSize(attachment.size)}</p>
        </div>
      </a>
    );
  }

  if (attachment.kind === 'video') {
    return (
      <div className="overflow-hidden rounded-2xl border" style={{ background: cardBg, borderColor }}>
        <video className="max-h-72 w-full" controls src={attachment.dataUrl}>
          <track kind="captions" />
        </video>
        <div className="px-3 py-2">
          <p className="truncate text-sm font-black" style={{ color: titleColor }}>{attachment.name}</p>
          <p className="text-xs font-semibold" style={{ color: metaColor }}>{formatFileSize(attachment.size)}</p>
        </div>
      </div>
    );
  }

  return (
    <a
      className="flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5 text-sm font-bold"
      download={attachment.name}
      href={attachment.dataUrl}
      style={{
        background: cardBg,
        borderColor,
        color: titleColor,
      }}
    >
      <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
      </svg>
      <span className="min-w-0 flex-1">
        <span className="block truncate">{attachment.name}</span>
        <span className="block text-xs font-semibold" style={{ color: metaColor }}>{formatFileSize(attachment.size)}</span>
      </span>
    </a>
  );
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}
