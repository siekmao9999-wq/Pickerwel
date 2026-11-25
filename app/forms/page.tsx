'use client';

import dynamic from 'next/dynamic';

const GoogleFormBuilderView = dynamic(
  () =>
    import('@/components/forms/GoogleFormBuilderView').then(
      (m) => m.GoogleFormBuilderView
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#F6F8FC] dark:bg-[#0B1120] canvas-dot-grid">
        {/* Skeleton Header matching Form Builder top bar & sub-tabs */}
        <div className="shrink-0 bg-white/95 dark:bg-slate-900/95 border-b border-slate-200/80 dark:border-slate-800/80 px-5 pt-3 pb-2.5 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/20 animate-pulse" />
              <div className="h-5 w-48 rounded-lg bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
              <div className="h-9 w-24 rounded-xl bg-indigo-500/25 dark:bg-indigo-500/25 animate-pulse" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-8">
            <div className="h-4 w-24 rounded bg-indigo-500/30 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-24 rounded bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
          </div>
        </div>

        {/* Skeleton Form Cards matching actual builder geometry */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-[760px] mx-auto space-y-4">
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 overflow-hidden shadow-xs">
              <div className="h-2.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500 opacity-75" />
              <div className="p-6 space-y-3">
                <div className="h-7 w-2/3 rounded-lg bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
                <div className="h-4 w-4/5 rounded bg-slate-200/60 dark:bg-slate-800/70 animate-pulse" />
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex gap-2">
                  <div className="h-7 w-24 rounded-lg bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
                  <div className="h-7 w-28 rounded-lg bg-slate-200/70 dark:bg-slate-800 animate-pulse" />
                  <div className="h-7 w-32 rounded-lg bg-indigo-500/15 animate-pulse" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="h-10 flex-1 rounded-lg bg-slate-100 dark:bg-slate-800/80 animate-pulse" />
                <div className="h-10 w-36 rounded-lg bg-slate-100 dark:bg-slate-800/80 animate-pulse" />
              </div>
              <div className="space-y-2.5 pt-1">
                <div className="h-5 w-1/2 rounded bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
                <div className="h-5 w-2/5 rounded bg-slate-100 dark:bg-slate-800/60 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  }
);

export default function FormsBuilderPage() {
  return <GoogleFormBuilderView />;
}
