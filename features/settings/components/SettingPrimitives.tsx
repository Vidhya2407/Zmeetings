import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useHydrated } from '@/hooks/useHydrated';
import { useThemeStore } from '@/lib/stores/themeStore';

function useIsLightTheme() {
  const hydrated = useHydrated(useThemeStore);
  const { theme } = useThemeStore();
  return (hydrated ? theme : 'dark') === 'light';
}

export function SettingSection({ title, children }: { title: string; children: ReactNode }) {
  const isLight = useIsLightTheme();

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[1.75rem] p-6 sm:p-7"
      initial={{ opacity: 0, y: 16 }}
      style={{
        background: isLight ? 'rgba(255,255,255,0.92)' : 'rgba(10,15,24,0.72)',
        border: isLight ? '1px solid rgba(15,23,42,0.08)' : '1px solid rgba(255,255,255,0.09)',
        boxShadow: isLight ? '0 18px 40px rgba(15,23,42,0.08)' : '0 18px 40px rgba(0,0,0,0.22)',
      }}
    >
      <h2
        className="mb-5 border-b pb-3 text-sm font-black uppercase tracking-[0.16em]"
        style={{
          color: isLight ? '#0f172a' : '#ffffff',
          borderBottomColor: isLight ? 'rgba(15,23,42,0.08)' : 'rgba(255,255,255,0.08)',
        }}
      >
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </motion.section>
  );
}

export function ToggleSetting({ label, desc, checked, onChange }: { label: string; desc?: string; checked: boolean; onChange: (value: boolean) => void }) {
  const isLight = useIsLightTheme();

  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-base font-semibold" style={{ color: isLight ? '#0f172a' : '#f8fafc' }}>{label}</p>
        {desc ? <p className="mt-1 max-w-[52ch] text-base leading-7" style={{ color: isLight ? '#475569' : '#cbd5e1' }}>{desc}</p> : null}
      </div>
      <button
        aria-checked={checked}
        aria-label={label}
        className="relative h-6 w-11 flex-shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green-400 focus-visible:ring-offset-2"
        onClick={() => onChange(!checked)}
        role="switch"
        style={{ background: checked ? 'rgb(0,229,186)' : isLight ? 'rgba(148,163,184,0.45)' : 'rgba(255,255,255,0.18)' }}
      >
        <motion.span animate={{ x: checked ? 20 : 0 }} className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow" transition={{ type: 'spring', damping: 22, stiffness: 400 }} />
      </button>
    </div>
  );
}
