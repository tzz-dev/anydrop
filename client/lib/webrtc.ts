import type { SignalingClient } from './signaling';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
  ],
};

const CHUNK_SIZE = 64 * 1024; // 64 KB per chunk
const CHANNEL_OPEN_TIMEOUT = 30_000; // 30 s
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 GB

export interface TransferProgress {
  fileName: string;
  fileSize: number;
  transferred: number;
  direction: 'send' | 'receive';
  peerId: string;
}

export interface IncomingFile {
  name: string;
  size: number;
  type: string;
  chunks: ArrayBuffer[];
  received: number;
}

export type OnProgressCallback = (progress: TransferProgress) => void;
export type OnFileReceivedCallback = (file: File) => void;
export type OnErrorCallback = (error: string) => void;
export type OnTextReceivedCallback = (peerId: string, text: string) => void;

const MAX_TEXT_SIZE = 10_000;

export class PeerConnection {
  private pc: RTCPeerConnection;
  private dc: RTCDataChannel | null = null;
  private signaling: SignalingClient;
  private peerId: string;
  private selfId: string;
  private onProgress: OnProgressCallback;
  private onFileReceived: OnFileReceivedCallback;
  private onError: OnErrorCallback;
  private onTextReceived: OnTextReceivedCallback;
  private incoming: IncomingFile | null = null;
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private hasRemoteDescription = false;
  private channelOpenResolvers: Array<{ resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }> = [];
  // intentional-close flag — prevents dc.onclose from reporting a spurious error
  private intentionalClose = false;
  // perfect negotiation — prevents offer collision
  private makingOffer = false;
  private readonly polite: boolean;

  constructor(opts: {
    signaling: SignalingClient;
    peerId: string;
    selfId: string;
    onProgress: OnProgressCallback;
    onFileReceived: OnFileReceivedCallback;
    onError: OnErrorCallback;
    onTextReceived: OnTextReceivedCallback;
  }) {
    this.signaling = opts.signaling;
    this.peerId = opts.peerId;
    this.selfId = opts.selfId;
    this.onProgress = opts.onProgress;
    this.onFileReceived = opts.onFileReceived;
    this.onError = opts.onError;
    this.onTextReceived = opts.onTextReceived;
    // the peer with the smaller selfId is polite and rolls back on collision
    this.polite = opts.selfId < opts.peerId;

    this.pc = new RTCPeerConnection(RTC_CONFIG);

    this.pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        this.signaling.send({
          type: 'ice-candidate',
          to: this.peerId,
          from: this.selfId,
          candidate: candidate.toJSON(),
        });
      }
    };

    this.pc.ondatachannel = (event) => {
      this._setupDataChannel(event.channel);
    };
  }

  private _setupDataChannel(dc: RTCDataChannel) {
    this.dc = dc;
    dc.binaryType = 'arraybuffer';
    dc.bufferedAmountLowThreshold = 8 * 1024 * 1024;

    dc.onopen = () => {
      this.channelOpenResolvers.forEach(({ resolve }) => resolve());
      this.channelOpenResolvers = [];
    };

    dc.onclose = () => {
      // stale channel (replaced after polite peer rollback) — ignore
      if (dc !== this.dc) return;
      if (!this.intentionalClose) this.onError('error.channel');
    };

    dc.onmessage = (event) => {
      if (typeof event.data === 'string') {
        try {
          const parsed = JSON.parse(event.data) as {
            kind?: string; text?: string;
            name?: string; size?: number; type?: string;
          };
          if (parsed.kind === 'message') {
            if (typeof parsed.text === 'string' && parsed.text.length > 0 && parsed.text.length <= MAX_TEXT_SIZE) {
              this.onTextReceived(this.peerId, parsed.text);
            }
            return;
          }
          if (parsed.kind === 'cancel') {
            this.incoming = null;
            return;
          }
          // file metadata (kind === 'file' or legacy without kind)
          const meta = parsed as { name: string; size: number; type: string };
          if (
            typeof meta.name !== 'string' || meta.name.length > 255 ||
            typeof meta.size !== 'number' || meta.size < 0 ||
            !isFinite(meta.size) || meta.size > MAX_FILE_SIZE ||
            typeof meta.type !== 'string'
          ) return;
          this.incoming = { ...meta, chunks: [], received: 0 };
        } catch {
          return;
        }
      } else {
        if (!this.incoming) return;
        this.incoming.chunks.push(event.data as ArrayBuffer);
        this.incoming.received += (event.data as ArrayBuffer).byteLength;

        this.onProgress({
          fileName: this.incoming.name,
          fileSize: this.incoming.size,
          transferred: this.incoming.received,
          direction: 'receive',
          peerId: this.peerId,
        });

        if (this.incoming.received >= this.incoming.size) {
          const blob = new Blob(this.incoming.chunks, { type: this.incoming.type });
          const file = new File([blob], this.incoming.name, { type: this.incoming.type });
          this.onFileReceived(file);
          this.incoming = null;
        }
      }
    };

    dc.onerror = () => {
      if (!this.intentionalClose) this.onError('error.channel');
    };
  }

  private waitForChannelOpen(): Promise<void> {
    if (this.dc?.readyState === 'open') return Promise.resolve();
    return new Promise((resolve, reject) => {
      const entry: { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } = {
        resolve: () => { clearTimeout(entry.timer); resolve(); },
        reject,
        timer: setTimeout(() => {
          const idx = this.channelOpenResolvers.indexOf(entry);
          if (idx !== -1) this.channelOpenResolvers.splice(idx, 1);
          reject(new Error('error.channelTimeout'));
        }, CHANNEL_OPEN_TIMEOUT),
      };
      this.channelOpenResolvers.push(entry);
    });
  }

  private async flushPendingCandidates() {
    for (const candidate of this.pendingCandidates) {
      await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
    this.pendingCandidates = [];
  }

  async initiate() {
    const dc = this.pc.createDataChannel('file-transfer');
    this._setupDataChannel(dc);

    try {
      this.makingOffer = true;
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.signaling.send({
        type: 'offer',
        to: this.peerId,
        from: this.selfId,
        sdp: this.pc.localDescription!,
      });
    } finally {
      this.makingOffer = false;
    }
  }

  async handleOffer(sdp: RTCSessionDescriptionInit) {
    const offerCollision = this.makingOffer || this.pc.signalingState !== 'stable';
    // perfect negotiation: impolite peer ignores incoming offer on collision
    if (offerCollision && !this.polite) return;
    // polite peer rolls back its own offer and accepts the incoming one
    if (offerCollision) {
      await this.pc.setLocalDescription({ type: 'rollback' });
    }

    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDescription = true;
    await this.flushPendingCandidates();

    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);

    this.signaling.send({
      type: 'answer',
      to: this.peerId,
      from: this.selfId,
      sdp: this.pc.localDescription!,
    });
  }

  async handleAnswer(sdp: RTCSessionDescriptionInit) {
    await this.pc.setRemoteDescription(new RTCSessionDescription(sdp));
    this.hasRemoteDescription = true;
    await this.flushPendingCandidates();
  }

  async handleIceCandidate(candidate: RTCIceCandidateInit) {
    if (!this.hasRemoteDescription) {
      this.pendingCandidates.push(candidate);
      return;
    }
    await this.pc.addIceCandidate(new RTCIceCandidate(candidate));
  }

  async sendFile(file: File, signal?: AbortSignal) {
    try {
      await this.waitForChannelOpen();
    } catch (e) {
      if (!this.intentionalClose) this.onError((e as Error).message);
      return;
    }

    if (signal?.aborted) return;

    const dc = this.dc!;
    dc.send(JSON.stringify({ kind: 'file', name: file.name, size: file.size, type: file.type }));

    let offset = 0;
    while (offset < file.size) {
      if (dc.readyState !== 'open') return;
      if (signal?.aborted) {
        dc.send(JSON.stringify({ kind: 'cancel' }));
        return;
      }

      if (dc.bufferedAmount > 16 * 1024 * 1024) {
        await new Promise<void>((resolve) => {
          const cleanup = () => {
            dc.removeEventListener('close', onClose);
            dc.onbufferedamountlow = null;
            signal?.removeEventListener('abort', onAbort);
          };
          const onClose = () => { cleanup(); resolve(); };
          const onAbort = () => { cleanup(); resolve(); };
          dc.addEventListener('close', onClose, { once: true });
          dc.onbufferedamountlow = () => { cleanup(); resolve(); };
          signal?.addEventListener('abort', onAbort, { once: true });
        });
        continue;
      }

      const chunk = await file.slice(offset, offset + CHUNK_SIZE).arrayBuffer();
      if (dc.readyState !== 'open') return;
      if (signal?.aborted) {
        dc.send(JSON.stringify({ kind: 'cancel' }));
        return;
      }

      dc.send(chunk);
      offset += chunk.byteLength;

      this.onProgress({
        fileName: file.name,
        fileSize: file.size,
        transferred: offset,
        direction: 'send',
        peerId: this.peerId,
      });
    }
  }

  async sendMessage(text: string) {
    if (!text || text.length > MAX_TEXT_SIZE) return;
    try {
      await this.waitForChannelOpen();
    } catch {
      return;
    }
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify({ kind: 'message', text }));
    }
  }

  close() {
    this.intentionalClose = true;
    this.channelOpenResolvers.forEach(({ reject, timer }) => { clearTimeout(timer); reject(new Error('error.channel')); });
    this.channelOpenResolvers = [];
    this.dc?.close();
    this.pc.close();
  }
}
