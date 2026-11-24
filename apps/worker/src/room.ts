import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import type { PeerInfo, ServerSignalMessage } from "@anydrop/protocol";
import type { Env } from "./env";
import { parseClientMessage } from "./messages";
import { RateLimiter } from "./rate-limit";
import { verifyRoomId } from "./room-id";

interface PeerConnectionState {
  peerId: string;
  displayName: string;
}

// A room is one network's worth of devices; far more than this is abuse.
const MAX_CONNECTIONS_PER_ROOM = 64;
// Signaling is a handful of messages per connection attempt.
const MESSAGE_LIMIT = 100;
const MESSAGE_WINDOW_MS = 10_000;

// Clients ping every ~20s and the runtime answers "ping" with "pong" without
// waking the object. A connection that pinged before but has been silent this
// long is dead (e.g. a phone that lost network without closing the socket).
export const HEARTBEAT_PING = "ping";
export const HEARTBEAT_PONG = "pong";
const STALE_AFTER_MS = 60_000;
const SWEEP_INTERVAL_MS = 30_000;

export class AnydropRoom extends Server<Env> {
  // Let the object hibernate while connections sit idle; connection state
  // (peerId/displayName) lives in the socket attachment and survives that.
  static options = { hibernate: true };

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(HEARTBEAT_PING, HEARTBEAT_PONG));
  }

  // In-memory only; a reset on eviction just gives the connection a fresh budget.
  private limiters = new Map<string, RateLimiter>();

  async onConnect(connection: Connection<PeerConnectionState>, ctx: ConnectionContext) {
    // Defense in depth: reject anyone who connected straight to a guessed
    // room id instead of going through the Worker's routing in index.ts.
    const isExpectedRoom = await verifyRoomId(ctx.request, this.env.ROOM_SALT, this.name);
    if (!isExpectedRoom) {
      connection.close(4001, "room mismatch");
      return;
    }

    if ([...this.getConnections()].length > MAX_CONNECTIONS_PER_ROOM) {
      connection.close(4002, "room full");
      return;
    }

    await this.scheduleSweep();

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

  // Drops connections whose heartbeat stopped, so ghost devices disappear
  // from everyone's list. Connections that never pinged (older clients) are
  // left alone.
  async onAlarm() {
    const now = Date.now();
    const dropped = new Set<string>();
    for (const ws of this.ctx.getWebSockets()) {
      const last = this.ctx.getWebSocketAutoResponseTimestamp(ws);
      if (!last || now - last.getTime() <= STALE_AFTER_MS) continue;
      const connection = this.getConnection<PeerConnectionState>(
        (ws.deserializeAttachment() as { __pk?: { id?: string } } | null)?.__pk?.id ?? "",
      );
      if (connection) dropped.add(connection.id);
      try {
        ws.close(4003, "heartbeat timeout");
      } catch {
        // already closing
      }
    }
    if (dropped.size > 0) this.broadcastRoster(dropped);
    if (this.ctx.getWebSockets().length > dropped.size) await this.scheduleSweep();
  }

  private async scheduleSweep() {
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(Date.now() + SWEEP_INTERVAL_MS);
    }
  }

  private broadcastRoster(exclude: ReadonlySet<string> = new Set()) {
    const peers: PeerInfo[] = [];
    for (const connection of this.getConnections<PeerConnectionState>()) {
      if (!connection.state || exclude.has(connection.id)) continue;
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
