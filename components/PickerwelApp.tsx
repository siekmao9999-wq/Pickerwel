'use client';

import React, { useState, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Home,
  LayoutGrid,
  Sparkles,
  Watch,
  History,
  Settings,
  ShieldCheck,
  Sun,
  Moon,
  Menu,
  X,
  UserPlus,
  LogOut,
  ChevronUp,
  ChevronDown,
  User as UserIcon,
  Check,
  Volume2,
  VolumeX,
  Clock,
  Gamepad2,
  Users,
} from 'lucide-react';
import { usePickerwel, type NavSection } from './PickerwelProvider';
import { PickerWheelCanvas, type SpinResultPayload } from './PickerWheelCanvas';
import { EntriesPanel } from './EntriesPanel';
import { WinnerModal } from './WinnerModal';
import { DashboardView } from './DashboardView';
import { TemplatesView } from './TemplatesView';
import { GroupTasksView } from './GroupTasksView';
import { StopwatchView } from './StopwatchView';
import { QuickStopwatchBar } from './QuickStopwatchBar';
import { QuickGroupSplitPanel } from './QuickGroupSplitPanel';
import { HistoryView } from './HistoryView';
import { SettingsView } from './SettingsView';
import { AdminView } from './AdminView';
import { OfflineGamesView } from './games/OfflineGamesView';
import { ApprovalGateBanner } from './ApprovalGateBanner';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { WHEEL_PALETTES, type PaletteId } from '@/lib/palettes';
import { playWinSound, triggerHaptic } from '@/lib/sound';
import { COPY } from '@/lib/i18n';

export function PickerwelApp() {
  const {
    user,
    userProfile,
    isApprovedCloudUser,
    allUsers,
    authLoading,
    authError,
    signInWithGoogle,
    signOut,
    activeNav,
    setActiveNav,
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
  const [groupsSyncKey, setGroupsSyncKey] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);
  const sheetTouchStartY = useRef<number | null>(null);
  const quickGroupsRef = useRef<HTMLDivElement | null>(null);

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
        const colors = WHEEL_PALETTES[activeWheel.paletteId]?.colors || ['#3B82F6', '#FBBF24', '#10B981', '#FF5A5F'];
        confetti({
          particleCount: 90,
          spread: 72,
          origin: { y: 0.56 },
          colors,
        });
      }
    },
    [activeWheel.paletteId, settings.confettiEnabled, settings.hapticsEnabled, settings.soundEnabled]
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

  const isAdmin = Boolean(user && userProfile?.role === 'admin' && userProfile?.status === 'approved');
  const pendingApprovalCount = allUsers.filter((u) => u.status === 'pending').length;

  const navItems: {
    id: NavSection;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'home', label: t.navHome, icon: Home },
    { id: 'wheels', label: t.navMyWheels, icon: LayoutGrid },
    { id: 'templates', label: t.navTemplates, icon: Sparkles },
    { id: 'groups', label: t.navGroups, icon: Users },
    { id: 'games', label: t.navGames, icon: Gamepad2 },
    { id: 'stopwatch', label: t.navStopwatch, icon: Watch },
    { id: 'history', label: t.navHistory, icon: History },
    { id: 'settings', label: t.navSettings, icon: Settings },
    ...(isAdmin
      ? [
          {
            id: 'admin' as NavSection,
            label: t.navAdmin,
            icon: ShieldCheck,
            count: pendingApprovalCount,
          },
        ]
      : []),
  ];

  const userDisplayName =
    user?.displayName || user?.email?.split('@')[0] || '';

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:flex-row bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors">
      {/* ========================================================= */}
      {/* DESKTOP LEFT SIDEBAR (~15%)                               */}
      {/* ========================================================= */}
      <aside className="hidden lg:flex lg:flex-col w-[15%] min-w-[220px] max-w-[252px] shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
        {/* Brand Wordmark */}
        <div className="px-5 h-16 flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
            <circle cx="16" cy="16" r="14" fill="#3B82F6" />
            <path d="M16 16 L16 2 A14 14 0 0 1 30 16 Z" fill="#FF5A5F" />
            <path d="M16 16 L30 16 A14 14 0 0 1 16 30 Z" fill="#FBBF24" />
            <path d="M16 16 L16 30 A14 14 0 0 1 2 16 Z" fill="#10B981" />
            <circle cx="16" cy="16" r="5" fill="#FFFFFF" />
          </svg>
          <span className="font-latin text-xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            {t.brand}
          </span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveNav(item.id)}
                className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-xs font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 shrink-0">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Theme, Language, PWA Install & Account Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
          <PWAInstallButton language={settings.language} />

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              aria-label={settings.theme === 'dark' ? t.lightMode : t.darkMode}
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-400" />
                  <span>{t.lightMode}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-indigo-500" />
                  <span>{t.darkMode}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({ language: settings.language === 'km' ? 'en' : 'km' })
              }
              className="min-h-[40px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              {settings.language === 'km' ? 'EN' : 'ខ្មែរ'}
            </button>
          </div>

          {user ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] text-white text-xs font-bold flex items-center justify-center shrink-0">
                  {userDisplayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {userDisplayName}
                  </span>
                  {userProfile && userProfile.status !== 'approved' && (
                    <span className="block text-[11px] text-amber-600 dark:text-amber-400 truncate">
                      {t.statusPending}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={signOut}
                title={t.signOut}
                aria-label={t.signOut}
                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={authLoading}
              className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.createAccountCta}</span>
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* MOBILE TOP BAR (Compact <= 8% height)                     */}
      {/* ========================================================= */}
      <header className="lg:hidden sticky top-0 z-30 h-14 px-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          aria-label={t.menu}
          className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <span className="font-latin text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
          {t.brand}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveNav(activeNav === 'games' ? 'home' : 'games')}
            aria-label={t.navGames}
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center cursor-pointer ${
              activeNav === 'games'
                ? 'text-[#3B82F6] bg-blue-50 dark:bg-blue-950/50'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Gamepad2 className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() => setActiveNav(activeNav === 'stopwatch' ? 'home' : 'stopwatch')}
            aria-label={t.navStopwatch}
            className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center cursor-pointer ${
              activeNav === 'stopwatch'
                ? 'text-[#3B82F6] bg-blue-50 dark:bg-blue-950/50'
                : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Watch className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={() =>
              updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
            }
            aria-label={settings.theme === 'dark' ? t.lightMode : t.darkMode}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            {settings.theme === 'dark' ? (
              <Sun className="w-5 h-5 text-amber-400" />
            ) : (
              <Moon className="w-5 h-5 text-indigo-500" />
            )}
          </button>
        </div>
      </header>

      {/* ========================================================= */}
      {/* MAIN CONTENT VIEWPORT                                     */}
      {/* ========================================================= */}
      {activeNav === 'home' ? (
        <div className="flex-1 flex flex-col lg:flex-row min-w-0 min-h-0 overflow-hidden">
          {/* Center Main Wheel Stage (~55% Desktop / Full Width Mobile) */}
          <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-y-auto px-4 sm:px-6 lg:px-8 pt-4 pb-32 lg:py-6">
            {/* Workspace Top Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/80 dark:border-slate-800/80">
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
                  <span className="tabular-nums">{t.entriesCount(activeWheel.entries.length)}</span>
                </div>
              </div>

              {/* Palette Quick Selector, Quick Stopwatch Toggle & Sound Button */}
              <div className="flex items-center gap-2 shrink-0">
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
                          isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : 'opacity-75 hover:opacity-100'
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

                {!user && (
                  <button
                    type="button"
                    onClick={signInWithGoogle}
                    disabled={authLoading}
                    className="hidden sm:inline-flex lg:hidden min-h-[40px] px-3.5 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>{t.createAccountCta}</span>
                  </button>
                )}
              </div>
            </div>

            {authError && (
              <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">{t.authErrorHint}</p>
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

            {/* Giant Center Wheel */}
            <div className="flex-1 flex flex-col items-center justify-center py-4 sm:py-6 gap-4">
              <PickerWheelCanvas
                entries={activeWheel.entries}
                paletteId={activeWheel.paletteId}
                spinDuration={settings.spinDuration}
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
                      setGroupsSyncKey((k) => k + 1);
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
              {!user && (
                <div className="sm:hidden">
                  <button
                    type="button"
                    onClick={signInWithGoogle}
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

          {/* Desktop Right Panel (~30%): Entries Input List */}
          <aside className="hidden lg:flex lg:flex-col w-[30%] min-w-[330px] max-w-[430px] shrink-0 border-l border-slate-200 dark:border-slate-800 h-full overflow-hidden">
            <EntriesPanel
              entries={activeWheel.entries}
              paletteId={activeWheel.paletteId}
              language={settings.language}
              hoveredSliceIndex={hoveredSliceIndex}
              onHoverSlice={setHoveredSliceIndex}
              onChangeEntries={(next) => updateActiveWheel({ entries: next })}
              onQuickGroupSplit={() => {
                setShowQuickGroups(true);
                requestAnimationFrame(() =>
                  quickGroupsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                );
              }}
            />
          </aside>

          {/* Mobile Pull-Up Bottom Sheet Trigger & Drawer */}
          <div className="lg:hidden">
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
                className="fixed bottom-16 left-0 right-0 z-30 px-4 pointer-events-none"
              >
                <button
                  type="button"
                  onClick={() => setMobileSheetOpen(true)}
                  className="pointer-events-auto w-full min-h-[48px] px-4 py-2.5 rounded-t-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-b-0 border-slate-200 dark:border-slate-800 shadow-lg flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="w-8 h-1 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
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
                <div className="h-[78vh] w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden">
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
                      hoveredSliceIndex={hoveredSliceIndex}
                      onHoverSlice={setHoveredSliceIndex}
                      onChangeEntries={(next) => updateActiveWheel({ entries: next })}
                      onQuickGroupSplit={() => {
                        setShowQuickGroups(true);
                        setMobileSheetOpen(false);
                        requestAnimationFrame(() =>
                          quickGroupsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
                        );
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : activeNav === 'wheels' ? (
        <DashboardView />
      ) : activeNav === 'templates' ? (
        <TemplatesView />
      ) : activeNav === 'groups' ? (
        <GroupTasksView syncFromWheelKey={groupsSyncKey} />
      ) : activeNav === 'games' ? (
        <OfflineGamesView />
      ) : activeNav === 'stopwatch' ? (
        <StopwatchView />
      ) : activeNav === 'history' ? (
        <HistoryView />
      ) : activeNav === 'admin' && isAdmin ? (
        <AdminView />
      ) : (
        <SettingsView />
      )}

      {/* ========================================================= */}
      {/* MOBILE SLIDE-OVER HAMBURGER MENU                          */}
      {/* ========================================================= */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex bg-slate-950/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <span className="font-latin text-xl font-bold text-slate-900 dark:text-white">
                {t.brand}
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                aria-label={t.close}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full min-h-[44px] px-3.5 py-2.5 rounded-xl text-sm font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                      active
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    {typeof item.count === 'number' && item.count > 0 && (
                      <span className="text-xs font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400">
                        {item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-2.5">
              <PWAInstallButton language={settings.language} />

              <button
                type="button"
                onClick={() =>
                  updateSettings({ language: settings.language === 'km' ? 'en' : 'km' })
                }
                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {settings.language === 'km' ? 'Switch to English' : 'ប្តូរទៅភាសាខ្មែរ'}
              </button>

              {user ? (
                <button
                  type="button"
                  onClick={() => {
                    signOut();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{t.signOut}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    signInWithGoogle();
                    setMobileMenuOpen(false);
                  }}
                  className="w-full min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{t.createAccountCta}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE PROFILE / ACCOUNT QUICK MODAL                      */}
      {/* ========================================================= */}
      {mobileProfileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileProfileOpen(false);
          }}
        >
          <div className="w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 pb-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {t.navProfile}
              </h2>
              <button
                type="button"
                onClick={() => setMobileProfileOpen(false)}
                aria-label={t.close}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {user ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] text-white font-bold flex items-center justify-center">
                    {userDisplayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {userDisplayName}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {user.email}
                    </p>
                    {userProfile && (
                      <p className="text-xs mt-0.5 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        {userProfile.status === 'pending' && (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>{t.statusPending}</span>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileProfileOpen(false);
                      setActiveNav(isAdmin ? 'admin' : 'settings');
                    }}
                    className="min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                  >
                    {isAdmin ? t.navAdmin : t.navSettings}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileProfileOpen(false);
                      signOut();
                    }}
                    className="min-h-[44px] rounded-xl bg-rose-50 dark:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                  >
                    {t.signOut}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {t.signInSubtext}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMobileProfileOpen(false);
                    signInWithGoogle();
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] text-white text-sm font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{t.createAccountCta}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMobileProfileOpen(false);
                    setActiveNav('settings');
                  }}
                  className="w-full min-h-[44px] rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                >
                  {t.navSettings}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MOBILE FIXED BOTTOM NAVIGATION BAR (4 Ergonomic Tabs)     */}
      {/* ========================================================= */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 items-center"
        aria-label="Mobile bottom navigation"
      >
        <button
          type="button"
          onClick={() => setActiveNav('home')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeNav === 'home'
              ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[11px] leading-tight truncate max-w-[76px]">{t.navHome}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('wheels')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeNav === 'wheels'
              ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <LayoutGrid className="w-5 h-5" />
          <span className="text-[11px] leading-tight truncate max-w-[76px]">{t.navMyWheels}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('history')}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            activeNav === 'history'
              ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <History className="w-5 h-5" />
          <span className="text-[11px] leading-tight truncate max-w-[76px]">{t.navHistory}</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileProfileOpen(true)}
          className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
            mobileProfileOpen || activeNav === 'settings' || activeNav === 'admin'
              ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <UserIcon className="w-5 h-5" />
          <span className="text-[11px] leading-tight truncate max-w-[76px]">{t.navProfile}</span>
        </button>
      </nav>

      {/* Offline Status Indicator */}
      <OfflineIndicator language={settings.language} />

      {/* ========================================================= */}
      {/* WINNER REVEAL MODAL                                       */}
      {/* ========================================================= */}
      <WinnerModal
        result={winnerResult}
        wheelTitle={activeWheel.title}
        language={settings.language}
        canRemove={activeWheel.entries.length > 1}
        onRemoveWinner={handleRemoveWinner}
        onKeepAndSpinAgain={handleKeepAndSpinAgain}
        onClose={handleCloseWinnerModal}
      />
    </div>
  );
}
