"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { MessageTooLargeError } from "@/lib/webrtc/controlMessage";

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
  onSend: (text: string) => Promise<void>;
  receivedTexts: ReceivedTextView[];
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState<"error" | "too-long" | null>(null);
  const [sending, setSending] = useState(false);

  const submit = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setFailed(null);
    try {
      await onSend(text);
      // Only clear the draft once the message actually went out.
      setDraft("");
    } catch (error) {
      setFailed(error instanceof MessageTooLargeError ? "too-long" : "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setFailed(null);
          }}
          disabled={disabled}
          placeholder={disabled ? t.textPlaceholderDisabled : t.textPlaceholder}
          className="flex-1 rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:border-white/10"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) void submit();
          }}
        />
        <button
          disabled={disabled || sending || !draft.trim()}
          onClick={() => void submit()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.textSend}
        </button>
      </div>

      {failed && (
        <p role="alert" className="text-xs text-red-500">
          {failed === "too-long" ? t.textTooLong : t.textSendFailed}
        </p>
      )}

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
                onClick={() => void navigator.clipboard?.writeText(item.text).catch(() => {})}
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
