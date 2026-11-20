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
  onAccept,
  onReject,
}: {
  offers: IncomingOffer[];
  peers: PeerInfo[];
  // Whether this browser is able to receive the offered file at all.
  canReceive: (offer: IncomingOffer) => boolean;
  onAccept: (offer: IncomingOffer) => void;
  onReject: (offer: IncomingOffer) => void;
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
        {!receivable && (
          <p role="alert" className="mt-4 text-sm text-red-500">
            {t.incomingTooLarge(formatBytes(MAX_IN_MEMORY_BYTES))}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={rejectRef}
            onClick={() => onReject(offer)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            {t.incomingReject}
          </button>
          <button
            onClick={() => onAccept(offer)}
            disabled={!receivable}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t.incomingAccept}
          </button>
        </div>
      </div>
    </div>
  );
}
