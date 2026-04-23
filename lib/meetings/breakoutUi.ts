import type { BreakoutAnnouncementType } from '@/types/domain/breakout';

const ANNOUNCEMENT_LABELS: Record<'en' | 'de', Record<BreakoutAnnouncementType, string>> = {
  en: {
    'breakout.starting': 'Split Starting',
    'breakout.started': 'Split Live',
    'breakout.merging': 'Merge In Progress',
    'breakout.closed': 'Breakout Closed',
  },
  de: {
    'breakout.starting': 'Aufteilung startet',
    'breakout.started': 'Breakouts aktiv',
    'breakout.merging': 'Zusammenfuehrung laeuft',
    'breakout.closed': 'Breakout beendet',
  },
};

export function formatBreakoutAnnouncementType(type?: string | null, language: 'en' | 'de' = 'en') {
  if (!type) {
    return language === 'de' ? 'Breakout-Update' : 'Breakout Update';
  }

  return ANNOUNCEMENT_LABELS[language][type as BreakoutAnnouncementType] ?? type;
}
