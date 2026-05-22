'use client';

import { useTranslations } from 'next-intl';

export default function AboutPage() {
  const t = useTranslations();

  const sections = [
    { title: t('about.whatTitle'), body: t('about.whatBody') },
    { title: t('about.howTitle'), body: t('about.howBody') },
    { title: t('about.privacyTitle'), body: t('about.privacyBody') },
  ];

  return (
    <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="text-2xl font-bold mb-1">AnyDrop</h1>
      <p className="text-muted-foreground mb-8">{t('about.tagline')}</p>

      <div className="space-y-8">
        {sections.map((s) => (
          <section key={s.title}>
            <h2 className="text-base font-semibold mb-2">{s.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
          </section>
        ))}
      </div>
    </main>
  );
}
