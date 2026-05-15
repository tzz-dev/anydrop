'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Device } from '@/lib/signaling';
import type { TransferProgress } from '@/lib/webrtc';
import { TransferProgressCard } from '@/components/TransferProgressCard';

interface Props {
  otherDevices: Device[];
  progresses: Map<string, TransferProgress>;
  onSendFile: (file: File, peerId: string) => Promise<void>;
}

export function DeviceGrid({ otherDevices, progresses, onSendFile }: Props) {
  const t = useTranslations();
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [dragOverPeer, setDragOverPeer] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onDeviceClick = (peerId: string) => {
    setSelectedPeer(peerId);
    fileInputRef.current?.click();
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const peer = selectedPeer;
    if (!files.length || !peer) return;
    e.target.value = '';
    setSelectedPeer(null);
    files.reduce((p, file) => p.then(() => onSendFile(file, peer)), Promise.resolve());
  };

  return (
    <>
      <TransferProgressCard progresses={progresses} />
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
                  files.reduce((p, file) => p.then(() => onSendFile(file, device.id)), Promise.resolve());
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
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onFileSelected} />
    </>
  );
}
