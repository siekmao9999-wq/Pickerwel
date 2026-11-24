'use client';

import dynamic from 'next/dynamic';

const GitHubConnectPanel = dynamic(
  () =>
    import('@/components/GitHubConnectPanel').then((m) => m.GitHubConnectPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 p-6 max-w-5xl mx-auto w-full space-y-4">
        <div className="h-8 w-56 rounded-xl bg-slate-200/70 dark:bg-slate-800/70" />
        <div className="h-40 w-full rounded-2xl bg-slate-200/50 dark:bg-slate-800/50" />
      </div>
    ),
  }
);

export default function GitHubPage() {
  return <GitHubConnectPanel />;
}
