import type { ClientSignalMessage } from "@anydrop/protocol";

// Signaling messages (SDP, ICE) are a few KB at most; anything bigger is
// either a bug or abuse.
export const MAX_MESSAGE_CHARS = 64 * 1024;

const MAX_ID_CHARS = 64;
const MAX_DISPLAY_NAME_CHARS = 32;

// Names are shown to every device in the room, so strip control/bidi
// characters and cap the length. Returns null if nothing printable is left.
export function sanitizeDisplayName(name: string): string | null {
  const cleaned = name
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
  const limited = Array.from(cleaned).slice(0, MAX_DISPLAY_NAME_CHARS).join("").trim();
  return limited === "" ? null : limited;
}

const SDP_TYPES = new Set(["offer", "answer", "pranswer", "rollback"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Parses and shape-checks an untrusted client message. Returns null for
// anything malformed instead of throwing, so one bad client can't spam the
// Durable Object with exceptions.
export function parseClientMessage(raw: string): ClientSignalMessage | null {
  if (raw.length > MAX_MESSAGE_CHARS) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "hello":
      if (typeof value.peerId !== "string" || typeof value.displayName !== "string") return null;
      if (value.peerId === "" || value.peerId.length > MAX_ID_CHARS) return null;
      const displayName = sanitizeDisplayName(value.displayName);
      if (!displayName) return null;
      return { type: "hello", peerId: value.peerId, displayName };

    case "signal": {
      const data = value.data;
      if (typeof value.to !== "string" || value.to.length > MAX_ID_CHARS || !isRecord(data)) return null;
      if (typeof data.type !== "string" || !SDP_TYPES.has(data.type)) return null;
      if (data.sdp !== undefined && typeof data.sdp !== "string") return null;
      return value as ClientSignalMessage;
    }

    case "ice": {
      const data = value.data;
      if (typeof value.to !== "string" || value.to.length > MAX_ID_CHARS || !isRecord(data)) return null;
      if (typeof data.candidate !== "string") return null;
      return value as ClientSignalMessage;
    }

    default:
      return null;
  }
}
