'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { NextIntlClientProvider } from 'next-intl';

import en from '@/messages/en.json';
import zh from '@/messages/zh.json';
import ja from '@/messages/ja.json';

export type Locale = 'en' | 'zh' | 'ja';

const messages = { en, zh, ja };

const STORAGE_KEY = 'anydrop-locale';
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'en';
  const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
  if (saved && saved in messages) return saved;
  const lang = navigator.language.slice(0, 2);
  if (lang === 'zh') return 'zh';
  if (lang === 'ja') return 'ja';
  return 'en';
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: 'ja',
  setLocale: () => {},
});

export function useLocale() {
  return useContext(LocaleContext);
}

export function IntlProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('ja');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(detectLocale());
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages[locale]} timeZone={LOCAL_TIMEZONE}>
        {children}
      </NextIntlClientProvider>
    </LocaleContext.Provider>
  );
}
