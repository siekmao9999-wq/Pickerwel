'use client';

import React, { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { NameScannerModal } from '@/components/NameScannerModal';
import { usePickerwel } from '@/components/PickerwelProvider';

function ScanContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab');
  const initialTab =
    tabParam === 'document' || tabParam === 'create-qr' ? tabParam : 'scan';

  const { activeWheel, updateActiveWheel, settings } = usePickerwel();

  return (
    <div className="flex-1 min-h-0 flex items-center justify-center p-4">
      <NameScannerModal
        isOpen
        initialTab={initialTab}
        entries={activeWheel.entries}
        wheelTitle={activeWheel.title}
        language={settings.language}
        soundEnabled={settings.soundEnabled}
        hapticsEnabled={settings.hapticsEnabled}
        onClose={() => router.push('/')}
        onApplyEntries={(nextEntries) => {
          updateActiveWheel({ entries: nextEntries });
        }}
      />
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <ScanContent />
    </Suspense>
  );
}
