// All wire-format types are defined in the shared package and re-exported here.
// Edit packages/shared/src/types.ts to change the protocol schema.
export type {
  Device,
  MessageType,
  RegisterMessage,
  DeviceListMessage,
  OfferMessage,
  AnswerMessage,
  IceCandidateMessage,
  ErrorMessage,
  ClientMessage,
  ServerMessage,
} from 'anydrop-shared';
