import { getServerByName } from "partyserver";
import type { Env } from "./env";
import { clientIp, hashIpToRoomId } from "./room-id";

export { AnydropRoom } from "./room";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/connect") {
      return new Response("Not Found", { status: 404 });
    }

    // Ignore any room name the client put in the URL — the room is always
    // derived server-side from the caller's IP, so same-network devices are
    // routed to the same Durable Object without a manual pairing step.
    const roomId = await hashIpToRoomId(clientIp(request), env.ROOM_SALT);
    const stub = await getServerByName(env.ANYDROP_ROOM, roomId);
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;
