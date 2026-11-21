// ALLOWED_ORIGINS is an optional comma-separated list of exact origins
// (e.g. "https://anydrop.example.com"). When unset, any origin is accepted;
// when set, requests must carry a matching Origin header, which blocks other
// websites from opening signaling sockets from visitors' browsers.
export function isOriginAllowed(origin: string | null, allowed: string | undefined): boolean {
  const list = (allowed ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (list.length === 0) return true;
  return origin !== null && list.includes(origin);
}
