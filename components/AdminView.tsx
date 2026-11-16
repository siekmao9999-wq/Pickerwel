'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { COPY } from '@/lib/i18n';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  type AccountStatus,
  type UserPreferences,
} from '@/lib/firestore-service';

export function AdminView() {
  const { user, userProfile, allUsers, reviewUser, settings } = usePickerwel();
  const t = COPY[settings.language];
  const [filter, setFilter] = useState<'all' | AccountStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  if (!user || userProfile?.role !== 'admin') {
    return null;
  }

  const filtered = allUsers.filter((u) => {
    if (filter !== 'all' && u.status !== filter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const pendingCount = allUsers.filter((u) => u.status === 'pending').length;

  const handleAction = async (
    target: UserPreferences,
    nextStatus: AccountStatus,
    nextRole: 'user' | 'admin'
  ) => {
    setBusyUid(target.uid);
    try {
      await reviewUser(target.uid, nextStatus, nextRole);
    } finally {
      setBusyUid(null);
    }
  };

  const filterTabs: { id: 'all' | AccountStatus; label: string }[] = [
    { id: 'pending', label: `${t.filterPending} (${pendingCount})` },
    { id: 'approved', label: t.filterApproved },
    { id: 'rejected', label: t.filterRejected },
    { id: 'all', label: t.filterAll },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.adminTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.adminDesc}
            </p>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchUsersPlaceholder}
              className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Status Filter Segmented Bar */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                filter === tab.id
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* User List */}
        {filtered.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
            {t.noUsersInFilter}
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map((item) => {
              const isSelf = item.uid === user.uid;
              const isPrimaryAdmin = item.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
              const isBusy = busyUid === item.uid;

              return (
                <div
                  key={item.uid}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                        {item.displayName}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        · {item.role === 'admin' ? t.roleAdmin : t.roleUser}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          item.status === 'approved'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : item.status === 'rejected'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {item.status === 'approved' ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : item.status === 'rejected' ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span>
                          {item.status === 'approved'
                            ? t.statusApproved
                            : item.status === 'rejected'
                            ? t.statusRejected
                            : t.statusPending}
                        </span>
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {item.email || item.uid}
                      <span aria-hidden="true"> · </span>
                      <span className="tabular-nums">
                        {new Date(item.createdAtMs).toLocaleDateString()}
                      </span>
                    </p>
                  </div>

                  {!isPrimaryAdmin && !isSelf && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {item.status !== 'approved' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(item, 'approved', item.role)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>{t.approveBtn}</span>
                        </button>
                      )}

                      {item.status !== 'rejected' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleAction(item, 'rejected', 'user')}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>{t.rejectBtn}</span>
                        </button>
                      )}

                      {item.status === 'approved' && (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            handleAction(
                              item,
                              'approved',
                              item.role === 'admin' ? 'user' : 'admin'
                            )
                          }
                          className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                        >
                          <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
                          <span>
                            {item.role === 'admin' ? t.removeAdminBtn : t.makeAdminBtn}
                          </span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
