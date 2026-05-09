'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Copy, LogOut, Share2 } from 'lucide-react';
import type { Device, ServerMessage } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import { useSignaling } from '@/lib/useSignaling';
import { usePeers } from '@/lib/usePeers';
import { useMode } from '@/lib/mode';
import { TransferProgressCard } from '@/components/TransferProgressCard';
import {
  formatBytes,
  getSignalingHttpBase,
  hashPassword,
  generateRoomCode,
} from '@/lib/utils';

const SERVER_ERROR_KEYS = ['error.wrongPassword', 'error.roomFull', 'error.roomNotFound'];
const ROOM_CODE_RE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

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

  const [joinInput, setJoinInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
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

  // ── UI state ──────────────────────────────────────────────────────────────
  const [devices, setDevices] = useState<Device[]>([]);
  const [selfId, setSelfId] = useState('');
  const [progresses, setProgresses] = useState<Map<string, TransferProgress>>(new Map());
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [dragOverPeer, setDragOverPeer] = useState<string | null>(null);
  const selfIdRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setJoinInput('');
        setPasswordInput('');
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
    return () => {
      closeAllPeers();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionRoom, mode]);

  // ── File sending ──────────────────────────────────────────────────────────
  const handleSendFile = async (file: File, peerId: string) => {
    const peer = getOrCreatePeer(peerId, true);
    toast.info(t('toastSending', { name: file.name }));
    await peer.sendFile(file);
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const peer = selectedPeer;
    if (!files.length || !peer) return;
    e.target.value = '';
    setSelectedPeer(null);
    files.reduce((p, file) => p.then(() => handleSendFile(file, peer)), Promise.resolve());
  };

  const onDeviceClick = (peerId: string) => {
    setSelectedPeer(peerId);
    fileInputRef.current?.click();
  };

  // ── Room helpers ──────────────────────────────────────────────────────────
  const copyRoomCode = (code: string) => {
    navigator.clipboard.writeText(code).then(
      () => toast.success(t('copied')),
      () => toast.error(code),
    );
  };

  const shareRoom = (code: string) => {
    const url = `${window.location.origin}#${code}`;
    if (navigator.share) {
      navigator.share({ url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(
        () => toast.success(t('copiedLink')),
        () => toast.error(url),
      );
    }
  };

  const joinPrivateRoom = async (code: string, password: string, create: boolean) => {
    if (!ROOM_CODE_RE.test(code)) {
      toast.error(t('errorInvalidRoomCode'));
      return;
    }
    privatePasswordHashRef.current = password ? await hashPassword(password, code) : '';
    privateRoomCreateRef.current = create;
    exclusiveRef.current = create;
    if (create) {
      // Create: navigate immediately, clear inputs
      setJoinInput('');
      setPasswordInput('');
      setPrivateRoom(code);
    } else {
      // Join: stay on lobby until server confirms with device-list
      setPendingRoom(code);
    }
  };

  const leavePrivateRoom = () => {
    privatePasswordHashRef.current = '';
    privateRoomCreateRef.current = true;
    exclusiveRef.current = false;
    setPrivateRoom(null);
    setPendingRoom(null);
    setJoinInput('');
    setPasswordInput('');
  };

  // ── Derived state ─────────────────────────────────────────────────────────
  const self = devices.find((d) => d.id === selfId);
  const otherDevices = devices.filter(
    (d) => d.id !== selfId && d.stableId !== self?.stableId,
  );

  // ── Shared sub-views ──────────────────────────────────────────────────────
  const deviceGrid = (
    <div className="w-full max-w-2xl">
      {otherDevices.length === 0 ? (
        <Card className="text-center py-16">
          <CardContent className="text-muted-foreground">
            <p className="text-lg">{t('noDevices')}</p>
            <p className="text-sm mt-1">{t('noDevicesHint')}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
          {otherDevices.map((device) => (
            <Card
              key={device.id}
              className={`cursor-pointer transition-colors select-none ${
                dragOverPeer === device.id
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary'
              }`}
              onClick={() => onDeviceClick(device.id)}
              onDragOver={(e) => { e.preventDefault(); setDragOverPeer(device.id); }}
              onDragLeave={() => setDragOverPeer(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverPeer(null);
                const files = Array.from(e.dataTransfer.files);
                files.reduce((p, file) => p.then(() => handleSendFile(file, device.id)), Promise.resolve());
              }}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base truncate">{device.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <Button size="sm" variant="outline" className="w-full pointer-events-none">
                  {dragOverPeer === device.id ? t('dropToSend') : t('clickToSend')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  // ── LAN mode ──────────────────────────────────────────────────────────────
  if (mode === 'lan') {
    return (
      <main className="flex flex-col items-center flex-1 p-8 gap-8">
        <div className="flex flex-col items-center gap-2 mt-8">
          {autoRoom && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('room')}</span>
              <span className="font-mono font-semibold tracking-widest text-sm">{autoRoom}</span>
              <button
                onClick={() => copyRoomCode(autoRoom)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={() => shareRoom(autoRoom)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Share2 size={14} />
              </button>
            </div>
          )}
          <Badge variant={connected ? 'default' : 'secondary'}>
            {connected ? t('connected', { name: self?.name ?? '' }) : t('connecting')}
          </Badge>
        </div>

        <TransferProgressCard progresses={progresses} />
        {deviceGrid}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileSelected} />
      </main>
    );
  }

  // ── Private mode — no room ────────────────────────────────────────────────
  if (!privateRoom) {
    return (
      <main className="flex flex-col items-center justify-center flex-1 p-8">
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>

          <input
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            type="password"
            className={inputClass}
          />

          <Button
            className="w-full"
            onClick={() => joinPrivateRoom(generateRoomCode(), passwordInput, true)}
          >
            {t('createPrivateRoom')}
          </Button>

          <div className="flex items-center gap-3 w-full">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">{t('or')}</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div className="flex gap-2 w-full">
            <input
              value={joinInput}
              onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && joinInput.trim()) joinPrivateRoom(joinInput.trim(), passwordInput, false);
              }}
              placeholder={t('joinRoomPlaceholder')}
              maxLength={6}
              className={`${inputClass} font-mono tracking-widest`}
            />
            <Button
              variant="outline"
              onClick={() => { if (joinInput.trim()) joinPrivateRoom(joinInput.trim(), passwordInput, false); }}
              disabled={!joinInput.trim()}
            >
              {t('joinRoom')}
            </Button>
          </div>
        </div>
      </main>
    );
  }

  // ── Private mode — in room ────────────────────────────────────────────────
  return (
    <main className="flex flex-col items-center flex-1 p-8 gap-8">
      <div className="flex flex-col items-center gap-2 mt-8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('room')}</span>
          <span className="font-mono font-semibold tracking-widest text-sm">{privateRoom}</span>
          <button
            onClick={() => copyRoomCode(privateRoom)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => shareRoom(privateRoom)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={leavePrivateRoom}
            aria-label={t('leaveRoom')}
            title={t('leaveRoom')}
            className="text-muted-foreground hover:text-foreground transition-colors ml-1"
          >
            <LogOut size={14} />
          </button>
        </div>
        <Badge variant={connected ? 'default' : 'secondary'}>
          {connected ? t('connected', { name: self?.name ?? '' }) : t('connecting')}
        </Badge>
        <div className="flex gap-1.5 mt-1">
          <input
            value={joinInput}
            onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && joinInput.trim()) joinPrivateRoom(joinInput.trim(), passwordInput, false);
            }}
            placeholder={t('joinRoomPlaceholder')}
            maxLength={6}
            className="flex h-7 w-28 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono tracking-widest"
          />
          <input
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && joinInput.trim()) joinPrivateRoom(joinInput.trim(), passwordInput, false);
            }}
            placeholder={t('passwordPlaceholder')}
            type="password"
            className="flex h-7 w-28 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() => { if (joinInput.trim()) joinPrivateRoom(joinInput.trim(), passwordInput, false); }}
            disabled={!joinInput.trim()}
          >
            {t('joinRoom')}
          </Button>
        </div>
      </div>

      <TransferProgressCard progresses={progresses} />
      {deviceGrid}
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileSelected} />
    </main>
  );
}
