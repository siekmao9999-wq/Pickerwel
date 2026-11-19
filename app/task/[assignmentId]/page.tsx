'use client';

import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';

const StudentPracticeView = dynamic(
  () =>
    import('@/components/StudentPracticeView').then((m) => m.StudentPracticeView),
  { ssr: false }
);

export default function StudentTaskPracticePage() {
  const params = useParams<{ assignmentId?: string }>();
  const assignmentId = typeof params?.assignmentId === 'string' ? params.assignmentId : '';
  return <StudentPracticeView assignmentId={assignmentId} />;
}
