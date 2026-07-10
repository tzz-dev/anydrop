"use client";

import { formatBytes } from "@/lib/format";

export interface TransferView {
  transferId: string;
  connectionId: string;
  name: string;
  size: number;
  direction: "send" | "receive";
  bytesDone: number;
  status: "awaiting-accept" | "in-progress" | "complete" | "rejected" | "canceled" | "error";
}

const STATUS_LABEL: Record<TransferView["status"], string> = {
  "awaiting-accept": "等待对方确认",
  "in-progress": "传输中",
  complete: "已完成",
  rejected: "对方已拒绝",
  canceled: "已取消",
  error: "传输失败",
};

export default function TransferProgress({
  transfers,
  onCancel,
}: {
  transfers: TransferView[];
  onCancel: (transfer: TransferView) => void;
}) {
  if (transfers.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      {transfers.map((transfer) => {
        const percent =
          transfer.size === 0 ? 0 : Math.min(100, Math.round((transfer.bytesDone / transfer.size) * 100));
        return (
          <div key={transfer.transferId} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {transfer.direction === "send" ? "发送" : "接收"} · {transfer.name}
              </span>
              <span className="text-black/50 dark:text-white/50">{STATUS_LABEL[transfer.status]}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: `${transfer.status === "complete" ? 100 : percent}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-xs text-black/50 dark:text-white/50">
              <span>
                {formatBytes(transfer.bytesDone)} / {formatBytes(transfer.size)}
              </span>
              {transfer.status === "in-progress" && (
                <button onClick={() => onCancel(transfer)} className="text-red-500 hover:underline">
                  取消
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
