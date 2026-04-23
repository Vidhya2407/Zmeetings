'use client';

import React from 'react';
import type { ChatAttachment } from '@/types/domain/workspace';

export default function Composer({
  isLight,
  value,
  attachments,
  onChange,
  onFileSelect,
  onRemoveAttachment,
  onSend,
  disabled,
  attachLabel,
  removeAttachmentLabel,
  placeholder,
  sendLabel,
}: {
  isLight: boolean;
  value: string;
  attachments: ChatAttachment[];
  onChange: (value: string) => void;
  onFileSelect: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onSend: () => void;
  disabled: boolean;
  attachLabel: string;
  removeAttachmentLabel: string;
  placeholder: string;
  sendLabel: string;
}) {
  const fileInputId = React.useId();
  const attachmentBorder = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.1)';

  return (
    <div className="mt-2 space-y-2">
      {attachments.length ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className="flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2"
              style={{
                background: isLight ? 'rgba(248,250,252,0.92)' : 'rgba(255,255,255,0.045)',
                borderColor: attachmentBorder,
              }}
            >
              <AttachmentIcon kind={attachment.kind} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>{attachment.name}</span>
                <span className="block text-xs font-semibold" style={{ color: isLight ? '#64748b' : '#94a3b8' }}>{formatFileSize(attachment.size)}</span>
              </span>
              <button
                aria-label={`${removeAttachmentLabel} ${attachment.name}`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-base font-black"
                onClick={() => onRemoveAttachment(attachment.id)}
                style={{
                  background: isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                  color: isLight ? '#0f172a' : '#ffffff',
                }}
                type="button"
              >
                x
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          className="sr-only"
          id={fileInputId}
          multiple
          onChange={(event) => {
            onFileSelect(event.target.files);
            event.target.value = '';
          }}
          type="file"
        />
        <label
          aria-label={attachLabel}
          className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-xl border"
          htmlFor={fileInputId}
          style={{
            background: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.05)',
            borderColor: attachmentBorder,
            color: isLight ? '#0f172a' : '#ffffff',
          }}
          title={attachLabel}
        >
          <PaperclipIcon />
        </label>
        <input
          className="h-11 flex-1 rounded-xl border px-3 text-base outline-none"
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder={placeholder}
          style={{
            background: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.05)',
            borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
            color: isLight ? '#0f172a' : '#ffffff',
          }}
          value={value}
        />
        <button
          className="h-11 rounded-xl px-4 text-base font-black"
          disabled={disabled}
          onClick={onSend}
          style={{
            background: disabled ? 'rgba(0,229,186,0.1)' : 'rgba(0,229,186,0.92)',
            color: disabled ? 'rgba(4,17,16,0.4)' : '#041110',
          }}
          type="button"
        >
          {sendLabel}
        </button>
      </div>
    </div>
  );
}

function AttachmentIcon({ kind }: { kind: ChatAttachment['kind'] }) {
  if (kind === 'image') {
    return (
      <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <rect height="18" rx="2" width="18" x="3" y="3" />
        <circle cx="9" cy="9" r="2" />
        <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L7 20" />
      </svg>
    );
  }

  if (kind === 'video') {
    return (
      <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
        <path d="m16 13 5 3V8l-5 3" />
        <rect height="14" rx="2" width="13" x="3" y="5" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function PaperclipIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m21.4 11.6-8.5 8.5a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5" />
    </svg>
  );
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${size} B`;
}
