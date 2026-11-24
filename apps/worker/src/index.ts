import { getServerByName } from "partyserver";
import type { Env } from "./env";
import { isOriginAllowed } from "./origin";
import { resolveRoomId } from "./room-id";

export { AnydropRoom } from "./room";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Fail loudly instead of silently hashing with salt "undefined" when the
    // secret was never provisioned (`wrangler secret put ROOM_SALT`).
    if (!env.ROOM_SALT) {
      console.error("ROOM_SALT is not configured");
      return new Response("Server misconfigured", { status: 500 });
    }

    const url = new URL(request.url);
    if (url.pathname !== "/connect") {
      return new Response("Not Found", { status: 404 });
    }

    if (!isOriginAllowed(request.headers.get("Origin"), env.ALLOWED_ORIGINS)) {
      return new Response("Forbidden", { status: 403 });
    }

    // The room is always derived server-side: from the secret `?room=` code of
    // a private room, or otherwise from the caller's IP, so same-network
    // devices meet in the same Durable Object without any pairing step.
    const roomId = await resolveRoomId(request, env.ROOM_SALT);
    if (!roomId) return new Response("Invalid room code", { status: 400 });
    const stub = await getServerByName(env.ANYDROP_ROOM, roomId);
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
