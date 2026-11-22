"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { MessageTooLargeError } from "@/lib/webrtc/controlMessage";

export default function TextSharePanel({
  disabled,
  onSend,
}: {
  disabled: boolean;
  onSend: (text: string) => Promise<void>;
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
    <div className="flex flex-col gap-2">
      <div className="flex items-end gap-2">
        <textarea
          value={draft}
          rows={2}
          onChange={(event) => {
            setDraft(event.target.value);
            setFailed(null);
          }}
          disabled={disabled}
          placeholder={disabled ? t.textPlaceholderDisabled : t.textPlaceholder}
          className="min-h-12 flex-1 resize-y rounded-lg border border-black/10 bg-transparent px-3 py-2 text-sm outline-none focus:border-blue-500 disabled:opacity-50 dark:border-white/10"
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter inserts a newline; ignore Enter that confirms IME input.
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              void submit();
            }
          }}
        />
        <button
          disabled={disabled || sending || !draft.trim()}
          onClick={() => void submit()}
          className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white disabled:opacity-40"
        >
          {t.textSend}
        </button>
      </div>

      {failed && (
        <p role="alert" className="text-xs text-red-500">
          {failed === "too-long" ? t.textTooLong : t.textSendFailed}
        </p>
      )}
    </div>
  );
}
