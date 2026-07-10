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
    peerId: crypto.randomUUID(),
    displayName: `${randomFrom(ADJECTIVES)} ${randomFrom(NOUNS)}`,
  };
}

// Cached after the first read so repeated calls return the same object
// reference — required for safe use as a useSyncExternalStore snapshot.
let cached: Identity | null = null;

// Per-tab identity, not per-device: multiple tabs on one machine intentionally
// show up as separate peers, which is convenient for local testing.
export function getIdentity(): Identity {
  if (cached) return cached;

  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      cached = JSON.parse(stored) as Identity;
      return cached;
    } catch {
      // fall through and regenerate a fresh identity
    }
  }

  cached = generateIdentity();
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  return cached;
}
