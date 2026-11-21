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
import { randomId } from "../id";
import { throttleProgress } from "../throttle";
import { parseControlMessage } from "./controlMessage";
import { receiveFile, sendFile, TransferAbortedError, type FileSink, type IncomingFileTransfer } from "./fileTransfer";

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

// Optional override, e.g. to add a TURN server for networks where direct
// connections fail (symmetric NAT). Must be a JSON array of RTCIceServer.
// NOTE: Next.js only inlines the literal `process.env.NEXT_PUBLIC_*` form.
function loadIceServers(): RTCIceServer[] {
  const raw = process.env.NEXT_PUBLIC_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as RTCIceServer[];
  } catch {
    // fall through
  }
  console.warn("NEXT_PUBLIC_ICE_SERVERS is not a valid non-empty JSON array; using default STUN server");
  return DEFAULT_ICE_SERVERS;
}

const ICE_SERVERS = loadIceServers();

const CONTROL_OPEN_TIMEOUT_MS = 15_000;
const MAX_PENDING_OFFERS_PER_PEER = 10;
// A peer that dropped out of the room while a transfer was running keeps its
// connection until the transfer ends, plus this grace period so the tail of
// the data isn't cut off by closing the connection right after the last byte.
const ORPHAN_GRACE_MS = 5_000;

export type PeerManagerEvent =
  | { kind: "incoming-file-offer"; connectionId: string; transferId: string; name: string; size: number; mime: string }
  | { kind: "incoming-text"; connectionId: string; text: string; textId: string }
  | { kind: "send-progress"; transferId: string; sentBytes: number; totalBytes: number }
  | { kind: "receive-progress"; transferId: string; receivedBytes: number; totalBytes: number }
  | { kind: "transfer-complete"; transferId: string; direction: "send" | "receive"; blob?: Blob; name?: string; mime?: string }
  | { kind: "transfer-rejected"; transferId: string }
  | { kind: "transfer-canceled"; transferId: string }
  | { kind: "transfer-error"; transferId: string; message: string }
  // The peer is gone (left the room / connection failed): drop any UI state
  // that is waiting on it, e.g. pending incoming-offer dialogs.
  | { kind: "peer-gone"; connectionId: string };

interface OutgoingFileOffer {
  transferId: string;
  file: File;
}

interface PendingIncomingOffer {
  transferId: string;
  name: string;
  size: number;
  mime: string;
  // Data is only accepted on a file channel after the user explicitly
  // accepted the offer — otherwise a peer could skip the dialog entirely.
  accepted: boolean;
  // Set when the user chose to stream a large file straight to disk.
  sink?: FileSink;
}

interface PeerEntry {
  connectionId: string;
  pc: RTCPeerConnection;
  // The peer is no longer in the room roster but still has a transfer running.
  orphaned: boolean;
  releaseTimer?: ReturnType<typeof setTimeout>;
  makingOffer: boolean;
  ignoreOffer: boolean;
  // Serializes remote signaling/ICE handling so candidates are never added
  // before the remote description they belong to has been applied.
  signalQueue: Promise<void>;
  control?: RTCDataChannel;
  controlReady: Promise<RTCDataChannel> | null;
  outgoing: Map<string, OutgoingFileOffer>;
  incoming: Map<string, PendingIncomingOffer>;
  outgoingAbort: Map<string, AbortController>;
  incomingTransfer: Map<string, IncomingFileTransfer>;
}

export class PeerManager {
  private peers = new Map<string, PeerEntry>();
  private localConnectionId: string | null = null;

  constructor(
    private sendSignal: (msg: ClientSignalMessage) => void,
    private emit: (event: PeerManagerEvent) => void,
  ) {}

  handleServerMessage(msg: ServerSignalMessage) {
    if (msg.type === "welcome") {
      this.localConnectionId = msg.connectionId;
    } else if (msg.type === "signal") {
      this.enqueueSignal(msg.from, (entry) => this.handleSignal(msg.from, entry, msg.data));
    } else if (msg.type === "ice") {
      this.enqueueSignal(msg.from, (entry) => this.handleIce(entry, msg.data), false);
    }
  }

  // Closes connections to peers that are no longer in the room roster.
  //
  // Dropping out of the roster only means the peer's *signaling* socket went
  // away (a closed tab, but also a brief network blip). The peer-to-peer link
  // doesn't depend on it, so a peer with a transfer in flight is kept until
  // that transfer ends; if the peer is really gone, its connection fails on
  // its own and cleans up through the usual paths.
  syncPeers(activeConnectionIds: Iterable<string>) {
    const active = new Set(activeConnectionIds);
    for (const [connectionId, entry] of [...this.peers]) {
      if (active.has(connectionId)) {
        entry.orphaned = false;
        clearTimeout(entry.releaseTimer);
        entry.releaseTimer = undefined;
      } else if (this.hasActiveTransfers(entry)) {
        entry.orphaned = true;
      } else {
        this.dropPeer(connectionId, "peer left the room");
      }
    }
  }

  // Data is flowing, or about to (an accepted offer whose channel hasn't opened yet).
  private hasActiveTransfers(entry: PeerEntry): boolean {
    if (entry.outgoingAbort.size > 0 || entry.incomingTransfer.size > 0) return true;
    for (const offer of entry.incoming.values()) if (offer.accepted) return true;
    return false;
  }

  // Called whenever a transfer ends: an orphaned peer is released shortly after.
  private scheduleOrphanRelease(entry: PeerEntry) {
    if (!entry.orphaned || entry.releaseTimer || this.hasActiveTransfers(entry)) return;
    entry.releaseTimer = setTimeout(() => {
      entry.releaseTimer = undefined;
      if (entry.orphaned && !this.hasActiveTransfers(entry) && this.peers.get(entry.connectionId) === entry) {
        this.dropPeer(entry.connectionId, "peer left the room");
      }
    }, ORPHAN_GRACE_MS);
  }

  async offerFile(connectionId: string, file: File, transferId: string): Promise<void> {
    const entry = this.getOrCreatePeer(connectionId);
    entry.outgoing.set(transferId, { transferId, file });

    try {
      const control = await this.ensureControl(connectionId, entry);
      const offer: ControlMessage = {
        type: "file-offer",
        transferId,
        name: file.name,
        size: file.size,
        mime: file.type || "application/octet-stream",
      };
      control.send(JSON.stringify(offer));
    } catch (error) {
      entry.outgoing.delete(transferId);
      throw error;
    }
  }

  async sendText(connectionId: string, text: string): Promise<void> {
    const entry = this.getOrCreatePeer(connectionId);
    const control = await this.ensureControl(connectionId, entry);
    const msg: ControlMessage = { type: "text", text, textId: randomId() };
    control.send(JSON.stringify(msg));
  }

  // Returns false if the offer no longer exists (e.g. the sender canceled
  // while the user was still deciding); the sink, if any, is discarded then.
  acceptFileOffer(connectionId: string, transferId: string, sink?: FileSink): boolean {
    const entry = this.peers.get(connectionId);
    const pending = entry?.incoming.get(transferId);
    if (!entry || !pending) {
      void sink?.abort();
      return false;
    }
    pending.accepted = true;
    pending.sink = sink;
    this.sendControl(entry, { type: "file-accept", transferId });
    return true;
  }

  rejectFileOffer(connectionId: string, transferId: string) {
    const entry = this.peers.get(connectionId);
    if (!entry) return;
    entry.incoming.delete(transferId);
    this.sendControl(entry, { type: "file-reject", transferId });
  }

  cancelTransfer(connectionId: string, transferId: string) {
    const entry = this.peers.get(connectionId);
    if (!entry) return;

    // Forget the offer too: if we cancel before the peer accepts, a late
    // "file-accept" must not start the transfer.
    entry.outgoing.delete(transferId);
    entry.outgoingAbort.get(transferId)?.abort();
    this.discardIncoming(entry, transferId);

    this.sendControl(entry, { type: "file-cancel", transferId });
    this.emit({ kind: "transfer-canceled", transferId });
    this.scheduleOrphanRelease(entry);
  }

  closeAll() {
    for (const connectionId of [...this.peers.keys()]) this.dropPeer(connectionId, "closed");
  }

  // Forgets an incoming transfer in any state: stops receiving, and discards
  // a half-written file if the data was being streamed to disk.
  private discardIncoming(entry: PeerEntry, transferId: string) {
    entry.incomingTransfer.get(transferId)?.abort();
    entry.incomingTransfer.delete(transferId);
    void entry.incoming.get(transferId)?.sink?.abort();
    entry.incoming.delete(transferId);
  }

  private sendControl(entry: PeerEntry, msg: ControlMessage) {
    if (entry.control?.readyState === "open") entry.control.send(JSON.stringify(msg));
  }

  // Tears down a peer and fails everything that was still in flight with it.
  private dropPeer(connectionId: string, reason: string) {
    const entry = this.peers.get(connectionId);
    if (!entry) return;
    this.peers.delete(connectionId);
    clearTimeout(entry.releaseTimer);

    const transferIds = new Set<string>([
      ...entry.outgoing.keys(),
      ...entry.outgoingAbort.keys(),
      ...entry.incomingTransfer.keys(),
    ]);
    for (const controller of entry.outgoingAbort.values()) controller.abort();
    for (const transfer of entry.incomingTransfer.values()) transfer.abort();
    for (const pending of entry.incoming.values()) void pending.sink?.abort();

    entry.pc.onicecandidate = null;
    entry.pc.ondatachannel = null;
    entry.pc.onconnectionstatechange = null;
    entry.pc.onnegotiationneeded = null;
    entry.pc.close();

    for (const transferId of transferIds) {
      this.emit({ kind: "transfer-error", transferId, message: reason });
    }
    this.emit({ kind: "peer-gone", connectionId });
  }

  private getOrCreatePeer(connectionId: string): PeerEntry {
    const existing = this.peers.get(connectionId);
    if (existing) return existing;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const entry: PeerEntry = {
      connectionId,
      pc,
      orphaned: false,
      makingOffer: false,
      ignoreOffer: false,
      signalQueue: Promise.resolve(),
      controlReady: null,
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

    // Perfect negotiation: creating a data channel triggers this on whichever
    // side needs to (re)negotiate; collisions are resolved in handleSignal.
    pc.onnegotiationneeded = async () => {
      try {
        entry.makingOffer = true;
        await pc.setLocalDescription();
        this.sendSignal({
          type: "signal",
          to: connectionId,
          data: pc.localDescription!.toJSON() as RTCSessionDescriptionLike,
        });
      } catch (error) {
        console.warn("negotiation failed", error);
      } finally {
        entry.makingOffer = false;
      }
    };

    pc.ondatachannel = (event) => {
      const { channel } = event;
      if (channel.label === CONTROL_CHANNEL_LABEL) {
        this.wireControlChannel(connectionId, entry, channel);
      } else if (isFileChannelLabel(channel.label)) {
        this.wireIncomingFileChannel(entry, channel);
      } else {
        channel.close();
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "closed" || pc.connectionState === "failed") {
        if (this.peers.get(connectionId) === entry) this.dropPeer(connectionId, `connection ${pc.connectionState}`);
      }
    };

    return entry;
  }

  // Resolves with an open control channel, creating one (and thereby starting
  // negotiation) if none exists yet. Concurrent callers share the same
  // promise, so nobody ever sends on a channel that is still connecting.
  private ensureControl(connectionId: string, entry: PeerEntry): Promise<RTCDataChannel> {
    if (entry.control?.readyState === "open") return Promise.resolve(entry.control);
    if (entry.control && entry.control.readyState !== "connecting") {
      return Promise.reject(new Error("control channel is closing"));
    }
    if (entry.controlReady) return entry.controlReady;

    const channel = entry.pc.createDataChannel(CONTROL_CHANNEL_LABEL);
    this.wireControlChannel(connectionId, entry, channel);
    return entry.controlReady!;
  }

  private wireControlChannel(connectionId: string, entry: PeerEntry, channel: RTCDataChannel) {
    channel.onmessage = (event: MessageEvent<string>) => {
      const msg = parseControlMessage(event.data);
      if (msg) this.handleControlMessage(connectionId, entry, msg);
    };

    const ready = new Promise<RTCDataChannel>((resolve, reject) => {
      if (channel.readyState === "open") {
        resolve(channel);
        return;
      }
      const timer = setTimeout(() => {
        reject(new Error("control channel timed out"));
        // The connection never came up; throw it away so a retry starts from
        // a clean RTCPeerConnection instead of piling onto a stuck one.
        if (entry.control === channel && this.peers.get(connectionId) === entry) {
          this.dropPeer(connectionId, "control channel timed out");
        }
      }, CONTROL_OPEN_TIMEOUT_MS);

      channel.addEventListener(
        "open",
        () => {
          clearTimeout(timer);
          resolve(channel);
        },
        { once: true },
      );
      channel.addEventListener(
        "error",
        () => {
          clearTimeout(timer);
          reject(new Error("control channel failed to open"));
          if (entry.control === channel && this.peers.get(connectionId) === entry) {
            this.dropPeer(connectionId, "control channel failed to open");
          }
        },
        { once: true },
      );
      channel.addEventListener(
        "close",
        () => {
          clearTimeout(timer);
          reject(new Error("control channel closed"));
        },
        { once: true },
      );
    });
    // Callers handle rejections; this just prevents an unhandled-rejection
    // warning when nobody is awaiting (e.g. a remotely created channel).
    ready.catch(() => {});

    entry.control = channel;
    entry.controlReady = ready;

    channel.onclose = () => {
      if (entry.control === channel) {
        entry.control = undefined;
        entry.controlReady = null;
        // The control channel is the lifeline of the peer: without it nothing
        // can be offered, accepted or canceled, so fail the peer outright.
        if (this.peers.get(connectionId) === entry) this.dropPeer(connectionId, "control channel closed");
      }
    };
  }

  private handleControlMessage(connectionId: string, entry: PeerEntry, msg: ControlMessage) {
    switch (msg.type) {
      case "file-offer": {
        if (entry.incoming.has(msg.transferId)) return;
        // A peer spamming offers would otherwise stack up dialogs forever.
        let pendingCount = 0;
        for (const offer of entry.incoming.values()) if (!offer.accepted) pendingCount++;
        if (pendingCount >= MAX_PENDING_OFFERS_PER_PEER) {
          this.sendControl(entry, { type: "file-reject", transferId: msg.transferId });
          return;
        }
        entry.incoming.set(msg.transferId, {
          transferId: msg.transferId,
          name: msg.name,
          size: msg.size,
          mime: msg.mime,
          accepted: false,
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
      }

      case "file-accept": {
        const offer = entry.outgoing.get(msg.transferId);
        // Ignore duplicate accepts: only the first one starts a send.
        if (offer && !entry.outgoingAbort.has(msg.transferId)) this.beginSending(entry, offer);
        break;
      }

      case "file-reject":
        entry.outgoing.delete(msg.transferId);
        this.emit({ kind: "transfer-rejected", transferId: msg.transferId });
        break;

      case "file-cancel":
        entry.outgoing.delete(msg.transferId);
        entry.outgoingAbort.get(msg.transferId)?.abort();
        this.discardIncoming(entry, msg.transferId);
        this.emit({ kind: "transfer-canceled", transferId: msg.transferId });
        this.scheduleOrphanRelease(entry);
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

    const cleanup = () => {
      entry.outgoing.delete(offer.transferId);
      entry.outgoingAbort.delete(offer.transferId);
      if (channel.readyState !== "closed") channel.close();
      this.scheduleOrphanRelease(entry);
    };

    let opened = false;
    // One state update per 64 KB chunk would flood React; ~10 per second is plenty.
    const reportProgress = throttleProgress((sentBytes) =>
      this.emit({ kind: "send-progress", transferId: offer.transferId, sentBytes, totalBytes: offer.file.size }),
    );

    channel.onopen = () => {
      opened = true;
      sendFile(
        channel,
        offer.file,
        reportProgress,
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
        .finally(cleanup);
    };

    // If the channel dies before it ever opens (error, or closed by a peer
    // that refused the data), surface that instead of leaving the transfer
    // stuck. Once open, sendFile reports failures itself.
    const failBeforeOpen = (message: string) => {
      if (opened || !entry.outgoingAbort.has(offer.transferId)) return;
      this.emit({ kind: "transfer-error", transferId: offer.transferId, message });
      abortController.abort();
      cleanup();
    };
    channel.onerror = () => failBeforeOpen("data channel error");
    channel.onclose = () => failBeforeOpen("data channel closed before it opened");
  }

  private wireIncomingFileChannel(entry: PeerEntry, channel: RTCDataChannel) {
    const transferId = transferIdFromChannelLabel(channel.label);
    const pending = entry.incoming.get(transferId);

    // Unknown transfer, not yet accepted by the user, or already receiving:
    // refuse the data outright.
    if (!pending || !pending.accepted || entry.incomingTransfer.has(transferId)) {
      channel.close();
      return;
    }

    const reportProgress = throttleProgress((receivedBytes) =>
      this.emit({ kind: "receive-progress", transferId, receivedBytes, totalBytes: pending.size }),
    );

    const transfer = receiveFile(
      channel,
      pending.size,
      pending.mime,
      reportProgress,
      (blob) => {
        entry.incoming.delete(transferId);
        entry.incomingTransfer.delete(transferId);
        this.emit({
          kind: "transfer-complete",
          transferId,
          direction: "receive",
          // null when the data was streamed straight to disk.
          blob: blob ?? undefined,
          name: pending.name,
          mime: pending.mime,
        });
        this.scheduleOrphanRelease(entry);
      },
      (message) => {
        entry.incoming.delete(transferId);
        entry.incomingTransfer.delete(transferId);
        this.emit({ kind: "transfer-error", transferId, message });
        this.scheduleOrphanRelease(entry);
      },
      pending.sink,
    );
    entry.incomingTransfer.set(transferId, transfer);
  }

  // Runs `task` after all previously queued signaling for this peer. Errors are
  // contained so one bad message can't wedge the queue.
  private enqueueSignal(connectionId: string, task: (entry: PeerEntry) => Promise<void>, createIfMissing = true) {
    const entry = createIfMissing ? this.getOrCreatePeer(connectionId) : this.peers.get(connectionId);
    if (!entry) return;
    entry.signalQueue = entry.signalQueue
      .then(() => task(entry))
      .catch((error) => {
        console.warn("signaling error", error);
      });
  }

  private async handleSignal(connectionId: string, entry: PeerEntry, data: RTCSessionDescriptionLike) {
    const { pc } = entry;

    // Perfect negotiation: on collision the impolite side ignores the remote
    // offer; the polite side rolls back (implicitly, via setRemoteDescription).
    const offerCollision = data.type === "offer" && (entry.makingOffer || pc.signalingState !== "stable");
    entry.ignoreOffer = !this.isPolite(connectionId) && offerCollision;
    if (entry.ignoreOffer) return;

    await pc.setRemoteDescription(data as RTCSessionDescriptionInit);

    if (data.type === "offer") {
      await pc.setLocalDescription();
      this.sendSignal({
        type: "signal",
        to: connectionId,
        data: pc.localDescription!.toJSON() as RTCSessionDescriptionLike,
      });
    }
  }

  // Both sides compare the same pair of connection ids, so exactly one of them
  // is polite. Evaluated when needed (not cached) so a reconnect that changes
  // our id can never leave a stale role behind.
  private isPolite(remoteConnectionId: string): boolean {
    return this.localConnectionId !== null && this.localConnectionId > remoteConnectionId;
  }

  private async handleIce(entry: PeerEntry, data: RTCIceCandidateLike) {
    try {
      await entry.pc.addIceCandidate(data as RTCIceCandidateInit);
    } catch (error) {
      // Candidates that belong to an offer we deliberately ignored are
      // expected to fail; anything else is worth knowing about.
      if (!entry.ignoreOffer) console.warn("addIceCandidate failed", error);
    }
  }
}
