import type { ControlMessage } from "@anydrop/protocol";

const MAX_TEXT_LENGTH = 100_000;
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
