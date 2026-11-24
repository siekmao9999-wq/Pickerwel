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
      <div className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-4">
        <div className="h-28 w-full rounded-xl bg-purple-200/40 dark:bg-slate-800/70" />
        <div className="h-48 w-full rounded-xl bg-slate-200/60 dark:bg-slate-800/50" />
      </div>
    ),
  }
);

export default function FormsBuilderPage() {
  return <GoogleFormBuilderView />;
}
