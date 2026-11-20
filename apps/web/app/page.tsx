"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRoom } from "@/lib/useRoom";
import { PeerManager, type PeerManagerEvent } from "@/lib/webrtc/peerManager";
import { getIdentity, type Identity } from "@/lib/identity";
import { downloadBlob } from "@/lib/download";
import { useI18n } from "@/lib/i18n/context";
import Logo from "@/components/Logo";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import PeerList from "@/components/PeerList";
import DropZone from "@/components/DropZone";
import IncomingTransferDialog, { type IncomingOffer } from "@/components/IncomingTransferDialog";
import TransferProgress, { type TransferView } from "@/components/TransferProgress";
import TextSharePanel, { type ReceivedTextView } from "@/components/TextSharePanel";

interface RawReceivedText {
  textId: string;
  connectionId: string;
  text: string;
}

const MAX_RECEIVED_TEXTS = 50;

function subscribeNever() {
  return () => {};
}

function getServerIdentitySnapshot(): Identity | null {
  return null;
}

export default function Page() {
  // sessionStorage isn't available during SSR, so the server snapshot is
  // null and the real identity appears once the client takes over.
  const identity = useSyncExternalStore(subscribeNever, getIdentity, getServerIdentitySnapshot);
  const { t } = useI18n();

  const room = useRoom(identity);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [incomingOffers, setIncomingOffers] = useState<IncomingOffer[]>([]);
  const [transfers, setTransfers] = useState<Record<string, TransferView>>({});
  const [rawTexts, setRawTexts] = useState<RawReceivedText[]>([]);

  // Derived rather than synced via an effect: if the selected peer left the
  // room, it simply won't be found here and every consumer below treats that
  // as "nothing selected" without a separate reset step.
  const selectedPeer = room.peers.find((peer) => peer.connectionId === selectedConnectionId);
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
          [...prev, { textId: event.textId, connectionId: event.connectionId, text: event.text }].slice(-MAX_RECEIVED_TEXTS),
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
        setTransfers((prev) => updateTransfer(prev, event.transferId, { status: "error" }));
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

  useEffect(() => {
    peerManager.setLocalConnectionId(room.connectionId);
  }, [room.connectionId, peerManager]);

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

    await Promise.all(
      files.map(async (file) => {
        // Register the transfer before connecting so it shows up immediately
        // and can be marked failed if the peer never becomes reachable.
        const transferId = crypto.randomUUID();
        setTransfers((prev) => ({
          ...prev,
          [transferId]: {
            transferId,
            connectionId,
            name: file.name,
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
          setTransfers((prev) => updateTransfer(prev, transferId, { status: "error" }));
        }
      }),
    );
  };

  const handleAcceptOffer = (offer: IncomingOffer) => {
    peerManager.acceptFileOffer(offer.connectionId, offer.transferId);
    setIncomingOffers((prev) => prev.filter((item) => item.transferId !== offer.transferId));
    setTransfers((prev) => ({
      ...prev,
      [offer.transferId]: {
        transferId: offer.transferId,
        connectionId: offer.connectionId,
        name: offer.name,
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

  const handleCancelTransfer = (transfer: TransferView) => {
    peerManager.cancelTransfer(transfer.connectionId, transfer.transferId);
  };

  const handleSendText = (text: string) => {
    if (!effectiveSelectedConnectionId) return;
    peerManager.sendText(effectiveSelectedConnectionId, text).catch((error) => {
      console.warn("failed to send text", error);
    });
  };

  const receivedTexts: ReceivedTextView[] = rawTexts.map((item) => ({
    textId: item.textId,
    senderName: room.peers.find((peer) => peer.connectionId === item.connectionId)?.displayName ?? t.unknownSender,
    text: item.text,
  }));

  // Object keys are UUID strings, so insertion order == creation order;
  // reverse for newest-first.
  const transferList = Object.values(transfers).reverse();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-10">
      <header className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Logo />
            <h1 className="text-2xl font-semibold">anydrop</h1>
          </div>
          <LanguageSwitcher />
        </div>
        <p className="text-sm text-black/50 dark:text-white/50">
          {identity ? t.youAre(identity.displayName) : t.connecting}
          {selectedPeer ? ` · ${t.selected(selectedPeer.displayName)}` : ""}
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionPeers}</h2>
        <PeerList peers={room.peers} selectedConnectionId={effectiveSelectedConnectionId} onSelect={setSelectedConnectionId} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionSend}</h2>
        <DropZone disabled={!effectiveSelectedConnectionId} onFiles={handleFiles} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionText}</h2>
        <TextSharePanel disabled={!effectiveSelectedConnectionId} onSend={handleSendText} receivedTexts={receivedTexts} />
      </section>

      {transferList.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-black/60 dark:text-white/60">{t.sectionTransfers}</h2>
          <TransferProgress transfers={transferList} onCancel={handleCancelTransfer} />
        </section>
      )}

      <IncomingTransferDialog offers={incomingOffers} peers={room.peers} onAccept={handleAcceptOffer} onReject={handleRejectOffer} />
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
  return { ...transfers, [transferId]: { ...existing, ...patch } };
}
