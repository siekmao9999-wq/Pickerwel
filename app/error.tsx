'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { usePickerwel } from '@/components/PickerwelProvider';
import { attemptChunkRecovery, isChunkLoadError } from '@/lib/chunk-recovery';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { settings } = usePickerwel();
  const isKm = settings.language === 'km';

  const isChunkError = isChunkLoadError(error);

  useEffect(() => {
    if (isChunkError) {
      attemptChunkRecovery();
    }
  }, [isChunkError]);

  const handleHardReload = () => {
    window.location.reload();
  };

  return (
    <main className="flex-1 min-h-0 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 text-center space-y-5 shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white text-balance">
            {isKm ? 'មានបញ្ហាក្នុងការផ្ទុកទំព័រនេះ' : 'Could not load this page'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {isChunkError
              ? isKm
                ? 'កម្មវិធីត្រូវបានធ្វើបច្ចុប្បន្នភាព ឬការតភ្ជាប់ផ្ទុកទំព័រត្រូវបានរំខាន។ សូមផ្ទុកទំព័រឡើងវិញដើម្បីបន្ត។'
                : 'The app was updated or the page module failed to load. Reload the page to continue.'
              : isKm
                ? 'សូមព្យាយាមផ្ទុកទំព័រឡើងវិញ ឬត្រឡប់ទៅទំព័រដើម។'
                : 'Please try reloading the page or return to the home screen.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={isChunkError ? handleHardReload : () => reset()}
            className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span>{isKm ? 'ផ្ទុកទំព័រឡើងវិញ' : 'Reload Page'}</span>
          </button>

          <button
            type="button"
            onClick={() => window.location.assign('/')}
            className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Home className="w-4 h-4 shrink-0" />
            <span>{isKm ? 'ទំព័រដើម' : 'Back to Home'}</span>
          </button>
        </div>
      </div>
    </main>
  );
}
