'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Copy, LogOut, Share2 } from 'lucide-react';
import type { Device } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import type { ChatMessage } from '@/lib/chat';
import { DeviceGrid } from '@/components/DeviceGrid';

interface Props {
  privateRoom: string;
  connected: boolean;
  self: Device | undefined;
  otherDevices: Device[];
  progresses: Map<string, TransferProgress>;
  chatMessages: Map<string, ChatMessage[]>;
  onSendFile: (file: File, peerId: string, signal?: AbortSignal) => Promise<void>;
  onSendMessage: (peerId: string, text: string) => void;
  onCopyRoomCode: (code: string) => void;
  onShareRoom: (code: string) => void;
  onLeaveRoom: () => void;
  onJoinRoom: (code: string, password: string, create: boolean) => void;
}

export function PrivateRoomView({
  privateRoom, connected, self, otherDevices, progresses, chatMessages,
  onSendFile, onSendMessage, onCopyRoomCode, onShareRoom, onLeaveRoom, onJoinRoom,
}: Props) {
  const t = useTranslations();
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const submitJoin = () => {
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim(), joinPassword, false);
    setJoinCode('');
    setJoinPassword('');
  };

  return (
    <main className="flex flex-col items-center flex-1 p-8 gap-8">
      <div className="flex flex-col items-center gap-2 mt-8">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{t('room')}</span>
          <span className="font-mono font-semibold tracking-widest text-sm">{privateRoom}</span>
          <button
            onClick={() => onCopyRoomCode(privateRoom)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => onShareRoom(privateRoom)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <Share2 size={14} />
          </button>
          <button
            onClick={onLeaveRoom}
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
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => { if (e.key === 'Enter') submitJoin(); }}
            placeholder={t('joinRoomPlaceholder')}
            maxLength={6}
            className="flex h-7 w-28 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring font-mono tracking-widest"
          />
          <input
            value={joinPassword}
            onChange={(e) => setJoinPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submitJoin(); }}
            placeholder={t('passwordPlaceholder')}
            type="password"
            className="flex h-7 w-28 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={submitJoin}
            disabled={!joinCode.trim()}
          >
            {t('joinRoom')}
          </Button>
        </div>
      </div>
      <DeviceGrid otherDevices={otherDevices} progresses={progresses} chatMessages={chatMessages} onSendFile={onSendFile} onSendMessage={onSendMessage} />
    </main>
  );
}
