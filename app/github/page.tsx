'use client';

import dynamic from 'next/dynamic';

const GitHubConnectPanel = dynamic(
  () =>
    import('@/components/GitHubConnectPanel').then((m) => m.GitHubConnectPanel),
  { ssr: false }
);

export default function GitHubPage() {
  return <GitHubConnectPanel />;
}
