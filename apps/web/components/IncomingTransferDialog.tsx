"use client";

import { useEffect, useRef } from "react";
import type { PeerInfo } from "@anydrop/protocol";
import { useI18n } from "@/lib/i18n/context";
import DeviceAvatar from "./DeviceAvatar";
import { formatBytes } from "@/lib/format";
import { MAX_IN_MEMORY_BYTES } from "@/lib/saveFile";

export interface IncomingOffer {
  connectionId: string;
  transferId: string;
  name: string;
  size: number;
  mime: string;
}

export default function IncomingTransferDialog({
  offers,
  peers,
  canReceive,
  canBatch,
  onAccept,
  onReject,
  onAcceptAll,
  onRejectAll,
}: {
  offers: IncomingOffer[];
  peers: PeerInfo[];
  // Whether this browser is able to receive the offered file at all.
  canReceive: (offer: IncomingOffer) => boolean;
  // Whether an offer can be accepted without its own save dialog (a file
  // streamed to disk needs one click of its own).
  canBatch: (offer: IncomingOffer) => boolean;
  onAccept: (offer: IncomingOffer) => void;
  onReject: (offer: IncomingOffer) => void;
  onAcceptAll: (offers: IncomingOffer[]) => void;
  onRejectAll: (offers: IncomingOffer[]) => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDivElement>(null);
  const rejectRef = useRef<HTMLButtonElement>(null);

  const offer = offers[0];
  const transferId = offer?.transferId;

  // Move focus into the dialog whenever a new offer is shown. The safe
  // choice (decline) gets the initial focus so a stray Enter can't accept.
  useEffect(() => {
    if (transferId) rejectRef.current?.focus();
  }, [transferId]);

  if (!offer) return null;
  const sender = peers.find((peer) => peer.connectionId === offer.connectionId);
  const senderName = sender?.displayName ?? t.unknownDevice;
  const receivable = canReceive(offer);
  const batchable = offers.filter((item) => canReceive(item) && canBatch(item));
  const showBatch = offers.length > 1;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onReject(offer);
      return;
    }
    // Minimal focus trap: keep Tab inside the dialog.
    if (event.key === "Tab") {
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>("button");
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-dialog-title"
        aria-describedby="incoming-dialog-file"
        onKeyDown={handleKeyDown}
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900"
      >
        <div className="flex items-center gap-3">
          <DeviceAvatar id={sender?.peerId ?? offer.connectionId} name={senderName} />
          <div>
            <p id="incoming-dialog-title" className="font-semibold">
              {t.incomingWantsToSend(senderName)}
            </p>
            <p id="incoming-dialog-file" className="text-sm text-black/60 dark:text-white/60">
              {offer.name} · {formatBytes(offer.size)}
            </p>
          </div>
        </div>
        {showBatch && (
          <p className="mt-3 text-xs text-black/50 dark:text-white/50">{t.incomingQueued(offers.length - 1)}</p>
        )}
        {!receivable && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {t.incomingTooLarge(formatBytes(MAX_IN_MEMORY_BYTES))}
          </p>
        )}
        {showBatch && (
          <div className="mt-4 flex flex-wrap justify-end gap-3 border-t border-black/10 pt-4 dark:border-white/10">
            <button
              onClick={() => onRejectAll(offers)}
              className="min-h-10 rounded-lg px-3 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
            >
              {t.incomingRejectAll(offers.length)}
            </button>
            {batchable.length > 1 && (
              <button
                onClick={() => onAcceptAll(batchable)}
                className="min-h-10 rounded-lg px-3 text-sm font-medium text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"
              >
                {t.incomingAcceptAll(batchable.length)}
              </button>
            )}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={rejectRef}
            onClick={() => onReject(offer)}
            className="min-h-11 rounded-lg px-4 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            {t.incomingReject}
          </button>
          <button
            onClick={() => onAccept(offer)}
            disabled={!receivable}
            className="min-h-11 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.incomingAccept}
          </button>
        </div>
      </div>
    </div>
  );
}
