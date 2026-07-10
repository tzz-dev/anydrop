"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { WebSocket as ReconnectingWebSocket } from "partysocket";
import type { ClientSignalMessage, PeerInfo, ServerSignalMessage } from "@anydrop/protocol";
import type { Identity } from "./identity";

type ServerMessageListener = (msg: ServerSignalMessage) => void;

export interface RoomHandle {
  connectionId: string | null;
  peers: PeerInfo[];
  send: (msg: ClientSignalMessage) => void;
  onMessage: (listener: ServerMessageListener) => () => void;
}

const SIGNAL_URL = process.env.NEXT_PUBLIC_SIGNAL_URL ?? "ws://127.0.0.1:8787";

export function useRoom(identity: Identity | null): RoomHandle {
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [peers, setPeers] = useState<PeerInfo[]>([]);
  const socketRef = useRef<ReconnectingWebSocket | null>(null);
  const listenersRef = useRef(new Set<ServerMessageListener>());

  useEffect(() => {
    if (!identity) return;

    const socket = new ReconnectingWebSocket(`${SIGNAL_URL}/connect`);
    socketRef.current = socket;

    socket.addEventListener("message", (event: MessageEvent<string>) => {
      const msg = JSON.parse(event.data) as ServerSignalMessage;

      switch (msg.type) {
        case "welcome": {
          setConnectionId(msg.connectionId);
          const hello: ClientSignalMessage = {
            type: "hello",
            peerId: identity.peerId,
            displayName: identity.displayName,
          };
          socket.send(JSON.stringify(hello));
          break;
        }
        case "roster":
          setPeers(msg.peers.filter((peer) => peer.peerId !== identity.peerId));
          break;
        default:
          for (const listener of listenersRef.current) listener(msg);
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
      setConnectionId(null);
      setPeers([]);
    };
  }, [identity]);

  const send = useMemo(
    () => (msg: ClientSignalMessage) => socketRef.current?.send(JSON.stringify(msg)),
    [],
  );

  const onMessage = useMemo(
    () => (listener: ServerMessageListener) => {
      listenersRef.current.add(listener);
      return () => listenersRef.current.delete(listener);
    },
    [],
  );

  return { connectionId, peers, send, onMessage };
}
