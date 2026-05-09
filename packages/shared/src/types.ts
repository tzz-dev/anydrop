/**
 * Wire-format types shared between the signaling server and the client.
 *
 * `sdp` and `candidate` fields are typed as `unknown` here because the server
 * forwards them opaquely without inspecting their contents. The client's
 * signaling.ts re-declares these message types with proper WebRTC types.
 */

export interface Device {
  id: string;
  stableId: string;
  name: string;
  userAgent: string;
  joinedAt: number;
}

export type MessageType =
  | 'register'
  | 'device-list'
  | 'offer'
  | 'answer'
  | 'ice-candidate'
  | 'error';

export interface RegisterMessage {
  type: 'register';
  name: string;
  userAgent: string;
  stableId: string;
  room: string;
  passwordHash?: string;
  /** true = create room if it doesn't exist; false = join only, error if not found */
  create?: boolean;
  /** true = fail if room already exists (client retries with a new code on error.roomExists) */
  exclusive?: boolean;
}

export interface DeviceListMessage {
  type: 'device-list';
  devices: Device[];
  selfId: string;
}

export interface OfferMessage {
  type: 'offer';
  from: string;
  to: string;
  sdp: unknown;
}

export interface AnswerMessage {
  type: 'answer';
  from: string;
  to: string;
  sdp: unknown;
}

export interface IceCandidateMessage {
  type: 'ice-candidate';
  from: string;
  to: string;
  candidate: unknown;
}

export interface ErrorMessage {
  type: 'error';
  message: string;
}

export type ClientMessage =
  | RegisterMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage;

export type ServerMessage =
  | DeviceListMessage
  | OfferMessage
  | AnswerMessage
  | IceCandidateMessage
  | ErrorMessage;
