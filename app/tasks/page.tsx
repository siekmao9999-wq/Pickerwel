'use client';

import dynamic from 'next/dynamic';

const StudentTasksView = dynamic(
  () => import('@/components/StudentTasksView').then((m) => m.StudentTasksView),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="h-8 w-64 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
        <div className="h-36 w-full rounded-2xl bg-slate-200/50 dark:bg-slate-800/50" />
      </div>
    ),
  }
);

export default function StudentTasksPage() {
  return <StudentTasksView />;
}
