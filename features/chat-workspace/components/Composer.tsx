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
  const attachmentBorder = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const inputBg = isLight
    ? 'linear-gradient(180deg,rgba(255,255,255,0.98) 0%,rgba(248,250,252,0.98) 100%)'
    : 'linear-gradient(180deg,rgba(15,23,42,0.72) 0%,rgba(10,15,24,0.9) 100%)';
  const inputText = isLight ? '#0f172a' : '#ffffff';
  const metaText = isLight ? '#64748b' : '#94a3b8';

  return (
    <div className="mt-4 pb-2 sm:pb-0">
      <div
        className="rounded-[22px] border p-3 sm:p-4"
        style={{
          background: inputBg,
          borderColor: attachmentBorder,
          boxShadow: isLight ? '0 14px 32px rgba(15,23,42,0.08)' : 'inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
          <input
            className="peer sr-only"
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
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border bg-[var(--attach-bg)] border-[var(--attach-border)] text-[var(--attach-color)] transition hover:scale-[1.02] hover:border-[var(--attach-hover-border)] hover:bg-[var(--attach-hover-bg)] hover:text-[var(--attach-hover-color)] peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-[rgb(0,229,186)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-transparent sm:h-12 sm:w-12"
            htmlFor={fileInputId}
            style={{
              '--attach-bg': isLight ? 'rgba(240,247,246,0.98)' : 'rgba(255,255,255,0.07)',
              '--attach-border': attachmentBorder,
              '--attach-color': inputText,
              '--attach-hover-bg': 'rgba(0,229,186,0.12)',
              '--attach-hover-border': 'rgba(0,229,186,0.35)',
              '--attach-hover-color': 'rgb(0,229,186)',
            } as React.CSSProperties}
            title={attachLabel}
          >
            <PaperclipIcon />
          </label>
          <input
            className="h-11 min-w-0 flex-1 rounded-2xl border px-4 text-[15px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:h-12"
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={placeholder}
            style={{
              background: isLight ? 'rgba(248,250,252,0.96)' : 'rgba(255,255,255,0.035)',
              borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
              color: inputText,
            }}
            value={value}
          />
          <button
            className="brand-gradient-button h-11 shrink-0 rounded-2xl px-4 text-xs font-black uppercase tracking-[0.1em] transition enabled:hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed sm:h-12 sm:px-5 sm:text-sm sm:tracking-[0.14em]"
            disabled={disabled}
            onClick={onSend}
            type="button"
          >
            {sendLabel}
          </button>
        </div>

        {attachments.length ? (
          <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2" style={{ borderColor: attachmentBorder }}>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex min-w-0 items-center gap-3 rounded-2xl border px-3 py-2.5"
                style={{
                  background: isLight ? 'rgba(247,250,252,0.98)' : 'rgba(255,255,255,0.05)',
                  borderColor: attachmentBorder,
                }}
              >
                {attachment.kind === 'image' ? (
                  <img
                    alt={attachment.name}
                    className="h-11 w-11 shrink-0 rounded-xl object-cover"
                    src={attachment.dataUrl}
                  />
                ) : (
                  <AttachmentIcon kind={attachment.kind} />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black" style={{ color: inputText }}>{attachment.name}</span>
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: metaText }}>{formatFileSize(attachment.size)}</span>
                </span>
                <button
                  aria-label={`${removeAttachmentLabel} ${attachment.name}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--remove-bg)] text-[var(--remove-color)] text-base font-black transition hover:scale-[1.04] hover:bg-[var(--remove-hover-bg)] hover:text-[var(--remove-hover-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  onClick={() => onRemoveAttachment(attachment.id)}
                  style={{
                    '--remove-bg': isLight ? 'rgba(15,23,42,0.06)' : 'rgba(255,255,255,0.08)',
                    '--remove-color': inputText,
                    '--remove-hover-bg': 'rgba(0,229,186,0.12)',
                    '--remove-hover-color': 'rgb(0,229,186)',
                  } as React.CSSProperties}
                  type="button"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : null}
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
