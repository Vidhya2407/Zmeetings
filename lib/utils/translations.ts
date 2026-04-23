import { useHydrated } from '@/hooks/useHydrated';
import { useLanguageStore } from '../stores/languageStore';
import enCommon from '../../locales/en/common.json';
import deCommon from '../../locales/de/common.json';

export type Language = 'en' | 'de';

type MaybeWrappedMessages = { common?: Record<string, unknown> } & Record<string, unknown>;
type TranslationMessages = typeof enCommon.common;
type TranslationBranch = Record<string, unknown>;
type TranslationValue = string | number | boolean | TranslationBranch | undefined;

const extractMessages = (value: MaybeWrappedMessages): TranslationMessages => {
  if (value && typeof value === 'object' && value.common && typeof value.common === 'object') {
    return value.common as TranslationMessages;
  }
  return value as TranslationMessages;
};

const EN_MESSAGES = extractMessages(enCommon as MaybeWrappedMessages);
const DE_MESSAGES = extractMessages(deCommon as MaybeWrappedMessages);

export const translations: Record<Language, TranslationMessages> = {
  en: EN_MESSAGES,
  de: DE_MESSAGES,
};

export const getTranslations = (language: Language) => {
  return translations[language];
};

export const useInstantTranslations = () => {
  const { language } = useLanguageStore();
  const resolvedLanguage: Language = language;
  return resolvedLanguage === 'de' ? DE_MESSAGES : EN_MESSAGES;
};

export const useTranslations = (language: Language) => {
  return getTranslations(language);
};

const getTranslationValue = (messages: TranslationMessages, key: string): TranslationValue => {
  return key.split('.').reduce<TranslationValue>((current, part) => {
    if (!current || typeof current !== 'object' || Array.isArray(current) || !(part in current)) {
      return undefined;
    }

    return (current as TranslationBranch)[part] as TranslationValue;
  }, messages);
};

export const useAppTranslations = () => {
  const { language } = useLanguageStore();
  const hydrated = useHydrated(useLanguageStore);
  const resolvedLanguage: Language = language;
  const messages = resolvedLanguage === 'de' ? DE_MESSAGES : EN_MESSAGES;
  const isGerman = resolvedLanguage === 'de';

  const t = (key: string, fallback?: string) => {
    const value = getTranslationValue(messages, key);
    if (typeof value === 'string') {
      return value;
    }

    const englishFallback = getTranslationValue(EN_MESSAGES, key);
    if (typeof englishFallback === 'string') {
      return englishFallback;
    }

    return fallback ?? key;
  };

  return { language: resolvedLanguage, isGerman, messages, t, hydrated };
};
