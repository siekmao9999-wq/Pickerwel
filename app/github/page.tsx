'use client';

import dynamic from 'next/dynamic';

const GitHubConnectPanel = dynamic(
  () =>
    import('@/components/GitHubConnectPanel').then((m) => m.GitHubConnectPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-6 max-w-4xl mx-auto w-full space-y-5">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded-lg bg-slate-200/80 dark:bg-slate-800 animate-pulse" />
          <div className="h-4 w-72 rounded bg-slate-200/60 dark:bg-slate-800/70 animate-pulse" />
        </div>
        <div className="h-56 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 animate-pulse" />
      </div>
    ),
  }
);

export default function GitHubPage() {
  return <GitHubConnectPanel />;
}
