import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import enTranslations from '../../locales/en/common.json';
import deTranslations from '../../locales/de/common.json';

type Language = 'en' | 'de';

const extractMessages = (value: Record<string, unknown>) => {
  const maybeCommon = value.common as Record<string, unknown> | undefined;
  return maybeCommon && typeof maybeCommon === 'object' ? maybeCommon : value;
};

const TRANSLATION_CACHE = {
  en: extractMessages(enTranslations as Record<string, unknown>),
  de: extractMessages(deTranslations as Record<string, unknown>),
} as const;

interface LanguageStore {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggle: () => void;
  getCurrentTranslations: () => typeof TRANSLATION_CACHE['en'];
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set, get) => ({
      language: 'en',
      setLanguage: (lang: Language) => set({ language: lang }),
      toggle: () =>
        set((state) => ({
          language: state.language === 'en' ? 'de' : 'en',
        })),
      getCurrentTranslations: () => TRANSLATION_CACHE[get().language],
    }),
    {
      name: 'language-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

