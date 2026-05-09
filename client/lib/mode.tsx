'use client';

import { createContext, useContext, useState } from 'react';

export type Mode = 'lan' | 'private';

const ModeContext = createContext<{
  mode: Mode;
  setMode: (m: Mode) => void;
}>({ mode: 'lan', setMode: () => {} });

export function useMode() {
  return useContext(ModeContext);
}

export function ModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>('lan');
  return (
    <ModeContext.Provider value={{ mode, setMode }}>
      {children}
    </ModeContext.Provider>
  );
}
