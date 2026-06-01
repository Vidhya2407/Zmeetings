'use client';

import React from 'react';

export default function JoinByCodeCard({
  isLight,
  joinCode,
  onJoinCodeChange,
  onJoin,
  title,
  description,
  placeholder,
  ctaLabel,
}: {
  isLight: boolean;
  joinCode: string;
  onJoinCodeChange: (value: string) => void;
  onJoin: () => void;
  title: string;
  description: string;
  placeholder: string;
  ctaLabel: string;
}) {
  return (
    <section
      className="rounded-3xl border p-6"
      style={{
        background: isLight ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <h2 className="text-xl font-black" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
        {title}
      </h2>
      <p className="mt-3 text-sm leading-6" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
        {description}
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <input
          className="h-12 min-w-[220px] flex-1 rounded-2xl border px-4 text-sm font-mono outline-none"
          onChange={(event) => onJoinCodeChange(event.target.value.toUpperCase())}
          placeholder={placeholder}
          style={{
            background: isLight ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.05)',
            borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
            color: isLight ? '#0f172a' : '#ffffff',
          }}
          value={joinCode}
        />
        <button
          className="h-12 rounded-2xl px-5 text-sm font-black"
          onClick={onJoin}
          style={{ background: 'rgba(0,229,186,0.15)', color: 'rgb(0,229,186)', border: '1px solid rgba(0,229,186,0.3)' }}
          type="button"
        >
          {ctaLabel}
        </button>
      </div>
    </section>
  );
}
