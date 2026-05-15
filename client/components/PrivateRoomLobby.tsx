'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { generateRoomCode } from '@/lib/utils';

const inputClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface Props {
  onJoinRoom: (code: string, password: string, create: boolean) => void;
}

export function PrivateRoomLobby({ onJoinRoom }: Props) {
  const t = useTranslations();
  const [createPassword, setCreatePassword] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [joinPassword, setJoinPassword] = useState('');

  const submitJoin = () => {
    if (!joinCode.trim()) return;
    onJoinRoom(joinCode.trim(), joinPassword, false);
  };

  return (
    <main className="flex flex-col items-center justify-center flex-1 p-8 gap-6">
      <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-lg">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('createPrivateRoom')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <input
              value={createPassword}
              onChange={(e) => setCreatePassword(e.target.value)}
              placeholder={t('passwordPlaceholder')}
              type="password"
              className={inputClass}
            />
            <Button
              className="w-full"
              onClick={() => onJoinRoom(generateRoomCode(), createPassword, true)}
            >
              {t('create')}
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t('joinRoom')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => { if (e.key === 'Enter') submitJoin(); }}
              placeholder={t('joinRoomPlaceholder')}
              maxLength={6}
              className={`${inputClass} font-mono tracking-widest`}
            />
            <input
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitJoin(); }}
              placeholder={t('passwordPlaceholder')}
              type="password"
              className={inputClass}
            />
            <Button
              className="w-full"
              onClick={submitJoin}
              disabled={!joinCode.trim()}
            >
              {t('joinRoom')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
