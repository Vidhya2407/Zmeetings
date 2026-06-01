'use client';
import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { signOut } from 'next-auth/react';
import { interfaceLanguages, themeOptions } from '../../features/settings/config';
import { SettingSection, ToggleSetting } from '../../features/settings/components/SettingPrimitives';
import { useAppTranslations } from '../../lib/utils/translations';
import { useLanguageStore } from '../../lib/stores/languageStore';
import { useSettingsStore } from '../../lib/stores/settingsStore';
import { useThemeStore } from '../../lib/stores/themeStore';
import { useHydrated } from '@/hooks/useHydrated';
import AppShell from '../../components/layout/AppShell';

export default function SettingsPage() {
  const { t } = useAppTranslations();
  const hydrated = useHydrated(useThemeStore);
  const { language, setLanguage } = useLanguageStore();
  const { theme, set: setTheme } = useThemeStore();
  const isLight = (hydrated ? theme : 'dark') === 'light';
  const {
    pushNotifications,
    carbonMilestoneAlerts,
    setPushNotifications,
    setCarbonMilestoneAlerts,
    reset,
  } = useSettingsStore();

  const [dataExporting, setDataExporting] = React.useState(false);
  const [deletionRequested, setDeletionRequested] = React.useState(false);
  const [isLoggingOut, setIsLoggingOut] = React.useState(false);

  const handleExport = () => {
    setDataExporting(true);
    setTimeout(() => {
      const data = {
        exportDate: new Date().toISOString(),
        request: 'GDPR Art. 20 data portability export',
        settings: {
          pushNotifications,
          meetingImpactAlerts: carbonMilestoneAlerts,
          theme,
          language,
        },
        note: 'Full data export would be emailed within 72 hours according to the privacy workflow.',
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'zmeetings-settings-export.json';
      link.click();
      URL.revokeObjectURL(url);
      setDataExporting(false);
    }, 1200);
  };

  const handleDeletionRequest = () => {
    const data = {
      requestedAt: new Date().toISOString(),
      request: 'GDPR Art. 17 account deletion',
      status: 'submitted locally',
      nextStep: 'Privacy operations would verify identity before deleting account data.',
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'zmeetings-account-deletion-request.json';
    link.click();
    URL.revokeObjectURL(url);
    setDeletionRequested(true);
    window.setTimeout(() => setDeletionRequested(false), 3000);
  };

  const handleResetPreferences = () => {
    reset();
    setTheme('dark');
    setLanguage('en');
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut({ callbackUrl: '/login' });
    } catch {
      setIsLoggingOut(false);
    }
  };

  const pageBg = isLight ? 'linear-gradient(180deg, #eff5f8 0%, #f7fafc 100%)' : 'linear-gradient(180deg, #09111c 0%, #0a0f18 100%)';
  const heading = isLight ? '#0f172a' : '#ffffff';
  const body = isLight ? '#334155' : '#d1d5db';
  const muted = isLight ? '#475569' : '#94a3b8';
  const panelBorder = isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)';
  const inactiveButtonBg = isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.06)';
  const inactiveButtonColor = isLight ? '#334155' : '#d1d5db';

  return (
    <AppShell>
      <div className="min-h-full" style={{ background: pageBg }}>
        <div className="mx-auto max-w-[56rem] space-y-5 px-4 pb-20 pt-8 sm:space-y-6 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.16em]" style={{ color: 'rgb(0,229,186)' }}>{t('settings.eyebrow', 'Experience controls')}</p>
            <h1 className="text-3xl font-black" style={{ color: heading }}>{t('settings.title', 'Settings')}</h1>
            <p className="mt-2.5 max-w-2xl text-base leading-7" style={{ color: body }}>
              {t('settings.subtitle', 'These controls change app behavior now: notifications, appearance, language, security access, and privacy exports.')}
            </p>
          </div>
          <button
            className="self-start whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-bold transition-all sm:self-end"
            onClick={handleResetPreferences}
            style={{ background: inactiveButtonBg, color: inactiveButtonColor, border: `1px solid ${panelBorder}` }}
          >
            {t('settings.resetPreferences', 'Reset preferences')}
          </button>
        </div>

        <SettingSection title={t('settings.appearanceLanguage', 'Appearance & Language')}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-base font-semibold" style={{ color: heading }}>{t('settings.theme', 'Theme')}</p>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {themeOptions.map((option) => (
                  <button
                    className="rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                    key={option.value}
                    onClick={() => setTheme(option.value)}
                    style={{
                      background: theme === option.value ? 'rgba(0,229,186,0.15)' : inactiveButtonBg,
                      color: theme === option.value ? 'rgb(0,229,186)' : inactiveButtonColor,
                      border: `1px solid ${theme === option.value ? 'rgba(0,229,186,0.3)' : panelBorder}`,
                    }}
                  >
                    {t(`settings.themeOptions.${option.value}`, option.label)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-base font-semibold" style={{ color: heading }}>{t('settings.interfaceLanguage', 'Interface language')}</p>
              <div className="grid grid-cols-2 gap-2 sm:max-w-sm">
                {interfaceLanguages.map((option) => (
                  <button
                    className="rounded-xl px-3 py-2.5 text-sm font-medium transition-all"
                    key={option.value}
                    onClick={() => setLanguage(option.value)}
                    style={{
                      background: language === option.value ? 'rgba(0,229,186,0.15)' : inactiveButtonBg,
                      color: language === option.value ? 'rgb(0,229,186)' : inactiveButtonColor,
                      border: `1px solid ${language === option.value ? 'rgba(0,229,186,0.3)' : panelBorder}`,
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SettingSection>

        <SettingSection title={t('settings.notifications', 'Notifications')}>
          <ToggleSetting checked={pushNotifications} desc={t('settings.pushNotificationsDesc', 'Controls the notification bell for activity, chat, meeting invites, and room updates.')} label={t('settings.pushNotifications', 'Push notifications')} onChange={setPushNotifications} />
          <ToggleSetting checked={carbonMilestoneAlerts} desc={t('settings.meetingImpactAlertsDesc', 'Controls recording-ready and post-meeting impact notifications.')} label={t('settings.meetingImpactAlerts', 'Meeting impact alerts')} onChange={setCarbonMilestoneAlerts} />
        </SettingSection>

        <SettingSection title={t('settings.accountProtection', 'Account protection')}>
          <div className="rounded-2xl px-4 py-3 sm:p-4" style={{ background: isLight ? 'rgba(0,229,186,0.08)' : 'rgba(0,229,186,0.05)', border: '1px solid rgba(0,229,186,0.12)' }}>
            <p className="text-base font-semibold leading-6" style={{ color: heading }}>{t('settings.accountProtectionDesc', 'Security, meeting session access, and privacy rights live in one place.')}</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {[
                t('settings.securityCenter', 'Security center'),
                t('settings.protectedMeetings', 'Protected meetings'),
                t('settings.euDataStorage', 'EU data storage'),
              ].map((item) => (
                <span key={item} className="rounded-full px-2.5 py-1 text-sm font-bold" style={{ background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.06)', border: `1px solid ${panelBorder}`, color: muted }}>
                  {item}
                </span>
              ))}
            </div>
            <div className="mt-3">
              <div className="flex flex-wrap gap-2">
                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                  <Link className="inline-flex rounded-xl px-4 py-2.5 text-sm font-bold" href="/settings/security" style={{ background: 'rgba(0,229,186,0.12)', color: 'rgb(0,229,186)', border: '1px solid rgba(0,229,186,0.25)' }}>
                    {t('settings.openSecurityCenter', 'Open security center')}
                  </Link>
                </motion.div>
                <motion.button
                  className="rounded-xl px-4 py-2.5 text-sm font-bold"
                  disabled={isLoggingOut}
                  onClick={() => void handleLogout()}
                  style={{ background: 'rgba(239,68,68,0.1)', color: 'rgb(239,68,68)', border: '1px solid rgba(239,68,68,0.25)', opacity: isLoggingOut ? 0.7 : 1 }}
                  whileHover={isLoggingOut ? {} : { scale: 1.01 }}
                  whileTap={isLoggingOut ? {} : { scale: 0.98 }}
                >
                  {isLoggingOut ? t('workspace.profile.loggingOut', 'Logging out...') : t('workspace.profile.logout', 'Log out')}
                </motion.button>
              </div>
            </div>
          </div>
        </SettingSection>

        <SettingSection title={t('settings.privacyTitle', 'Privacy')}>
          <div className="space-y-4">
            <p className="text-base leading-7" style={{ color: body }}>{t('settings.privacyDesc', 'Privacy actions download your visible app preferences and request metadata.')}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { href: '/privacy-policy', label: t('settings.privacyPolicy', 'Privacy Policy') },
                { href: '/terms-of-service', label: t('settings.termsOfService', 'Terms of Service') },
                { href: '/cookie-policy', label: t('settings.cookiePolicy', 'Cookie Policy') },
              ].map((item) => (
                <Link
                  className="rounded-xl px-4 py-2.5 text-center text-sm font-bold transition-all"
                  href={item.href}
                  key={item.href}
                  style={{
                    background: inactiveButtonBg,
                    border: `1px solid ${panelBorder}`,
                    color: heading,
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <motion.button className="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all" disabled={dataExporting} onClick={handleExport} style={{ background: 'rgba(0,229,186,0.12)', color: dataExporting ? 'rgba(0,229,186,0.4)' : 'rgb(0,229,186)', border: '1px solid rgba(0,229,186,0.25)' }} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                {dataExporting ? <><svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" fill="currentColor" /></svg>{t('settings.preparing', 'Preparing export...')}</> : <><svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeLinecap="round" strokeLinejoin="round" /></svg>{t('settings.exportData', 'Export my data')}</>}
              </motion.button>
              <button className="rounded-xl px-4 py-2.5 text-sm font-bold transition-all" onClick={handleDeletionRequest} style={{ background: 'rgba(239,68,68,0.08)', color: 'rgb(239,68,68)', border: '1px solid rgba(239,68,68,0.2)' }} type="button">
                {deletionRequested ? t('settings.requested', 'Request saved') : t('settings.requestDeletion', 'Request account deletion')}
              </button>
            </div>
            <p className="text-sm leading-6 sm:text-base" style={{ color: muted }}>{t('settings.deletionNote', 'Account deletion currently downloads a request file for your records; it does not delete the account automatically.')}</p>
          </div>
        </SettingSection>
      </div>
      </div>
    </AppShell>
  );
}
