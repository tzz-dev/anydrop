# anydrop

AirDrop-style file and text sharing between devices on the same network, in the browser.
Files and text go directly between devices over WebRTC; a small signaling server only
helps them find each other and set up the connection.

## How it works

- **Rooms are derived from the public IP.** The signaling Worker hashes the caller's IP
  (IPv6: the /64 prefix) with a secret salt to pick a Durable Object room, so devices behind
  the same router meet automatically. This is a heuristic: devices behind CGNAT, a corporate
  proxy or a VPN may share a room with strangers.
- **Signaling** (`apps/worker`): Cloudflare Worker + Durable Object (`partyserver`) relaying
  WebRTC offers/answers/ICE candidates over WebSocket.
- **Transfers** (`apps/web`): a per-peer `control` data channel carries offers/accept/cancel
  and text; every file uses its own `file:<id>` data channel and is only received after the
  user accepts it.

## Layout

| Path | What |
| --- | --- |
| `apps/web` | Next.js frontend (UI, WebRTC peer manager) |
| `apps/worker` | Cloudflare Worker signaling server |
| `packages/protocol` | Message types shared by both |

## Development

```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local        # defaults work for local dev
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
pnpm dev          # web on :3000, worker on :8787
pnpm typecheck
pnpm test
```

Open the page in two tabs (each tab is its own device) to try it out.

## Configuration

**Web** (`apps/web/.env.local`, inlined at build time):

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_SIGNAL_URL` | `ws(s)://` base URL of the deployed Worker. **Required for production builds.** |
| `NEXT_PUBLIC_ICE_SERVERS` | Optional JSON array of `RTCIceServer`; set it to add a TURN server. |
| `NEXT_PUBLIC_GA_ID` | Optional Google Analytics 4 measurement ID. |

**Worker:**

| Name | Description |
| --- | --- |
| `ROOM_SALT` | Secret used to hash IPs into room ids. Locally: `apps/worker/.dev.vars`. In production: `wrangler secret put ROOM_SALT`. The Worker refuses requests (HTTP 500) if it is missing. |

## Deployment

```bash
# Signaling Worker
cd apps/worker
pnpm wrangler secret put ROOM_SALT
pnpm deploy

# Web: deploy apps/web to any Next.js host with NEXT_PUBLIC_SIGNAL_URL set to the
# deployed Worker's wss:// URL.
```

## Known limitations

- Received files are assembled in memory, so very large files can exhaust browser memory.
- Text messages are delivered without a confirmation prompt, and device names are
  self-reported, so anyone sharing your room can send you text and pick any name.
- Without a TURN server, some networks (e.g. symmetric NAT) can't establish a direct connection.
