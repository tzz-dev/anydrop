'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Copy, Share2 } from 'lucide-react';
import type { Device } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import type { ChatMessage } from '@/lib/chat';
import { DeviceGrid } from '@/components/DeviceGrid';

interface Props {
  autoRoom: string | null;
  connected: boolean;
  self: Device | undefined;
  otherDevices: Device[];
  progresses: Map<string, TransferProgress>;
  chatMessages: Map<string, ChatMessage[]>;
  onSendFile: (file: File, peerId: string, signal?: AbortSignal) => Promise<void>;
  onSendMessage: (peerId: string, text: string) => void;
  onCopyRoomCode: (code: string) => void;
  onShareRoom: (code: string) => void;
}

export function LanModeView({
  autoRoom, connected, self, otherDevices, progresses, chatMessages,
  onSendFile, onSendMessage, onCopyRoomCode, onShareRoom,
}: Props) {
  const t = useTranslations();

  return (
    <main className="flex flex-col items-center flex-1 p-8 gap-8">
      <div className="flex flex-col items-center gap-2 mt-8">
        {autoRoom && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{t('room')}</span>
            <span className="font-mono font-semibold tracking-widest text-sm">{autoRoom}</span>
            <button
              onClick={() => onCopyRoomCode(autoRoom)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => onShareRoom(autoRoom)}
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
      <DeviceGrid otherDevices={otherDevices} progresses={progresses} chatMessages={chatMessages} onSendFile={onSendFile} onSendMessage={onSendMessage} />
    </main>
  );
}
