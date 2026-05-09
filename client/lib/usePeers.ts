'use client';

import { useRef, useCallback } from 'react';
import { PeerConnection } from './webrtc';
import type { TransferProgress } from './webrtc';
import type { SignalingClient } from './signaling';

/**
 * Manages the map of active PeerConnection instances.
 * Exposes helpers to create, close, and garbage-collect peers.
 */
export function usePeers(
  signalingRef: { current: SignalingClient | null },
  selfIdRef: { current: string },
  onProgress: (p: TransferProgress) => void,
  onFileReceived: (file: File) => void,
  onError: (key: string) => void,
) {
  const peersRef = useRef<Map<string, PeerConnection>>(new Map());

  const getOrCreatePeer = useCallback(
    (peerId: string, initiate: boolean): PeerConnection => {
      if (peersRef.current.has(peerId)) return peersRef.current.get(peerId)!;
      const peer = new PeerConnection({
        signaling: signalingRef.current!,
        peerId,
        selfId: selfIdRef.current,
        onProgress,
        onFileReceived,
        onError,
      });
      peersRef.current.set(peerId, peer);
      // initiate() is async — capture errors here since callers don't await it
      if (initiate) peer.initiate().catch((e: Error) => onError(e.message));
      return peer;
    },
    [signalingRef, selfIdRef, onProgress, onFileReceived, onError],
  );

  /** Close and remove peers whose ids are not in the active set. */
  const closeStalePeers = useCallback((activeIds: Set<string>) => {
    for (const [id, peer] of peersRef.current) {
      if (!activeIds.has(id)) {
        peer.close();
        peersRef.current.delete(id);
      }
    }
  }, []);

  const closeAllPeers = useCallback(() => {
    peersRef.current.forEach((p) => p.close());
    peersRef.current.clear();
  }, []);

  return { peersRef, getOrCreatePeer, closeStalePeers, closeAllPeers };
}
