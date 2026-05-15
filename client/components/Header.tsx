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
            <a
              href="https://github.com/tzz-zhao/anydrop"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub"
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <ThemeToggle />
          </div>
        </div>

        {/* mobile: mode switcher on its own second row */}
        <div className="sm:hidden pb-2">{modeNav}</div>
      </div>
    </header>
  );
}
