import { randomId } from "./id";

const STORAGE_KEY = "anydrop:identity";

export interface Identity {
  peerId: string;
  displayName: string;
}

const ADJECTIVES = [
  "Swift", "Quiet", "Bright", "Amber", "Cosmic", "Lucky", "Gentle", "Bold",
  "Curious", "Silver", "Rapid", "Mellow", "Vivid", "Nimble", "Sunny",
];

const NOUNS = [
  "Fox", "Otter", "Falcon", "Panda", "Comet", "Maple", "Willow", "Lynx",
  "Sparrow", "Cedar", "Dolphin", "Heron", "Badger", "Aspen", "Wren",
];

function randomFrom<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function generateIdentity(): Identity {
  return {
    peerId: randomId(),
    displayName: `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`,
  };
}

function isIdentity(value: unknown): value is Identity {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.peerId === "string" && v.peerId.length > 0 && typeof v.displayName === "string" && v.displayName.length > 0;
}

// Cached after the first read so repeated calls return the same object
// reference — required for safe use as a useSyncExternalStore snapshot.
let cached: Identity | null = null;

// Per-tab identity, not per-device: multiple tabs on one machine intentionally
// show up as separate peers, which is convenient for local testing.
// sessionStorage can throw (privacy modes, blocked storage), so it is strictly
// best-effort: without it the identity just lives in memory for this page load.
export function getIdentity(): Identity {
  if (cached) return cached;

  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: unknown = JSON.parse(stored);
      if (isIdentity(parsed)) {
        cached = { peerId: parsed.peerId, displayName: parsed.displayName };
        return cached;
      }
    }
  } catch {
    // fall through and regenerate a fresh identity
  }

  cached = generateIdentity();
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // ignore: identity stays in memory only
  }
  return cached;
}

export const MAX_DISPLAY_NAME_LENGTH = 32;

const listeners = new Set<() => void>();

export function subscribeIdentity(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Returns the new name, or null if it was empty after trimming.
export function renameIdentity(name: string): string | null {
  const next = Array.from(name.replace(/\s+/g, " ").trim()).slice(0, MAX_DISPLAY_NAME_LENGTH).join("");
  if (!next) return null;
  const current = getIdentity();
  if (current.displayName === next) return next;

  cached = { peerId: current.peerId, displayName: next };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  } catch {
    // best-effort, like the initial save
  }
  for (const listener of listeners) listener();
  return next;
}
