'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { Device, ServerMessage } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import { useSignaling } from '@/lib/useSignaling';
import { usePeers } from '@/lib/usePeers';
import { useMode } from '@/lib/mode';
import { formatBytes, getSignalingHttpBase, hashPassword, generateRoomCode } from '@/lib/utils';
import { LanModeView } from '@/components/LanModeView';
import { PrivateRoomLobby } from '@/components/PrivateRoomLobby';
import { PrivateRoomView } from '@/components/PrivateRoomView';

const SERVER_ERROR_KEYS = ['error.wrongPassword', 'error.roomFull', 'error.roomNotFound'];
const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

export default function Home() {
  const t = useTranslations();
  const { mode, setMode } = useMode();

  // ── Room state ────────────────────────────────────────────────────────────
  const [autoRoom, setAutoRoom] = useState<string | null>(null);
  const [privateRoom, setPrivateRoom] = useState<string | null>(null);
  const [pendingRoom, setPendingRoom] = useState<string | null>(null);
  const pendingRoomRef = useRef<string | null>(null);
  pendingRoomRef.current = pendingRoom;
  const privatePasswordHashRef = useRef('');
  const privateRoomCreateRef = useRef(true);
  const exclusiveRef = useRef(false);

  useEffect(() => {
    const hashRoom = window.location.hash.slice(1).toUpperCase();
    if (hashRoom && ROOM_CODE_RE.test(hashRoom)) {
      setMode('private');
      privateRoomCreateRef.current = false;
      setPrivateRoom(hashRoom);
    }
    fetch(`${getSignalingHttpBase()}/welcome`)
      .then((r) => r.json())
      .then(({ lanRoom }: { lanRoom: string }) => setAutoRoom(lanRoom))
      .catch(() => toast.error(t('errorSignalingUnreachable')));
  }, [setMode, t]);

  const connectionRoom = mode === 'lan' ? autoRoom : (pendingRoom ?? privateRoom);

  // ── Device / transfer state ───────────────────────────────────────────────
  const [devices, setDevices] = useState<Device[]>([]);
  const [selfId, setSelfId] = useState('');
  const [progresses, setProgresses] = useState<Map<string, TransferProgress>>(new Map());
  const selfIdRef = useRef('');

  // ── Transfer callbacks ────────────────────────────────────────────────────
  const handleProgress = useCallback((p: TransferProgress) => {
    setProgresses((prev) => new Map(prev).set(p.peerId, p));
    if (p.transferred >= p.fileSize) {
      setTimeout(
        () => setProgresses((prev) => { const n = new Map(prev); n.delete(p.peerId); return n; }),
        1000,
      );
    }
  }, []);

  const handleFileReceived = useCallback((file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    toast.success(t('toastReceived', { name: file.name, size: formatBytes(file.size) }));
  }, [t]);

  const handleError = useCallback((key: string) => {
    toast.error(t(key as Parameters<typeof t>[0]));
  }, [t]);

  // ── Peer connections ──────────────────────────────────────────────────────
  // signalingRef is populated by useSignaling; we declare it here so usePeers
  // can hold a stable reference before the signaling hook fills it in.
  const signalingRef = useRef<import('@/lib/signaling').SignalingClient | null>(null);

  const { peersRef, getOrCreatePeer, closeStalePeers, closeAllPeers } = usePeers(
    signalingRef,
    selfIdRef,
    handleProgress,
    handleFileReceived,
    handleError,
  );

  // ── Message handler (forward-ref pattern to break circular hook dependency) ─
  // useSignaling must be called before onMessage is defined (it needs usePeers
  // results), so we route through a ref that is updated every render.
  const onMessageRef = useRef<(msg: ServerMessage) => void>(() => {});

  const { connected, signalingRef: sigRef } = useSignaling(
    connectionRoom,
    mode,
    privatePasswordHashRef.current,
    mode === 'lan' ? true : privateRoomCreateRef.current,
    mode === 'lan' ? false : exclusiveRef.current,
    (msg) => onMessageRef.current(msg),
  );
  // Keep our local signalingRef in sync with the hook's internal ref
  signalingRef.current = sigRef.current;

  const onMessage = useCallback((msg: ServerMessage) => {
    if (msg.type === 'device-list') {
      if (pendingRoomRef.current) {
        setPrivateRoom(pendingRoomRef.current);
        setPendingRoom(null);
      }
      closeStalePeers(new Set(msg.devices.map((d) => d.id)));
      setDevices(msg.devices);
      setSelfId(msg.selfId);
      selfIdRef.current = msg.selfId;
    } else if (msg.type === 'offer') {
      const peer = getOrCreatePeer(msg.from, false);
      peer.handleOffer(msg.sdp).catch((e: Error) => toast.error(e.message));
    } else if (msg.type === 'answer') {
      const peer = peersRef.current.get(msg.from);
      if (peer) peer.handleAnswer(msg.sdp).catch((e: Error) => toast.error(e.message));
    } else if (msg.type === 'ice-candidate') {
      const peer = peersRef.current.get(msg.from);
      // ICE candidate errors (e.g. candidate arrived after close) are benign
      if (peer) peer.handleIceCandidate(msg.candidate).catch(() => {});
    } else if (msg.type === 'error') {
      const message = SERVER_ERROR_KEYS.includes(msg.message)
        ? t(msg.message as Parameters<typeof t>[0])
        : msg.message;
      toast.error(message);
      if (msg.message === 'error.roomNotFound') {
        privatePasswordHashRef.current = '';
        privateRoomCreateRef.current = true;
        setPendingRoom(null);
      } else if (msg.message === 'error.roomExists') {
        exclusiveRef.current = true;
        setPrivateRoom(generateRoomCode());
      }
    }
  }, [closeStalePeers, getOrCreatePeer, peersRef, t]);

  onMessageRef.current = onMessage;

  // ── Cleanup peers when room/mode changes ──────────────────────────────────
  useEffect(() => {
    setDevices([]);
    setSelfId('');
    selfIdRef.current = '';
    setProgresses(new Map());
    return () => { closeAllPeers(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionRoom, mode]);

  // ── File sending ──────────────────────────────────────────────────────────
  const handleSendFile = useCallback(async (file: File, peerId: string) => {
    const peer = getOrCreatePeer(peerId, true);
    toast.info(t('toastSending', { name: file.name }));
    await peer.sendFile(file);
  }, [getOrCreatePeer, t]);

  // ── Room helpers ──────────────────────────────────────────────────────────
  const copyRoomCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast.success(t('copied')),
      () => toast.error(code),
    );
  }, [t]);

  const shareRoom = useCallback((code: string) => {
    const url = `${window.location.origin}#${code}`;
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(
        () => toast.success(t('copiedLink')),
        () => toast.error(url),
      );
    }
  }, [t]);

  const joinPrivateRoom = useCallback((code: string, password: string, create: boolean) => {
    if (!ROOM_CODE_RE.test(code)) {
      toast.error(t('errorInvalidRoomCode'));
      return;
    }
    (password ? hashPassword(password, code) : Promise.resolve('')).then((hash) => {
      privatePasswordHashRef.current = hash;
      privateRoomCreateRef.current = create;
      exclusiveRef.current = create;
      if (create) {
        setPrivateRoom(code);
      } else {
        setPendingRoom(code);
      }
    });
  }, [t]);

  const leavePrivateRoom = useCallback(() => {
    privatePasswordHashRef.current = '';
    privateRoomCreateRef.current = true;
    exclusiveRef.current = false;
    setPrivateRoom(null);
    setPendingRoom(null);
  }, []);

  // ── Derived state ─────────────────────────────────────────────────────────
  const self = devices.find((d) => d.id === selfId);
  const otherDevices = devices.filter(
    (d) => d.id !== selfId && d.stableId !== self?.stableId,
  );

  // ── Render ────────────────────────────────────────────────────────────────
  if (mode === 'lan') {
    return (
      <LanModeView
        autoRoom={autoRoom}
        connected={connected}
        self={self}
        otherDevices={otherDevices}
        progresses={progresses}
        onSendFile={handleSendFile}
        onCopyRoomCode={copyRoomCode}
        onShareRoom={shareRoom}
      />
    );
  }

  if (!privateRoom) {
    return <PrivateRoomLobby onJoinRoom={joinPrivateRoom} />;
  }

  return (
    <PrivateRoomView
      privateRoom={privateRoom}
      connected={connected}
      self={self}
      otherDevices={otherDevices}
      progresses={progresses}
      onSendFile={handleSendFile}
      onCopyRoomCode={copyRoomCode}
      onShareRoom={shareRoom}
      onLeaveRoom={leavePrivateRoom}
      onJoinRoom={joinPrivateRoom}
    />
  );
}
