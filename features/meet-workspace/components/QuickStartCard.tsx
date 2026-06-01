'use client';

import React from 'react';

export default function QuickStartCard({
  isLight,
  onStartMeeting,
  title,
  description,
  ctaLabel,
  disabled = false,
}: {
  isLight: boolean;
  onStartMeeting: () => void;
  title: string;
  description: string;
  ctaLabel: string;
  disabled?: boolean;
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
      <button
        aria-busy={disabled}
        className="mt-5 rounded-2xl px-5 py-3 text-sm font-black"
        disabled={disabled}
        onClick={onStartMeeting}
        style={{ background: 'rgba(0,229,186,0.92)', color: '#041110', opacity: disabled ? 0.72 : 1 }}
        type="button"
      >
        {ctaLabel}
      </button>
    </section>
  );
}
