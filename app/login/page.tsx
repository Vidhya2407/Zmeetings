'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { toast } from 'sonner';
import { useRouter, useSearchParams } from 'next/navigation';
import { AuthError, AuthField, AuthInput, AuthShell, PrimaryAction } from '../../components/auth/AuthShell';
import { useAppTranslations } from '../../lib/utils/translations';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';

export const dynamic = 'force-dynamic';

type AuthMode = 'password' | 'magic';

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return '/meet';
  }

  return value;
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </React.Suspense>
  );
}

function LoginPageContent() {
  const { t } = useAppTranslations();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const [mode, setMode] = React.useState<AuthMode>('password');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [remember, setRemember] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [magicSent, setMagicSent] = React.useState(false);
  const [error, setError] = React.useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  const mutedText = isLight ? '#64748b' : '#9ca3af';
  const panelBg = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)';
  const panelBorder = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.08)';
  const bodyText = isLight ? '#0f172a' : '#ffffff';
  const nextPath = getSafeNextPath(searchParams.get('next'));

  React.useEffect(() => {
    const authError = searchParams.get('error');
    if (!authError) return;

    const errorMap: Record<string, string> = {
      Configuration: t('auth.login.authConfigError', 'Authentication is temporarily unavailable. Please try again.'),
      AccessDenied: t('auth.login.authAccessDenied', 'Access denied. Please check your account permissions.'),
      Verification: t('auth.login.authVerificationError', 'Verification failed. Please try signing in again.'),
      Default: t('auth.login.authDefaultError', 'Sign-in failed. Please try again.'),
    };

    const message = errorMap[authError] ?? errorMap.Default;
    setError(message);
    toast.error(message);
  }, [searchParams, t]);

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      toast.error(t('auth.login.fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const res = await signIn('credentials', {
        callbackUrl: nextPath,
        email,
        password,
        redirect: false,
      });

      if (res?.error) {
        const message = t('auth.login.invalidCredentials');
        toast.error(message);
        setError(message);
        return;
      }

      toast.success(t('auth.login.success'));
      window.location.assign(nextPath);
    } catch {
      toast.error(t('error.generic'));
    } finally {
      setTimeout(() => setLoading(false), 500);
    }
  };

  const handleMagicLink = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError(t('auth.login.enterEmailAddress'));
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMagicSent(true);
    }, 1400);
  };

  const handleUnavailableProvider = (label: string) => {
    const message = t(
      'auth.login.providerUnavailable',
      `${label} sign-in is not configured yet. Use password or magic link.`,
    );
    setError(message);
    toast.error(message);
  };

  return (
    <AuthShell
      badge={mode === 'password' ? t('auth.login.passwordMode') : t('auth.login.magicMode')}
      brandTagline={t('auth.login.brandTagline')}
      description={t('auth.login.subtitle')}
      maxWidthClassName="max-w-lg"
      title={t('auth.login.title')}
      footer={(
        <>
          <div className="mb-5 flex items-center gap-3">
            <div className="h-px flex-1" style={{ background: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.07)' }} />
            <span className="text-xs" style={{ color: mutedText }}>{t('auth.login.continueWith')}</span>
            <div className="h-px flex-1" style={{ background: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.07)' }} />
          </div>

          <div className="mb-5 grid grid-cols-2 gap-3">
            <OAuthButton icon={<GoogleIcon />} isLight={isLight} label="Google" onClick={() => handleUnavailableProvider('Google')} />
            <OAuthButton icon={<GitHubIcon />} isLight={isLight} label="GitHub" onClick={() => handleUnavailableProvider('GitHub')} />
          </div>

          <p className="text-center text-xs" style={{ color: mutedText }}>
            {t('auth.login.noAccount')}{' '}
            <button
              className="font-bold transition-colors"
              onClick={() => router.push('/register')}
              style={{ color: 'rgb(0,229,186)' }}
              type="button"
            >
              {t('auth.login.createOneFree')}
            </button>
          </p>
        </>
      )}
    >
      <div className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border p-1" style={{ background: panelBg, borderColor: panelBorder }}>
        {(['password', 'magic'] as const).map((currentMode) => (
          <button
            key={currentMode}
            className="rounded-xl px-3 py-2.5 text-xs font-bold transition-all"
            onClick={() => {
              setMode(currentMode);
              setError('');
              setMagicSent(false);
            }}
            style={{
              background: mode === currentMode ? 'rgba(0,229,186,0.16)' : 'transparent',
              color: mode === currentMode ? 'rgb(0,229,186)' : mutedText,
            }}
            type="button"
          >
            {currentMode === 'password' ? t('auth.login.passwordMode') : t('auth.login.magicMode')}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {mode === 'password' ? (
          <motion.form
            key="password"
            animate={{ opacity: 1, x: 0 }}
            className="space-y-5"
            exit={{ opacity: 0, x: 8 }}
            initial={{ opacity: 0, x: -8 }}
            onSubmit={handlePasswordLogin}
          >
            <AuthField htmlFor="email" label={t('auth.login.email')}>
              <AuthInput
                autoComplete="email"
                id="email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </AuthField>

            <AuthField htmlFor="password" label={t('auth.login.password')}>
              <div className="relative">
                <AuthInput
                  autoComplete="current-password"
                  id="password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="********"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                />
                <button
                  aria-label={showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ color: mutedText }}
                  type="button"
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </AuthField>

            <div className="flex items-center justify-between gap-4">
              <label className="flex cursor-pointer items-center gap-2.5">
                <button
                  aria-checked={remember}
                  aria-label={t('auth.login.rememberMe')}
                  className="flex h-5 w-5 items-center justify-center rounded-md border transition-all"
                  onClick={() => setRemember(!remember)}
                  role="checkbox"
                  style={{
                    background: remember ? 'rgb(0,229,186)' : isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.05)',
                    borderColor: remember ? 'transparent' : panelBorder,
                  }}
                  type="button"
                >
                  {remember ? <svg className="h-3 w-3 text-black" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}
                </button>
                <span className="text-xs" style={{ color: isLight ? '#475569' : '#9ca3af' }}>{t('auth.login.rememberMe')}</span>
              </label>

              <Link className="text-xs font-semibold" href="/forgot-password" style={{ color: 'rgb(0,229,186)' }}>
                {t('auth.login.forgotPassword')}
              </Link>
            </div>

            {error ? <AuthError message={error} /> : null}

            <PrimaryAction disabled={loading} type="submit">
              {loading ? <LoadingLabel label={t('auth.login.signingIn')} /> : t('auth.login.signin')}
            </PrimaryAction>
          </motion.form>
        ) : (
          <motion.div
            key="magic"
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            initial={{ opacity: 0, x: 8 }}
          >
            <AnimatePresence mode="wait">
              {magicSent ? (
                <motion.div key="sent" animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.96 }} className="rounded-[1.5rem] border px-5 py-10 text-center" style={{ borderColor: panelBorder, background: panelBg }}>
                  <div className="mb-4 text-5xl">@</div>
                  <p className="mb-1 text-base font-bold" style={{ color: bodyText }}>{t('auth.login.checkInboxTitle')}</p>
                  <p className="mb-4 text-sm" style={{ color: mutedText }}>
                    {t('auth.login.magicSentTo')} <strong style={{ color: bodyText }}>{email}</strong>
                  </p>
                  <button className="text-xs font-semibold" onClick={() => setMagicSent(false)} style={{ color: 'rgb(0,229,186)' }} type="button">
                    {t('auth.login.tryDifferentEmail')}
                  </button>
                </motion.div>
              ) : (
                <motion.form key="form" className="space-y-5" onSubmit={handleMagicLink}>
                  <p className="text-sm leading-6" style={{ color: mutedText }}>{t('auth.login.passwordlessDesc')}</p>

                  <AuthField htmlFor="magic-email" label={t('auth.login.email')}>
                    <AuthInput
                      autoComplete="email"
                      id="magic-email"
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      type="email"
                      value={email}
                    />
                  </AuthField>

                  {error ? <AuthError message={error} /> : null}

                  <PrimaryAction disabled={loading} type="submit">
                    {loading ? <LoadingLabel label={t('auth.login.signingIn')} /> : t('auth.login.sendMagicLink')}
                  </PrimaryAction>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}

function LoginPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #060c14 0%, #0a1220 50%, #071814 100%)' }}>
      <p className="text-sm font-semibold text-slate-300">Loading login...</p>
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

function OAuthButton({ icon, isLight, label, onClick }: { icon: React.ReactNode; isLight: boolean; label: string; onClick: () => void }) {
  return (
    <motion.button
      className="flex items-center justify-center gap-2.5 rounded-2xl border py-3 text-sm font-semibold transition-all"
      onClick={onClick}
      style={{
        background: isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.05)',
        color: isLight ? '#334155' : 'rgba(255,255,255,0.8)',
        borderColor: isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.09)',
      }}
      type="button"
      whileHover={{ backgroundColor: isLight ? 'rgba(240,249,255,0.95)' : 'rgba(255,255,255,0.09)', scale: 1.01 }}
      whileTap={{ scale: 0.97 }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" strokeLinecap="round" strokeLinejoin="round" /></svg>
  ) : (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" /><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" /></svg>
  );
}

function GoogleIcon() {
  return <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>;
}

function GitHubIcon() {
  return <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" fillRule="evenodd" /></svg>;
}
