'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, File as FileIcon, Paperclip, Send, X } from 'lucide-react';
import type { Device } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import type { ChatMessage } from '@/lib/chat';
import { TransferProgressCard } from '@/components/TransferProgressCard';
import { formatBytes } from '@/lib/utils';

interface QueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: 'queued' | 'sending' | 'done';
}

interface Props {
  otherDevices: Device[];
  progresses: Map<string, TransferProgress>;
  chatMessages: Map<string, ChatMessage[]>;
  onSendFile: (file: File, peerId: string, signal?: AbortSignal) => Promise<void>;
  onSendMessage: (peerId: string, text: string) => void;
}

export function DeviceGrid({ otherDevices, progresses, chatMessages, onSendFile, onSendMessage }: Props) {
  const t = useTranslations();
  const [activePeer, setActivePeer] = useState<string | null>(null);
  const [dragOverPeer, setDragOverPeer] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── File queue ────────────────────────────────────────────────────────────
  // Refs hold the source of truth; state is a snapshot used only for rendering.
  const [queueSnapshot, setQueueSnapshot] = useState<Map<string, QueueItem[]>>(new Map());
  const queueDataRef = useRef<Map<string, QueueItem[]>>(new Map());
  const queueFilesRef = useRef<Map<string, File>>(new Map());
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const sendingRef = useRef<Set<string>>(new Set());
  // Keep onSendFile fresh without triggering queue re-creation
  const onSendFileRef = useRef(onSendFile);
  useEffect(() => { onSendFileRef.current = onSendFile; }, [onSendFile]);

  const syncQueue = useCallback(() => {
    setQueueSnapshot(new Map(queueDataRef.current));
  }, []);

  // Ref to break the self-reference in processNextItem's recursive setTimeout call
  const processNextItemRef = useRef<((peerId: string) => Promise<void>) | undefined>(undefined);

  const processNextItem = useCallback(async (peerId: string) => {
    if (sendingRef.current.has(peerId)) return;
    const queue = queueDataRef.current.get(peerId) ?? [];
    const nextItem = queue.find((i) => i.status === 'queued');
    if (!nextItem) return;

    sendingRef.current.add(peerId);
    nextItem.status = 'sending';
    syncQueue();

    const ac = new AbortController();
    abortControllersRef.current.set(nextItem.id, ac);
    const file = queueFilesRef.current.get(nextItem.id)!;

    await onSendFileRef.current(file, peerId, ac.signal);

    abortControllersRef.current.delete(nextItem.id);
    sendingRef.current.delete(peerId);

    const removeItem = () => {
      const q = queueDataRef.current.get(peerId);
      if (q) {
        const filtered = q.filter((i) => i.id !== nextItem.id);
        if (filtered.length === 0) queueDataRef.current.delete(peerId);
        else queueDataRef.current.set(peerId, filtered);
        queueFilesRef.current.delete(nextItem.id);
      }
    };

    if (!ac.signal.aborted) {
      nextItem.status = 'done';
      syncQueue();
      setTimeout(() => { removeItem(); syncQueue(); processNextItemRef.current?.(peerId); }, 1500);
    } else {
      removeItem();
      syncQueue();
      processNextItemRef.current?.(peerId);
    }
  }, [syncQueue]);

  useEffect(() => { processNextItemRef.current = processNextItem; }, [processNextItem]);

  const enqueueFiles = useCallback((files: File[], peerId: string) => {
    const items: QueueItem[] = files.map((file) => ({
      id: crypto.randomUUID(),
      fileName: file.name,
      fileSize: file.size,
      status: 'queued' as const,
    }));
    files.forEach((file, i) => queueFilesRef.current.set(items[i].id, file));
    const existing = queueDataRef.current.get(peerId) ?? [];
    queueDataRef.current.set(peerId, [...existing, ...items]);
    syncQueue();
    processNextItem(peerId);
  }, [processNextItem, syncQueue]);

  const cancelItem = useCallback((peerId: string, itemId: string) => {
    const queue = queueDataRef.current.get(peerId) ?? [];
    const item = queue.find((i) => i.id === itemId);
    if (!item) return;
    if (item.status === 'queued') {
      const filtered = queue.filter((i) => i.id !== itemId);
      if (filtered.length === 0) queueDataRef.current.delete(peerId);
      else queueDataRef.current.set(peerId, filtered);
      queueFilesRef.current.delete(itemId);
      syncQueue();
    } else if (item.status === 'sending') {
      abortControllersRef.current.get(itemId)?.abort();
    }
  }, [syncQueue]);

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activePeer && !otherDevices.find((d) => d.id === activePeer)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePeer(null);
    }
  }, [otherDevices, activePeer]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, activePeer]);

  // ── Derived state ─────────────────────────────────────────────────────────
  const activePeerDevice = activePeer ? otherDevices.find((d) => d.id === activePeer) : null;
  const activeMessages = activePeer ? (chatMessages.get(activePeer) ?? []) : [];
  const activeQueue = activePeer ? (queueSnapshot.get(activePeer) ?? []) : [];
  const activeSendProgress = activePeer ? progresses.get(activePeer) : undefined;

  // Hide send-direction progress from TransferProgressCard when chat panel is open
  // (already visible in the queue section)
  const filteredProgresses = activePeer
    ? new Map([...progresses].filter(([id, p]) => !(id === activePeer && p.direction === 'send')))
    : progresses;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSend = () => {
    if (!activePeer || !inputText.trim()) return;
    onSendMessage(activePeer, inputText.trim());
    setInputText('');
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const files = Array.from(e.clipboardData.files).filter((f) => f.type.startsWith('image/'));
    if (files.length && activePeer) {
      e.preventDefault();
      enqueueFiles(files, activePeer);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activePeer) return;
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = '';
    enqueueFiles(files, activePeer);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <TransferProgressCard progresses={filteredProgresses} />
      <div className="w-full max-w-3xl flex flex-col gap-4">
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
                  enqueueFiles(Array.from(e.dataTransfer.files), device.id);
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
              {/* Message history */}
              <div className="h-36 overflow-y-auto flex flex-col gap-1.5 text-sm pr-1">
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

              {/* File queue */}
              {activeQueue.length > 0 && (
                <div className="flex flex-col gap-1 border-t pt-2">
                  {activeQueue.map((item) => {
                    const progress = item.status === 'sending' ? activeSendProgress : undefined;
                    const pct = progress && progress.fileSize > 0
                      ? Math.round((progress.transferred / progress.fileSize) * 100)
                      : 0;
                    return (
                      <div key={item.id} className="flex items-center gap-2 text-xs">
                        {item.status === 'done'
                          ? <Check size={13} className="text-green-500 shrink-0" />
                          : <FileIcon size={13} className="text-muted-foreground shrink-0" />
                        }
                        <span className="truncate flex-1 text-muted-foreground">{item.fileName}</span>
                        {item.status === 'sending' && progress ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="tabular-nums text-muted-foreground">{pct}%</span>
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="text-muted-foreground hidden sm:inline">
                              {formatBytes(progress.transferred)}/{formatBytes(item.fileSize)}
                            </span>
                          </div>
                        ) : item.status === 'queued' ? (
                          <span className="text-muted-foreground shrink-0">{t('queued')}</span>
                        ) : null}
                        {item.status !== 'done' && (
                          <button
                            onClick={() => cancelItem(activePeer, item.id)}
                            className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          >
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Input row */}
              <div className="flex gap-1.5 items-center border-t pt-2">
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
