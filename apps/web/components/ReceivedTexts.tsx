"use client";

import { useEffect, useRef, useState } from "react";
import { linkify } from "@/lib/linkify";
import { useI18n } from "@/lib/i18n/context";

export interface ReceivedTextView {
  textId: string;
  senderName: string;
  text: string;
}

export default function ReceivedTexts({
  texts,
  onDelete,
}: {
  texts: ReceivedTextView[];
  onDelete: (textId: string) => void;
}) {
  const { t } = useI18n();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async (item: ReceivedTextView) => {
    try {
      await navigator.clipboard.writeText(item.text);
    } catch {
      return;
    }
    setCopiedId(item.textId);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopiedId(null), 1500);
  };

  if (texts.length === 0) return null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionReceivedTexts}</h2>
      {/* A live region so screen readers announce newly received text. */}
      <div role="log" aria-live="polite" className="flex flex-col gap-2">
        {[...texts].reverse().map((item) => (
          <div
            key={item.textId}
            className="flex items-start justify-between gap-3 rounded-xl border border-black/10 p-3 text-sm dark:border-white/10"
          >
            <div className="min-w-0">
              <p className="text-xs text-black/50 dark:text-white/50">{t.textFrom(item.senderName)}</p>
              <p className="whitespace-pre-wrap break-words">
                {linkify(item.text).map((part, index) =>
                  part.type === "link" ? (
                    <a
                      key={index}
                      href={part.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline dark:text-blue-400"
                    >
                      {part.value}
                    </a>
                  ) : (
                    <span key={index}>{part.value}</span>
                  ),
                )}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end">
              <button
                onClick={() => void copy(item)}
                className="min-h-9 px-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {copiedId === item.textId ? t.textCopied : t.textCopy}
              </button>
              <button
                onClick={() => onDelete(item.textId)}
                className="min-h-9 px-2 text-sm text-black/50 hover:underline dark:text-white/50"
              >
                {t.textDelete}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
