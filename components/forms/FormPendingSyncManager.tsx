'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CloudUpload, CheckCircle2, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useFormPendingSync } from '@/hooks/useFormPendingSync';
import { PendingSyncQueueModal } from './PendingSyncQueueModal';
import type { SyncRunSummary } from '@/lib/form-sync-queue';
import type { Language } from '@/lib/i18n';

interface FormPendingSyncManagerProps {
  language: Language;
}

export function FormPendingSyncManager({ language }: FormPendingSyncManagerProps) {
  const km = language === 'km';
  const [modalOpen, setModalOpen] = useState(false);
  const [completedToast, setCompletedToast] = useState<SyncRunSummary | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const handleSynced = useCallback((summary: SyncRunSummary) => {
    if (summary.synced <= 0) return;
    setCompletedToast(summary);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setCompletedToast(null);
    }, 5000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const {
    items,
    pendingCount,
    failedCount,
    totalCount,
    isOnline,
    isSyncing,
    syncNow,
    retryItem,
    removeItem,
    clearQueue,
  } = useFormPendingSync({
    autoSync: true,
    onSynced: handleSynced,
  });

  const showFloatingBar = isSyncing || totalCount > 0 || completedToast !== null;

  return (
    <>
      {showFloatingBar && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-4 right-4 z-40 max-w-[calc(100vw-2rem)]"
        >
          {isSyncing ? (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 text-white px-3.5 py-2.5 text-xs font-semibold shadow-lg hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
              <span>
                {km
                  ? `កំពុងបញ្ជូនចម្លើយ Offline ទៅ Cloud (${totalCount})...`
                  : `Syncing ${totalCount} offline submission${totalCount === 1 ? '' : 's'}...`}
              </span>
            </button>
          ) : totalCount > 0 ? (
            <div className="flex items-center gap-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 px-3 py-2 text-xs font-semibold shadow-lg">
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 cursor-pointer"
              >
                {failedCount > 0 && pendingCount === 0 ? (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                ) : (
                  <CloudUpload className="w-4 h-4 text-amber-400 shrink-0" />
                )}
                <span>
                  {!isOnline
                    ? km
                      ? `Pending Sync៖ ${totalCount} ចម្លើយ (រង់ចាំអ៊ីនធឺណិត)`
                      : `Pending Sync: ${totalCount} queued (offline)`
                    : failedCount > 0 && pendingCount === 0
                      ? km
                        ? `Pending Sync៖ ${failedCount} ត្រូវពិនិត្យ`
                        : `Pending Sync: ${failedCount} failed`
                      : km
                        ? `Pending Sync៖ ${totalCount} ចម្លើយ`
                        : `Pending Sync: ${totalCount} queued`}
                </span>
              </button>
              {isOnline && (
                <button
                  type="button"
                  onClick={() => void syncNow(true)}
                  className="ml-1 px-2 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-semibold cursor-pointer"
                >
                  {km ? 'បញ្ជូន' : 'Sync'}
                </button>
              )}
            </div>
          ) : completedToast ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-3.5 py-2.5 text-xs font-semibold shadow-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {km
                  ? `បានបញ្ជូនចម្លើយ Offline ចំនួន ${completedToast.synced} ទៅ Cloud ដោយស្វ័យប្រវត្តិ!`
                  : `Auto-synced ${completedToast.synced} offline submission${completedToast.synced === 1 ? '' : 's'} to cloud!`}
              </span>
              <button
                type="button"
                onClick={() => setCompletedToast(null)}
                aria-label={km ? 'បិទ' : 'Dismiss'}
                className="ml-1 opacity-80 hover:opacity-100 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : null}
        </div>
      )}

      <PendingSyncQueueModal
        open={modalOpen}
        language={language}
        items={items}
        isOnline={isOnline}
        isSyncing={isSyncing}
        onClose={() => setModalOpen(false)}
        onSyncNow={() => syncNow(true)}
        onRetryItem={retryItem}
        onRemoveItem={removeItem}
        onClearAll={clearQueue}
      />
    </>
  );
}
