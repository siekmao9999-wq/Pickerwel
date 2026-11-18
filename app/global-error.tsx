'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { attemptChunkRecovery, isChunkLoadError } from '@/lib/chunk-recovery';

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isChunkError = isChunkLoadError(error);

  useEffect(() => {
    if (isChunkError) {
      attemptChunkRecovery();
    }
  }, [isChunkError]);

  return (
    <html lang="km">
      <body className="min-h-[100dvh] bg-[#F8FAFC] text-slate-900 flex items-center justify-center p-4 antialiased">
        <div className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-lg font-bold text-slate-900 text-balance">
              មានបញ្ហាក្នុងការផ្ទុកកម្មវិធី
            </h1>
            <p className="text-sm text-slate-600 leading-relaxed">
              សូមចុចផ្ទុកទំព័រឡើងវិញ ដើម្បីទទួលយកកំណែថ្មីចុងក្រោយ។
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span>ផ្ទុកទំព័រឡើងវិញ</span>
            </button>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Home className="w-4 h-4 shrink-0" />
              <span>ទំព័រដើម</span>
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
