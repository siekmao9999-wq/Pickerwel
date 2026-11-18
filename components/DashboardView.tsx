'use client';

import React, { useState } from 'react';
import {
  Search,
  Plus,
  Play,
  Pencil,
  Copy,
  Trash2,
  Clock,
  ArrowRight,
  UserPlus,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { MiniWheelPreview } from './MiniWheelPreview';
import { COPY } from '@/lib/i18n';
import type { SavedWheel } from '@/lib/firestore-service';
import { ApprovalGateBanner } from './ApprovalGateBanner';

export function DashboardView() {
  const {
    user,
    userProfile,
    passcodeSession,
    isSignedIn,
    currentDisplayName,
    isApprovedCloudUser,
    authLoading,
    openAuthModal,
    signOut,
    settings,
    wheels,
    activeWheel,
    selectWheel,
    createNewWheel,
    duplicateWheel,
    deleteWheel,
    history,
    setActiveNav,
  } = usePickerwel();

  const t = COPY[settings.language];
  const [searchQuery, setSearchQuery] = useState('');

  const filteredWheels = wheels.filter((w) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      w.title.toLowerCase().includes(q) ||
      w.entries.some((e) => e.toLowerCase().includes(q))
    );
  });

  const handleOpenWheel = (wheel: SavedWheel) => {
    selectWheel(wheel.id);
    setActiveNav('home');
  };

  const handleCreateNew = async () => {
    await createNewWheel();
    setActiveNav('home');
  };

  const isPasscodeRevoked = Boolean(
    passcodeSession && (passcodeSession.status === 'rejected' || !passcodeSession.passcodeActive)
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Bar: Greeting / Name + Live Search + Create Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white truncate">
              {isSignedIn ? t.dashboardGreeting(currentDisplayName) : t.dashboardGuestTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {isApprovedCloudUser
                ? `${t.navMyWheels} · ${wheels.length}`
                : passcodeSession
                ? `${t.authPasscodeBadge}: ${passcodeSession.passcode} · ${wheels.length}`
                : t.dashboardGuestBanner}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t.searchWheelsPlaceholder}
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="button"
              onClick={handleCreateNew}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{t.newWheel}</span>
            </button>
          </div>
        </div>

        {/* Pending / Rejected Approval Gate */}
        {user && userProfile && userProfile.status !== 'approved' && (
          <ApprovalGateBanner
            status={userProfile.status}
            email={user.email || userProfile.email}
            language={settings.language}
            onSignOut={signOut}
          />
        )}

        {!user && isPasscodeRevoked && passcodeSession && (
          <ApprovalGateBanner
            status="rejected"
            email={`${passcodeSession.displayName} · ${passcodeSession.passcode}`}
            language={settings.language}
            customDesc={t.rejectedPasscodeDesc}
            onSignOut={signOut}
          />
        )}

        {/* Unauthenticated Registration Prompt */}
        {!isSignedIn && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-blue-50/70 dark:bg-slate-900 border border-blue-200 dark:border-slate-800">
            <div className="min-w-0">
              <p className="font-display text-base font-semibold text-slate-900 dark:text-white">
                {t.createAccountCta}
              </p>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
                {t.signInSubtext}
              </p>
            </div>
            <button
              type="button"
              onClick={openAuthModal}
              disabled={authLoading}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4" />
              <span>{t.createAccountCta}</span>
            </button>
          </div>
        )}

        {/* My Wheels Grid Cards */}
        <section aria-labelledby="my-wheels-heading">
          <h2
            id="my-wheels-heading"
            className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-4"
          >
            {t.navMyWheels}
          </h2>

          {filteredWheels.length === 0 ? (
            <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <p className="font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                {t.noWheelsTitle}
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {t.noWheelsDesc}
              </p>
              <div className="mt-5 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleCreateNew}
                  className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-medium cursor-pointer"
                >
                  {t.newWheel}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveNav('templates')}
                  className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.navTemplates}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredWheels.map((wheel) => {
                const isActive = wheel.id === activeWheel.id;
                return (
                  <div
                    key={wheel.id}
                    className={`flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border transition-colors ${
                      isActive
                        ? 'border-blue-400 dark:border-blue-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <MiniWheelPreview
                        entriesCount={wheel.entries.length}
                        paletteId={wheel.paletteId}
                        size={56}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                          {wheel.title}
                        </h3>
                        {/* Unboxed metadata per Zero-Pill rule */}
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          {t.entriesCount(wheel.entries.length)}
                          <span aria-hidden="true"> · </span>
                          {t.spinsCount(wheel.spinCount)}
                        </p>
                        {wheel.lastWinner && (
                          <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 truncate">
                            {wheel.lastWinner}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenWheel(wheel)}
                          className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{t.playWheel}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenWheel(wheel)}
                          className="min-h-[38px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>{t.editWheel}</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => duplicateWheel(wheel)}
                          aria-label={t.duplicateWheel}
                          title={t.duplicateWheel}
                          className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {wheels.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteWheel(wheel.id)}
                            aria-label={t.deleteWheel}
                            title={t.deleteWheel}
                            className="min-h-[38px] min-w-[38px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Results Preview Section */}
        <section aria-labelledby="recent-results-heading">
          <div className="flex items-center justify-between mb-3">
            <h2
              id="recent-results-heading"
              className="font-display text-lg font-semibold text-slate-900 dark:text-white"
            >
              {t.historyTitle}
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => setActiveNav('history')}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <span>{t.navHistory}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-3">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{t.historyEmptyDesc}</span>
            </div>
          ) : (
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {history.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: item.winnerColor }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {item.winner}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.wheelTitle}
                        <span aria-hidden="true"> · </span>
                        {item.removedAfterSpin ? t.removedTag : t.keptTag}
                      </p>
                    </div>
                  </div>
                  <time className="text-xs text-slate-400 dark:text-slate-500 tabular-nums shrink-0">
                    {new Date(item.spunAtMs).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
