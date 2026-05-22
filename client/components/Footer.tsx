'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations();
  return (
    <footer className="w-full border-t mt-auto">
      <div className="max-w-2xl mx-auto px-6 h-12 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('footer')}</p>
        <Link href="/about" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          {t('aboutLink')}
        </Link>
      </div>
    </footer>
  );
}
