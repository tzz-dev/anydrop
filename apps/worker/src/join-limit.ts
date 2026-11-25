import { clientIp, normalizeIp } from "./room-id";

// Private-room connections per client network per rate-limit period. Normal
// use (join, a few reconnects) stays far below this; guessing codes does not.
export const JOIN_LIMIT = 20;

// Whether this request may try to join a private room. Only requests that
// carry a `?room=` code count, so the nearby (IP-derived) room is unaffected.
// Without a limiter binding (local dev, tests) everything is allowed.
export async function allowJoin(request: Request, limiter: RateLimit | undefined): Promise<boolean> {
  if (!limiter || !new URL(request.url).searchParams.has("room")) return true;
  const { success } = await limiter.limit({ key: `join:${normalizeIp(clientIp(request))}` });
  return success;
}
