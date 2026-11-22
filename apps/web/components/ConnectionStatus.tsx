"use client";

import type { RoomStatus } from "@/lib/useRoom";
import { useI18n } from "@/lib/i18n/context";

const DOT: Record<RoomStatus, string> = {
  connecting: "bg-amber-500 animate-pulse",
  connected: "bg-emerald-500",
  disconnected: "bg-red-500",
};

export default function ConnectionStatus({ status }: { status: RoomStatus }) {
  const { t } = useI18n();
  const label =
    status === "connected" ? t.statusConnected : status === "connecting" ? t.connecting : t.connectionLost;
  return (
    <span role="status" className="flex items-center gap-1.5 text-xs">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[status]}`} />
      {label}
    </span>
  );
}
