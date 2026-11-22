"use client";

import { estimateTransfer, formatBytes, formatDuration } from "@/lib/format";
import { useI18n } from "@/lib/i18n/context";

export interface TransferView {
  transferId: string;
  connectionId: string;
  name: string;
  peerName: string;
  size: number;
  // Timestamps (ms) of the first and latest progress update, for speed/ETA.
  startedAt?: number;
  updatedAt?: number;
  direction: "send" | "receive";
  bytesDone: number;
  // Technical reason for a failed transfer (shown as-is, not translated).
  error?: string;
  status: "awaiting-accept" | "in-progress" | "complete" | "rejected" | "canceled" | "error";
}

export default function TransferProgress({
  transfers,
  onCancel,
}: {
  transfers: TransferView[];
  onCancel: (transfer: TransferView) => void;
}) {
  const { t } = useI18n();

  if (transfers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {transfers.map((transfer) => {
        const percent =
          transfer.size === 0 ? 0 : Math.min(100, Math.round((transfer.bytesDone / transfer.size) * 100));
        const estimate =
          transfer.status === "in-progress"
            ? estimateTransfer(transfer.bytesDone, transfer.size, transfer.startedAt, transfer.updatedAt)
            : null;
        return (
          <div key={transfer.transferId} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium">
                {transfer.direction === "send" ? t.transferSend : t.transferReceive} · {transfer.name}
              </span>
              <span className="shrink-0 text-black/50 dark:text-white/50">{t.transferStatus[transfer.status]}</span>
            </div>
            <p className="truncate text-xs text-black/50 dark:text-white/50">{transfer.peerName}</p>
            <div
              role="progressbar"
              aria-label={transfer.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={transfer.status === "complete" ? 100 : percent}
              className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
            >
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${transfer.status === "complete" ? 100 : percent}%` }}
              />
            </div>
            {transfer.status === "error" && transfer.error && (
              <p className="mt-1 break-words text-xs text-red-500">{transfer.error}</p>
            )}
            <div className="mt-1 flex items-center justify-between text-xs text-black/50 dark:text-white/50">
              <span>
                {formatBytes(transfer.bytesDone)} / {formatBytes(transfer.size)}
                {estimate && (
                  <>
                    {" · "}
                    {formatBytes(estimate.bytesPerSecond)}/s · {t.transferRemaining(formatDuration(estimate.remainingSeconds))}
                  </>
                )}
              </span>
              {(transfer.status === "in-progress" || transfer.status === "awaiting-accept") && (
                <button onClick={() => onCancel(transfer)} className="min-h-9 px-2 text-sm text-red-500 hover:underline">
                  {t.transferCancel}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
