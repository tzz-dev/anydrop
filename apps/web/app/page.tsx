"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRoom } from "@/lib/useRoom";
import { PeerManager, type PeerManagerEvent } from "@/lib/webrtc/peerManager";
import { getIdentity, renameIdentity, subscribeIdentity, type Identity } from "@/lib/identity";
import { downloadBlob } from "@/lib/download";
import { randomId } from "@/lib/id";
import { canReceiveSize, pickFileSink, shouldStreamToDisk } from "@/lib/saveFile";
import type { FileSink } from "@/lib/webrtc/fileTransfer";
import { useI18n } from "@/lib/i18n/context";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PeerList from "@/components/PeerList";
import DropZone from "@/components/DropZone";
import IncomingTransferDialog, { type IncomingOffer } from "@/components/IncomingTransferDialog";
import TransferProgress, { type TransferView } from "@/components/TransferProgress";
import TextSharePanel from "@/components/TextSharePanel";
import ReceivedTexts, { type ReceivedTextView } from "@/components/ReceivedTexts";
import SendPanel from "@/components/SendPanel";
import DeviceName from "@/components/DeviceName";
import ConnectionStatus from "@/components/ConnectionStatus";

interface RawReceivedText {
  textId: string;
  // Resolved when the text arrives, so it survives the sender leaving.
  senderName: string | null;
  text: string;
}

const MAX_RECEIVED_TEXTS = 50;

function getServerIdentitySnapshot(): Identity | null {
  return null;
}

export default function Page() {
  // sessionStorage isn't available during SSR, so the server snapshot is
  // null and the real identity appears once the client takes over.
  const identity = useSyncExternalStore(subscribeIdentity, getIdentity, getServerIdentitySnapshot);
  const { t } = useI18n();

  const room = useRoom(identity);
  // The PeerManager callback is created once, so it reads the roster via a ref.
  const peersRef = useRef(room.peers);
  useEffect(() => {
    peersRef.current = room.peers;
  }, [room.peers]);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [incomingOffers, setIncomingOffers] = useState<IncomingOffer[]>([]);
  const [transfers, setTransfers] = useState<Record<string, TransferView>>({});
  const [rawTexts, setRawTexts] = useState<RawReceivedText[]>([]);
  const [pageDragging, setPageDragging] = useState(false);

  // Derived rather than synced via an effect: if the selected peer left the
  // room, it simply won't be found here and every consumer below treats that
  // as "nothing selected" without a separate reset step.
  // With exactly one device around there is nothing to choose.
  const selectedPeer =
    room.peers.find((peer) => peer.connectionId === selectedConnectionId) ??
    (room.peers.length === 1 ? room.peers[0] : undefined);
  const effectiveSelectedConnectionId = selectedPeer?.connectionId ?? null;

  function handlePeerManagerEvent(event: PeerManagerEvent) {
    switch (event.kind) {
      case "incoming-file-offer":
        setIncomingOffers((prev) => [
          ...prev,
          {
            connectionId: event.connectionId,
            transferId: event.transferId,
            name: event.name,
            size: event.size,
            mime: event.mime,
          },
        ]);
        break;

      case "incoming-text":
        setRawTexts((prev) =>
          [
            ...prev,
            {
              textId: event.textId,
              senderName: peersRef.current.find((peer) => peer.connectionId === event.connectionId)?.displayName ?? null,
              text: event.text,
            },
          ].slice(-MAX_RECEIVED_TEXTS),
        );
        break;

      case "send-progress":
        setTransfers((prev) => updateTransfer(prev, event.transferId, { bytesDone: event.sentBytes, status: "in-progress" }));
        break;

      case "receive-progress":
        setTransfers((prev) => updateTransfer(prev, event.transferId, { bytesDone: event.receivedBytes, status: "in-progress" }));
        break;

      case "transfer-complete":
        setTransfers((prev) => {
          const existing = prev[event.transferId];
          if (!existing) return prev;
          return updateTransfer(prev, event.transferId, { bytesDone: existing.size, status: "complete" });
        });
        if (event.direction === "receive" && event.blob) {
          downloadBlob(event.blob, event.name ?? "download");
        }
        break;

      case "transfer-rejected":
        setTransfers((prev) => updateTransfer(prev, event.transferId, { status: "rejected" }));
        break;

      case "transfer-canceled":
        setTransfers((prev) => updateTransfer(prev, event.transferId, { status: "canceled" }));
        // A sender withdrawing an offer we haven't answered yet must also
        // dismiss its dialog.
        setIncomingOffers((prev) => prev.filter((offer) => offer.transferId !== event.transferId));
        break;

      case "peer-gone":
        setIncomingOffers((prev) => prev.filter((offer) => offer.connectionId !== event.connectionId));
        break;

      case "transfer-error":
        setTransfers((prev) => updateTransfer(prev, event.transferId, { status: "error", error: event.message }));
        break;
    }
  }

  // Lazy useState initializer instead of a ref: it runs exactly once (even
  // under StrictMode's double-invoke, only one result is kept) without
  // touching a ref during render.
  const [peerManager] = useState(
    () =>
      new PeerManager(
        (msg) => room.send(msg),
        (event) => handlePeerManagerEvent(event),
      ),
  );

  // Close WebRTC connections (and fail their transfers) for peers that left.
  useEffect(() => {
    peerManager.syncPeers(room.peers.map((peer) => peer.connectionId));
  }, [room.peers, peerManager]);

  // Tear everything down when leaving the page.
  useEffect(() => () => peerManager.closeAll(), [peerManager]);

  useEffect(() => {
    return room.onMessage((msg) => peerManager.handleServerMessage(msg));
    // room.onMessage and peerManager are both stable for the component's
    // lifetime; `room` itself is a fresh object every render, so it's
    // intentionally left out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.onMessage, peerManager]);

  const handleFiles = async (files: File[]) => {
    if (!effectiveSelectedConnectionId) return;
    const connectionId = effectiveSelectedConnectionId;
    const peerName = selectedPeer?.displayName ?? t.unknownDevice;

    await Promise.all(
      files.map(async (file) => {
        // Register the transfer before connecting so it shows up immediately
        // and can be marked failed if the peer never becomes reachable.
        const transferId = randomId();
        setTransfers((prev) => ({
          ...prev,
          [transferId]: {
            transferId,
            connectionId,
            name: file.name,
            peerName,
            size: file.size,
            direction: "send",
            bytesDone: 0,
            status: "awaiting-accept",
          },
        }));
        try {
          await peerManager.offerFile(connectionId, file, transferId);
        } catch (error) {
          console.warn("failed to offer file", error);
          setTransfers((prev) => updateTransfer(prev, transferId, { status: "error", error: String(error) }));
        }
      }),
    );
  };

  // Files can be dropped anywhere on the page or pasted from the clipboard.
  const handleFilesRef = useRef(handleFiles);
  useEffect(() => {
    handleFilesRef.current = handleFiles;
  });
  useEffect(() => {
    const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;
    const onDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      // Always cancel the default, or dropping beside the zone would make the
      // browser navigate to the file.
      event.preventDefault();
      setPageDragging(true);
    };
    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget === null) setPageDragging(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      setPageDragging(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) void handleFilesRef.current(files);
    };
    const onPaste = (event: ClipboardEvent) => {
      const files = Array.from(event.clipboardData?.files ?? []);
      if (files.length === 0) return;
      event.preventDefault();
      void handleFilesRef.current(files);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragleave", onDragLeave);
    window.addEventListener("drop", onDrop);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragleave", onDragLeave);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("paste", onPaste);
    };
  }, []);

  // Offers whose save dialog is currently open, so a second click can't open another.
  const acceptingRef = useRef(new Set<string>());

  const handleAcceptOffer = async (offer: IncomingOffer) => {
    if (!canReceiveSize(offer.size) || acceptingRef.current.has(offer.transferId)) return;
    acceptingRef.current.add(offer.transferId);
    try {
      await acceptOffer(offer);
    } finally {
      acceptingRef.current.delete(offer.transferId);
    }
  };

  const acceptOffer = async (offer: IncomingOffer) => {
    // Big files are streamed to a user-chosen file instead of buffered in
    // memory. The save dialog must open straight from this click, so it
    // happens before anything else; dismissing it keeps the offer pending.
    let sink: FileSink | undefined;
    if (shouldStreamToDisk(offer.size)) {
      try {
        sink = await pickFileSink(offer.name);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          console.warn("failed to open save dialog", error);
        }
        return;
      }
    }

    // The sender may have canceled or left while the save dialog was open.
    if (!peerManager.acceptFileOffer(offer.connectionId, offer.transferId, sink)) return;
    setIncomingOffers((prev) => prev.filter((item) => item.transferId !== offer.transferId));
    setTransfers((prev) => ({
      ...prev,
      [offer.transferId]: {
        transferId: offer.transferId,
        connectionId: offer.connectionId,
        name: offer.name,
        peerName: room.peers.find((peer) => peer.connectionId === offer.connectionId)?.displayName ?? t.unknownDevice,
        size: offer.size,
        direction: "receive",
        bytesDone: 0,
        status: "in-progress",
      },
    }));
  };

  const handleRejectOffer = (offer: IncomingOffer) => {
    peerManager.rejectFileOffer(offer.connectionId, offer.transferId);
    setIncomingOffers((prev) => prev.filter((item) => item.transferId !== offer.transferId));
  };

  const handleAcceptAll = (offers: IncomingOffer[]) => {
    for (const offer of offers) void handleAcceptOffer(offer);
  };

  const handleRejectAll = (offers: IncomingOffer[]) => {
    for (const offer of offers) handleRejectOffer(offer);
  };

  const handleDeleteText = (textId: string) => {
    setRawTexts((prev) => prev.filter((item) => item.textId !== textId));
  };

  const handleCancelTransfer = (transfer: TransferView) => {
    peerManager.cancelTransfer(transfer.connectionId, transfer.transferId);
  };

  // Rejects on failure so the text panel can keep the draft and show an error.
  const handleSendText = async (text: string) => {
    if (!effectiveSelectedConnectionId) throw new Error("no peer selected");
    await peerManager.sendText(effectiveSelectedConnectionId, text);
  };

  const handleClearFinished = () => {
    setTransfers((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([, transfer]) => transfer.status === "awaiting-accept" || transfer.status === "in-progress"),
      ),
    );
  };

  const receivedTexts: ReceivedTextView[] = rawTexts.map((item) => ({
    textId: item.textId,
    senderName: item.senderName ?? t.unknownSender,
    text: item.text,
  }));

  // Object keys are UUID strings, so insertion order == creation order;
  // reverse for newest-first.
  const transferList = Object.values(transfers).reverse();
  const hasFinishedTransfers = transferList.some(
    (transfer) => transfer.status !== "awaiting-accept" && transfer.status !== "in-progress",
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-8 sm:px-6 sm:py-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="text-2xl font-semibold">anydrop</h1>
          </div>
          <LanguageSwitcher />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-black/60 dark:text-white/60">
          <DeviceName name={identity?.displayName ?? null} onRename={renameIdentity} />
          {identity && <ConnectionStatus status={room.status} />}
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionPeers}</h2>
        <PeerList peers={room.peers} selectedConnectionId={effectiveSelectedConnectionId} onSelect={setSelectedConnectionId} />
        <p className="text-xs text-black/40 dark:text-white/40">{t.peersNotice}</p>
      </section>

      <SendPanel
        peerName={selectedPeer?.displayName ?? null}
        fileTab={<DropZone disabled={!effectiveSelectedConnectionId} dragging={pageDragging} onFiles={handleFiles} />}
        textTab={<TextSharePanel disabled={!effectiveSelectedConnectionId} onSend={handleSendText} />}
      />

      <ReceivedTexts texts={receivedTexts} onDelete={handleDeleteText} />

      {transferList.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionTransfers}</h2>
            {hasFinishedTransfers && (
              <button
                onClick={handleClearFinished}
                className="min-h-9 px-2 text-sm text-blue-600 hover:underline dark:text-blue-400"
              >
                {t.transfersClear}
              </button>
            )}
          </div>
          <TransferProgress transfers={transferList} onCancel={handleCancelTransfer} />
        </section>
      )}

      {pageDragging && (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-blue-500/60 bg-blue-500/10">
          <p className="rounded-xl bg-background px-4 py-2 text-sm font-medium shadow-lg">
            {selectedPeer ? t.dropOverlay(selectedPeer.displayName) : t.dropDisabled}
          </p>
        </div>
      )}

      <IncomingTransferDialog
        offers={incomingOffers}
        peers={room.peers}
        canReceive={(offer) => canReceiveSize(offer.size)}
        canBatch={(offer) => !shouldStreamToDisk(offer.size)}
        onAccept={handleAcceptOffer}
        onReject={handleRejectOffer}
        onAcceptAll={handleAcceptAll}
        onRejectAll={handleRejectAll}
      />
    </div>
  );
}

function updateTransfer(
  transfers: Record<string, TransferView>,
  transferId: string,
  patch: Partial<TransferView>,
): Record<string, TransferView> {
  const existing = transfers[transferId];
  if (!existing) return transfers;
  // Progress updates carry timestamps so the UI can show speed and time left.
  const now = Date.now();
  const timing = patch.bytesDone !== undefined ? { updatedAt: now, startedAt: existing.startedAt ?? now } : {};
  return { ...transfers, [transferId]: { ...existing, ...patch, ...timing } };
}
