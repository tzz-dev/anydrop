"use client";

import { useI18n } from "@/lib/i18n/context";

export default function Faq() {
  const { t } = useI18n();
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.faqTitle}</h2>
      <div className="divide-y divide-black/10 rounded-2xl border border-black/10 dark:divide-white/10 dark:border-white/10">
        {t.faq.map((item) => (
          <details key={item.q} className="group px-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 py-2 text-sm font-medium [&::-webkit-details-marker]:hidden">
              {item.q}
              <span aria-hidden className="shrink-0 text-black/40 transition group-open:rotate-45 dark:text-white/40">
                +
              </span>
            </summary>
            <p className="pb-3 text-sm leading-relaxed text-black/70 dark:text-white/70">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
