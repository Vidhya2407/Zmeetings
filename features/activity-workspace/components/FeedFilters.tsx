'use client';

import type { ActivityFilter } from '@/lib/stores/activityStore';
import { useAppTranslations } from '@/lib/utils/translations';

export default function FeedFilters({
  isLight,
  value,
  onChange,
}: {
  isLight: boolean;
  value: ActivityFilter;
  onChange: (next: ActivityFilter) => void;
}) {
  const { t } = useAppTranslations();

  return (
    <div className="flex items-center gap-1 rounded-xl border p-1" style={{ borderColor: isLight ? 'rgba(15,23,42,0.12)' : 'rgba(255,255,255,0.1)' }}>
      {(['all', 'unread', 'mentions'] as const).map((filter) => (
        <button
          key={filter}
          className="rounded-lg px-3 py-1.5 text-sm font-black uppercase tracking-[0.12em]"
          onClick={() => onChange(filter)}
          style={{
            background: value === filter ? 'rgba(0,229,186,0.16)' : 'transparent',
            color: value === filter ? 'rgb(0,229,186)' : (isLight ? '#64748b' : '#94a3b8'),
          }}
          type="button"
        >
          {t(`workspace.activity.filters.${filter}`, filter)}
        </button>
      ))}
    </div>
  );
}
