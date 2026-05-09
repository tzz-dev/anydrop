import type {
  Device,
  RegisterMessage,
  DeviceListMessage,
  ErrorMessage,
} from 'anydrop-shared';

export type { Device, RegisterMessage, DeviceListMessage, ErrorMessage };

// Client-side overrides: narrow sdp/candidate from `unknown` to proper WebRTC types.
export interface OfferMessage {
  type: 'offer';
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface AnswerMessage {
  type: 'answer';
  from: string;
  to: string;
  sdp: RTCSessionDescriptionInit;
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  from: string;
  to: string;
  candidate: RTCIceCandidateInit;
}

export type ClientMessage = RegisterMessage | OfferMessage | AnswerMessage | IceCandidateMessage;
export type ServerMessage = DeviceListMessage | OfferMessage | AnswerMessage | IceCandidateMessage | ErrorMessage;

export type SignalingHandler = (msg: ServerMessage) => void;
export type DisconnectHandler = () => void;

export class SignalingClient {
  private ws: WebSocket | null = null;
  private handler: SignalingHandler | null = null;
  private onDisconnect: DisconnectHandler | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string;
  private deviceName: string;
  private room: string;
  private shouldReconnect = true;
  private reconnectAttempts = 0;

  private stableId: string;
  private passwordHash: string;
  private create: boolean;
  private exclusive: boolean;

  constructor(url: string, deviceName: string, room: string, passwordHash = '', create = true, exclusive = false) {
    this.url = url;
    this.deviceName = deviceName;
    this.room = room;
    this.passwordHash = passwordHash;
    this.create = create;
    this.exclusive = exclusive;
    this.stableId = SignalingClient.getStableId();
  }

  private static getStableId(): string {
    const key = 'anydrop-stable-id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
      localStorage.setItem(key, id);
    }
    return id;
  }

  connect(handler: SignalingHandler, onDisconnect?: DisconnectHandler) {
    this.handler = handler;
    this.onDisconnect = onDisconnect ?? null;
    this.shouldReconnect = true;
    this._connect();
  }

  private _connect() {
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.send({
        type: 'register',
        name: this.deviceName,
        userAgent: navigator.userAgent,
        stableId: this.stableId,
        room: this.room,
        create: this.create,
        ...(this.passwordHash ? { passwordHash: this.passwordHash } : {}),
        ...(this.exclusive ? { exclusive: true } : {}),
      });
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as ServerMessage;
        // once successfully joined, stop being exclusive so reconnects work normally
        if (msg.type === 'device-list') this.exclusive = false;
        this.handler?.(msg);
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      if (ws !== this.ws) return; // stale handler
      this.onDisconnect?.();
      if (this.shouldReconnect) {
        // Exponential backoff with jitter, capped at 30 s
        const base = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
        const delay = base + Math.random() * 1000;
        this.reconnectAttempts++;
        this.reconnectTimer = setTimeout(() => this._connect(), delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }

  send(msg: ClientMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  disconnect() {
    this.shouldReconnect = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.reconnectAttempts = 0;
  }
}
