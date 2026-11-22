"use client";

import { LOCALES, LOCALE_LABELS } from "@/lib/i18n/translations";
import { useI18n } from "@/lib/i18n/context";

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div role="group" aria-label="Language" className="flex items-center gap-0.5 rounded-md border border-black/10 p-0.5 dark:border-white/10">
      {LOCALES.map((code) => (
        <button
          key={code}
          onClick={() => setLocale(code)}
          aria-pressed={locale === code}
          className={`min-h-8 rounded px-2.5 text-xs font-medium transition ${
            locale === code
              ? "bg-foreground text-background"
              : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
          }`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  );
}
