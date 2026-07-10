"use client";

import type { PeerInfo } from "@anydrop/protocol";
import DeviceAvatar from "./DeviceAvatar";
import { formatBytes } from "@/lib/format";

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
  onAccept,
  onReject,
}: {
  offers: IncomingOffer[];
  peers: PeerInfo[];
  onAccept: (offer: IncomingOffer) => void;
  onReject: (offer: IncomingOffer) => void;
}) {
  if (offers.length === 0) return null;
  const offer = offers[0];
  const sender = peers.find((peer) => peer.connectionId === offer.connectionId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-neutral-900">
        <div className="flex items-center gap-3">
          <DeviceAvatar id={sender?.peerId ?? offer.connectionId} name={sender?.displayName ?? "未知设备"} />
          <div>
            <p className="font-semibold">{sender?.displayName ?? "未知设备"} 想发送文件</p>
            <p className="text-sm text-black/60 dark:text-white/60">
              {offer.name} · {formatBytes(offer.size)}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => onReject(offer)}
            className="rounded-lg px-4 py-2 text-sm font-medium text-black/60 hover:bg-black/5 dark:text-white/60 dark:hover:bg-white/10"
          >
            拒绝
          </button>
          <button
            onClick={() => onAccept(offer)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            接受
          </button>
        </div>
      </div>
    </div>
  );
}
