'use client';

import { GroupTasksView } from '@/components/GroupTasksView';
import { usePickerwel } from '@/components/PickerwelProvider';

export default function GroupsPage() {
  const { groupsSyncKey } = usePickerwel();
  return <GroupTasksView syncFromWheelKey={groupsSyncKey} />;
}
