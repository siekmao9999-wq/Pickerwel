'use client';

import React, { useState } from 'react';
import {
  X,
  CloudUpload,
  CloudOff,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Wifi,
  WifiOff,
  Mail,
} from 'lucide-react';
import type { PendingFormSubmission } from '@/lib/form-sync-queue';
import type { Language } from '@/lib/i18n';

interface PendingSyncQueueModalProps {
  open: boolean;
  language: Language;
  accentColor?: string;
  items: PendingFormSubmission[];
  isOnline: boolean;
  isSyncing: boolean;
  scopedTitle?: string;
  onClose: () => void;
  onSyncNow: () => Promise<unknown> | void;
  onRetryItem: (id: string) => Promise<unknown> | void;
  onRemoveItem: (id: string) => void;
  onClearAll?: () => void;
}

export function PendingSyncQueueModal({
  open,
  language,
  accentColor = '#673AB7',
  items,
  isOnline,
  isSyncing,
  scopedTitle,
  onClose,
  onSyncNow,
  onRetryItem,
  onRemoveItem,
  onClearAll,
}: PendingSyncQueueModalProps) {
  const km = language === 'km';
  const [retryingId, setRetryingId] = useState<string | null>(null);

  if (!open) return null;

  const pendingCount = items.filter(
    (i) => i.status === 'pending' || i.status === 'syncing'
  ).length;
  const failedCount = items.filter((i) => i.status === 'failed').length;

  const formatTime = (ms: number) => {
    try {
      return new Date(ms).toLocaleString(km ? 'km-KH' : 'en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return new Date(ms).toLocaleTimeString();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl max-h-[85dvh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Strip */}
        <div className="h-1.5 w-full shrink-0" style={{ backgroundColor: accentColor }} />

        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CloudUpload className="w-5 h-5 shrink-0" style={{ color: accentColor }} />
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                {km ? 'បញ្ជីរង់ចាំបញ្ជូនទៅ Cloud (Pending Sync)' : 'Pending Sync Queue'}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {scopedTitle
                ? km
                  ? `ចម្លើយ Offline សម្រាប់ទម្រង់ «${scopedTitle}» — នឹងបញ្ជូនទៅ Cloud ដោយស្វ័យប្រវត្តិពេលមានអ៊ីនធឺណិត។`
                  : `Cached offline submissions for "${scopedTitle}" — pushed automatically once you reconnect.`
                : km
                  ? 'ចម្លើយ Form ដែលបានរក្សាទុកក្នុងឧបករណ៍ពេលអត់អ៊ីនធឺណិត នឹងបញ្ជូនឡើង Cloud ដោយស្វ័យប្រវត្តិពេលភ្ជាប់អ៊ីនធឺណិតវិញ។'
                  : 'Locally cached form submissions automatically upload to the cloud once your device reconnects to the internet.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={km ? 'បិទ' : 'Close'}
            className="min-h-[34px] min-w-[34px] rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Connection + Summary Action Bar */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                <Wifi className="w-3.5 h-3.5" />
                <span>{km ? 'មានអ៊ីនធឺណិត (Online)' : 'Online'}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
                <WifiOff className="w-3.5 h-3.5" />
                <span>{km ? 'កំពុង Offline — រង់ចាំការតភ្ជាប់' : 'Offline — waiting to reconnect'}</span>
              </span>
            )}
            {items.length > 0 && (
              <span className="text-slate-400 dark:text-slate-500">·</span>
            )}
            {items.length > 0 && (
              <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {pendingCount > 0
                  ? km
                    ? `${pendingCount} រង់ចាំ`
                    : `${pendingCount} queued`
                  : ''}
                {pendingCount > 0 && failedCount > 0 ? ' · ' : ''}
                {failedCount > 0
                  ? km
                    ? `${failedCount} ត្រូវពិនិត្យ`
                    : `${failedCount} failed`
                  : ''}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button
                type="button"
                disabled={!isOnline || isSyncing}
                onClick={() => void onSyncNow()}
                className="min-h-[34px] px-3 rounded-lg text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50 cursor-pointer"
                style={{ backgroundColor: accentColor }}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncing
                    ? km
                      ? 'កំពុងបញ្ជូន...'
                      : 'Syncing...'
                    : km
                      ? 'បញ្ជូនឥឡូវ (Sync Now)'
                      : 'Sync Now'}
                </span>
              </button>
            )}
            {items.length > 0 && onClearAll && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={onClearAll}
                className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 disabled:opacity-50 cursor-pointer"
              >
                {km ? 'សម្អាតទាំងអស់' : 'Clear'}
              </button>
            )}
          </div>
        </div>

        {/* Queue List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
          {items.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500" />
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {km
                  ? 'ចម្លើយទាំងអស់ត្រូវបានបញ្ជូនទៅ Cloud រួចរាល់!'
                  : 'All form submissions are synced!'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                {km
                  ? 'មិនមានចម្លើយរង់ចាំនៅក្នុងបញ្ជី Pending Sync ទេ។ រាល់ចម្លើយថ្មីដែលផ្ញើពេលអត់អ៊ីនធឺណិត នឹងបង្ហាញនៅទីនេះ។'
                  : 'There are no pending offline submissions right now. Any submissions made while offline will appear here automatically.'}
              </p>
            </div>
          ) : (
            items.map((item) => {
              const isItemSyncing = item.status === 'syncing' || retryingId === item.id;
              const isFailed = item.status === 'failed';
              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 transition-colors ${
                    isFailed
                      ? 'border-rose-200 dark:border-rose-900/70 bg-rose-50/50 dark:bg-rose-950/20'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                          {item.respondentName || (km ? 'អ្នកឆ្លើយអនាមិក' : 'Anonymous')}
                        </span>
                        {item.maxScore > 0 && (
                          <span className="text-[11px] font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                            {item.score}/{item.maxScore}
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${
                            isItemSyncing
                              ? 'bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300'
                              : isFailed
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300'
                                : 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                          }`}
                        >
                          {isItemSyncing ? (
                            <>
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{km ? 'កំពុងបញ្ជូន' : 'Syncing'}</span>
                            </>
                          ) : isFailed ? (
                            <>
                              <AlertTriangle className="w-3 h-3" />
                              <span>{km ? 'មិនអាចបញ្ជូនបាន' : 'Needs attention'}</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>{km ? 'រង់ចាំអ៊ីនធឺណិត' : 'Pending Sync'}</span>
                            </>
                          )}
                        </span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                        {item.formTitle}
                      </p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                        <span suppressHydrationWarning>{formatTime(item.createdAtMs)}</span>
                        {item.respondentEmail && (
                          <span className="inline-flex items-center gap-1 font-mono truncate">
                            <Mail className="w-3 h-3" />
                            {item.respondentEmail}
                          </span>
                        )}
                        {item.attempts > 0 && (
                          <span className="font-mono tabular-nums">
                            {km ? `សាកល្បង ${item.attempts} ដង` : `${item.attempts} attempt${item.attempts === 1 ? '' : 's'}`}
                          </span>
                        )}
                      </div>

                      {item.lastError && (
                        <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1">
                          <CloudOff className="w-3 h-3 shrink-0" />
                          <span>{item.lastError}</span>
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={!isOnline || isSyncing || isItemSyncing}
                        onClick={async () => {
                          setRetryingId(item.id);
                          try {
                            await onRetryItem(item.id);
                          } finally {
                            setRetryingId(null);
                          }
                        }}
                        title={km ? 'ព្យាយាមបញ្ជូនម្តងទៀត' : 'Retry upload now'}
                        className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${isItemSyncing ? 'animate-spin' : ''}`}
                        />
                      </button>
                      <button
                        type="button"
                        disabled={isItemSyncing}
                        onClick={() => onRemoveItem(item.id)}
                        title={km ? 'លុបចេញពីបញ្ជីរង់ចាំ' : 'Remove from queue'}
                        className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:border-rose-200 dark:hover:border-rose-900 disabled:opacity-40 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
