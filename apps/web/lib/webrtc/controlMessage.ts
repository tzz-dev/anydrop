import type { ControlMessage } from "@anydrop/protocol";

const MAX_TEXT_LENGTH = 100_000;

// Browsers differ in the largest single data channel message they accept
// (RTCSctpTransport.maxMessageSize; Chrome and Safari use 256 KiB). Stay under
// the negotiated value, never above 256 KiB, and assume a conservative size
// when the browser doesn't report one.
const DEFAULT_MAX_MESSAGE_BYTES = 64 * 1024;
const HARD_MAX_MESSAGE_BYTES = 256 * 1024;

export class MessageTooLargeError extends Error {
  constructor() {
    super("message too large for the data channel");
    this.name = "MessageTooLargeError";
  }
}

export function maxMessageBytes(pc: { sctp?: { maxMessageSize?: number } | null }): number {
  const reported = pc.sctp?.maxMessageSize;
  const negotiated = typeof reported === "number" && reported > 0 ? reported : DEFAULT_MAX_MESSAGE_BYTES;
  return Math.min(negotiated, HARD_MAX_MESSAGE_BYTES);
}

// Throws if the UTF-8 encoded message would exceed the limit.
export function assertFitsMessageLimit(json: string, limitBytes: number): void {
  if (new TextEncoder().encode(json).length > limitBytes) throw new MessageTooLargeError();
}
const MAX_NAME_LENGTH = 255;
const MAX_ID_LENGTH = 64;

function isShortString(value: unknown, max: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

// Peer-supplied file names are display/download hints only; strip anything
// that looks like a path so it can't smuggle directories into a save dialog.
function sanitizeFileName(name: string): string {
  const base = name.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(0, MAX_NAME_LENGTH);
  return base || "download";
}

// Validates an untrusted control message. Returns null if malformed.
export function parseControlMessage(raw: unknown): ControlMessage | null {
  if (typeof raw !== "string") return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  const msg = value as Record<string, unknown>;

  switch (msg.type) {
    case "file-offer":
      if (
        !isShortString(msg.transferId, MAX_ID_LENGTH) ||
        typeof msg.name !== "string" ||
        typeof msg.mime !== "string" ||
        typeof msg.size !== "number" ||
        !Number.isSafeInteger(msg.size) ||
        msg.size < 0
      ) {
        return null;
      }
      return {
        type: "file-offer",
        transferId: msg.transferId,
        name: sanitizeFileName(msg.name),
        size: msg.size,
        mime: msg.mime.slice(0, 255),
      };
    case "file-accept":
      if (!isShortString(msg.transferId, MAX_ID_LENGTH)) return null;
      return msg.acks === true
        ? { type: "file-accept", transferId: msg.transferId, acks: true }
        : { type: "file-accept", transferId: msg.transferId };
    case "file-reject":
    case "file-cancel":
      if (!isShortString(msg.transferId, MAX_ID_LENGTH)) return null;
      return { type: msg.type, transferId: msg.transferId };
    case "text":
      if (typeof msg.text !== "string" || msg.text.length > MAX_TEXT_LENGTH) return null;
      if (!isShortString(msg.textId, MAX_ID_LENGTH)) return null;
      return { type: "text", text: msg.text, textId: msg.textId };
    default:
      return null;
  }
}
