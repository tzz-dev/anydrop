'use client';

import { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Paperclip, Send, X } from 'lucide-react';
import type { Device } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import type { ChatMessage } from '@/lib/chat';
import { TransferProgressCard } from '@/components/TransferProgressCard';

interface Props {
  otherDevices: Device[];
  progresses: Map<string, TransferProgress>;
  chatMessages: Map<string, ChatMessage[]>;
  onSendFile: (file: File, peerId: string) => Promise<void>;
  onSendMessage: (peerId: string, text: string) => void;
}

export function DeviceGrid({ otherDevices, progresses, chatMessages, onSendFile, onSendMessage }: Props) {
  const t = useTranslations();
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [dragOverPeer, setDragOverPeer] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Close panel if active peer disconnects
  useEffect(() => {
    if (activePeer && !otherDevices.find((d) => d.id === activePeer)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePeer(null);
    }
  }, [otherDevices, activePeer]);

  // Scroll to bottom when messages arrive or panel opens
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activePeer]);

  const activePeerDevice = activePeer ? otherDevices.find((d) => d.id === activePeer) : null;
  const activeMessages = activePeer ? (chatMessages.get(activePeer) ?? []) : [];

  const handleSend = () => {
    if (!activePeer || !inputText.trim()) return;
    onSendMessage(activePeer, inputText.trim());
    setInputText('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (files.length && activePeer) {
      e.preventDefault();
      files.reduce((p, file) => p.then(() => onSendFile(file, activePeer)), Promise.resolve());
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePeer) return;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    files.reduce((p, file) => p.then(() => onSendFile(file, activePeer)), Promise.resolve());
  };

  return (
    <>
      <TransferProgressCard progresses={progresses} />
      <div className="w-full max-w-2xl flex flex-col gap-4">
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
                  activePeer === device.id || dragOverPeer === device.id
                    ? 'border-primary bg-primary/5'
                    : 'hover:border-primary'
                }`}
                onClick={() => setActivePeer(activePeer === device.id ? null : device.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverPeer(device.id); }}
                onDragLeave={() => setDragOverPeer(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverPeer(null);
                  const files = Array.from(e.dataTransfer.files);
                  files.reduce((p, file) => p.then(() => onSendFile(file, device.id)), Promise.resolve());
                }}
              >
                <CardHeader className="pb-2">
                  <CardTitle className="text-base truncate">{device.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Button size="sm" variant="outline" className="w-full pointer-events-none">
                    {dragOverPeer === device.id ? t('dropToSend') : t('clickToChat')}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activePeer && activePeerDevice && (
          <Card>
            <CardHeader className="pb-2 border-b">
              <CardTitle className="text-sm font-medium">{activePeerDevice.name}</CardTitle>
              <CardAction>
                <button
                  onClick={() => setActivePeer(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={14} />
                </button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 pt-3">
              <div className="h-40 overflow-y-auto flex flex-col gap-1.5 text-sm pr-1">
                {activeMessages.length === 0 ? (
                  <p className="text-muted-foreground text-xs text-center m-auto">{t('noMessages')}</p>
                ) : (
                  activeMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'send' ? 'justify-end' : 'justify-start'}`}
                    >
                      <span className={`px-2.5 py-1 rounded-lg max-w-[80%] wrap-break-word text-xs ${
                        msg.direction === 'send'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted'
                      }`}>
                        {msg.text}
                      </span>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-1.5 items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title={t('attachFile')}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 shrink-0"
                >
                  <Paperclip size={15} />
                </button>
                <input
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  onPaste={handlePaste}
                  placeholder={t('messagePlaceholder')}
                  className="flex-1 h-8 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <Button
                  size="sm"
                  className="h-8 px-2 shrink-0"
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                >
                  <Send size={14} />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileSelected} />
    </>
  );
}
