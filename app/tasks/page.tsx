'use client';

import dynamic from 'next/dynamic';

const StudentTasksView = dynamic(
  () => import('@/components/StudentTasksView').then((m) => m.StudentTasksView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-7 w-56 rounded-lg bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
            <div className="h-4 w-80 rounded bg-slate-200/60 dark:bg-slate-800/70 animate-pulse" />
          </div>
          <div className="h-10 w-36 rounded-xl bg-blue-500/20 animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 animate-pulse" />
          <div className="h-40 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 animate-pulse" />
        </div>
      </div>
    ),
  }
);

export default function StudentTasksPage() {
  return <StudentTasksView />;
}
