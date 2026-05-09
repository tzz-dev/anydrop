'use client';

import { Component, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

function ErrorFallback({ error }: { error: Error }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-center">
      <p className="text-lg font-medium">{t('errorBoundaryMessage')}</p>
      <p className="text-sm text-muted-foreground">{error.message}</p>
      <button
        onClick={() => window.location.reload()}
        className="text-sm px-4 py-2 rounded-md border hover:bg-muted transition-colors"
      >
        {t('errorBoundaryRefresh')}
      </button>
    </div>
  );
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
