import {
  CONTROL_CHANNEL_LABEL,
  fileChannelLabel,
  isFileChannelLabel,
  transferIdFromChannelLabel,
  type ClientSignalMessage,
  type ControlMessage,
  type RTCIceCandidateLike,
  type RTCSessionDescriptionLike,
  type ServerSignalMessage,
} from "@anydrop/protocol";
import { receiveFile, sendFile, TransferAbortedError, type IncomingFileTransfer } from "./fileTransfer";

const ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export type PeerManagerEvent =
  | { kind: "incoming-file-offer"; connectionId: string; transferId: string; name: string; size: number; mime: string }
  | { kind: "incoming-text"; connectionId: string; text: string; textId: string }
  | { kind: "send-progress"; transferId: string; sentBytes: number; totalBytes: number }
  | { kind: "receive-progress"; transferId: string; receivedBytes: number; totalBytes: number }
  | { kind: "transfer-complete"; transferId: string; direction: "send" | "receive"; blob?: Blob; name?: string; mime?: string }
  | { kind: "transfer-rejected"; transferId: string }
  | { kind: "transfer-canceled"; transferId: string }
  | { kind: "transfer-error"; transferId: string; message: string };

interface OutgoingFileOffer {
  transferId: string;
  file: File;
}

interface PendingIncomingOffer {
  transferId: string;
  name: string;
  size: number;
  mime: string;
}

interface PeerEntry {
  pc: RTCPeerConnection;
  control?: RTCDataChannel;
  outgoing: Map<string, OutgoingFileOffer>;
  incoming: Map<string, PendingIncomingOffer>;
  outgoingAbort: Map<string, AbortController>;
  incomingTransfer: Map<string, IncomingFileTransfer>;
}

export class PeerManager {
  private peers = new Map<string, PeerEntry>();

  constructor(
    private sendSignal: (msg: ClientSignalMessage) => void,
    private emit: (event: PeerManagerEvent) => void,
  ) {}

  handleServerMessage(msg: ServerSignalMessage) {
    if (msg.type === "signal") {
      void this.handleSignal(msg.from, msg.data);
    } else if (msg.type === "ice") {
      void this.handleIce(msg.from, msg.data);
    }
  }

  async connectAndOfferFile(connectionId: string, file: File): Promise<string> {
    const entry = this.getOrCreatePeer(connectionId);
    const transferId = crypto.randomUUID();
    entry.outgoing.set(transferId, { transferId, file });

    if (!entry.control) await this.openControlChannel(connectionId, entry);

    const offer: ControlMessage = {
      type: "file-offer",
      transferId,
      name: file.name,
      size: file.size,
      mime: file.type || "application/octet-stream",
    };
    entry.control!.send(JSON.stringify(offer));
    return transferId;
  }

  async sendText(connectionId: string, text: string): Promise<void> {
    const entry = this.getOrCreatePeer(connectionId);
    if (!entry.control) await this.openControlChannel(connectionId, entry);
    const msg: ControlMessage = { type: "text", text, textId: crypto.randomUUID() };
    entry.control!.send(JSON.stringify(msg));
  }

  acceptFileOffer(connectionId: string, transferId: string) {
    const entry = this.peers.get(connectionId);
    if (!entry?.incoming.has(transferId)) return;
    entry.control?.send(JSON.stringify({ type: "file-accept", transferId } satisfies ControlMessage));
  }

  rejectFileOffer(connectionId: string, transferId: string) {
    const entry = this.peers.get(connectionId);
    if (!entry) return;
    entry.incoming.delete(transferId);
    entry.control?.send(JSON.stringify({ type: "file-reject", transferId } satisfies ControlMessage));
  }

  cancelTransfer(connectionId: string, transferId: string) {
    const entry = this.peers.get(connectionId);
    if (!entry) return;

    entry.outgoingAbort.get(transferId)?.abort();
    entry.incomingTransfer.get(transferId)?.abort();
    entry.incomingTransfer.delete(transferId);

    entry.control?.send(JSON.stringify({ type: "file-cancel", transferId } satisfies ControlMessage));
  }

  closeAll() {
    for (const entry of this.peers.values()) entry.pc.close();
    this.peers.clear();
  }

  private getOrCreatePeer(connectionId: string): PeerEntry {
    const existing = this.peers.get(connectionId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry: PeerEntry = {
      pc,
      outgoing: new Map(),
      incoming: new Map(),
      outgoingAbort: new Map(),
      incomingTransfer: new Map(),
    };
    this.peers.set(connectionId, entry);

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.sendSignal({ type: "ice", to: connectionId, data: event.candidate.toJSON() as RTCIceCandidateLike });
    };

    pc.ondatachannel = (event) => {
      const { channel } = event;
      if (channel.label === CONTROL_CHANNEL_LABEL) {
        this.wireControlChannel(connectionId, entry, channel);
      } else if (isFileChannelLabel(channel.label)) {
        this.wireIncomingFileChannel(entry, channel);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        this.peers.delete(connectionId);
      }
    };

    return entry;
  }

  private openControlChannel(connectionId: string, entry: PeerEntry): Promise<void> {
    const channel = entry.pc.createDataChannel(CONTROL_CHANNEL_LABEL);
    this.wireControlChannel(connectionId, entry, channel);

    return new Promise((resolve, reject) => {
      channel.addEventListener("open", () => resolve(), { once: true });
      channel.addEventListener("error", () => reject(new Error("control channel failed to open")), { once: true });

      void (async () => {
        const offer = await entry.pc.createOffer();
        await entry.pc.setLocalDescription(offer);
        this.sendSignal({
          type: "signal",
          to: connectionId,
          data: entry.pc.localDescription!.toJSON() as RTCSessionDescriptionLike,
        });
      })();
    });
  }

  private wireControlChannel(connectionId: string, entry: PeerEntry, channel: RTCDataChannel) {
    entry.control = channel;
    channel.onmessage = (event: MessageEvent<string>) => {
      this.handleControlMessage(connectionId, entry, JSON.parse(event.data) as ControlMessage);
    };
  }

  private handleControlMessage(connectionId: string, entry: PeerEntry, msg: ControlMessage) {
    switch (msg.type) {
      case "file-offer":
        entry.incoming.set(msg.transferId, {
          transferId: msg.transferId,
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
        });
        this.emit({
          kind: "incoming-file-offer",
          connectionId,
          transferId: msg.transferId,
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
        });
        break;

      case "file-accept": {
        const offer = entry.outgoing.get(msg.transferId);
        if (offer) this.beginSending(entry, offer);
        break;
      }

      case "file-reject":
        entry.outgoing.delete(msg.transferId);
        this.emit({ kind: "transfer-rejected", transferId: msg.transferId });
        break;

      case "file-cancel":
        entry.outgoingAbort.get(msg.transferId)?.abort();
        entry.incomingTransfer.get(msg.transferId)?.abort();
        entry.incomingTransfer.delete(msg.transferId);
        this.emit({ kind: "transfer-canceled", transferId: msg.transferId });
        break;

      case "text":
        this.emit({ kind: "incoming-text", connectionId, text: msg.text, textId: msg.textId });
        break;
    }
  }

  private beginSending(entry: PeerEntry, offer: OutgoingFileOffer) {
    const channel = entry.pc.createDataChannel(fileChannelLabel(offer.transferId));
    channel.binaryType = "arraybuffer";
    const abortController = new AbortController();
    entry.outgoingAbort.set(offer.transferId, abortController);

    channel.onopen = () => {
      sendFile(
        channel,
        offer.file,
        (sentBytes) => this.emit({ kind: "send-progress", transferId: offer.transferId, sentBytes, totalBytes: offer.file.size }),
        abortController.signal,
      )
        .then(() => {
          this.emit({ kind: "transfer-complete", transferId: offer.transferId, direction: "send" });
        })
        .catch((error) => {
          if (!(error instanceof TransferAbortedError)) {
            this.emit({ kind: "transfer-error", transferId: offer.transferId, message: String(error) });
          }
        })
        .finally(() => {
          entry.outgoing.delete(offer.transferId);
          entry.outgoingAbort.delete(offer.transferId);
        });
    };
  }

  private wireIncomingFileChannel(entry: PeerEntry, channel: RTCDataChannel) {
    const transferId = transferIdFromChannelLabel(channel.label);
    const pending = entry.incoming.get(transferId);
    if (!pending) return;

    const transfer = receiveFile(
      channel,
      pending.size,
      pending.mime,
      (receivedBytes) => this.emit({ kind: "receive-progress", transferId, receivedBytes, totalBytes: pending.size }),
      (blob) => {
        entry.incoming.delete(transferId);
        entry.incomingTransfer.delete(transferId);
        this.emit({
          kind: "transfer-complete",
          transferId,
          direction: "receive",
          blob,
          name: pending.name,
          mime: pending.mime,
        });
      },
    );
    entry.incomingTransfer.set(transferId, transfer);
  }

  private async handleSignal(connectionId: string, data: RTCSessionDescriptionLike) {
    const entry = this.getOrCreatePeer(connectionId);
    await entry.pc.setRemoteDescription(data as RTCSessionDescriptionInit);

    if (data.type === "offer") {
      const answer = await entry.pc.createAnswer();
      await entry.pc.setLocalDescription(answer);
      this.sendSignal({
        type: "signal",
        to: connectionId,
        data: entry.pc.localDescription!.toJSON() as RTCSessionDescriptionLike,
      });
    }
  }

  private async handleIce(connectionId: string, data: RTCIceCandidateLike) {
    const entry = this.peers.get(connectionId);
    if (!entry) return;
    try {
      await entry.pc.addIceCandidate(data as RTCIceCandidateInit);
    } catch {
      // Benign: candidate arrived for an already-closed/renegotiated connection.
    }
  }
}
