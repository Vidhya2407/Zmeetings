'use client';

import React from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import AppShell from '../../../components/layout/AppShell';
import {
  mockBackupCodes,
  mockSecuritySecret,
  type BackupStage,
  type SmsStage,
  type TotpStage,
} from '../../../features/settings-security/config';
import { useAppTranslations } from '../../../lib/utils/translations';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';

type SmsCountry = {
  id: string;
  label: string;
  dialCode: string;
  placeholder: string;
  minDigits: number;
  maxDigits: number;
  trunkPrefix?: string;
};

const SMS_COUNTRIES: SmsCountry[] = [
  { id: 'de', label: 'Germany', dialCode: '+49', placeholder: '151 23456789', minDigits: 10, maxDigits: 12, trunkPrefix: '0' },
  { id: 'us', label: 'United States', dialCode: '+1', placeholder: '201 555 0123', minDigits: 10, maxDigits: 10 },
  { id: 'gb', label: 'United Kingdom', dialCode: '+44', placeholder: '07123 456789', minDigits: 10, maxDigits: 11, trunkPrefix: '0' },
  { id: 'fr', label: 'France', dialCode: '+33', placeholder: '06 12 34 56 78', minDigits: 9, maxDigits: 10, trunkPrefix: '0' },
  { id: 'in', label: 'India', dialCode: '+91', placeholder: '98765 43210', minDigits: 10, maxDigits: 10 },
];

function useSecurityTheme() {
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';

  return {
    isLight,
    title: isLight ? '#0f172a' : '#ffffff',
    body: isLight ? '#475569' : '#9ca3af',
    muted: isLight ? '#64748b' : '#6b7280',
    panelBg: isLight ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.03)',
    panelBorder: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.07)',
    inputBg: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.05)',
    inputBorder: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.09)',
    softBg: isLight ? 'rgba(15,23,42,0.04)' : 'rgba(255,255,255,0.04)',
    successBg: 'rgba(0,229,186,0.08)',
    successBorder: 'rgba(0,229,186,0.2)',
    successText: 'rgb(0,229,186)',
  };
}

function getSmsCountry(id: string) {
  return SMS_COUNTRIES.find((country) => country.id === id) ?? SMS_COUNTRIES[0];
}

function normalizeSmsPhoneInput(value: string) {
  return value.replace(/\D/g, '');
}

function isValidSmsPhone(country: SmsCountry, value: string) {
  const digits = normalizeSmsPhoneInput(value);
  if (!digits.length) {
    return false;
  }

  return digits.length >= country.minDigits && digits.length <= country.maxDigits;
}

function toInternationalSmsPhone(country: SmsCountry, value: string) {
  const digits = normalizeSmsPhoneInput(value);
  if (!digits.length) {
    return '';
  }

  const nationalDigits = country.trunkPrefix && digits.startsWith(country.trunkPrefix)
    ? digits.slice(country.trunkPrefix.length)
    : digits;

  return `${country.dialCode}${nationalDigits}`;
}

function formatSmsPhone(country: SmsCountry, value: string) {
  const international = toInternationalSmsPhone(country, value);
  if (!international) {
    return '';
  }

  return `${country.dialCode} ${international.slice(country.dialCode.length)}`;
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  const theme = useSecurityTheme();

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6"
      initial={{ opacity: 0, y: 16 }}
      style={{
        background: theme.panelBg,
        border: `1px solid ${theme.panelBorder}`,
        boxShadow: theme.isLight ? '0 16px 40px rgba(15,23,42,0.08)' : 'none',
      }}
    >
      <h2
        className="mb-4 flex items-center gap-2 border-b pb-3 text-sm font-black uppercase tracking-widest"
        style={{ borderBottom: `1px solid ${theme.panelBorder}`, color: theme.title }}
      >
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {title}
      </h2>
      <div className="space-y-4 sm:space-y-5">{children}</div>
    </motion.section>
  );
}

function SecurityInput(
  props: React.InputHTMLAttributes<HTMLInputElement> & { centered?: boolean },
) {
  const theme = useSecurityTheme();
  const { centered, style, ...rest } = props;

  return (
    <input
      {...rest}
      className={`w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${centered ? 'text-center font-mono tracking-[0.35em]' : ''}`.trim()}
      onBlur={(event) => {
        event.currentTarget.style.borderColor = theme.inputBorder;
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = 'rgba(0,229,186,0.45)';
        props.onFocus?.(event);
      }}
      style={{
        background: theme.inputBg,
        border: `1px solid ${theme.inputBorder}`,
        color: theme.title,
        ...style,
      }}
    />
  );
}

function SecuritySelect(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  const theme = useSecurityTheme();
  const { style, ...rest } = props;

  return (
    <select
      {...rest}
      className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-all focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      onBlur={(event) => {
        event.currentTarget.style.borderColor = theme.inputBorder;
        props.onBlur?.(event);
      }}
      onFocus={(event) => {
        event.currentTarget.style.borderColor = 'rgba(0,229,186,0.45)';
        props.onFocus?.(event);
      }}
      style={{
        background: theme.inputBg,
        border: `1px solid ${theme.inputBorder}`,
        color: theme.title,
        ...style,
      }}
    />
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
  type = 'button',
  variant = 'primary',
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'primary' | 'secondary';
}) {
  const theme = useSecurityTheme();
  const active = variant === 'primary';

  return (
    <motion.button
      className="min-h-[44px] rounded-xl px-5 py-3 text-sm font-bold transition-all enabled:hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed"
      disabled={disabled}
      onClick={onClick}
      style={{
        background: active
          ? disabled
            ? 'var(--brand-gradient-disabled)'
            : 'var(--brand-gradient)'
          : theme.softBg,
        color: active
          ? disabled
            ? 'rgba(4,17,16,0.45)'
            : '#041110'
          : theme.body,
        border: `1px solid ${active && !disabled ? 'rgba(0,201,167,0.24)' : theme.panelBorder}`,
        boxShadow: active && !disabled ? 'var(--brand-shadow)' : 'none',
      }}
      type={type}
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
    >
      {children}
    </motion.button>
  );
}

function SuccessBanner({ message }: { message: string }) {
  const theme = useSecurityTheme();

  return (
    <div
      className="flex items-center gap-3 rounded-2xl p-4"
      style={{ background: theme.successBg, border: `1px solid ${theme.successBorder}` }}
    >
      <span className="text-lg" style={{ color: theme.successText }} aria-hidden="true">
        OK
      </span>
      <p className="text-sm font-semibold" style={{ color: theme.title }}>
        {message}
      </p>
    </div>
  );
}

function SecurityStatusSummary() {
  const theme = useSecurityTheme();
  const rows = [
    { label: 'Meeting access', value: 'Active' },
    { label: 'Session', value: 'Protected' },
  ];

  return (
    <div
      className="w-full max-w-sm rounded-2xl px-4 py-4"
      style={{
        background: theme.softBg,
        borderLeft: `4px solid ${theme.successText}`,
      }}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.18em]" style={{ color: theme.muted }}>
        Account status
      </p>
      <div className="mt-2.5 space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-4">
            <span className="text-sm" style={{ color: theme.body }}>{row.label}</span>
            <span className="text-sm font-black" style={{ color: theme.successText }}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusListCard({
  title,
  icon,
  rows,
  footer,
  accent = 'rgb(0,229,186)',
}: {
  title: string;
  icon: string;
  rows: Array<{ label: string; value: string; good?: boolean }>;
  footer?: React.ReactNode;
  accent?: string;
}) {
  const theme = useSecurityTheme();

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6"
      initial={{ opacity: 0, y: 16 }}
      style={{
        background: theme.panelBg,
        border: `1px solid ${theme.panelBorder}`,
        boxShadow: theme.isLight ? '0 16px 40px rgba(15,23,42,0.08)' : 'none',
      }}
    >
      <h2 className="mb-5 flex items-center gap-2 text-sm font-black" style={{ color: theme.title }}>
        <span aria-hidden="true">{icon}</span>
        {title}
      </h2>
      <div className="space-y-1">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-start justify-between gap-4 border-b py-4 text-sm sm:items-center"
            style={{ borderBottom: `1px solid ${theme.panelBorder}` }}
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <span
                className="inline-block h-3 w-3 rounded-full"
                style={{ background: row.good ? accent : 'rgb(59,130,246)', boxShadow: row.good ? `0 0 14px ${accent}` : 'none' }}
              />
              <span style={{ color: theme.title }}>{row.label}</span>
            </div>
            <span className="min-w-[11rem] text-right text-sm leading-6" style={{ color: theme.body }}>{row.value}</span>
          </div>
        ))}
      </div>
      {footer ? <div className="mt-5">{footer}</div> : null}
    </motion.section>
  );
}

function DeviceCard({
  name,
  detail,
  current,
  actionLabel,
  onAction,
}: {
  name: string;
  detail: string;
  current?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useSecurityTheme();

  return (
    <div className="flex items-start justify-between gap-4 border-b py-4 sm:items-center sm:gap-5" style={{ borderBottom: `1px solid ${theme.panelBorder}` }}>
      <div className="flex min-w-0 items-center gap-4">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-xl"
          style={{ background: theme.softBg, border: `1px solid ${theme.panelBorder}` }}
        >
          DV
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold" style={{ color: theme.title }}>{name}</p>
          <p className="mt-1 text-sm leading-6" style={{ color: theme.body }}>{detail}</p>
        </div>
      </div>
      {current ? (
        <span className="rounded-full px-4 py-1.5 text-sm font-bold" style={{ background: 'rgba(0,229,186,0.1)', color: theme.successText, border: '1px solid rgba(0,229,186,0.2)' }}>
          Current
        </span>
      ) : (
        <button className="rounded-xl px-4 py-2.5 text-sm font-bold" onClick={onAction} style={{ background: theme.softBg, border: `1px solid ${theme.panelBorder}`, color: theme.body }} type="button">
          {actionLabel ?? 'Remove'}
        </button>
      )}
    </div>
  );
}

export default function SecurityPage() {
  const { t } = useAppTranslations();
  const theme = useSecurityTheme();
  const [totpStage, setTotpStage] = React.useState<TotpStage>('idle');
  const [totpCode, setTotpCode] = React.useState('');
  const [totpError, setTotpError] = React.useState('');
  const [smsStage, setSmsStage] = React.useState<SmsStage>('idle');
  const [smsCountryId, setSmsCountryId] = React.useState('de');
  const [phoneInput, setPhoneInput] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [smsCode, setSmsCode] = React.useState('');
  const [smsError, setSmsError] = React.useState('');
  const [smsCooldown, setSmsCooldown] = React.useState(0);
  const [backupStage, setBackupStage] = React.useState<BackupStage>('idle');
  const [copiedAll, setCopiedAll] = React.useState(false);
  const [downloaded, setDownloaded] = React.useState(false);
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [confirmPw, setConfirmPw] = React.useState('');
  const [pwLoading, setPwLoading] = React.useState(false);
  const [pwSuccess, setPwSuccess] = React.useState(false);
  const [pwError, setPwError] = React.useState('');
  const [dataExporting, setDataExporting] = React.useState(false);
  const [trustedDevices, setTrustedDevices] = React.useState([
    { id: 'macbook', name: 'MacBook Pro | Chrome', detail: 'Essen, Germany | Active now', current: true },
    { id: 'iphone', name: 'iPhone 15 | Mobile browser', detail: 'Essen, Germany | Last used 1 day ago', current: false },
  ]);
  const [privacyNotice, setPrivacyNotice] = React.useState('');

  const resendLabel = smsCooldown > 0
    ? t('security.resendIn', 'Resend in {seconds}s').replace('{seconds}', String(smsCooldown))
    : t('security.resendCode');
  const smsCountry = getSmsCountry(smsCountryId);

  const canSubmitPasswordChange = Boolean(
    currentPw &&
      newPw &&
      confirmPw &&
      !pwLoading,
  );

  const getPasswordErrorMessage = (message: string) => {
    switch (message) {
      case 'Current password is incorrect.':
        return t('security.currentPasswordIncorrect');
      case 'New password and confirmation must match.':
        return t('security.passwordConfirmMismatch');
      case 'New password must be different from your current password.':
        return t('security.passwordReuse');
      default:
        return message || t('security.passwordUpdateFailed');
    }
  };

  const startSmsCooldown = () => {
    setSmsCooldown(30);
    const timer = window.setInterval(() => {
      setSmsCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  };

  const handleTotpVerify = () => {
    setTotpError('');
    if (totpCode.length !== 6) {
      setTotpError(t('security.enterAuthenticatorCode'));
      return;
    }
    setTotpStage('verifying');
    window.setTimeout(() => setTotpStage('active'), 1200);
  };

  const handleSendSms = () => {
    const normalizedPhone = normalizeSmsPhoneInput(phoneInput);
    if (!normalizedPhone.length) {
      setSmsError(t('security.enterPhone'));
      return;
    }
    if (!isValidSmsPhone(smsCountry, normalizedPhone)) {
      setSmsError(t('security.enterValidPhone', 'Enter a valid phone number.'));
      return;
    }
    const formattedPhone = formatSmsPhone(smsCountry, normalizedPhone);
    setSmsError('');
    setSmsCode('');
    setPhone(formattedPhone);
    setPhoneInput(normalizedPhone);
    setSmsStage('entering');
    startSmsCooldown();
  };

  const handleSmsVerify = () => {
    setSmsError('');
    if (smsCode.length < 4) {
      setSmsError(t('security.enterCodeSent'));
      return;
    }
    setSmsStage('verifying');
    window.setTimeout(() => setSmsStage('active'), 900);
  };

  const handleGenerateBackup = () => {
    setBackupStage('generating');
    setCopiedAll(false);
    setDownloaded(false);
    window.setTimeout(() => setBackupStage('ready'), 1000);
  };

  const handleExport = () => {
    setDataExporting(true);
    window.setTimeout(() => {
      const data = {
        exportDate: new Date().toISOString(),
        request: 'DSAR account export',
        accountProtection: {
          trustedDevices: 2,
          meetingSessionsProtected: true,
          region: 'Frankfurt, Germany',
        },
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zmeetings-account-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setDataExporting(false);
    }, 900);
  };

  const handleDeleteAccountRequest = () => {
    const data = {
      requestedAt: new Date().toISOString(),
      request: 'GDPR Art. 17 account deletion',
      status: 'submitted locally',
      verificationRequired: true,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zmeetings-security-deletion-request.json';
    link.click();
    URL.revokeObjectURL(url);
    setPrivacyNotice('Account deletion request saved for privacy review.');
    window.setTimeout(() => setPrivacyNotice(''), 3000);
  };

  const handleDownloadCodes = () => {
    const content = mockBackupCodes.join('\n');
    const blob = new Blob(
      [
        `ZMEETINGS 2FA Backup Codes\nGenerated: ${new Date().toISOString()}\n\n${content}\n\nEach code can only be used once. Store these securely.`,
      ],
      { type: 'text/plain' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zmeetings-backup-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  const handleCopyAll = () => {
    navigator.clipboard?.writeText(mockBackupCodes.join('\n')).then(() => {
      setCopiedAll(true);
      window.setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const handleChangePw = async (event: React.FormEvent) => {
    event.preventDefault();
    setPwError('');
    setPwSuccess(false);

    if (!currentPw || !newPw || !confirmPw) return;
    if (newPw.length < 8) return setPwError(t('security.passwordTooShort'));
    if (newPw !== confirmPw) return setPwError(t('security.passwordConfirmMismatch'));
    if (currentPw === newPw) return setPwError(t('security.passwordReuse'));

    setPwLoading(true);

    try {
      const response = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: currentPw,
          newPassword: newPw,
          confirmPassword: confirmPw,
        }),
      });

      const result = (await response.json().catch(() => null)) as
 | { error?: string; success?: boolean }
 | null;

      if (!response.ok || !result?.success) {
        setPwError(getPasswordErrorMessage(result?.error ?? t('security.passwordUpdateFailed')));
        return;
      }

      setPwSuccess(true);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      window.setTimeout(() => setPwSuccess(false), 3000);
    } catch {
      setPwError(t('security.passwordUpdateFailed'));
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <AppShell>
      <div
        className="min-h-full"
        style={{
          background: theme.isLight
            ? 'linear-gradient(180deg, #eff5f8 0%, #f7fafc 100%)'
            : 'linear-gradient(180deg, #09111c 0%, #0a0f18 100%)',
        }}
      >
        <div className="mx-auto max-w-[56rem] space-y-8 px-4 pb-20 pt-8 sm:px-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em]" style={{ color: theme.successText }}>
                {t('settings.security')}
              </p>
              <h1 className="text-3xl font-black" style={{ color: theme.title }}>
                {t('security.title')}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: theme.body }}>
                {t('security.subtitle')}
              </p>
            </div>
            <Link
              className="self-start rounded-xl px-4 py-2.5 text-sm font-bold transition-all hover:border-[rgba(0,229,186,0.35)] hover:text-[rgb(0,229,186)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(0,229,186)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:self-end"
              href="/settings"
              style={{
                background: theme.softBg,
                border: `1px solid ${theme.panelBorder}`,
                color: theme.body,
              }}
            >
              Back to settings
            </Link>
          </div>

          <div className="space-y-6">
        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6"
          initial={{ opacity: 0, y: 16 }}
          style={{
            background: theme.panelBg,
            border: `1px solid ${theme.panelBorder}`,
            boxShadow: theme.isLight ? '0 18px 44px rgba(15,23,42,0.08)' : 'none',
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em]" style={{ color: theme.successText }}>
                Security Center
              </p>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: theme.body }}>
                Review your sign-in protection, trusted devices, meeting session access, and privacy rights in one place.
              </p>
            </div>
            <SecurityStatusSummary />
          </div>
        </motion.section>

        <StatusListCard
          footer={
            <p className="text-sm" style={{ color: theme.body }}>
              Use the tools below to update two-factor authentication, backup codes, or your password.
            </p>
          }
          icon=""
          rows={[
            { label: 'Password security', value: 'Strong | Last changed 30 days ago', good: true },
            { label: 'Two-factor authentication', value: 'Enabled (Authenticator app)', good: true },
            { label: 'Active sessions', value: '2 devices', good: true },
            { label: 'Login history', value: 'Essen, DE | 2 hours ago' },
          ]}
          title="Your account protection"
        />

        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6"
          initial={{ opacity: 0, y: 16 }}
          style={{
            background: theme.panelBg,
            border: `1px solid ${theme.panelBorder}`,
            boxShadow: theme.isLight ? '0 16px 40px rgba(15,23,42,0.08)' : 'none',
          }}
        >
          <h2 className="mb-4 flex items-center gap-2 text-sm font-black" style={{ color: theme.title }}>
            Your trusted devices
          </h2>
          {trustedDevices.map((device) => (
            <DeviceCard
              key={device.id}
              actionLabel={t('settings.remove')}
              current={device.current}
              detail={device.detail}
              name={device.name}
              onAction={() => setTrustedDevices((current) => current.filter((item) => item.id !== device.id))}
            />
          ))}
          <div className="mt-5 rounded-2xl px-5 py-4 text-sm leading-7" style={{ background: 'rgba(0,128,255,0.08)', border: '1px solid rgba(0,128,255,0.2)', color: theme.body }}>
            Trusted devices help keep meeting access smooth while letting you remove browsers or devices you no longer use.
          </div>
        </motion.section>

        <motion.section
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[1.75rem] px-5 py-5 sm:px-6 sm:py-6"
          initial={{ opacity: 0, y: 16 }}
          style={{
            background: theme.panelBg,
            border: `1px solid ${theme.panelBorder}`,
            boxShadow: theme.isLight ? '0 16px 40px rgba(15,23,42,0.08)' : 'none',
          }}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-black" style={{ color: theme.title }}>
                Privacy
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6" style={{ color: theme.body }}>
                We do not sell personal data. Security logs are used only to protect accounts, operate the service, and meet legal obligations.
              </p>
            </div>
            <Link
              className="inline-flex justify-center whitespace-nowrap rounded-xl px-5 py-2 text-sm font-bold transition-all sm:min-w-[148px]"
              href="/privacy-policy"
              style={{
                background: theme.softBg,
                border: `1px solid ${theme.panelBorder}`,
                color: theme.body,
              }}
            >
              Privacy policy
            </Link>
          </div>
        </motion.section>

        <StatusListCard
          footer={
            <div className="mt-2 flex flex-wrap gap-4">
              <ActionButton onClick={handleExport} variant="secondary">
                {dataExporting ? t('settings.preparing') : 'Request my data (DSAR)'}
              </ActionButton>
              <button className="rounded-2xl px-5 py-3 text-sm font-bold" onClick={handleDeleteAccountRequest} style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', color: 'rgb(239,68,68)' }} type="button">
                Delete my account
              </button>
              {privacyNotice ? <p className="basis-full text-sm font-semibold" style={{ color: theme.successText }}>{privacyNotice}</p> : null}
            </div>
          }
          icon="⚖️"
          rows={[
            { label: 'Your data is stored in the EU', value: 'Frankfurt, Germany', good: true },
            { label: 'Export your account data', value: 'Available within 30 days', good: true },
            { label: 'Delete your account', value: 'Processed within 72 hours', good: true },
          ]}
          title="Your rights (GDPR / DSGVO)"
        />

        <SectionCard icon="" title={t('security.setupAuthenticator', 'Authenticator App (TOTP)')}>
          <AnimatePresence mode="wait">
            {totpStage === 'idle' ? (
              <motion.div key="totp-idle" animate={{ opacity: 1 }} exit={{ opacity: 0 }} initial={{ opacity: 0 }}>
                <p className="mb-4 text-sm" style={{ color: theme.body }}>
                  {t('security.useAuthenticator')}
                </p>
                <div
                  className="mb-4 flex items-center gap-3 rounded-xl p-3"
                  style={{ background: theme.softBg, border: `1px solid ${theme.panelBorder}` }}
                >
                  <span className="text-xs" style={{ color: theme.muted }}>
                    {t('security.status')}
                  </span>
                  <span className="text-xs font-bold text-red-400">{t('security.notEnabled')}</span>
                </div>
                <ActionButton onClick={() => setTotpStage('scanning')}>
                  {t('security.setupAuthenticator')}
                </ActionButton>
              </motion.div>
            ) : null}

            {totpStage === 'scanning' ? (
              <motion.div key="totp-scan" animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} initial={{ opacity: 0, y: 8 }}>
                <p className="mb-1 text-sm font-semibold" style={{ color: theme.title }}>
                  {t('security.stepOne')}
                </p>
                <p className="mb-4 text-xs" style={{ color: theme.muted }}>
                  {t('security.stepOneDesc')}
                </p>

                <div className="mb-6 flex flex-col gap-6 sm:flex-row">
                  <div className="flex-shrink-0">
                    <div className="mx-auto flex h-36 w-36 items-center justify-center rounded-2xl bg-white p-[10px]">
                      <div
                        className="grid h-full w-full grid-cols-7 gap-px rounded-xl p-1"
                        style={{ background: 'rgba(0,0,0,0.05)' }}
                      >
                        {Array.from({ length: 49 }).map((_, index) => (
                          <div
                            key={index}
                            className="rounded-sm"
                            style={{ background: Math.sin(index * 1.7 + 3) > 0 ? '#0a0f18' : 'transparent' }}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mt-1.5 text-center text-[9px]" style={{ color: theme.muted }}>
                      {t('security.qrPlaceholder')}
                    </p>
                  </div>

                  <div className="flex-1">
                    <p className="mb-2 text-xs font-semibold" style={{ color: theme.body }}>
                      {t('security.manualSecret')}
                    </p>
                    <div
                      className="flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-xs"
                      style={{ background: 'rgba(0,229,186,0.06)', border: '1px solid rgba(0,229,186,0.15)', color: 'rgb(0,229,186)' }}
                    >
                      <span className="flex-1 tracking-widest">{mockSecuritySecret}</span>
                      <button
                        aria-label={t('security.copySecret')}
                        className="flex-shrink-0 transition-colors"
                        onClick={() => navigator.clipboard?.writeText(mockSecuritySecret)}
                        style={{ color: theme.muted }}
                        type="button"
                      >
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 text-[10px]" style={{ color: theme.muted }}>
                      {t('security.algorithmDetails')}
                    </p>
                  </div>
                </div>

                <p className="mb-2 text-sm font-semibold" style={{ color: theme.title }}>
                  {t('security.stepTwo')}
                </p>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start">
                  <SecurityInput
                    aria-label="TOTP verification code"
                    autoComplete="one-time-code"
                    centered
                    inputMode="numeric"
                    maxLength={6}
                    onChange={(event) => setTotpCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                    pattern="[0-9]*"
                    placeholder="000000"
                    type="text"
                    value={totpCode}
                  />
                  <ActionButton disabled={totpCode.length !== 6} onClick={handleTotpVerify}>
                    {t('security.verify')}
                  </ActionButton>
                </div>

                {totpError ? (
                  <p className="text-xs text-red-400" role="alert">
                    {totpError}
                  </p>
                ) : null}

                <button className="mt-1 text-xs transition-colors" onClick={() => setTotpStage('idle')} style={{ color: theme.muted }} type="button">
                  {t('security.cancel')}
                </button>
              </motion.div>
            ) : null}

            {totpStage === 'verifying' ? (
              <motion.div key="totp-verifying" animate={{ opacity: 1 }} className="py-6 text-center" initial={{ opacity: 0 }}>
                <svg className="mx-auto mb-3 h-8 w-8 animate-spin" fill="none" style={{ color: theme.successText }} viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
                </svg>
                <p className="text-sm" style={{ color: theme.body }}>
                  {t('security.verifyingCode')}
                </p>
              </motion.div>
            ) : null}

            {totpStage === 'active' ? (
              <motion.div key="totp-active" animate={{ opacity: 1, scale: 1 }} initial={{ opacity: 0, scale: 0.95 }}>
                <SuccessBanner message={t('security.authenticatorEnabled')} />
                <p className="mt-3 text-xs" style={{ color: theme.body }}>
                  {t('security.authenticatorEnabledDesc')}
                </p>
                <button
                  className="mt-4 text-xs font-semibold text-red-400 transition-colors hover:text-red-300"
                  onClick={() => {
                    setTotpStage('idle');
                    setTotpCode('');
                  }}
                  type="button"
                >
                  {t('security.disableTotp')}
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </SectionCard>

        <SectionCard icon="" title={t('security.smsFallback')}>
          <p className="text-sm" style={{ color: theme.body }}>
            {t('security.smsFallbackDesc')}
          </p>

          {smsStage === 'idle' ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,220px)_1fr]">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em]" htmlFor="sms-country" style={{ color: theme.muted }}>
                    {t('security.phoneCountry', 'Country / region')}
                  </label>
                  <SecuritySelect
                    aria-label={t('security.phoneCountry', 'Country / region')}
                    id="sms-country"
                    onChange={(event) => {
                      setSmsCountryId(event.target.value);
                      if (smsError) {
                        setSmsError('');
                      }
                    }}
                    value={smsCountryId}
                  >
                    {SMS_COUNTRIES.map((country) => (
                      <option key={country.id} value={country.id}>
                        {country.label} ({country.dialCode})
                      </option>
                    ))}
                  </SecuritySelect>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-[0.2em]" htmlFor="sms-phone" style={{ color: theme.muted }}>
                    {t('security.phoneNumber', 'Phone number')}
                  </label>
                  <SecurityInput
                    aria-label={t('security.phoneNumber', 'Phone number')}
                    autoComplete="tel-national"
                    id="sms-phone"
                    inputMode="numeric"
                    maxLength={smsCountry.maxDigits}
                    onChange={(event) => {
                      setPhoneInput(normalizeSmsPhoneInput(event.target.value).slice(0, smsCountry.maxDigits));
                      if (smsError) {
                        setSmsError('');
                      }
                    }}
                    pattern="[0-9]*"
                    placeholder={smsCountry.placeholder}
                    type="tel"
                    value={phoneInput}
                  />
                </div>
              </div>
              <p className="text-xs" style={{ color: theme.muted }}>
                {t('security.phoneHint', 'Choose the country code, then enter the local number without the international prefix.')}
              </p>
              {smsError ? (
                <p className="text-xs text-red-400" role="alert">
                  {smsError}
                </p>
              ) : null}
              <ActionButton onClick={handleSendSms}>{t('security.sendCode')}</ActionButton>
            </div>
          ) : null}

          {smsStage === 'entering' ? (
            <div className="space-y-4">
              <div className="rounded-2xl px-4 py-4" style={{ background: theme.softBg, border: `1px solid ${theme.panelBorder}` }}>
                <p className="text-xs" style={{ color: theme.muted }}>
                  {t('security.codeSentTo')}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: theme.title }}>
                  {phone}
                </p>
              </div>
              <SecurityInput
                aria-label="SMS verification code"
                autoComplete="one-time-code"
                centered
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setSmsCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                type="text"
                value={smsCode}
              />
              <p className="text-xs" style={{ color: theme.muted }}>
                {t('security.enterSmsCode')}
              </p>
              {smsError ? (
                <p className="text-xs text-red-400" role="alert">
                  {smsError}
                </p>
              ) : null}
              <div className="flex flex-wrap gap-4">
                <ActionButton disabled={smsCode.length < 4} onClick={handleSmsVerify}>
                  {t('security.verify')}
                </ActionButton>
                <ActionButton disabled={smsCooldown > 0} onClick={handleSendSms} variant="secondary">
                  {resendLabel}
                </ActionButton>
              </div>
            </div>
          ) : null}

          {smsStage === 'verifying' ? (
            <div className="py-4 text-center">
              <svg className="mx-auto mb-3 h-8 w-8 animate-spin" fill="none" style={{ color: theme.successText }} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
              </svg>
              <p className="text-sm" style={{ color: theme.body }}>
                {t('security.verifyingCode')}
              </p>
            </div>
          ) : null}

          {smsStage === 'active' ? (
            <div className="space-y-4">
              <SuccessBanner message={t('security.smsEnabled')} />
              <div className="rounded-2xl px-4 py-4" style={{ background: theme.softBg, border: `1px solid ${theme.panelBorder}` }}>
                <p className="text-xs" style={{ color: theme.muted }}>
                  {t('security.codeSentTo')}
                </p>
                <p className="mt-1 text-sm font-semibold" style={{ color: theme.title }}>
                  {phone}
                </p>
              </div>
              <button
                className="text-xs font-semibold text-red-400 transition-colors hover:text-red-300"
                onClick={() => {
                  setSmsStage('idle');
                  setPhoneInput('');
                  setPhone('');
                  setSmsCode('');
                  setSmsError('');
                  setSmsCooldown(0);
                }}
                type="button"
              >
                {t('security.removePhone')}
              </button>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard icon="" title={t('security.backupCodes')}>
          <div className="space-y-2">
            <p className="text-sm" style={{ color: theme.body }}>
              {t('security.backupCodesDesc')}
            </p>
            <p className="text-xs leading-6" style={{ color: theme.muted }}>
              {t('security.backupWarning')}
            </p>
          </div>

          {backupStage === 'idle' ? (
            <ActionButton onClick={handleGenerateBackup}>{t('security.generateBackupCodes')}</ActionButton>
          ) : null}

          {backupStage === 'generating' ? (
            <div className="py-4 text-center">
              <svg className="mx-auto mb-3 h-8 w-8 animate-spin" fill="none" style={{ color: theme.successText }} viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" />
              </svg>
              <p className="text-sm" style={{ color: theme.body }}>
                {t('security.generatingCodes')}
              </p>
            </div>
          ) : null}

          {backupStage === 'ready' ? (
            <div className="space-y-4">
              <div className="rounded-2xl px-4 py-4 sm:px-5" style={{ background: theme.softBg, border: `1px solid ${theme.panelBorder}` }}>
                <p className="mb-3 text-sm font-semibold" style={{ color: theme.title }}>
                  {t('security.yourBackupCodes')}
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {mockBackupCodes.map((code) => (
                    <div key={code} className="rounded-xl px-3 py-2 font-mono text-sm" style={{ background: theme.inputBg, border: `1px solid ${theme.inputBorder}`, color: theme.title }}>
                      {code}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <ActionButton onClick={handleDownloadCodes}>{downloaded ? t('security.downloaded') : t('security.downloadTxt')}</ActionButton>
                <ActionButton onClick={handleCopyAll} variant="secondary">{copiedAll ? t('security.copied') : t('security.copyAll')}</ActionButton>
                <ActionButton onClick={handleGenerateBackup} variant="secondary">{t('security.regenerate')}</ActionButton>
              </div>
              <p className="text-xs leading-6" style={{ color: theme.muted }}>
                {t('security.backupStoreDesc')}
              </p>
            </div>
          ) : null}
        </SectionCard>

        <SectionCard icon="" title={t('security.changePassword')}>
          <AnimatePresence>
            {pwSuccess ? (
              <motion.div
                animate={{ opacity: 1, y: 0 }}
                className="mb-2"
                exit={{ opacity: 0 }}
                initial={{ opacity: 0, y: -6 }}
                role="status"
              >
                <SuccessBanner message={t('security.passwordUpdated')} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <form className="space-y-5" onSubmit={handleChangePw}>
            {[
              {
                id: 'cur-pw',
                label: t('security.currentPassword'),
                value: currentPw,
                setter: setCurrentPw,
                complete: 'current-password',
              },
              {
                id: 'new-pw',
                label: t('security.newPassword'),
                value: newPw,
                setter: setNewPw,
                complete: 'new-password',
              },
              {
                id: 'conf-pw',
                label: t('security.confirmPassword'),
                value: confirmPw,
                setter: setConfirmPw,
                complete: 'new-password',
              },
            ].map((field) => (
              <div key={field.id}>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.16em]" htmlFor={field.id} style={{ color: theme.body }}>
                  {field.label}
                </label>
                <SecurityInput
                  autoComplete={field.complete}
                  id={field.id}
                  onChange={(event) => field.setter(event.target.value)}
                  required
                  type="password"
                  value={field.value}
                />
              </div>
            ))}

            {pwError ? (
              <p className="text-xs text-red-400" role="alert">
                {pwError}
              </p>
            ) : null}

            <div className="pt-1">
              <ActionButton disabled={!canSubmitPasswordChange} type="submit">
                {pwLoading ? '...' : t('security.changePassword')}
              </ActionButton>
            </div>
          </form>
        </SectionCard>
      </div>
        </div>
      </div>
    </AppShell>
  );
}
