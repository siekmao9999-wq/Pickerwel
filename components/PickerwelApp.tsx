'use client';

import React, { useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import {
  UserPlus,
  ChevronUp,
  ChevronDown,
  Check,
  Volume2,
  VolumeX,
  Watch,
  Users,
  Timer,
  Minus,
  Plus,
  ScanLine,
  ImageDown,
  QrCode,
  Copy,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { PickerWheelCanvas, type SpinResultPayload } from './PickerWheelCanvas';
import { EntriesPanel } from './EntriesPanel';
import { WinnerModal } from './WinnerModal';
import { QuickStopwatchBar } from './QuickStopwatchBar';
import { QuickGroupSplitPanel } from './QuickGroupSplitPanel';
import { ApprovalGateBanner } from './ApprovalGateBanner';
import { QuickQrModal } from './QuickQrModal';
import { WHEEL_PALETTES, type PaletteId } from '@/lib/palettes';
import { exportWheelSnapshotPng } from '@/lib/wheel-snapshot';
import { playWinSound, triggerHaptic } from '@/lib/sound';
import { COPY } from '@/lib/i18n';

export function PickerwelApp() {
  const router = useRouter();
  const {
    user,
    userProfile,
    passcodeSession,
    isSignedIn,
    isApprovedCloudUser,
    authLoading,
    authError,
    openAuthModal,
    signOut,
    setActiveNav,
    bumpGroupsSyncKey,
    settings,
    updateSettings,
    activeWheel,
    updateActiveWheel,
    createNewWheel,
    logSpinOutcome,
    saveStatus,
    hoveredSliceIndex,
    setHoveredSliceIndex,
  } = usePickerwel();

  const t = COPY[settings.language];
  const [winnerResult, setWinnerResult] = useState<SpinResultPayload | null>(null);
  const [outcomeLogged, setOutcomeLogged] = useState(false);
  const [spinTriggerCount, setSpinTriggerCount] = useState(0);
  const [showQuickStopwatch, setShowQuickStopwatch] = useState(false);
  const [showQuickGroups, setShowQuickGroups] = useState(false);
  const [timeToSpinEnabled, setTimeToSpinEnabled] = useState(false);
  const [timeToSpinSeconds, setTimeToSpinSeconds] = useState(10);
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [pngSaved, setPngSaved] = useState(false);
  const [appLinkCopied, setAppLinkCopied] = useState(false);
  const [quickQrOpen, setQuickQrOpen] = useState(false);
  const sheetTouchStartY = useRef<number | null>(null);
  const quickGroupsRef = useRef<HTMLDivElement | null>(null);
  const pngTimerRef = useRef<number | null>(null);

  const handleCopyAppLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const url = window.location.origin;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setAppLinkCopied(true);
    window.setTimeout(() => setAppLinkCopied(false), 1800);
  }, []);

  const handleExportWheelPng = useCallback(async () => {
    if (activeWheel.entries.length === 0 || exportingPng) return;
    setExportingPng(true);
    try {
      await exportWheelSnapshotPng({
        title: activeWheel.title || t.listTitle,
        entries: activeWheel.entries,
        paletteId: activeWheel.paletteId,
        language: settings.language,
        theme: settings.theme,
      });
      setPngSaved(true);
      if (pngTimerRef.current) window.clearTimeout(pngTimerRef.current);
      pngTimerRef.current = window.setTimeout(() => setPngSaved(false), 1800);
    } finally {
      setExportingPng(false);
    }
  }, [
    activeWheel.entries,
    activeWheel.paletteId,
    activeWheel.title,
    exportingPng,
    settings.language,
    settings.theme,
    t.listTitle,
  ]);

  const handleSpinComplete = useCallback(
    (result: SpinResultPayload) => {
      setWinnerResult(result);
      setOutcomeLogged(false);

      if (settings.soundEnabled) {
        playWinSound();
      }
      if (settings.hapticsEnabled) {
        triggerHaptic([45, 30, 80]);
      }
      if (
        settings.confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        const colors =
          WHEEL_PALETTES[activeWheel.paletteId]?.colors || [
            '#3B82F6',
            '#FBBF24',
            '#10B981',
            '#FF5A5F',
          ];
        confetti({
          particleCount: 90,
          spread: 72,
          origin: { y: 0.56 },
          colors,
        });
      }
    },
    [
      activeWheel.paletteId,
      settings.confettiEnabled,
      settings.hapticsEnabled,
      settings.soundEnabled,
    ]
  );

  const handleRemoveWinner = async () => {
    if (!winnerResult) return;
    const updated = activeWheel.entries.filter((_, i) => i !== winnerResult.winnerIndex);
    updateActiveWheel({ entries: updated });
    if (!outcomeLogged) {
      setOutcomeLogged(true);
      await logSpinOutcome({
        winner: winnerResult.winner,
        winnerColor: winnerResult.winnerColor,
        removedAfterSpin: true,
        updatedEntries: updated,
      });
    }
    setWinnerResult(null);
  };

  const handleKeepAndSpinAgain = async () => {
    if (winnerResult && !outcomeLogged) {
      setOutcomeLogged(true);
      await logSpinOutcome({
        winner: winnerResult.winner,
        winnerColor: winnerResult.winnerColor,
        removedAfterSpin: false,
      });
    }
    setWinnerResult(null);
    setSpinTriggerCount((c) => c + 1);
  };

  const handleCloseWinnerModal = async () => {
    if (winnerResult && !outcomeLogged) {
      setOutcomeLogged(true);
      await logSpinOutcome({
        winner: winnerResult.winner,
        winnerColor: winnerResult.winnerColor,
        removedAfterSpin: false,
      });
    }
    setWinnerResult(null);
  };

  const isPasscodeRevoked = Boolean(
    passcodeSession &&
      (passcodeSession.status === 'rejected' || !passcodeSession.passcodeActive)
  );

  return (
    <div className="flex-1 flex flex-col md:flex-row min-w-0 min-h-0 overflow-hidden">
      {/* Center Main Wheel Stage */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto px-3.5 sm:px-5 lg:px-8 pt-3 sm:pt-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] md:py-5 lg:py-6">
        {/* Workspace Top Strip */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 pb-3.5 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex-1 min-w-[180px]">
            <input
              type="text"
              value={activeWheel.title}
              maxLength={120}
              onChange={(e) => updateActiveWheel({ title: e.target.value })}
              placeholder={t.wheelTitlePlaceholder}
              aria-label={t.wheelTitlePlaceholder}
              className="w-full bg-transparent font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 rounded-lg px-1.5 py-0.5 -ml-1.5"
            />
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>
                  {isApprovedCloudUser
                    ? saveStatus === 'saving'
                      ? t.savingCloud
                      : t.autoSavedCloud
                    : t.autoSavedLocal}
                </span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t.entriesCount(activeWheel.entries.length)}
              </span>
            </div>
          </div>

          {/* Palette Quick Selector, Scanner, PNG Export, Quick Groups, Countdown & Sound */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <div className="hidden sm:flex items-center gap-1.5 p-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              {(Object.keys(WHEEL_PALETTES) as PaletteId[]).map((pid) => {
                const pal = WHEEL_PALETTES[pid];
                const isSelected = activeWheel.paletteId === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    onClick={() => updateActiveWheel({ paletteId: pid })}
                    title={settings.language === 'km' ? pal.nameKm : pal.nameEn}
                    aria-label={settings.language === 'km' ? pal.nameKm : pal.nameEn}
                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-transform cursor-pointer ${
                      isSelected
                        ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-110'
                        : 'opacity-75 hover:opacity-100'
                    }`}
                    style={{
                      background: `conic-gradient(${pal.colors[0]} 0 90deg, ${pal.colors[1]} 90deg 180deg, ${pal.colors[2]} 180deg 270deg, ${pal.colors[3]} 270deg 360deg)`,
                    }}
                  />
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => router.push('/scan')}
              title={t.scanNamesTitle}
              aria-label={t.scanNamesTitle}
              className="min-h-[40px] px-3 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/80 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 text-xs font-semibold text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <ScanLine className="w-4 h-4 shrink-0" />
              <span>{t.scanNamesBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleCopyAppLink}
              title={t.quickAppLinkTitle}
              aria-label={t.quickCopyLinkBtn}
              className="min-h-[40px] px-3 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-950/70 text-xs font-semibold text-indigo-700 dark:text-indigo-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              {appLinkCopied ? (
                <>
                  <Check className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-700 dark:text-emerald-300">
                    {t.tasksCopiedLinkBtn}
                  </span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 shrink-0" />
                  <span>{t.quickCopyLinkBtn}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setQuickQrOpen(true)}
              title={t.quickAppLinkTitle}
              aria-label={t.quickShowQrBtn}
              className="min-h-[40px] px-3 rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-950/70 text-xs font-semibold text-violet-700 dark:text-violet-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>{t.quickShowQrBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('tasks')}
              title={t.tasksPageTitle}
              aria-label={t.tasksPageTitle}
              className="min-h-[40px] px-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <QrCode className="w-4 h-4 shrink-0" />
              <span>{t.tasksNavShort}</span>
            </button>

            <button
              type="button"
              onClick={handleExportWheelPng}
              disabled={activeWheel.entries.length === 0 || exportingPng}
              title={t.downloadPngTitle}
              aria-label={t.downloadPngTitle}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
            >
              {pngSaved ? (
                <>
                  <Check className="w-4 h-4 shrink-0 text-emerald-500" />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t.downloadPngDone}
                  </span>
                </>
              ) : (
                <>
                  <ImageDown className="w-4 h-4 shrink-0 text-[#3B82F6]" />
                  <span>{t.downloadPngBtn}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowQuickGroups((v) => !v)}
              className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showQuickGroups
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Users className="w-4 h-4 shrink-0" />
              <span>{t.quickGroupsToggle}</span>
            </button>

            <button
              type="button"
              onClick={() => setTimeToSpinEnabled((v) => !v)}
              aria-pressed={timeToSpinEnabled}
              title={t.timeToSpinTitle}
              className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                timeToSpinEnabled
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Timer className="w-4 h-4 shrink-0" />
              <span>
                {t.timeToSpinToggle}
                {timeToSpinEnabled
                  ? ` · ${timeToSpinSeconds}${t.timeToSpinSecUnit}`
                  : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowQuickStopwatch((v) => !v)}
              className={`min-h-[40px] px-3 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                showQuickStopwatch
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Watch className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t.quickStopwatchToggle}</span>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
              aria-label={t.soundLabel}
              title={t.soundLabel}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
            >
              {settings.soundEnabled ? (
                <Volume2 className="w-4 h-4 text-[#3B82F6]" />
              ) : (
                <VolumeX className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {!isSignedIn && (
              <button
                type="button"
                onClick={openAuthModal}
                disabled={authLoading}
                className="hidden sm:inline-flex md:hidden min-h-[40px] px-3.5 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.createAccountCta}</span>
              </button>
            )}
          </div>
        </div>

        {authError && authError !== 'auth_popup_closed' && (
          <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">
            {authError === 'auth_popup_blocked'
              ? t.authPopupBlockedHint
              : t.authErrorHint}
          </p>
        )}

        {/* Pending / Rejected Admin Approval Notice if signed in */}
        {user && userProfile && userProfile.status !== 'approved' && (
          <div className="mt-4">
            <ApprovalGateBanner
              status={userProfile.status}
              email={user.email || userProfile.email}
              language={settings.language}
              onSignOut={signOut}
            />
          </div>
        )}

        {!user && isPasscodeRevoked && passcodeSession && (
          <div className="mt-4">
            <ApprovalGateBanner
              status="rejected"
              email={`${passcodeSession.displayName} · ${passcodeSession.passcode}`}
              language={settings.language}
              customDesc={t.rejectedPasscodeDesc}
              onSignOut={signOut}
            />
          </div>
        )}

        {/* Giant Center Wheel */}
        <div className="flex-1 flex flex-col items-center justify-center py-2 sm:py-4 lg:py-6 gap-3 sm:gap-4">
          {timeToSpinEnabled && (
            <div className="w-full max-w-xl rounded-2xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 shadow-sm space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Timer className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                    {t.timeToSpinTitle}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={wheelSpinning}
                  onClick={() => setTimeToSpinEnabled(false)}
                  className="min-h-[28px] px-2 py-0.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  {t.timeToSpinOffBtn}
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[3, 5, 10, 15, 30, 60].map((sec) => {
                    const active = timeToSpinSeconds === sec;
                    return (
                      <button
                        key={sec}
                        type="button"
                        disabled={wheelSpinning}
                        onClick={() => setTimeToSpinSeconds(sec)}
                        className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-mono font-semibold tabular-nums transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap ${
                          active
                            ? 'border-[#3B82F6] bg-[#3B82F6] text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        {sec}
                        {t.timeToSpinSecUnit}
                      </button>
                    );
                  })}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={wheelSpinning || timeToSpinSeconds <= 1}
                    onClick={() => setTimeToSpinSeconds((s) => Math.max(1, s - 1))}
                    aria-label="Decrease spin seconds"
                    className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    disabled={wheelSpinning}
                    value={timeToSpinSeconds}
                    onChange={(e) => {
                      const parsed = Number(e.target.value);
                      if (!Number.isNaN(parsed)) {
                        setTimeToSpinSeconds(
                          Math.min(120, Math.max(1, Math.round(parsed)))
                        );
                      }
                    }}
                    aria-label={t.timeToSpinTitle}
                    className="w-14 h-8 px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-center font-mono text-xs font-bold text-slate-900 dark:text-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400 px-0.5">
                    {t.timeToSpinCustomLabel}
                  </span>
                  <button
                    type="button"
                    disabled={wheelSpinning || timeToSpinSeconds >= 120}
                    onClick={() => setTimeToSpinSeconds((s) => Math.min(120, s + 1))}
                    aria-label="Increase spin seconds"
                    className="min-h-[32px] min-w-[32px] rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          )}

          <PickerWheelCanvas
            entries={activeWheel.entries}
            paletteId={activeWheel.paletteId}
            spinDuration={
              timeToSpinEnabled ? timeToSpinSeconds : settings.spinDuration
            }
            showSpinCountdown={timeToSpinEnabled}
            onSpinStateChange={setWheelSpinning}
            soundEnabled={settings.soundEnabled}
            spinSound={settings.spinSound}
            onChangeSpinSound={(spinSound) =>
              updateSettings({ spinSound, soundEnabled: true })
            }
            language={settings.language}
            hapticsEnabled={settings.hapticsEnabled}
            spinLabel={t.spinButton}
            emptyTitle={t.emptyWheelTitle}
            emptyDesc={t.emptyWheelDesc}
            hoveredSliceIndex={hoveredSliceIndex}
            onHoverSlice={setHoveredSliceIndex}
            onSpinComplete={handleSpinComplete}
            spinTriggerCount={spinTriggerCount}
          />

          {showQuickStopwatch && (
            <QuickStopwatchBar
              language={settings.language}
              soundEnabled={settings.soundEnabled}
              onOpenFull={() => setActiveNav('stopwatch')}
            />
          )}

          {showQuickGroups && (
            <div ref={quickGroupsRef} className="w-full flex justify-center">
              <QuickGroupSplitPanel
                entries={activeWheel.entries}
                paletteId={activeWheel.paletteId}
                language={settings.language}
                soundEnabled={settings.soundEnabled}
                hapticsEnabled={settings.hapticsEnabled}
                onSpinTeamsOnWheel={async (teamNames) => {
                  const title =
                    settings.language === 'km'
                      ? `${activeWheel.title} • ក្រុម`
                      : `${activeWheel.title} • Teams`;
                  await createNewWheel(title, teamNames, activeWheel.paletteId);
                  setShowQuickGroups(false);
                }}
                onOpenFull={() => {
                  bumpGroupsSyncKey();
                  setActiveNav('groups');
                }}
                onClose={() => setShowQuickGroups(false)}
              />
            </div>
          )}

          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 text-center">
            {activeWheel.entries.length >= 2 ? t.swipeHint : t.needTwoItems}
          </p>

          {/* Guest Quick CTA below wheel on Mobile Homepage */}
          {!isSignedIn && (
            <div className="sm:hidden">
              <button
                type="button"
                onClick={openAuthModal}
                disabled={authLoading}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{t.createAccountCta}</span>
              </button>
            </div>
          )}
        </div>
      </main>

      {/* Tablet & Desktop Right Panel: Entries Input List */}
      <aside className="hidden md:flex md:flex-col md:w-[288px] lg:w-[328px] xl:w-[376px] 2xl:w-[420px] shrink-0 border-l border-slate-200 dark:border-slate-800 h-full overflow-hidden">
        <EntriesPanel
          entries={activeWheel.entries}
          paletteId={activeWheel.paletteId}
          language={settings.language}
          wheelTitle={activeWheel.title}
          theme={settings.theme}
          hoveredSliceIndex={hoveredSliceIndex}
          onHoverSlice={setHoveredSliceIndex}
          onChangeEntries={(next) => updateActiveWheel({ entries: next })}
          onQuickGroupSplit={() => {
            setShowQuickGroups(true);
            requestAnimationFrame(() =>
              quickGroupsRef.current?.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              })
            );
          }}
        />
      </aside>

      {/* Smartphone Pull-Up Bottom Sheet Trigger & Drawer (< 768px) */}
      <div className="md:hidden">
        {!mobileSheetOpen && (
          <div
            onTouchStart={(e) => {
              sheetTouchStartY.current = e.touches[0].clientY;
            }}
            onTouchEnd={(e) => {
              if (sheetTouchStartY.current !== null) {
                const dy = sheetTouchStartY.current - e.changedTouches[0].clientY;
                if (dy > 30) setMobileSheetOpen(true);
              }
              sheetTouchStartY.current = null;
            }}
            className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] left-0 right-0 z-30 px-3 sm:px-4 pointer-events-none"
          >
            <button
              type="button"
              onClick={() => setMobileSheetOpen(true)}
              className="pointer-events-auto w-full min-h-[48px] px-4 py-2.5 rounded-t-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-b-0 border-slate-200 dark:border-slate-800 shadow-lg flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <span
                  className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-700"
                  aria-hidden="true"
                />
                <span className="font-display text-sm font-semibold text-slate-900 dark:text-white">
                  {t.openListSheet}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  ({activeWheel.entries.length})
                </span>
              </div>
              <ChevronUp className="w-5 h-5 text-slate-500" />
            </button>
          </div>
        )}

        {mobileSheetOpen && (
          <div
            className="fixed inset-0 z-50 flex flex-col justify-end bg-slate-950/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) setMobileSheetOpen(false);
            }}
          >
            <div className="h-[78dvh] pb-[env(safe-area-inset-bottom)] w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
              <div
                onTouchStart={(e) => {
                  sheetTouchStartY.current = e.touches[0].clientY;
                }}
                onTouchEnd={(e) => {
                  if (sheetTouchStartY.current !== null) {
                    const dy = e.changedTouches[0].clientY - sheetTouchStartY.current;
                    if (dy > 50) setMobileSheetOpen(false);
                  }
                  sheetTouchStartY.current = null;
                }}
                className="pt-2.5 pb-1 px-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800"
              >
                <div className="w-10" />
                <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(false)}
                  aria-label={t.closeListSheet}
                  className="min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                >
                  <ChevronDown className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-hidden">
                <EntriesPanel
                  entries={activeWheel.entries}
                  paletteId={activeWheel.paletteId}
                  language={settings.language}
                  wheelTitle={activeWheel.title}
                  theme={settings.theme}
                  hoveredSliceIndex={hoveredSliceIndex}
                  onHoverSlice={setHoveredSliceIndex}
                  onChangeEntries={(next) => updateActiveWheel({ entries: next })}
                  onQuickGroupSplit={() => {
                    setShowQuickGroups(true);
                    setMobileSheetOpen(false);
                    requestAnimationFrame(() =>
                      quickGroupsRef.current?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'nearest',
                      })
                    );
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Winner Reveal Modal */}
      <WinnerModal
        result={winnerResult}
        wheelTitle={activeWheel.title}
        language={settings.language}
        canRemove={activeWheel.entries.length > 1}
        onRemoveWinner={handleRemoveWinner}
        onKeepAndSpinAgain={handleKeepAndSpinAgain}
        onClose={handleCloseWinnerModal}
      />

      {/* Quick Share QR-Code Projector Modal */}
      <QuickQrModal
        isOpen={quickQrOpen}
        initialPath="/"
        language={settings.language}
        onClose={() => setQuickQrOpen(false)}
      />
    </div>
  );
}
