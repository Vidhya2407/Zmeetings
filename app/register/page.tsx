'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { AuthError, AuthField, AuthInput, AuthShell, PrimaryAction } from '../../components/auth/AuthShell';
import { useAppTranslations } from '../../lib/utils/translations';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';
import type { ApiResponse } from '@/types/api';

type RegisterResponse = {
  message: string;
  userId: string;
};

function calcStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;

  const color = ['transparent', 'rgb(239,68,68)', 'rgb(251,146,60)', 'rgb(251,191,36)', 'rgb(0,229,186)'][score] ?? 'rgb(0,229,186)';
  return { color, score };
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useAppTranslations();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [createdEmail, setCreatedEmail] = React.useState('');
  const strength = calcStrength(password);
  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#475569' : '#9ca3af';
  const panelBg = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)';
  const panelBorder = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.08)';

  const validate = () => {
    if (name.trim().length < 2) return t('auth.register.nameError', 'Enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t('auth.register.emailError', 'Enter a valid email address.');
    if (password.length < 8) return t('auth.register.passwordLengthError', 'Password must be at least 8 characters.');
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return t('auth.register.passwordPatternError', 'Password must include uppercase, lowercase, and a number.');
    }
    if (password !== confirmPassword) return t('auth.register.passwordMatchError', 'Passwords do not match.');
    if (!acceptedTerms) return t('auth.register.termsError', 'Accept the terms, privacy policy, and cookie policy to continue.');
    return '';
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          name: name.trim(),
          password,
        }),
      });
      const result = await response.json().catch(() => null) as ApiResponse<RegisterResponse> | null;

      if (!response.ok || !result?.success) {
        const message = result?.error ?? t('auth.register.createFailed', 'Unable to create account right now.');
        setError(message);
        toast.error(message);
        return;
      }

      setCreatedEmail(email.trim());
      toast.success(t('auth.register.success', 'Account created successfully.'));
    } catch {
      const message = t('auth.register.createFailed', 'Unable to create account right now.');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  if (createdEmail) {
    return (
      <AuthShell
        badge={t('auth.register.badge', 'Create account')}
        brandTagline={t('auth.login.brandTagline', 'Zero Carbon Meetings')}
        description={t('auth.register.doneSubtitle', 'Your account is ready. Sign in to open your meetings workspace.')}
        maxWidthClassName="max-w-lg"
        title={t('auth.register.doneTitle', 'Welcome to ZMeetings')}
      >
        <div className="space-y-5 text-center">
          <div className="rounded-[1.5rem] border px-5 py-8" style={{ borderColor: panelBorder, background: panelBg }}>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl font-black" style={{ background: 'rgba(0,229,186,0.12)', color: 'rgb(0,229,186)' }}>OK</div>
            <p className="text-sm" style={{ color: textSecondary }}>{t('auth.register.accountCreatedFor', 'Account created for')}</p>
            <p className="mt-2 text-sm font-black" style={{ color: textPrimary }}>{createdEmail}</p>
          </div>
          <PrimaryAction onClick={() => router.push('/login')}>{t('auth.register.goToLogin', 'Go to login')}</PrimaryAction>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      badge={t('auth.register.badge', 'Create account')}
      brandTagline={t('auth.login.brandTagline', 'Zero Carbon Meetings')}
      description={t('auth.register.subtitle', 'Create a secure account for hosting, joining, and managing meetings.')}
      maxWidthClassName="max-w-xl"
      title={t('auth.register.title', 'Join ZMeetings')}
      footer={(
        <p className="text-center text-xs" style={{ color: textSecondary }}>
          {t('auth.register.alreadyHaveAccount', 'Already have an account?')}{' '}
          <button className="font-bold" onClick={() => router.push('/login')} style={{ color: 'rgb(0,229,186)' }} type="button">
            {t('auth.register.signIn', 'Sign in')}
          </button>
        </p>
      )}
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField htmlFor="register-name" label={t('auth.register.fullName', 'Full name')}>
            <AuthInput
              autoComplete="name"
              id="register-name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Ada Lovelace"
              type="text"
              value={name}
            />
          </AuthField>
          <AuthField htmlFor="register-email" label={t('auth.register.email', 'Email address')}>
            <AuthInput
              autoComplete="email"
              id="register-email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              type="email"
              value={email}
            />
          </AuthField>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <AuthField htmlFor="register-password" label={t('auth.register.password', 'Password')}>
            <AuthInput
              autoComplete="new-password"
              id="register-password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder={t('auth.register.passwordHint', '8+ chars, Aa, 123')}
              type="password"
              value={password}
            />
            {password ? (
              <div className="mt-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((level) => (
                    <motion.div
                      key={level}
                      animate={{ background: level <= strength.score ? strength.color : (isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)') }}
                      className="h-1 flex-1 rounded-full"
                      initial={false}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </AuthField>
          <AuthField htmlFor="register-confirm-password" label={t('auth.register.confirmPassword', 'Confirm password')}>
            <AuthInput
              autoComplete="new-password"
              id="register-confirm-password"
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t('auth.register.confirmPassword', 'Confirm password')}
              type="password"
              value={confirmPassword}
            />
          </AuthField>
        </div>

        <TermsConsent
          acceptLabel={t('auth.register.acceptPrefix', 'I accept the')}
          andLabel={t('common.and', 'and')}
          ariaLabel={t('auth.register.acceptTermsAria', 'Accept terms, privacy policy, and cookie policy')}
          checked={acceptedTerms}
          cookieLabel={t('auth.register.cookiePolicy', 'Cookie Policy')}
          onToggle={() => setAcceptedTerms((value) => !value)}
          privacyLabel={t('auth.register.privacyPolicy', 'Privacy Policy')}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          termsLabel={t('auth.register.termsOfService', 'Terms of Service')}
        />

        {error ? <AuthError message={error} /> : null}

        <PrimaryAction disabled={loading} type="submit">
          {loading ? <LoadingLabel label={t('auth.register.creatingAccount', 'Creating account...')} /> : t('auth.register.createAccount', 'Create account')}
        </PrimaryAction>
      </form>
    </AuthShell>
  );
}

function TermsConsent({
  acceptLabel,
  andLabel,
  ariaLabel,
  checked,
  cookieLabel,
  onToggle,
  privacyLabel,
  termsLabel,
  textPrimary,
  textSecondary,
}: {
  acceptLabel: string;
  andLabel: string;
  ariaLabel: string;
  checked: boolean;
  cookieLabel: string;
  onToggle: () => void;
  privacyLabel: string;
  termsLabel: string;
  textPrimary: string;
  textSecondary: string;
}) {
  return (
    <div className="mt-4 flex w-full items-start gap-3 rounded-2xl px-1 py-1 text-left">
      <button
        aria-checked={checked}
        aria-label={ariaLabel}
        className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border"
        onClick={onToggle}
        role="checkbox"
        style={{
          background: checked ? 'rgb(0,229,186)' : 'transparent',
          borderColor: checked ? 'transparent' : 'rgba(148,163,184,0.36)',
        }}
        type="button"
      >
        {checked ? <svg className="h-3 w-3 text-black" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
      </button>
      <p className="text-xs leading-5" style={{ color: checked ? textPrimary : textSecondary }}>
        <button className="font-medium" onClick={onToggle} type="button">
          {acceptLabel}
        </button>{' '}
        <Link className="font-bold transition-colors" href="/terms-of-service" style={{ color: 'rgb(0,229,186)' }}>
          {termsLabel}
        </Link>
        ,{' '}
        <Link className="font-bold transition-colors" href="/privacy-policy" style={{ color: 'rgb(0,229,186)' }}>
          {privacyLabel}
        </Link>
        ,{' '}
        {andLabel}{' '}
        <Link className="font-bold transition-colors" href="/cookie-policy" style={{ color: 'rgb(0,229,186)' }}>
          {cookieLabel}
        </Link>
        .
      </p>
    </div>
  );
}

function LoadingLabel({ label }: { label: string }) {
  return (
    <>
      <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
      </svg>
      {label}
    </>
  );
}
