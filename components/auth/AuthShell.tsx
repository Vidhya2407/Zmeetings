'use client';

import Link from 'next/link';
import React from 'react';
import { motion } from 'framer-motion';
import BrandMark from '@/components/branding/BrandMark';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';

type AuthShellProps = {
  badge?: string;
  title: string;
  description: string;
  icon?: React.ReactNode;
  brandTagline?: string;
  maxWidthClassName?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

function useAuthTheme() {
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  return (hydrated ? theme : 'dark') === 'light';
}

export function AuthShell({
  badge,
  title,
  description,
  icon,
  brandTagline = 'Zero Carbon Meetings',
  maxWidthClassName = 'max-w-md',
  children,
  footer,
}: AuthShellProps) {
  const isLight = useAuthTheme();

  return (
    <div
      className="min-h-screen px-4 pb-10 pt-20 sm:px-6 sm:py-14"
      style={{
        background: isLight
          ? 'radial-gradient(circle at top, rgba(0,229,186,0.14), transparent 28%), radial-gradient(circle at bottom right, rgba(0,128,255,0.12), transparent 24%), linear-gradient(145deg, #edf4f7 0%, #f8fbfd 46%, #eef8f4 100%)'
          : 'radial-gradient(circle at top, rgba(0,229,186,0.08), transparent 28%), radial-gradient(circle at bottom right, rgba(0,128,255,0.08), transparent 24%), linear-gradient(145deg, #050b12 0%, #09121f 46%, #071713 100%)',
      }}
    >
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full items-start justify-center sm:min-h-[calc(100vh-5rem)] sm:items-center">
        <motion.div
          animate={{ opacity: 1, y: 0 }}
          className={`relative w-full ${maxWidthClassName}`}
          initial={{ opacity: 0, y: 18 }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
        >
          <div
            className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-90"
            style={{
              background: isLight
                ? 'radial-gradient(circle at top, rgba(0,229,186,0.12), transparent 42%)'
                : 'radial-gradient(circle at top, rgba(0,229,186,0.14), transparent 42%)',
            }}
          />

          <div
            className="relative overflow-hidden rounded-[2rem] border p-6 sm:p-8"
            style={{
              background: isLight
                ? 'linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(245,250,251,0.84) 100%)'
                : 'linear-gradient(180deg, rgba(255,255,255,0.065) 0%, rgba(255,255,255,0.035) 100%)',
              borderColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              boxShadow: isLight ? '0 30px 80px rgba(15,23,42,0.12)' : '0 24px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div className="absolute inset-x-8 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(0,229,186,0.55),transparent)]" />

            <div className="mb-8 text-center">
              <Link className="inline-flex flex-col items-center gap-2" href="/">
                <span className="inline-flex items-end gap-3 overflow-visible rounded-2xl px-4 py-3 text-3xl font-black tracking-tight" style={{ background: isLight ? 'rgba(0,229,186,0.12)' : 'rgba(0,229,186,0.10)' }}>
                  <BrandMark alt="Z Meetings" className="h-[1.2em] w-[1.2em] shrink-0 self-center" />
                  <span
                    className="brand-gradient-text block pb-[0.08em] leading-[1.1]"
                  >
                    Meetings
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-[0.28em]" style={{ color: isLight ? 'rgba(0,161,127,0.62)' : 'rgba(0,229,186,0.45)' }}>
                  {brandTagline}
                </span>
              </Link>
            </div>

            <div className="mb-7">
              {badge ? (
                <div
                  className="mb-4 inline-flex rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em]"
                  style={{ borderColor: 'rgba(0,229,186,0.22)', color: 'rgba(0,229,186,0.78)', background: isLight ? 'rgba(0,229,186,0.11)' : 'rgba(0,229,186,0.08)' }}
                >
                  {badge}
                </div>
              ) : null}

              {icon ? (
                <div
                  className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border"
                  style={{ background: isLight ? 'rgba(0,229,186,0.12)' : 'rgba(0,229,186,0.1)', borderColor: 'rgba(0,229,186,0.18)', color: 'rgb(0,229,186)' }}
                >
                  {icon}
                </div>
              ) : null}

              <h1 className="max-w-[16ch] text-3xl font-black leading-tight sm:text-[2rem]" style={{ color: isLight ? '#0f172a' : '#ffffff' }}>
                {title}
              </h1>
              <p className="mt-2 max-w-[52ch] text-sm leading-6" style={{ color: isLight ? '#475569' : '#9ca3af' }}>
                {description}
              </p>
            </div>

            {children}

            {footer ? <div className="mt-6">{footer}</div> : null}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export function AuthField({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  const isLight = useAuthTheme();

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.18em]" htmlFor={htmlFor} style={{ color: isLight ? '#64748b' : '#9ca3af' }}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const isLight = useAuthTheme();

  return (
    <input
      {...props}
      className={`w-full rounded-2xl border px-4 py-3 text-sm outline-none transition-all placeholder:text-gray-500 ${props.className ?? ''}`.trim()}
      style={{
        background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.05)',
        borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.09)',
        color: isLight ? '#0f172a' : '#ffffff',
        ...props.style,
      }}
    />
  );
}

export function AuthSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const isLight = useAuthTheme();

  return (
    <select
      {...props}
      className={`w-full rounded-2xl border px-3 py-3 text-sm outline-none transition-all ${props.className ?? ''}`.trim()}
      style={{
        background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.05)',
        borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.09)',
        color: isLight ? '#0f172a' : '#ffffff',
        ...props.style,
      }}
    />
  );
}

export function AuthError({ message }: { message: string }) {
  const isLight = useAuthTheme();

  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-2xl border px-3.5 py-3"
      initial={{ opacity: 0, y: -4 }}
      role="alert"
      style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.2)' }}
    >
      <span className="text-sm">!</span>
      <p className="text-xs" style={{ color: isLight ? '#b91c1c' : '#f87171' }}>{message}</p>
    </motion.div>
  );
}

export function AuthSuccess({ message }: { message: string }) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-2 rounded-2xl border px-3.5 py-3"
      initial={{ opacity: 0, y: -4 }}
      role="status"
      style={{ background: 'rgba(0,229,186,0.08)', borderColor: 'rgba(0,229,186,0.22)' }}
    >
      <span className="text-sm" style={{ color: 'rgb(0,229,186)' }}>
        OK
      </span>
      <p className="text-xs font-semibold" style={{ color: 'rgb(0,229,186)' }}>
        {message}
      </p>
    </motion.div>
  );
}

export function PrimaryAction({
  children,
  disabled,
  type = 'button',
  onClick,
  className = '',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  type?: 'button' | 'submit';
  onClick?: () => void;
  className?: string;
}) {
  return (
    <motion.button
      className={`brand-gradient-button flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-black transition-all ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      type={type}
      whileHover={disabled ? {} : { scale: 1.01, boxShadow: '0 0 28px rgba(0,122,106,0.22)' }}
      whileTap={disabled ? {} : { scale: 0.985 }}
    >
      {children}
    </motion.button>
  );
}

export function SecondaryAction({
  children,
  onClick,
  type = 'button',
  disabled,
  className = '',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const isLight = useAuthTheme();

  return (
    <motion.button
      className={`flex items-center justify-center rounded-2xl border px-5 py-3 text-sm font-bold transition-all ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      style={{
        background: isLight ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.04)',
        borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.08)',
        color: disabled ? (isLight ? 'rgba(15,23,42,0.25)' : 'rgba(255,255,255,0.3)') : (isLight ? '#334155' : 'rgba(255,255,255,0.65)'),
      }}
      type={type}
      whileHover={disabled ? {} : { scale: 1.01 }}
      whileTap={disabled ? {} : { scale: 0.985 }}
    >
      {children}
    </motion.button>
  );
}
