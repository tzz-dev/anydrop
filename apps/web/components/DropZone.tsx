"use client";

import { useRef } from "react";
import { useI18n } from "@/lib/i18n/context";

// Dropping and pasting are handled for the whole page (see page.tsx); this
// zone shows the state and offers click / keyboard selection.
export default function DropZone({
  disabled,
  dragging,
  onFiles,
}: {
  disabled: boolean;
  dragging: boolean;
  onFiles: (files: File[]) => void;
}) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(event) => {
        if (disabled || event.target !== event.currentTarget) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      className={`flex cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-10 text-center transition ${
        disabled
          ? "cursor-not-allowed border-black/10 text-black/30 dark:border-white/10 dark:text-white/30"
          : dragging
            ? "border-blue-500 bg-blue-500/10"
            : "border-black/20 hover:border-black/30 dark:border-white/20 dark:hover:border-white/30"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        disabled={disabled}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          if (files.length > 0) onFiles(files);
          event.target.value = "";
        }}
      />
      <p className="text-sm font-medium">
        {disabled ? t.dropDisabled : t.dropIdle}
      </p>
    </div>
  );
}
