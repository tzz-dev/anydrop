import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import type { ClientSignalMessage, PeerInfo, ServerSignalMessage } from "@anydrop/protocol";
import type { Env } from "./env";
import { clientIp, verifyRoomId } from "./room-id";

interface PeerConnectionState {
  peerId: string;
  displayName: string;
}

// Signaling messages (SDP, ICE) are a few KB at most; anything bigger is
// either a bug or abuse.
const MAX_MESSAGE_CHARS = 64 * 1024;

const SDP_TYPES = new Set(["offer", "answer", "pranswer", "rollback"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Parses and shape-checks an untrusted client message. Returns null for
// anything malformed instead of throwing, so one bad client can't spam the
// Durable Object with exceptions.
function parseClientMessage(raw: string): ClientSignalMessage | null {
  if (raw.length > MAX_MESSAGE_CHARS) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "hello":
      if (typeof value.peerId !== "string" || typeof value.displayName !== "string") return null;
      return { type: "hello", peerId: value.peerId, displayName: value.displayName };

    case "signal": {
      const data = value.data;
      if (typeof value.to !== "string" || !isRecord(data)) return null;
      if (typeof data.type !== "string" || !SDP_TYPES.has(data.type)) return null;
      if (data.sdp !== undefined && typeof data.sdp !== "string") return null;
      return value as ClientSignalMessage;
    }

    case "ice": {
      const data = value.data;
      if (typeof value.to !== "string" || !isRecord(data)) return null;
      if (typeof data.candidate !== "string") return null;
      return value as ClientSignalMessage;
    }

    default:
      return null;
  }
}

export class AnydropRoom extends Server<Env> {
  async onConnect(connection: Connection<PeerConnectionState>, ctx: ConnectionContext) {
    // Defense in depth: reject anyone who connected straight to a guessed
    // room id instead of going through the Worker's IP-based routing in index.ts.
    const ip = clientIp(ctx.request);
    const isExpectedRoom = await verifyRoomId(ip, this.env.ROOM_SALT, this.name);
    if (!isExpectedRoom) {
      connection.close(4001, "room mismatch");
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

  onClose() {
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
