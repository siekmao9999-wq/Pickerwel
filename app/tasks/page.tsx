'use client';

import dynamic from 'next/dynamic';

const StudentTasksView = dynamic(
  () => import('@/components/StudentTasksView').then((m) => m.StudentTasksView),
  { ssr: false }
);

export default function StudentTasksPage() {
  return <StudentTasksView />;
}
