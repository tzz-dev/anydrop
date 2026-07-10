import { Server, type Connection, type ConnectionContext, type WSMessage } from "partyserver";
import type { ClientSignalMessage, PeerInfo, ServerSignalMessage } from "@anydrop/protocol";
import type { Env } from "./env";
import { clientIp, verifyRoomId } from "./room-id";

interface PeerConnectionState {
  peerId: string;
  displayName: string;
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

    const msg = JSON.parse(message) as ClientSignalMessage;

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
