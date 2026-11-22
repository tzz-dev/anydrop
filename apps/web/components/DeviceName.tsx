"use client";

import { useState } from "react";
import { MAX_DISPLAY_NAME_LENGTH } from "@/lib/identity";
import { useI18n } from "@/lib/i18n/context";

export default function DeviceName({
  name,
  onRename,
}: {
  name: string | null;
  onRename: (name: string) => void;
}) {
  const { t } = useI18n();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  if (!name) return <span>{t.connecting}</span>;

  if (editing) {
    const save = () => {
      if (draft.trim()) onRename(draft);
      setEditing(false);
    };
    return (
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <input
          autoFocus
          value={draft}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          aria-label={t.renameDevice}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") setEditing(false);
          }}
          className="w-44 rounded-md border border-black/10 bg-transparent px-2 py-1 text-sm outline-none focus:border-blue-500 dark:border-white/10"
        />
        <button type="submit" className="min-h-9 rounded-md px-2 text-sm text-blue-600 hover:underline dark:text-blue-400">
          {t.renameSave}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="min-h-9 rounded-md px-2 text-sm text-black/60 hover:underline dark:text-white/60"
        >
          {t.renameCancel}
        </button>
      </form>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {t.youAre(name)}
      <button
        onClick={() => {
          setDraft(name);
          setEditing(true);
        }}
        aria-label={t.renameDevice}
        title={t.renameDevice}
        className="flex h-9 w-9 items-center justify-center rounded-md text-black/40 hover:bg-black/5 hover:text-black dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      </button>
    </span>
  );
}
