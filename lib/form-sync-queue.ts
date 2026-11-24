'use client';

import {
  generateResponseId,
  saveLocalFormResponse,
  updateLocalFormResponse,
  type CustomForm,
  type FormResponseRecord,
} from './forms-model';
import { submitCloudFormResponse } from './firestore-forms';

export const FORM_PENDING_SYNC_STORAGE_KEY = 'pickerwel_form_pending_sync_v1';
export const CACHED_CLOUD_FORMS_STORAGE_KEY = 'pickerwel_cached_cloud_forms_v1';
const SYNC_EVENT_NAME = 'pickerwel:form-pending-sync-updated';

export type PendingSyncStatus = 'pending' | 'syncing' | 'failed';

export interface PendingFormSubmission {
  id: string;
  formId: string;
  formTitle: string;
  ownerId: string;
  respondentName: string;
  respondentEmail: string;
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
  createdAtMs: number;
  attempts: number;
  lastAttemptAtMs?: number;
  status: PendingSyncStatus;
  lastError?: string;
}

export interface SyncRunSummary {
  attempted: number;
  synced: number;
  failed: number;
  remaining: number;
  syncedIds: string[];
  finishedAtMs: number;
}

export interface SyncQueueSnapshot {
  items: PendingFormSubmission[];
  isSyncing: boolean;
  lastSummary: SyncRunSummary | null;
}

export type ResilientSubmitOutcome =
  | { mode: 'synced'; record: FormResponseRecord }
  | { mode: 'queued'; record: FormResponseRecord; queueItem: PendingFormSubmission }
  | { mode: 'local_only'; record: FormResponseRecord };

let isCurrentlySyncing = false;
let lastSyncRunSummary: SyncRunSummary | null = null;
let activeFlushPromise: Promise<SyncRunSummary> | null = null;

function notifySyncSubscribers() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(SYNC_EVENT_NAME));
}

function readRawQueue(): PendingFormSubmission[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FORM_PENDING_SYNC_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingFormSubmission[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.formId === 'string')
      .map((item) => ({
        ...item,
        // Recover stale 'syncing' items left over from a closed tab/reload
        status: !isCurrentlySyncing && item.status === 'syncing' ? 'pending' : item.status || 'pending',
        attempts: Number(item.attempts || 0),
        respondentName: String(item.respondentName || ''),
        respondentEmail: String(item.respondentEmail || ''),
        score: Number(item.score || 0),
        maxScore: Number(item.maxScore || 0),
      }));
  } catch {
    return [];
  }
}

function writeRawQueue(items: PendingFormSubmission[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FORM_PENDING_SYNC_STORAGE_KEY, JSON.stringify(items.slice(0, 300)));
  } catch {
    // Ignore storage quota issues
  }
  notifySyncSubscribers();
}

export function loadPendingSyncQueue(formId?: string): PendingFormSubmission[] {
  const all = readRawQueue();
  return formId ? all.filter((item) => item.formId === formId) : all;
}

export function getSyncQueueSnapshot(): SyncQueueSnapshot {
  return {
    items: readRawQueue(),
    isSyncing: isCurrentlySyncing,
    lastSummary: lastSyncRunSummary,
  };
}

export function subscribePendingSync(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handleCustom = () => listener();
  const handleStorage = (e: StorageEvent) => {
    if (e.key === FORM_PENDING_SYNC_STORAGE_KEY || e.key === null) {
      listener();
    }
  };
  window.addEventListener(SYNC_EVENT_NAME, handleCustom);
  window.addEventListener('storage', handleStorage);
  return () => {
    window.removeEventListener(SYNC_EVENT_NAME, handleCustom);
    window.removeEventListener('storage', handleStorage);
  };
}

export function cacheCloudFormSnapshot(form: CustomForm): void {
  if (typeof window === 'undefined' || !form?.id) return;
  try {
    const raw = localStorage.getItem(CACHED_CLOUD_FORMS_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, CustomForm>) : {};
    const map = parsed && typeof parsed === 'object' ? { ...parsed } : {};
    map[form.id] = { ...form, syncedToCloud: true };
    const entries = Object.entries(map)
      .sort((a, b) => (b[1].updatedAtMs || 0) - (a[1].updatedAtMs || 0))
      .slice(0, 30);
    localStorage.setItem(
      CACHED_CLOUD_FORMS_STORAGE_KEY,
      JSON.stringify(Object.fromEntries(entries))
    );
  } catch {
    // Ignore storage quota issues
  }
}

export function getCachedCloudForm(formId: string): CustomForm | null {
  if (typeof window === 'undefined' || !formId) return null;
  try {
    const raw = localStorage.getItem(CACHED_CLOUD_FORMS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, CustomForm>;
    const found = parsed?.[formId];
    return found && Array.isArray(found.questions) ? found : null;
  } catch {
    return null;
  }
}

export function enqueuePendingFormSubmission(
  input: Omit<PendingFormSubmission, 'attempts' | 'status'>
): PendingFormSubmission {
  const existing = readRawQueue();
  const already = existing.find((item) => item.id === input.id);
  if (already) return already;
  const queued: PendingFormSubmission = {
    ...input,
    attempts: 0,
    status: 'pending',
  };
  writeRawQueue([queued, ...existing]);
  return queued;
}

export function removePendingSyncItem(id: string): void {
  const next = readRawQueue().filter((item) => item.id !== id);
  writeRawQueue(next);
}

export function clearPendingSyncQueue(formId?: string): void {
  if (!formId) {
    writeRawQueue([]);
    return;
  }
  const next = readRawQueue().filter((item) => item.formId !== formId);
  writeRawQueue(next);
}

export function enqueueUnsyncedLocalResponses(
  form: CustomForm,
  localResponses: FormResponseRecord[]
): PendingFormSubmission[] {
  if (!form.syncedToCloud || !form.ownerId) return [];
  const existing = readRawQueue();
  const existingIds = new Set(existing.map((i) => i.id));
  const newlyQueued: PendingFormSubmission[] = [];

  for (const r of localResponses) {
    if (r.formId !== form.id) continue;
    if (r.source === 'cloud' || r.syncStatus === 'synced') continue;
    if (existingIds.has(r.id)) continue;
    const item: PendingFormSubmission = {
      id: r.id,
      formId: form.id,
      formTitle: form.title || 'Untitled Form',
      ownerId: form.ownerId,
      respondentName: r.respondentName || 'Anonymous',
      respondentEmail: r.respondentEmail || '',
      answers: r.answers,
      score: r.score,
      maxScore: r.maxScore,
      createdAtMs: r.submittedAtMs || Date.now(),
      attempts: 0,
      status: 'pending',
    };
    newlyQueued.push(item);
    updateLocalFormResponse(r.id, { syncStatus: 'pending' });
  }

  if (newlyQueued.length > 0) {
    writeRawQueue([...newlyQueued, ...existing]);
  }
  return newlyQueued;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error('NETWORK_TIMEOUT'));
    }, timeoutMs);
    promise.then(
      (val) => {
        window.clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      }
    );
  });
}

function classifySyncError(error: unknown): {
  isPermanentRuleFailure: boolean;
  reason: string;
} {
  let rawMessage = error instanceof Error ? error.message : String(error || 'Unknown error');
  // Unwrap handleFirestoreError JSON payload if present
  try {
    const parsed = JSON.parse(rawMessage) as { error?: string };
    if (parsed && typeof parsed.error === 'string') {
      rawMessage = parsed.error;
    }
  } catch {
    // Plain error string
  }

  const lower = rawMessage.toLowerCase();
  if (
    lower.includes('network_timeout') ||
    lower.includes('offline') ||
    lower.includes('unavailable') ||
    lower.includes('network') ||
    lower.includes('failed to fetch') ||
    lower.includes('deadline-exceeded')
  ) {
    return {
      isPermanentRuleFailure: false,
      reason: 'Waiting for stable internet connection',
    };
  }

  if (
    lower.includes('permission-denied') ||
    lower.includes('missing or insufficient permissions')
  ) {
    return {
      isPermanentRuleFailure: true,
      reason: 'Form may be closed, unpublished, or response already synced',
    };
  }

  return {
    isPermanentRuleFailure: false,
    reason: rawMessage.slice(0, 160),
  };
}

export async function submitFormResponseResilient(params: {
  form: CustomForm;
  respondentName: string;
  respondentEmail: string;
  answers: Record<string, string | string[]>;
  score: number;
  maxScore: number;
  /** When true (e.g. Offline Fill Mode), caches immediately and flushes in background if online */
  preferOfflineQueue?: boolean;
}): Promise<ResilientSubmitOutcome> {
  const { form, respondentName, respondentEmail, answers, score, maxScore, preferOfflineQueue } =
    params;
  const responseId = generateResponseId();
  const now = Date.now();
  const canSyncToCloud = Boolean(form.syncedToCloud && form.ownerId);

  if (!canSyncToCloud) {
    const record: FormResponseRecord = {
      id: responseId,
      formId: form.id,
      respondentName,
      respondentEmail,
      answers,
      score,
      maxScore,
      submittedAtMs: now,
      source: 'local',
      syncStatus: 'local',
    };
    saveLocalFormResponse(record);
    return { mode: 'local_only', record };
  }

  const onlineNow = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!onlineNow || preferOfflineQueue) {
    const record: FormResponseRecord = {
      id: responseId,
      formId: form.id,
      respondentName,
      respondentEmail,
      answers,
      score,
      maxScore,
      submittedAtMs: now,
      source: 'local',
      syncStatus: 'pending',
    };
    saveLocalFormResponse(record);
    const queueItem = enqueuePendingFormSubmission({
      id: responseId,
      formId: form.id,
      formTitle: form.title || 'Untitled Form',
      ownerId: form.ownerId!,
      respondentName,
      respondentEmail,
      answers,
      score,
      maxScore,
      createdAtMs: now,
    });
    if (onlineNow && preferOfflineQueue) {
      // Trigger non-blocking background push immediately
      void flushPendingSyncQueue({ formId: form.id });
    }
    return { mode: 'queued', record, queueItem };
  }

  // Online direct push with timeout fallback to Pending Sync queue
  try {
    const cloudRecord = await withTimeout(
      submitCloudFormResponse({
        responseId,
        formId: form.id,
        ownerId: form.ownerId!,
        respondentName,
        respondentEmail,
        answers,
        score,
        maxScore,
      }),
      10000
    );
    const syncedRecord: FormResponseRecord = {
      ...cloudRecord,
      source: 'cloud',
      syncStatus: 'synced',
    };
    return { mode: 'synced', record: syncedRecord };
  } catch (err) {
    const { reason } = classifySyncError(err);
    const record: FormResponseRecord = {
      id: responseId,
      formId: form.id,
      respondentName,
      respondentEmail,
      answers,
      score,
      maxScore,
      submittedAtMs: now,
      source: 'local',
      syncStatus: 'pending',
    };
    saveLocalFormResponse(record);
    const queueItem = enqueuePendingFormSubmission({
      id: responseId,
      formId: form.id,
      formTitle: form.title || 'Untitled Form',
      ownerId: form.ownerId!,
      respondentName,
      respondentEmail,
      answers,
      score,
      maxScore,
      createdAtMs: now,
      lastError: reason,
    });
    return { mode: 'queued', record, queueItem };
  }
}

export async function flushPendingSyncQueue(options?: {
  formId?: string;
  includeFailed?: boolean;
}): Promise<SyncRunSummary> {
  if (typeof window === 'undefined') {
    return {
      attempted: 0,
      synced: 0,
      failed: 0,
      remaining: 0,
      syncedIds: [],
      finishedAtMs: Date.now(),
    };
  }

  if (activeFlushPromise) {
    return activeFlushPromise;
  }

  const run = async (): Promise<SyncRunSummary> => {
    if (!navigator.onLine) {
      const remaining = readRawQueue().length;
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        remaining,
        syncedIds: [],
        finishedAtMs: Date.now(),
      };
    }

    const initialQueue = readRawQueue();
    const candidates = initialQueue.filter((item) => {
      if (options?.formId && item.formId !== options.formId) return false;
      if (item.status === 'failed' && !options?.includeFailed) return false;
      return true;
    });

    if (candidates.length === 0) {
      return {
        attempted: 0,
        synced: 0,
        failed: 0,
        remaining: initialQueue.length,
        syncedIds: [],
        finishedAtMs: Date.now(),
      };
    }

    isCurrentlySyncing = true;
    notifySyncSubscribers();

    let attempted = 0;
    let synced = 0;
    let failed = 0;
    const syncedIds: string[] = [];

    try {
      for (const candidate of candidates) {
        if (!navigator.onLine) break;
        attempted++;

        // Mark item as actively syncing
        const beforeList = readRawQueue().map((it) =>
          it.id === candidate.id
            ? {
                ...it,
                status: 'syncing' as PendingSyncStatus,
                attempts: it.attempts + 1,
                lastAttemptAtMs: Date.now(),
              }
            : it
        );
        writeRawQueue(beforeList);

        try {
          await withTimeout(
            submitCloudFormResponse({
              responseId: candidate.id,
              formId: candidate.formId,
              ownerId: candidate.ownerId,
              respondentName: candidate.respondentName,
              respondentEmail: candidate.respondentEmail,
              answers: candidate.answers,
              score: candidate.score,
              maxScore: candidate.maxScore,
            }),
            12000
          );

          synced++;
          syncedIds.push(candidate.id);
          // Remove from pending queue & upgrade local copy to synced
          const afterSuccess = readRawQueue().filter((it) => it.id !== candidate.id);
          writeRawQueue(afterSuccess);
          updateLocalFormResponse(candidate.id, {
            source: 'cloud',
            syncStatus: 'synced',
          });
        } catch (err) {
          failed++;
          const { isPermanentRuleFailure, reason } = classifySyncError(err);
          const nextStatus: PendingSyncStatus = isPermanentRuleFailure ? 'failed' : 'pending';
          const afterFailure = readRawQueue().map((it) =>
            it.id === candidate.id
              ? {
                  ...it,
                  status: nextStatus,
                  lastError: reason,
                }
              : it
          );
          writeRawQueue(afterFailure);
          updateLocalFormResponse(candidate.id, {
            syncStatus: nextStatus === 'failed' ? 'failed' : 'pending',
          });

          // If network dropped mid-batch, stop attempting remaining items
          if (!navigator.onLine) break;
        }
      }
    } finally {
      isCurrentlySyncing = false;
      const remaining = readRawQueue().length;
      const summary: SyncRunSummary = {
        attempted,
        synced,
        failed,
        remaining,
        syncedIds,
        finishedAtMs: Date.now(),
      };
      if (attempted > 0) {
        lastSyncRunSummary = summary;
      }
      notifySyncSubscribers();
    }

    return {
      attempted,
      synced,
      failed,
      remaining: readRawQueue().length,
      syncedIds,
      finishedAtMs: Date.now(),
    };
  };

  activeFlushPromise = run().finally(() => {
    activeFlushPromise = null;
  });

  return activeFlushPromise;
}

export async function retryPendingSyncItem(id: string): Promise<boolean> {
  if (typeof window === 'undefined' || !navigator.onLine) return false;
  const list = readRawQueue();
  const target = list.find((it) => it.id === id);
  if (!target) return false;

  // Reset status to pending and flush just this form (with includeFailed)
  writeRawQueue(
    list.map((it) =>
      it.id === id ? { ...it, status: 'pending', lastError: undefined } : it
    )
  );
  const summary = await flushPendingSyncQueue({
    formId: target.formId,
    includeFailed: false,
  });
  return summary.syncedIds.includes(id);
}
