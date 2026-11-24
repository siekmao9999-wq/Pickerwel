'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import {
  clearPendingSyncQueue,
  flushPendingSyncQueue,
  getSyncQueueSnapshot,
  removePendingSyncItem,
  retryPendingSyncItem,
  subscribePendingSync,
  type PendingFormSubmission,
  type SyncQueueSnapshot,
  type SyncRunSummary,
} from '@/lib/form-sync-queue';

interface UseFormPendingSyncOptions {
  /** Filter exposed items to a single formId (counts & actions scope to this form when set) */
  formId?: string;
  /** Enable automatic background flushing on reconnect, mount, tab focus, and retry interval */
  autoSync?: boolean;
  /** Optional callback fired whenever a sync run pushes >= 1 submission */
  onSynced?: (summary: SyncRunSummary) => void;
}

export function useFormPendingSync(options?: UseFormPendingSyncOptions) {
  const formId = options?.formId;
  const autoSync = Boolean(options?.autoSync);
  const onSyncedRef = useRef(options?.onSynced);

  useEffect(() => {
    onSyncedRef.current = options?.onSynced;
  }, [options?.onSynced]);

  const isOnline = useOnlineStatus();
  const [snapshot, setSnapshot] = useState<SyncQueueSnapshot>({
    items: [],
    isSyncing: false,
    lastSummary: null,
  });

  // Hydrate & subscribe to cross-component / cross-tab queue updates
  useEffect(() => {
    const syncState = () => setSnapshot(getSyncQueueSnapshot());
    queueMicrotask(syncState);
    const unsub = subscribePendingSync(syncState);
    return () => unsub();
  }, []);

  const scopedItems = useMemo<PendingFormSubmission[]>(
    () =>
      formId
        ? snapshot.items.filter((item) => item.formId === formId)
        : snapshot.items,
    [formId, snapshot.items]
  );

  const pendingCount = useMemo(
    () => scopedItems.filter((i) => i.status === 'pending' || i.status === 'syncing').length,
    [scopedItems]
  );

  const failedCount = useMemo(
    () => scopedItems.filter((i) => i.status === 'failed').length,
    [scopedItems]
  );

  const totalCount = scopedItems.length;

  const syncNow = useCallback(
    async (includeFailed = true): Promise<SyncRunSummary> => {
      const summary = await flushPendingSyncQueue({
        formId,
        includeFailed,
      });
      if (summary.synced > 0 && onSyncedRef.current) {
        onSyncedRef.current(summary);
      }
      return summary;
    },
    [formId]
  );

  const retryItem = useCallback(async (id: string) => {
    const ok = await retryPendingSyncItem(id);
    if (ok && onSyncedRef.current) {
      const latest = getSyncQueueSnapshot().lastSummary;
      if (latest) onSyncedRef.current(latest);
    }
    return ok;
  }, []);

  const removeItem = useCallback((id: string) => {
    removePendingSyncItem(id);
  }, []);

  const clearQueue = useCallback(() => {
    clearPendingSyncQueue(formId);
  }, [formId]);

  // Automatic flush whenever the user reconnects, loads online with pending items, or returns to tab
  useEffect(() => {
    if (!autoSync) return;

    const triggerAutoFlush = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      const current = getSyncQueueSnapshot();
      const hasPending = current.items.some((i) => i.status === 'pending');
      if (!hasPending) return;
      void flushPendingSyncQueue({ includeFailed: false }).then((summary) => {
        if (summary.synced > 0 && onSyncedRef.current) {
          onSyncedRef.current(summary);
        }
      });
    };

    if (isOnline) {
      // Short grace delay after reconnection so network interface is ready
      const reconnectTimer = window.setTimeout(triggerAutoFlush, 600);
      const handleVisibility = () => {
        if (document.visibilityState === 'visible') {
          triggerAutoFlush();
        }
      };
      const retryInterval = window.setInterval(triggerAutoFlush, 30000);
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        window.clearTimeout(reconnectTimer);
        window.clearInterval(retryInterval);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
  }, [autoSync, isOnline]);

  return {
    items: scopedItems,
    allItems: snapshot.items,
    pendingCount,
    failedCount,
    totalCount,
    isOnline,
    isSyncing: snapshot.isSyncing,
    lastSummary: snapshot.lastSummary,
    syncNow,
    retryItem,
    removeItem,
    clearQueue,
  };
}
