const DEV_FALLBACK_IP = "dev-local";

// Devices behind the same NAT (a home/office WiFi) share one public IPv4
// address, so hashing it groups them into the same room. IPv6 has no NAT —
// each device can get its own public address — so we truncate to an
// approximate LAN-sized prefix instead. This is a heuristic, not exact.
function normalizeIp(ip: string): string {
  if (ip.includes(":")) {
    return ip.split(":").slice(0, 4).join(":");
  }
  return ip;
}

export async function hashIpToRoomId(ip: string, salt: string): Promise<string> {
  const normalized = normalizeIp(ip || DEV_FALLBACK_IP);
  const bytes = new TextEncoder().encode(`${salt}:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 16);
}

export async function verifyRoomId(ip: string, salt: string, roomId: string): Promise<boolean> {
  return (await hashIpToRoomId(ip, salt)) === roomId;
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip") ?? DEV_FALLBACK_IP;
}
