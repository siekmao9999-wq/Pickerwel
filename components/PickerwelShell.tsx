'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
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
  User as UserIcon,
  Clock,
  Gamepad2,
  Users,
  Github,
  QrCode,
  ClipboardList,
} from 'lucide-react';
import {
  usePickerwel,
  NAV_ROUTES,
  type NavSection,
} from './PickerwelProvider';
import { AuthModal } from './AuthModal';
import { PWAInstallButton } from './PWAInstallButton';
import { OfflineIndicator } from './OfflineIndicator';
import { FormPendingSyncManager } from './forms/FormPendingSyncManager';
import { COPY } from '@/lib/i18n';
import { attemptChunkRecovery, isChunkLoadError } from '@/lib/chunk-recovery';

export function PickerwelShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    userProfile,
    passcodeSession,
    isSignedIn,
    currentDisplayName,
    allUsers,
    authLoading,
    openAuthModal,
    signOut,
    appAdminName,
    activeNav,
    setActiveNav,
    markPendingNav,
    settings,
    updateSettings,
  } = usePickerwel();

  const pathname = usePathname();
  const isStudentTaskRoute = Boolean(
    pathname && (pathname.startsWith('/task/') || pathname.startsWith('/form/'))
  );
  const t = COPY[settings.language];
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileProfileOpen, setMobileProfileOpen] = useState(false);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      if (isChunkLoadError(event.error ?? event.message)) {
        attemptChunkRecovery();
      }
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isChunkLoadError(event.reason)) {
        event.preventDefault();
        attemptChunkRecovery();
      }
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const isAdmin = Boolean(
    user && userProfile?.role === 'admin' && userProfile?.status === 'approved'
  );
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
    { id: 'tasks', label: t.navTasks, icon: QrCode },
    { id: 'forms', label: t.navForms, icon: ClipboardList },
    { id: 'games', label: t.navGames, icon: Gamepad2 },
    { id: 'stopwatch', label: t.navStopwatch, icon: Watch },
    { id: 'history', label: t.navHistory, icon: History },
    { id: 'github', label: t.navGitHub, icon: Github },
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

  const userDisplayName = currentDisplayName;

  if (isStudentTaskRoute) {
    return (
      <div className="min-h-[100dvh] flex flex-col bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors">
        <header className="sticky top-0 z-30 px-4 sm:px-6 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
          <div className="max-w-5xl mx-auto h-14 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 min-w-0">
              <span className="font-latin text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
                {t.brand}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:inline">
                · {t.tasksStudentHeaderBadge}
              </span>
            </Link>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() =>
                  updateSettings({ language: settings.language === 'km' ? 'en' : 'km' })
                }
                className="min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
              >
                {settings.language === 'km' ? 'EN' : 'ខ្មែរ'}
              </button>
              <button
                type="button"
                onClick={() =>
                  updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
                }
                aria-label={settings.theme === 'dark' ? t.lightMode : t.darkMode}
                className="min-h-[36px] min-w-[36px] rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {settings.theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-500" />
                )}
              </button>
            </div>
          </div>
        </header>
        {children}
        <OfflineIndicator language={settings.language} />
        <FormPendingSyncManager language={settings.language} />
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] md:h-[100dvh] flex flex-col md:flex-row md:overflow-hidden bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 transition-colors">
      {/* TABLET ICON RAIL (md) & DESKTOP SIDEBAR (lg+) */}
      <aside className="hidden md:flex md:flex-col md:w-[76px] lg:w-[228px] xl:w-[252px] shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-[width] duration-200">
        {/* Brand Wordmark & App Admin Name */}
        <div className="px-3 lg:px-5 py-3.5 flex items-center justify-center lg:justify-start gap-2.5 border-b border-slate-200 dark:border-slate-800">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
            <circle cx="16" cy="16" r="14" fill="#3B82F6" />
            <path d="M16 16 L16 2 A14 14 0 0 1 30 16 Z" fill="#FF5A5F" />
            <path d="M16 16 L30 16 A14 14 0 0 1 16 30 Z" fill="#FBBF24" />
            <path d="M16 16 L16 30 A14 14 0 0 1 2 16 Z" fill="#10B981" />
            <circle cx="16" cy="16" r="5" fill="#FFFFFF" />
          </svg>
          <div className="hidden lg:block min-w-0">
            <span className="block font-latin text-lg font-bold tracking-tight text-slate-900 dark:text-white leading-tight whitespace-nowrap">
              {t.brand}
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate">
              <ShieldCheck className="w-3 h-3 text-[#3B82F6] shrink-0" />
              <span className="truncate">
                {t.adminAppLabel}: {appAdminName}
              </span>
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-2 lg:p-3 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <Link
                key={item.id}
                href={NAV_ROUTES[item.id]}
                prefetch
                onClick={() => markPendingNav(item.id)}
                title={item.label}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={`relative w-full min-h-[42px] px-2 lg:px-3 py-2 rounded-xl text-sm font-medium flex items-center justify-center lg:justify-between gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400 font-semibold'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon className="w-4.5 h-4.5 lg:w-4 lg:h-4 shrink-0" />
                  <span className="hidden lg:inline truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && item.count > 0 && (
                  <span className="text-[11px] lg:text-xs font-mono tabular-nums font-bold text-amber-600 dark:text-amber-400 shrink-0 md:max-lg:absolute md:max-lg:top-1 md:max-lg:right-1.5">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Quick Theme, Language, PWA Install & Account Footer */}
        <div className="p-2 lg:p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <PWAInstallButton language={settings.language} />

          <div className="flex flex-col lg:flex-row items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateSettings({ theme: settings.theme === 'dark' ? 'light' : 'dark' })
              }
              title={settings.theme === 'dark' ? t.lightMode : t.darkMode}
              aria-label={settings.theme === 'dark' ? t.lightMode : t.darkMode}
              className="w-full lg:flex-1 min-h-[40px] px-2 lg:px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              {settings.theme === 'dark' ? (
                <>
                  <Sun className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-amber-400 shrink-0" />
                  <span className="hidden lg:inline">{t.lightMode}</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 lg:w-3.5 lg:h-3.5 text-indigo-500 shrink-0" />
                  <span className="hidden lg:inline">{t.darkMode}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                updateSettings({ language: settings.language === 'km' ? 'en' : 'km' })
              }
              title={settings.language === 'km' ? 'English' : 'ភាសាខ្មែរ'}
              className="w-full lg:w-auto min-h-[40px] px-2 lg:px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              {settings.language === 'km' ? 'EN' : 'ខ្មែរ'}
            </button>
          </div>

          {isSignedIn ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col lg:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  title={userDisplayName}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] text-white text-xs font-bold flex items-center justify-center shrink-0"
                >
                  {userDisplayName.slice(0, 1).toUpperCase()}
                </div>
                <div className="hidden lg:block min-w-0">
                  <span className="block text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {userDisplayName}
                  </span>
                  {userProfile && userProfile.status !== 'approved' ? (
                    <span className="block text-[11px] text-amber-600 dark:text-amber-400 truncate">
                      {t.statusPending}
                    </span>
                  ) : passcodeSession && !user ? (
                    <span className="block text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate">
                      {passcodeSession.passcode}
                    </span>
                  ) : null}
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
              onClick={openAuthModal}
              disabled={authLoading}
              title={t.createAccountCta}
              aria-label={t.createAccountCta}
              className="w-full min-h-[42px] px-2 lg:px-3 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              <UserPlus className="w-4 h-4 lg:w-3.5 lg:h-3.5 shrink-0" />
              <span className="hidden lg:inline truncate">{t.createAccountCta}</span>
            </button>
          )}
        </div>
      </aside>

      {/* SMARTPHONE TOP BAR (< 768px) */}
      <header className="md:hidden sticky top-0 z-30 pt-[env(safe-area-inset-top)] px-3 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="h-14 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            aria-label={t.menu}
            className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="min-w-0 flex flex-col items-center leading-tight">
            <span className="font-latin text-base font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0">
              {t.brand}
            </span>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
              {t.adminAppLabel}: {appAdminName}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Link
              href={activeNav === 'games' ? NAV_ROUTES.home : NAV_ROUTES.games}
              prefetch
              onClick={() =>
                markPendingNav(activeNav === 'games' ? 'home' : 'games')
              }
              aria-label={t.navGames}
              className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center cursor-pointer ${
                activeNav === 'games'
                  ? 'text-[#3B82F6] bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Gamepad2 className="w-5 h-5" />
            </Link>
            <Link
              href={
                activeNav === 'stopwatch' ? NAV_ROUTES.home : NAV_ROUTES.stopwatch
              }
              prefetch
              onClick={() =>
                markPendingNav(activeNav === 'stopwatch' ? 'home' : 'stopwatch')
              }
              aria-label={t.navStopwatch}
              className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center cursor-pointer ${
                activeNav === 'stopwatch'
                  ? 'text-[#3B82F6] bg-blue-50 dark:bg-blue-950/50'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Watch className="w-5 h-5" />
            </Link>
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
        </div>
      </header>

      {/* MAIN CONTENT VIEWPORT */}
      {children}

      {/* SMARTPHONE SLIDE-OVER HAMBURGER MENU (< 768px) */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex bg-slate-950/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileMenuOpen(false);
          }}
        >
          <div className="w-72 max-w-[82vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="min-w-0">
                <span className="block font-latin text-xl font-bold text-slate-900 dark:text-white">
                  {t.brand}
                </span>
                <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6] shrink-0" />
                  <span className="truncate">
                    {t.adminAppLabel}: {appAdminName}
                  </span>
                </span>
              </div>
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
                  <Link
                    key={item.id}
                    href={NAV_ROUTES[item.id]}
                    prefetch
                    onClick={() => {
                      markPendingNav(item.id);
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
                  </Link>
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

              {isSignedIn ? (
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
                    setMobileMenuOpen(false);
                    openAuthModal();
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

      {/* SMARTPHONE PROFILE / ACCOUNT QUICK MODAL (< 768px) */}
      {mobileProfileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileProfileOpen(false);
          }}
        >
          <div className="w-full rounded-t-3xl bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-6 pb-[calc(2rem+env(safe-area-inset-bottom))] space-y-4">
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

            {isSignedIn ? (
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
                      {user?.email ||
                        (passcodeSession
                          ? `${t.authPasscodeBadge}: ${passcodeSession.passcode}`
                          : '')}
                    </p>
                    {userProfile && userProfile.status === 'pending' && (
                      <p className="text-xs mt-0.5 flex items-center gap-1 text-amber-600 dark:text-amber-400">
                        <Clock className="w-3 h-3" />
                        <span>{t.statusPending}</span>
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
                    openAuthModal();
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

      {/* SMARTPHONE FIXED BOTTOM NAVIGATION BAR (< 768px) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800"
        aria-label="Mobile bottom navigation"
      >
        <div className="h-16 grid grid-cols-4 items-center">
          <Link
            href={NAV_ROUTES.home}
            prefetch
            onClick={() => markPendingNav('home')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeNav === 'home'
                ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] leading-tight truncate max-w-[76px]">
              {t.navHome}
            </span>
          </Link>

          <Link
            href={NAV_ROUTES.wheels}
            prefetch
            onClick={() => markPendingNav('wheels')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeNav === 'wheels'
                ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[11px] leading-tight truncate max-w-[76px]">
              {t.navMyWheels}
            </span>
          </Link>

          <Link
            href={NAV_ROUTES.history}
            prefetch
            onClick={() => markPendingNav('history')}
            className={`h-full flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
              activeNav === 'history'
                ? 'text-[#3B82F6] dark:text-blue-400 font-semibold'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <History className="w-5 h-5" />
            <span className="text-[11px] leading-tight truncate max-w-[76px]">
              {t.navHistory}
            </span>
          </Link>

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
            <span className="text-[11px] leading-tight truncate max-w-[76px]">
              {t.navProfile}
            </span>
          </button>
        </div>
      </nav>

      {/* Offline Status Indicator, Pending Sync Auto-Uploader & Auth Modal */}
      <OfflineIndicator language={settings.language} />
      <FormPendingSyncManager language={settings.language} />
      <AuthModal />
    </div>
  );
}
