'use client';

import { AdminView } from '@/components/AdminView';
import { SettingsView } from '@/components/SettingsView';
import { usePickerwel } from '@/components/PickerwelProvider';

export default function AdminPage() {
  const { user, userProfile } = usePickerwel();
  const isAdmin = Boolean(
    user && userProfile?.role === 'admin' && userProfile?.status === 'approved'
  );
  return isAdmin ? <AdminView /> : <SettingsView />;
}
