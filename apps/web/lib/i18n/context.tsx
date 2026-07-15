"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { dictionaries, LOCALES, type Dictionary, type Locale } from "./translations";

const STORAGE_KEY = "anydrop:locale";

// Preference order when the browser language isn't a clean match: ja, then
// zh, then en as the final catch-all.
function detectLocale(): Locale {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("ja")) return "ja";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

function readStoredLocale(): Locale {
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null;
  return stored && LOCALES.includes(stored) ? stored : detectLocale();
}

// Module-level store (mirrors the getIdentity() pattern in lib/identity.ts):
// useSyncExternalStore lets the server render a safe default and swap in the
// real, storage-backed value on the client without a setState-in-effect.
let cachedLocale: Locale | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Locale {
  if (cachedLocale === null) cachedLocale = readStoredLocale();
  return cachedLocale;
}

function getServerSnapshot(): Locale {
  return "ja";
}

function commitLocale(next: Locale) {
  cachedLocale = next;
  localStorage.setItem(STORAGE_KEY, next);
  for (const listener of listeners) listener();
}

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ locale, setLocale: commitLocale, t: dictionaries[locale] }), [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
