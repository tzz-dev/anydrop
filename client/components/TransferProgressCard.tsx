'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { TransferProgress } from '@/lib/webrtc';
import { formatBytes } from '@/lib/utils';

interface Props {
  progresses: Map<string, TransferProgress>;
}

interface Snapshot {
  transferred: number;
  timestamp: number;
  speed: number; // bytes/s, smoothed
}

const ALPHA = 0.3; // EMA smoothing factor

export function TransferProgressCard({ progresses }: Props) {
  const t = useTranslations();
  const snapshots = useRef<Map<string, Snapshot>>(new Map());

  if (progresses.size === 0) {
    snapshots.current.clear();
    return null;
  }

  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div className="w-full max-w-md flex flex-col gap-3">
      {Array.from(progresses.values()).map((p) => {
        const prev = snapshots.current.get(p.peerId);
        let speed = prev?.speed ?? 0;
        const dt = prev ? (now - prev.timestamp) / 1000 : 0;
        if (prev && dt > 0) {
          const instantSpeed = (p.transferred - prev.transferred) / dt;
          speed = prev.speed === 0 ? instantSpeed : ALPHA * instantSpeed + (1 - ALPHA) * prev.speed;
        }
        snapshots.current.set(p.peerId, { transferred: p.transferred, timestamp: now, speed });

        const remaining = speed > 0 ? (p.fileSize - p.transferred) / speed : null;
        const eta =
          remaining === null ? '' :
          remaining < 60 ? `${Math.ceil(remaining)}s` :
          `${Math.ceil(remaining / 60)}m`;

        return (
          <Card key={p.peerId}>
            <CardContent className="pt-6 flex flex-col gap-2">
              <div className="flex justify-between text-sm">
                <span className="truncate max-w-50">{p.fileName}</span>
                <span className="text-muted-foreground">
                  {formatBytes(p.transferred)} / {formatBytes(p.fileSize)}
                </span>
              </div>
              <Progress value={p.fileSize > 0 ? (p.transferred / p.fileSize) * 100 : 0} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{p.direction === 'send' ? t('sending') : t('receiving')}</span>
                <span>
                  {speed > 0 && `${formatBytes(Math.round(speed))}/s`}
                  {eta && ` · ${eta}`}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
