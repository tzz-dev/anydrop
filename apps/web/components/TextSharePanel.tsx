"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

export interface ReceivedTextView {
  textId: string;
  senderName: string;
  text: string;
}

export default function TextSharePanel({
  disabled,
  onSend,
  receivedTexts,
}: {
  disabled: boolean;
  onSend: (text: string) => void;
  receivedTexts: ReceivedTextView[];
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSend(text);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          disabled={disabled}
          placeholder={disabled ? t.textPlaceholderDisabled : t.textPlaceholder}
          className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:border-white/10"
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
          }}
        />
        <button
          disabled={disabled || !draft.trim()}
          onClick={submit}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.textSend}
        </button>
      </div>

      {receivedTexts.length > 0 && (
        <div className="flex flex-col gap-2">
          {receivedTexts.map((item) => (
            <div
              key={item.textId}
              className="flex items-start justify-between gap-3 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10"
            >
              <div>
                <p className="text-xs text-black/50 dark:text-white/50">{t.textFrom(item.senderName)}</p>
                <p className="whitespace-pre-wrap break-words">{item.text}</p>
              </div>
              <button
                onClick={() => navigator.clipboard.writeText(item.text)}
                className="shrink-0 text-xs text-blue-600 hover:underline"
              >
                {t.textCopy}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
