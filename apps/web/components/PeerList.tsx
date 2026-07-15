"use client";

import type { PeerInfo } from "@anydrop/protocol";
import { useI18n } from "@/lib/i18n/context";
import DeviceAvatar from "./DeviceAvatar";

export default function PeerList({
  peers,
  selectedConnectionId,
  onSelect,
}: {
  peers: PeerInfo[];
  selectedConnectionId: string | null;
  onSelect: (connectionId: string) => void;
}) {
  const { t } = useI18n();

  if (peers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/10 p-10 text-center text-sm text-black/50 dark:border-white/10 dark:text-white/50">
        <p>{t.peersEmptyTitle}</p>
        <p>{t.peersEmptyHint}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {peers.map((peer) => (
        <button
          key={peer.connectionId}
          onClick={() => onSelect(peer.connectionId)}
          className={`flex flex-col items-center gap-2 rounded-xl border p-4 transition ${
            selectedConnectionId === peer.connectionId
              ? "border-blue-500 bg-blue-500/10"
              : "border-black/10 hover:border-black/20 dark:border-white/10 dark:hover:border-white/20"
          }`}
        >
          <DeviceAvatar id={peer.peerId} name={peer.displayName} />
          <span className="text-sm font-medium">{peer.displayName}</span>
        </button>
      ))}
    </div>
  );
}
