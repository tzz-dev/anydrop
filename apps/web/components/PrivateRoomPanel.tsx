"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { buildRoomLink, formatRoomCode, normalizeRoomCode } from "@/lib/privateRoom";
import QrCode from "./QrCode";

export default function PrivateRoomPanel({
  roomCode,
  onCreate,
  onJoin,
  onLeave,
}: {
  roomCode: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const join = () => {
    const code = normalizeRoomCode(draft);
    if (!code) {
      setInvalid(true);
      return;
    }
    setDraft("");
    setInvalid(false);
    onJoin(code);
  };

  if (!roomCode) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <h2 className="text-sm font-medium text-black/70 dark:text-white/70">{t.privateTitle}</h2>
        <p className="text-sm text-black/60 dark:text-white/60">{t.privateIntro}</p>
        <div>
          <button
            onClick={onCreate}
            className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          >
            {t.privateCreate}
          </button>
        </div>
        <form
          className="flex flex-col gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            join();
          }}
        >
          <label htmlFor="room-code" className="text-xs text-black/50 dark:text-white/50">
            {t.privateJoinLabel}
          </label>
          <div className="flex gap-2">
            <input
              id="room-code"
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setInvalid(false);
              }}
              placeholder={t.privateJoinPlaceholder}
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={invalid}
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-black/10 bg-transparent px-3 font-mono text-sm uppercase outline-none focus:border-blue-500 dark:border-white/10"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className="min-h-11 rounded-lg px-4 text-sm font-medium text-blue-600 hover:bg-blue-500/10 disabled:opacity-40 dark:text-blue-400"
            >
              {t.privateJoin}
            </button>
          </div>
          {invalid && (
            <p role="alert" className="text-xs text-red-500">
              {t.privateInvalidCode}
            </p>
          )}
        </form>
      </section>
    );
  }

  const link = buildRoomLink(window.location.origin, roomCode);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      return;
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-blue-500/40 bg-blue-500/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-black/70 dark:text-white/70">
          {t.privateTitle} · <span className="font-mono">{formatRoomCode(roomCode)}</span>
        </h2>
        <button
          onClick={onLeave}
          className="min-h-9 shrink-0 rounded-lg px-3 text-sm text-red-500 hover:bg-red-500/10"
        >
          {t.privateLeave}
        </button>
      </div>
      <p className="text-sm text-black/60 dark:text-white/60">{t.privateActiveIntro}</p>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <QrCode value={link} label={t.privateQrLabel} />
        <div className="flex min-w-0 flex-1 flex-col gap-2 self-stretch">
          <label htmlFor="room-link" className="text-xs text-black/50 dark:text-white/50">
            {t.privateLinkLabel}
          </label>
          <input
            id="room-link"
            readOnly
            value={link}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 w-full rounded-lg border border-black/10 bg-transparent px-3 font-mono text-xs outline-none dark:border-white/10"
          />
          <div>
            <button
              onClick={() => void copy()}
              className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
            >
              {copied ? t.textCopied : t.privateCopyLink}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
