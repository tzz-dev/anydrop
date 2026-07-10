// WebRTC session description / ICE candidate shapes, redefined locally so this
// package has no dependency on DOM lib types (it's consumed from both a browser
// and a Cloudflare Workers runtime).
export interface RTCSessionDescriptionLike {
  type: "offer" | "answer" | "pranswer" | "rollback";
  sdp?: string;
}

export interface RTCIceCandidateLike {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

export interface PeerInfo {
  connectionId: string;
  peerId: string;
  displayName: string;
}

// Messages sent from a browser client to the signaling Worker over WebSocket.
export type ClientSignalMessage =
  | { type: "hello"; peerId: string; displayName: string }
  | { type: "signal"; to: string; data: RTCSessionDescriptionLike }
  | { type: "ice"; to: string; data: RTCIceCandidateLike };

// Messages sent from the signaling Worker to a browser client.
export type ServerSignalMessage =
  | { type: "welcome"; connectionId: string; roomId: string }
  | { type: "roster"; peers: PeerInfo[] }
  | { type: "signal"; from: string; data: RTCSessionDescriptionLike }
  | { type: "ice"; from: string; data: RTCIceCandidateLike };

// JSON control messages exchanged over the per-peer "control" RTCDataChannel.
export type ControlMessage =
  | { type: "file-offer"; transferId: string; name: string; size: number; mime: string }
  | { type: "file-accept"; transferId: string }
  | { type: "file-reject"; transferId: string }
  | { type: "file-cancel"; transferId: string }
  | { type: "text"; text: string; textId: string };

export const CONTROL_CHANNEL_LABEL = "control";
export const FILE_CHANNEL_PREFIX = "file:";

export function fileChannelLabel(transferId: string): string {
  return `${FILE_CHANNEL_PREFIX}${transferId}`;
}

export function isFileChannelLabel(label: string): boolean {
  return label.startsWith(FILE_CHANNEL_PREFIX);
}

export function transferIdFromChannelLabel(label: string): string {
  return label.slice(FILE_CHANNEL_PREFIX.length);
}
