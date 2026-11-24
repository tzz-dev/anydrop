// Private rooms: devices that share a secret code meet in the same signaling
// room regardless of network, and stay out of the shared "nearby" room.
// The code lives in the URL fragment (#room=CODE), which browsers never send
// to any server, and is passed to the signaling Worker only when connecting.

// No 0/O/1/I so codes survive being read aloud or typed from a screenshot.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 10; // 32^10 = 2^50 combinations
const CODE_PATTERN = /^[A-Z0-9]{8,32}$/;
const HASH_PREFIX = "#room=";

export function generateRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  // 256 is a multiple of 32, so masking keeps the distribution uniform.
  return Array.from(bytes, (byte) => ALPHABET[byte & 31]).join("");
}

// Accepts what people actually type or paste: any case, with spaces or dashes.
export function normalizeRoomCode(input: string): string | null {
  const code = input.toUpperCase().replace(/[\s-]/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

export function parseRoomHash(hash: string): string | null {
  return hash.startsWith(HASH_PREFIX) ? normalizeRoomCode(decodeURIComponent(hash.slice(HASH_PREFIX.length))) : null;
}

export function buildRoomLink(origin: string, code: string): string {
  return `${origin}/${HASH_PREFIX}${code}`;
}

export function formatRoomCode(code: string): string {
  return code.replace(/(.{5})(?=.)/g, "$1-");
}

// --- URL-backed store (for useSyncExternalStore) ---------------------------

const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeRoomCode(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("hashchange", notify);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("hashchange", notify);
  };
}

export function getRoomCode(): string | null {
  try {
    return parseRoomHash(window.location.hash);
  } catch {
    return null;
  }
}

// Joins the private room with this code, or leaves to the nearby room for null.
export function setRoomCode(code: string | null): void {
  const url = code ? `${window.location.pathname}${window.location.search}${HASH_PREFIX}${code}` : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
  notify();
}
