'use client';

import { useEffect, useRef, useState } from 'react';
import { SignalingClient } from './signaling';
import type { ServerMessage } from './signaling';
import type { Mode } from './mode';
import { getSignalingUrl, getDeviceName } from './utils';

/**
 * Manages the SignalingClient lifecycle for a given room.
 * Returns the connected state and a stable ref to the active client.
 *
 * The `onMessage` callback is kept fresh via a ref so that stale-closure
 * issues don't cause the WebSocket connection to be torn down on every render.
 */
export function useSignaling(
  room: string | null,
  mode: Mode,
  passwordHash: string,
  create: boolean,
  exclusive: boolean,
  onMessage: (msg: ServerMessage) => void,
): {
  connected: boolean;
  signalingRef: { current: SignalingClient | null };
} {
  const [connected, setConnected] = useState(false);
  const signalingRef = useRef<SignalingClient | null>(null);

  // Keep onMessage fresh without including it in effect deps
  const onMessageRef = useRef(onMessage);
  useEffect(() => {
    onMessageRef.current = onMessage;
  });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConnected(false);
    if (!room) return;

    // These browser APIs are safe inside useEffect (never runs on server)
    const url = getSignalingUrl();
    const name = getDeviceName();

    const signaling = new SignalingClient(url, name, room, passwordHash, create, exclusive);
    signalingRef.current = signaling;

    signaling.connect(
      (msg: ServerMessage) => {
        if (msg.type === 'device-list') setConnected(true);
        onMessageRef.current(msg);
      },
      () => setConnected(false),
    );

    return () => {
      signaling.disconnect();
      signalingRef.current = null;
    };
  }, [room, mode, passwordHash, create, exclusive]);

  return { connected, signalingRef };
}
