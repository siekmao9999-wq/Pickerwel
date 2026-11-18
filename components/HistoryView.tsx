'use client';

import React from 'react';
import { Trash2, Clock, X } from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { COPY } from '@/lib/i18n';

export function HistoryView() {
  const { settings, history, clearHistory, deleteHistoryItem } = usePickerwel();
  const t = COPY[settings.language];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.historyTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 tabular-nums">
              {history.length}
            </p>
          </div>

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => clearHistory()}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-xs font-semibold text-rose-700 dark:text-rose-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.clearHistory}</span>
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
            <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
            <p className="font-display text-base font-semibold text-slate-800 dark:text-slate-200">
              {t.historyEmptyTitle}
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.historyEmptyDesc}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {history.map((item) => (
              <div
                key={item.id}
                className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.winnerColor }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                      {item.winner}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.wheelTitle}
                      <span aria-hidden="true"> · </span>
                      {item.removedAfterSpin ? t.removedTag : t.keptTag}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <time className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {new Date(item.spunAtMs).toLocaleString([], {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                  <button
                    type="button"
                    onClick={() => deleteHistoryItem(item.id)}
                    aria-label={t.deleteWheel}
                    className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
