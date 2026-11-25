const DEV_FALLBACK_IP = "dev-local";

// Expands any textual IPv6 form (including "::" compression and an embedded
// IPv4 tail) into exactly 8 numeric hextets, or null if it isn't valid IPv6.
function expandIPv6(ip: string): number[] | null {
  let addr = ip.split("%")[0]; // strip zone id, e.g. fe80::1%en0

  // Embedded IPv4 tail (::ffff:1.2.3.4) -> two hextets.
  const lastColon = addr.lastIndexOf(":");
  const tail = addr.slice(lastColon + 1);
  if (tail.includes(".")) {
    const octets = tail.split(".").map(Number);
    if (octets.length !== 4 || octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)) return null;
    const hi = ((octets[0] << 8) | octets[1]).toString(16);
    const lo = ((octets[2] << 8) | octets[3]).toString(16);
    addr = `${addr.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;

  const parse = (part: string): number[] | null => {
    if (part === "") return [];
    const groups = part.split(":");
    const out: number[] = [];
    for (const g of groups) {
      if (!/^[0-9a-fA-F]{1,4}$/.test(g)) return null;
      out.push(parseInt(g, 16));
    }
    return out;
  };

  const head = parse(halves[0]);
  const rest = halves.length === 2 ? parse(halves[1]) : [];
  if (!head || !rest) return null;

  if (halves.length === 1) return head.length === 8 ? head : null;

  const missing = 8 - head.length - rest.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...rest];
}

// Devices behind the same NAT (a home/office WiFi) share one public IPv4
// address, so hashing it groups them into the same room. IPv6 has no NAT —
// each device can get its own public address — so we use the /64 prefix as
// an approximate LAN-sized group. IPv4-mapped IPv6 addresses collapse to
// their IPv4 form. This is a heuristic, not exact.
export function normalizeIp(ip: string): string {
  if (!ip.includes(":")) return ip;

  const groups = expandIPv6(ip);
  if (!groups) return ip;

  const isV4Mapped =
    groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
  if (isV4Mapped) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join(".");
  }

  return groups
    .slice(0, 4)
    .map((g) => g.toString(16))
    .join(":");
}

export async function hashIpToRoomId(ip: string, salt: string): Promise<string> {
  const normalized = normalizeIp(ip || DEV_FALLBACK_IP);
  return sha256Hex16(`${salt}:${normalized}`);
}

// Private rooms are joined with a secret code instead of a shared network.
// Clients generate 8+ random characters; the strict format keeps junk (and
// anything that could be confused with an IP-derived room) out.
const ROOM_CODE_PATTERN = /^[A-Z0-9]{8,32}$/;

export function isValidRoomCode(code: string): boolean {
  return ROOM_CODE_PATTERN.test(code);
}

async function sha256Hex16(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function hashRoomCode(code: string, salt: string): Promise<string> {
  return sha256Hex16(`${salt}:code:${code}`);
}

// Picks the room for a connection: the private room named by `?room=CODE`, or
// the network room derived from the caller's IP. A malformed code is an error
// rather than a silent fallback, so nobody lands in the shared network room
// believing they are in a private one.
export async function resolveRoomId(request: Request, salt: string): Promise<string | null> {
  const code = new URL(request.url).searchParams.get("room");
  if (code === null) return hashIpToRoomId(clientIp(request), salt);
  if (!isValidRoomCode(code)) return null;
  return hashRoomCode(code, salt);
}

export async function verifyRoomId(request: Request, salt: string, roomId: string): Promise<boolean> {
  return (await resolveRoomId(request, salt)) === roomId;
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? DEV_FALLBACK_IP;
}
