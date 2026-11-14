/**
 * H28 app-wide localisation: English, Bahasa Melayu and Tamil.
 *
 * - DICTIONARIES hold the strings; English is the source and the fallback.
 * - I18nProvider keeps the chosen locale and remembers it on the device.
 * - useI18n() works without a provider (English), so existing screens and
 *   tests keep working while screens move to translation keys.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { en, TranslationKey, Dictionary } from './locales/en';
import { ms } from './locales/ms';
import { ta } from './locales/ta';
import { getStoredLocale, setStoredLocale } from '../services/storage';

export type Locale = 'en' | 'ms' | 'ta';
export type { TranslationKey };

export const LOCALES: Locale[] = ['en', 'ms', 'ta'];
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', ms: 'Bahasa Melayu', ta: 'தமிழ்' };
export const DICTIONARIES: Record<Locale, Dictionary> = { en, ms, ta };

export const isLocale = (value: unknown): value is Locale => LOCALES.includes(value as Locale);

/** Looks up a key, falling back to English and then to the key itself; fills {placeholders}. */
export function translate(locale: Locale, key: TranslationKey | string, params?: Record<string, string | number>): string {
  const dict = DICTIONARIES[locale] as Record<string, string>;
  const template = dict[key] ?? (en as Record<string, string>)[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => (params[name] !== undefined ? String(params[name]) : match));
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey | string, params?: Record<string, string | number>) => string;
}

const defaultValue: I18nValue = {
  locale: 'en',
  setLocale: () => undefined,
  t: (key, params) => translate('en', key, params),
};

const I18nContext = createContext<I18nValue>(defaultValue);

export interface I18nProviderProps {
  /** Starting locale. When omitted, the locale saved on the device is used (default English). */
  initialLocale?: Locale;
  children?: React.ReactNode;
}

export const I18nProvider: React.FC<I18nProviderProps> = ({ initialLocale, children }) => {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || 'en');

  useEffect(() => {
    if (initialLocale) return;
    let active = true;
    getStoredLocale().then(stored => {
      if (active && isLocale(stored)) setLocaleState(stored);
    });
    return () => {
      active = false;
    };
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setStoredLocale(next).catch(() => undefined);
  }, []);

  const value = useMemo<I18nValue>(() => ({
    locale,
    setLocale,
    t: (key, params) => translate(locale, key, params),
  }), [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
