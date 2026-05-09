'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale, type Locale } from '@/components/IntlProvider';
import { useMode } from '@/lib/mode';

const LOCALES: { value: Locale; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'EN' },
];

function AnyDropLogo() {
  return (
    <svg
      width="32"
      height="32"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="8" className="fill-foreground" />
      <path
        d="M11 22V10M11 10l-3 3.5M11 10l3 3.5"
        className="stroke-background"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M21 10V22M21 22l-3-3.5M21 22l3-3.5"
        className="stroke-background"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const noop = () => () => {};

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);

  return (
    <button
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="text-muted-foreground hover:text-foreground transition-colors p-1"
      aria-label="Toggle theme"
    >
      {mounted && resolvedTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

export function Header() {
  const t = useTranslations();
  const { locale, setLocale } = useLocale();
  const { mode, setMode } = useMode();

  const modeNav = (
    <nav className="flex items-center gap-1">
      {(['lan', 'private'] as const).map((m) => (
        <button
          key={m}
          onClick={() => setMode(m)}
          className={`text-sm px-3 py-1 rounded-md transition-colors ${
            mode === m
              ? 'bg-muted text-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t(m === 'lan' ? 'localNetwork' : 'privateRoom')}
        </button>
      ))}
    </nav>
  );

  return (
    <header className="w-full border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* main row: logo + desktop mode switcher + locale selector */}
        <div className="h-14 flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <Link href="/" className="flex items-center gap-2 shrink-0">
              <AnyDropLogo />
              <span className="font-bold text-lg tracking-tight">AnyDrop</span>
            </Link>
            {/* desktop: mode switcher inline in main row */}
            <div className="hidden sm:block">{modeNav}</div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {LOCALES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => setLocale(value)}
                className={`text-sm px-2 py-1 rounded transition-colors ${
                  locale === value
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {label}
              </button>
            ))}
            <ThemeToggle />
          </div>
        </div>

        {/* mobile: mode switcher on its own second row */}
        <div className="sm:hidden pb-2">{modeNav}</div>
      </div>
    </header>
  );
}
