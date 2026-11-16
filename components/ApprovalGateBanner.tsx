'use client';

import React from 'react';
import { Clock, ShieldAlert, LogOut } from 'lucide-react';
import { COPY, type Language } from '@/lib/i18n';
import type { AccountStatus } from '@/lib/firestore-service';

interface ApprovalGateBannerProps {
  status: AccountStatus;
  email: string;
  language: Language;
  onSignOut: () => void;
}

export function ApprovalGateBanner({
  status,
  email,
  language,
  onSignOut,
}: ApprovalGateBannerProps) {
  const t = COPY[language];
  if (status === 'approved') return null;

  const isRejected = status === 'rejected';

  return (
    <div
      className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isRejected
          ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900'
          : 'bg-amber-50/80 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900'
      }`}
    >
      <div className="flex items-start gap-3.5 min-w-0">
        {isRejected ? (
          <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400 mt-0.5 shrink-0" />
        ) : (
          <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
        )}
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            {isRejected ? t.rejectedTitle : t.pendingApprovalTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {isRejected ? t.rejectedDesc : t.pendingApprovalDesc}
          </p>
          {email && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 truncate">
              {email}
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={onSignOut}
        className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
      >
        <LogOut className="w-3.5 h-3.5" />
        <span>{t.signOut}</span>
      </button>
    </div>
  );
}
