'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { AuthError, AuthField, AuthInput, AuthShell, PrimaryAction, SecondaryAction } from '../../components/auth/AuthShell';
import { useAppTranslations } from '../../lib/utils/translations';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';
import type { ApiResponse } from '@/types/api';

type RegisterResponse = {
  message: string;
  userId: string;
};

type RegisterStep = 'account' | 'profile' | 'consent';

const STEP_ORDER: RegisterStep[] = ['account', 'profile', 'consent'];
const GENRE_OPTIONS = ['Climate', 'Music', 'Documentary', 'Tech Talks', 'Live Events', 'Wellness', 'Gaming', 'Shorts'];

function calcStrength(password: string) {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;

  const color = ['transparent', 'rgb(239,68,68)', 'rgb(251,146,60)', 'rgb(251,191,36)', 'rgb(0,229,186)'][score] ?? 'rgb(0,229,186)';
  return { color, score };
}

function stepTitle(step: RegisterStep, t: ReturnType<typeof useAppTranslations>['t']) {
  if (step === 'account') return t('auth.register.flow.account', 'Account details');
  if (step === 'profile') return t('auth.register.flow.profile', 'Profile setup');
  return t('auth.register.flow.consent', 'Privacy & consent');
}

function stepDescription(step: RegisterStep, t: ReturnType<typeof useAppTranslations>['t']) {
  if (step === 'account') return t('auth.register.flow.accountDesc', 'Create your secure login and access the meetings workspace.');
  if (step === 'profile') return t('auth.register.flow.profileDesc', 'Add a recognizable avatar and choose the content spaces you care about most.');
  return t('auth.register.flow.consentDesc', 'Confirm the required privacy choices before creating the account.');
}

function avatarInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ZM';
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export default function RegisterPage() {
  const router = useRouter();
  const { t } = useAppTranslations();
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [currentStep, setCurrentStep] = React.useState<RegisterStep>('account');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [acceptedTerms, setAcceptedTerms] = React.useState(false);
  const [confirmAge, setConfirmAge] = React.useState(false);
  const [marketingConsent, setMarketingConsent] = React.useState(false);
  const [favoriteGenres, setFavoriteGenres] = React.useState<string[]>(['Climate', 'Live Events']);
  const [avatarPreview, setAvatarPreview] = React.useState('');
  const [avatarFileName, setAvatarFileName] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [createdEmail, setCreatedEmail] = React.useState('');
  const initializedStepFromQueryRef = React.useRef(false);
  const strength = calcStrength(password);

  const currentIndex = STEP_ORDER.indexOf(currentStep);
  const isLastStep = currentStep === 'consent';

  const textPrimary = isLight ? '#0f172a' : '#ffffff';
  const textSecondary = isLight ? '#475569' : '#9ca3af';
  const textMuted = isLight ? '#64748b' : '#94a3b8';
  const panelBg = isLight ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.04)';
  const panelBorder = isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.08)';
  const softSurface = isLight ? 'rgba(248,250,252,0.96)' : 'rgba(15,23,42,0.5)';
  const accent = 'rgb(0,229,186)';
  const accentText = isLight ? '#047857' : '#5eead4';
  const accentSoft = isLight ? 'rgba(220,252,231,0.95)' : 'rgba(13,148,136,0.14)';

  const validateAccount = React.useCallback(() => {
    if (name.trim().length < 2) return t('auth.register.nameError', 'Enter your full name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return t('auth.register.emailError', 'Enter a valid email address.');
    if (password.length < 8) return t('auth.register.passwordLengthError', 'Password must be at least 8 characters.');
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      return t('auth.register.passwordPatternError', 'Password must include uppercase, lowercase, and a number.');
    }
    if (password !== confirmPassword) return t('auth.register.passwordMatchError', 'Passwords do not match.');
    return '';
  }, [confirmPassword, email, name, password, t]);

  const validateProfile = React.useCallback(() => {
    if (favoriteGenres.length === 0) {
      return t('auth.register.favoriteGenresError', 'Choose at least one favorite genre.');
    }
    return '';
  }, [favoriteGenres.length, t]);

  const validateConsent = React.useCallback(() => {
    if (!confirmAge) return t('auth.register.ageConsentError', 'Confirm that you are 16 years of age or older.');
    if (!acceptedTerms) return t('auth.register.termsError', 'Accept the terms, privacy policy, and cookie policy to continue.');
    return '';
  }, [acceptedTerms, confirmAge, t]);

  React.useEffect(() => {
    if (initializedStepFromQueryRef.current) return;
    const requestedStep = new URLSearchParams(window.location.search).get('step');
    if (requestedStep === 'account' || requestedStep === 'profile' || requestedStep === 'consent') {
      setCurrentStep(requestedStep);
    }
    initializedStepFromQueryRef.current = true;
  }, []);

  const validateCurrentStep = React.useCallback(() => {
    if (currentStep === 'account') return validateAccount();
    if (currentStep === 'profile') return validateProfile();
    return validateConsent();
  }, [currentStep, validateAccount, validateConsent, validateProfile]);

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('auth.register.avatarTypeError', 'Please upload an image file.'));
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setError(t('auth.register.avatarSizeError', 'Please choose an image smaller than 2 MB.'));
      return;
    }

    setError('');
    setAvatarFileName(file.name);

    const preview = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('preview_failed'));
      reader.readAsDataURL(file);
    }).catch(() => '');

    if (preview) {
      setAvatarPreview(preview);
    }
  };

  const handleNext = () => {
    setError('');
    const validationError = validateCurrentStep();
    if (validationError) {
      setError(validationError);
      return;
    }

    const nextStep = STEP_ORDER[currentIndex + 1];
    if (nextStep) {
      setCurrentStep(nextStep);
    }
  };

  const handleBack = () => {
    setError('');
    const previousStep = STEP_ORDER[currentIndex - 1];
    if (previousStep) {
      setCurrentStep(previousStep);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    const validationError = validateAccount() || validateProfile() || validateConsent();
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
        maxWidthClassName="max-w-2xl"
        title={t('auth.register.doneTitle', 'Welcome to Z Meetings')}
      >
        <div className="space-y-5 text-center">
          <div className="rounded-[1.75rem] border px-5 py-8" style={{ borderColor: panelBorder, background: panelBg }}>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.25rem] font-black" style={{ background: accentSoft, color: accentText }}>
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={t('auth.register.avatarPreviewAlt', 'Avatar preview')} className="h-full w-full rounded-[1.25rem] object-cover" src={avatarPreview} />
              ) : (
                avatarInitials(name)
              )}
            </div>
            <p className="text-sm" style={{ color: textSecondary }}>{t('auth.register.accountCreatedFor', 'Account created for')}</p>
            <p className="mt-2 text-sm font-black" style={{ color: textPrimary }}>{createdEmail}</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {favoriteGenres.map((genre) => (
                <span key={genre} className="rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em]" style={{ background: accentSoft, color: accentText }}>
                  {genre}
                </span>
              ))}
            </div>
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
      description={t('auth.register.subtitle', 'Create your account with a guided setup that stays readable in both themes.')}
      maxWidthClassName="max-w-5xl"
      title={t('auth.register.title', 'Join Z Meetings')}
      footer={(
        <p className="text-center text-xs" style={{ color: textSecondary }}>
          {t('auth.register.alreadyHaveAccount', 'Already have an account?')}{' '}
          <button className="font-bold" onClick={() => router.push('/login')} style={{ color: accent }} type="button">
            {t('auth.register.signIn', 'Sign in')}
          </button>
        </p>
      )}
    >
      <div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-[1.75rem] border p-4" style={{ background: panelBg, borderColor: panelBorder }}>
            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: accentText }}>
              {t('auth.register.stepperLabel', 'Registration flow')}
            </p>
            <div className="mt-4 space-y-3">
              {STEP_ORDER.map((step, index) => {
                const status = index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'upcoming';
                return (
                  <div key={step} className="flex items-center gap-3 rounded-2xl border px-3 py-3" style={{ background: status === 'current' ? accentSoft : softSurface, borderColor: status === 'current' ? 'rgba(0,229,186,0.28)' : panelBorder }}>
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black"
                      style={{
                        background: status === 'done' ? accent : status === 'current' ? (isLight ? '#ffffff' : 'rgba(255,255,255,0.08)') : 'transparent',
                        color: status === 'done' ? '#041110' : status === 'current' ? accentText : textMuted,
                        border: `1px solid ${status === 'upcoming' ? panelBorder : 'rgba(0,229,186,0.32)'}`,
                      }}
                    >
                      {status === 'done' ? 'OK' : index + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black" style={{ color: textPrimary }}>
                        {stepTitle(step, t)}
                      </p>
                      <p className="mt-1 text-xs leading-5" style={{ color: textSecondary }}>
                        {stepDescription(step, t)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[1.75rem] border p-4" style={{ background: softSurface, borderColor: panelBorder }}>
            <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: textMuted }}>
              {t('auth.register.previewLabel', 'Live preview')}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-[1.25rem] border text-base font-black" style={{ borderColor: 'rgba(0,229,186,0.24)', background: accentSoft, color: accentText }}>
                {avatarPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt={t('auth.register.avatarPreviewAlt', 'Avatar preview')} className="h-full w-full object-cover" src={avatarPreview} />
                ) : (
                  avatarInitials(name)
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-black" style={{ color: textPrimary }}>{name.trim() || 'Your profile'}</p>
                <p className="truncate text-xs" style={{ color: textSecondary }}>{email.trim() || 'name@example.com'}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {favoriteGenres.map((genre) => (
                <span key={genre} className="rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em]" style={{ background: accentSoft, color: accentText }}>
                  {genre}
                </span>
              ))}
            </div>
          </div>
        </aside>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="rounded-[1.75rem] border p-5 sm:p-6" style={{ background: panelBg, borderColor: panelBorder }}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.22em]" style={{ color: accentText }}>
                  {t('auth.register.stepCount', `Step ${currentIndex + 1} of ${STEP_ORDER.length}`)}
                </p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.02em]" style={{ color: textPrimary }}>
                  {stepTitle(currentStep, t)}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: textSecondary }}>
                  {stepDescription(currentStep, t)}
                </p>
              </div>

              {currentIndex > 0 ? (
                <SecondaryAction className="min-w-[128px]" onClick={handleBack}>
                  {t('auth.register.back', 'Back')}
                </SecondaryAction>
              ) : null}
            </div>

            {currentStep === 'account' ? (
              <div className="mt-6 space-y-5">
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
              </div>
            ) : null}

            {currentStep === 'profile' ? (
              <div className="mt-6 space-y-6">
                <div className="rounded-[1.5rem] border p-4" style={{ background: softSurface, borderColor: panelBorder }}>
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[1.5rem] border text-xl font-black" style={{ background: accentSoft, borderColor: 'rgba(0,229,186,0.24)', color: accentText }}>
                      {avatarPreview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={t('auth.register.avatarPreviewAlt', 'Avatar preview')} className="h-full w-full object-cover" src={avatarPreview} />
                      ) : (
                        avatarInitials(name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black" style={{ color: textPrimary }}>
                        {t('auth.register.avatarTitle', 'Upload avatar')}
                      </p>
                      <p className="mt-1 text-sm leading-6" style={{ color: textSecondary }}>
                        {t('auth.register.avatarSubtitle', 'Choose a clear photo or illustration so teammates can recognize you quickly.')}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        <button
                          className="rounded-2xl border px-4 py-2.5 text-sm font-black"
                          onClick={() => fileInputRef.current?.click()}
                          style={{ background: accentSoft, borderColor: 'rgba(0,229,186,0.28)', color: accentText }}
                          type="button"
                        >
                          {avatarFileName ? t('auth.register.changeAvatar', 'Change avatar') : t('auth.register.uploadAvatar', 'Upload avatar')}
                        </button>
                        <span className="text-sm" style={{ color: textMuted }}>
                          {avatarFileName || t('auth.register.avatarHint', 'PNG or JPG up to 2 MB')}
                        </span>
                      </div>
                      <input
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => void handleAvatarChange(event)}
                        ref={fileInputRef}
                        type="file"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="mb-3">
                    <p className="text-sm font-black" style={{ color: textPrimary }}>
                      {t('auth.register.favoriteGenres', 'Favorite genres')}
                    </p>
                    <p className="mt-1 text-sm leading-6" style={{ color: textSecondary }}>
                      {t('auth.register.favoriteGenresSubtitle', 'Pick the content lanes and event types you want surfaced first.')}
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {GENRE_OPTIONS.map((genre) => {
                      const selected = favoriteGenres.includes(genre);
                      return (
                        <button
                          key={genre}
                          aria-pressed={selected}
                          className="flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition"
                          onClick={() => setFavoriteGenres((current) => (
                            current.includes(genre)
                              ? current.filter((item) => item !== genre)
                              : [...current, genre]
                          ))}
                          style={{
                            background: selected ? accentSoft : softSurface,
                            borderColor: selected ? 'rgba(0,229,186,0.28)' : panelBorder,
                            color: selected ? accentText : textPrimary,
                          }}
                          type="button"
                        >
                          <span className="text-sm font-black">{genre}</span>
                          <span
                            className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black"
                            style={{
                              background: selected ? accent : 'transparent',
                              border: `1px solid ${selected ? 'transparent' : panelBorder}`,
                              color: selected ? '#041110' : textMuted,
                            }}
                          >
                            {selected ? 'OK' : '+'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : null}

            {currentStep === 'consent' ? (
              <div className="mt-6 space-y-4">
                <div className="rounded-[1.5rem] border px-4 py-3 text-sm leading-6" style={{ background: accentSoft, borderColor: 'rgba(0,229,186,0.2)', color: accentText }}>
                  {t('auth.register.privacyNotice', 'We only ask for the choices required to open your account safely. Optional marketing consent can be changed later.')}
                </div>

                <ConsentCard
                  checked={confirmAge}
                  description={t('auth.register.ageConsentDesc', 'Required for account eligibility and onboarding access.')}
                  isLight={isLight}
                  onToggle={() => setConfirmAge((value) => !value)}
                  title={t('auth.register.ageConsent', 'I confirm I am 16 years of age or older')}
                />

                <ConsentCard
                  checked={acceptedTerms}
                  description={t('auth.register.termsConsentDesc', 'Required to process your account under the terms, privacy policy, and cookie policy.')}
                  extra={(
                    <p className="mt-2 text-xs leading-5" style={{ color: textSecondary }}>
                      <Link className="font-bold" href="/terms-of-service" style={{ color: accent }}>
                        {t('auth.register.termsOfService', 'Terms of Service')}
                      </Link>
                      {' · '}
                      <Link className="font-bold" href="/privacy-policy" style={{ color: accent }}>
                        {t('auth.register.privacyPolicy', 'Privacy Policy')}
                      </Link>
                      {' · '}
                      <Link className="font-bold" href="/cookie-policy" style={{ color: accent }}>
                        {t('auth.register.cookiePolicy', 'Cookie Policy')}
                      </Link>
                    </p>
                  )}
                  isLight={isLight}
                  onToggle={() => setAcceptedTerms((value) => !value)}
                  title={t('auth.register.acceptTerms', 'I accept the privacy and legal terms')}
                />

                <ConsentCard
                  checked={marketingConsent}
                  description={t('auth.register.marketingConsentDesc', 'Optional updates about events, releases, and sustainability reports.')}
                  isLight={isLight}
                  onToggle={() => setMarketingConsent((value) => !value)}
                  title={t('auth.register.marketingConsent', 'I agree to receive product updates and curated event emails')}
                />
              </div>
            ) : null}

            {error ? <div className="mt-5"><AuthError message={error} /></div> : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs leading-5" style={{ color: textMuted }}>
                {currentStep === 'profile'
                  ? t('auth.register.profileHint', 'You can skip the avatar later, but at least one genre keeps the home feed personalized.')
                  : currentStep === 'consent'
                    ? t('auth.register.consentHint', 'Required checkboxes must be selected before account creation.')
                    : t('auth.register.accountHint', 'Use a strong password so the workspace stays protected.')}
              </p>

              {isLastStep ? (
                <PrimaryAction disabled={loading} type="submit" className="min-w-[180px] sm:w-auto sm:px-6">
                  {loading ? <LoadingLabel label={t('auth.register.creatingAccount', 'Creating account...')} /> : t('auth.register.createAccount', 'Create account')}
                </PrimaryAction>
              ) : (
                <PrimaryAction onClick={handleNext} className="min-w-[160px] sm:w-auto sm:px-6">
                  {t('auth.register.next', 'Next')}
                </PrimaryAction>
              )}
            </div>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}

function ConsentCard({
  title,
  description,
  checked,
  onToggle,
  isLight,
  extra,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
  isLight: boolean;
  extra?: React.ReactNode;
}) {
  const borderColor = checked ? 'rgba(0,229,186,0.28)' : (isLight ? 'rgba(15,23,42,0.1)' : 'rgba(255,255,255,0.08)');
  const background = checked ? (isLight ? 'rgba(236,253,245,0.96)' : 'rgba(13,148,136,0.14)') : (isLight ? 'rgba(248,250,252,0.96)' : 'rgba(15,23,42,0.5)');
  const titleColor = checked ? (isLight ? '#065f46' : '#5eead4') : (isLight ? '#0f172a' : '#ffffff');
  const bodyColor = isLight ? '#475569' : '#9ca3af';

  return (
    <button
      aria-pressed={checked}
      className="w-full rounded-[1.5rem] border px-4 py-4 text-left transition"
      onClick={onToggle}
      style={{ borderColor, background }}
      type="button"
    >
      <div className="flex items-start gap-3">
        <div
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black"
          style={{
            background: checked ? 'rgb(0,229,186)' : 'transparent',
            border: `1px solid ${checked ? 'transparent' : borderColor}`,
            color: checked ? '#041110' : bodyColor,
          }}
        >
          {checked ? 'OK' : ''}
        </div>
        <div className="min-w-0">
          <p className="text-base font-black" style={{ color: titleColor }}>{title}</p>
          <p className="mt-1 text-sm leading-6" style={{ color: bodyColor }}>{description}</p>
          {extra}
        </div>
      </div>
    </button>
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
