import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import type { PeerInfo, ServerSignalMessage } from "@anydrop/protocol";
import type { Env } from "./env";
import { parseClientMessage } from "./messages";
import { RateLimiter } from "./rate-limit";
import { clientIp, verifyRoomId } from "./room-id";

interface PeerConnectionState {
  peerId: string;
  displayName: string;
}

// A room is one network's worth of devices; far more than this is abuse.
const MAX_CONNECTIONS_PER_ROOM = 64;
// Signaling is a handful of messages per connection attempt.
const MESSAGE_LIMIT = 100;
const MESSAGE_WINDOW_MS = 10_000;

export class AnydropRoom extends Server<Env> {
  // In-memory only; a reset on eviction just gives the connection a fresh budget.
  private limiters = new Map<string, RateLimiter>();

  async onConnect(connection: Connection<PeerConnectionState>, ctx: ConnectionContext) {
    // Defense in depth: reject anyone who connected straight to a guessed
    // room id instead of going through the Worker's IP-based routing in index.ts.
    const ip = clientIp(ctx.request);
    const isExpectedRoom = await verifyRoomId(ip, this.env.ROOM_SALT, this.name);
    if (!isExpectedRoom) {
      connection.close(4001, "room mismatch");
      return;
    }

    if ([...this.getConnections()].length > MAX_CONNECTIONS_PER_ROOM) {
      connection.close(4002, "room full");
      return;
    }

    const welcome: ServerSignalMessage = {
      type: "welcome",
      connectionId: connection.id,
      roomId: this.name,
    };
    connection.send(JSON.stringify(welcome));
  }

  onMessage(connection: Connection<PeerConnectionState>, message: WSMessage) {
    if (typeof message !== "string") return;

    let limiter = this.limiters.get(connection.id);
    if (!limiter) {
      limiter = new RateLimiter(MESSAGE_LIMIT, MESSAGE_WINDOW_MS);
      this.limiters.set(connection.id, limiter);
    }
    if (!limiter.allow()) {
      connection.close(4008, "rate limit exceeded");
      return;
    }

    const msg = parseClientMessage(message);
    if (!msg) return;

    // Only peers that completed the "hello" handshake may relay signaling.
    if (msg.type !== "hello" && !connection.state) return;

    switch (msg.type) {
      case "hello": {
        connection.setState({ peerId: msg.peerId, displayName: msg.displayName });
        this.broadcastRoster();
        break;
      }
      // Split rather than combined into one "signal" | "ice" branch: building
      // the relayed object from msg.type/msg.data separately loses the
      // discriminated-union pairing, so TS can't verify type and data match.
      case "signal": {
        const target = this.getConnection<PeerConnectionState>(msg.to);
        target?.send(JSON.stringify({ type: "signal", from: connection.id, data: msg.data } satisfies ServerSignalMessage));
        break;
      }
      case "ice": {
        const target = this.getConnection<PeerConnectionState>(msg.to);
        target?.send(JSON.stringify({ type: "ice", from: connection.id, data: msg.data } satisfies ServerSignalMessage));
        break;
      }
    }
  }

  onClose(connection: Connection) {
    this.limiters.delete(connection.id);
    this.broadcastRoster();
  }

  private broadcastRoster() {
    const peers: PeerInfo[] = [];
    for (const connection of this.getConnections<PeerConnectionState>()) {
      if (!connection.state) continue;
      peers.push({
        connectionId: connection.id,
        peerId: connection.state.peerId,
        displayName: connection.state.displayName,
      });
    }
    const msg: ServerSignalMessage = { type: "roster", peers };
    this.broadcast(JSON.stringify(msg));
  }
}
