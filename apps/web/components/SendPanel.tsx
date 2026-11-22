"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n/context";

type Tab = "file" | "text";

export default function SendPanel({
  peerName,
  fileTab,
  textTab,
}: {
  peerName: string | null;
  fileTab: React.ReactNode;
  textTab: React.ReactNode;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("file");

  const tabs: { id: Tab; label: string }[] = [
    { id: "file", label: t.tabFile },
    { id: "text", label: t.tabText },
  ];

  return (
    <div className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="min-w-0 truncate text-sm font-medium text-black/70 dark:text-white/70">
          {peerName ? t.sendTo(peerName) : t.sectionSend}
        </h2>
        <div role="tablist" className="flex shrink-0 gap-0.5 rounded-lg bg-black/5 p-0.5 dark:bg-white/10">
          {tabs.map((item) => (
            <button
              key={item.id}
              role="tab"
              id={`send-tab-${item.id}`}
              aria-selected={tab === item.id}
              aria-controls={`send-panel-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`min-h-9 rounded-md px-3 text-sm font-medium transition ${
                tab === item.id ? "bg-background shadow-sm" : "text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div role="tabpanel" id={`send-panel-${tab}`} aria-labelledby={`send-tab-${tab}`}>
        {tab === "file" ? fileTab : textTab}
      </div>
    </div>
  );
}
