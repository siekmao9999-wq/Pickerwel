'use client';

import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { COPY, type Language } from '@/lib/i18n';

interface OfflineIndicatorProps {
  language: Language;
}

export function OfflineIndicator({ language }: OfflineIndicatorProps) {
  const isOnline = useOnlineStatus();
  const t = COPY[language];

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 left-4 z-40 flex items-center gap-2 rounded-xl bg-amber-600 dark:bg-amber-500 px-3.5 py-2 text-xs font-semibold text-white shadow-lg"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{t.offlineBanner}</span>
    </div>
  );
}
