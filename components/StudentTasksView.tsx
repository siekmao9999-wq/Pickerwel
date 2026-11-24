'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  Copy,
  Check,
  Plus,
  ShieldCheck,
  Lock,
  UserPlus,
  Inbox,
  PauseCircle,
  PlayCircle,
  Trash2,
  ExternalLink,
  RefreshCw,
  Clock,
  Info,
  Link2,
  Download,
  Maximize2,
  ArrowLeft,
  Sigma,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { QrShareModal } from './QrShareModal';
import { QuickQrModal } from './QuickQrModal';
import { AssignmentSubmissionsModal } from './AssignmentSubmissionsModal';
import { QuickJoinTaskCard } from './QuickJoinTaskCard';
import { MathText, hasExplicitMathSyntax } from './MathText';
import { StemFormulaEditorModal } from './forms/StemFormulaEditorModal';
import { COPY } from '@/lib/i18n';
import { downloadQrPng, renderQrToCanvas } from '@/lib/qr-names';
import { getShareOrigin, isPrivatePreviewHost } from '@/lib/share-origin';
import { WHEEL_PALETTES, type PaletteId } from '@/lib/palettes';
import {
  buildStudentTaskUrl,
  createStudentAssignment,
  deleteStudentAssignment,
  getStudentAssignment,
  subscribeUserAssignments,
  updateStudentAssignment,
  type StudentAssignment,
} from '@/lib/firestore-service';

const subscribeNoop = () => () => {};
const getSharePageUrlClient = () => {
  const origin = getShareOrigin();
  return origin ? `${origin}/tasks` : '/tasks';
};
const getSharePageUrlServer = () => '/tasks';
const getOriginServer = () => '';
const getPreviewServer = () => false;

function getPasscodeStorageKey(memberId: string): string {
  return `pickerwel_pm_assignments_${memberId}`;
}

function loadPasscodeAssignmentIds(memberId: string): string[] {
  if (typeof window === 'undefined' || !memberId) return [];
  try {
    const raw = window.localStorage.getItem(getPasscodeStorageKey(memberId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function savePasscodeAssignmentIds(memberId: string, ids: string[]): void {
  if (typeof window === 'undefined' || !memberId) return;
  try {
    window.localStorage.setItem(getPasscodeStorageKey(memberId), JSON.stringify(ids.slice(0, 100)));
  } catch {
    // Ignore storage quota errors
  }
}

export function StudentTasksView() {
  const router = useRouter();
  const {
    user,
    userProfile,
    passcodeSession,
    isSignedIn,
    isApprovedCloudUser,
    currentDisplayName,
    openAuthModal,
    setActiveNav,
    activeWheel,
    settings,
  } = usePickerwel();

  const t = COPY[settings.language];
  const isAdmin = Boolean(
    user && userProfile?.role === 'admin' && userProfile?.status === 'approved'
  );
  const isApprovedPasscodeUser = Boolean(
    !user &&
      passcodeSession &&
      passcodeSession.status === 'approved' &&
      passcodeSession.passcodeActive
  );
  const canCreateTasks = isApprovedCloudUser || isApprovedPasscodeUser;

  // Form state
  const [title, setTitle] = useState(() => activeWheel.title || '');
  const [instructions, setInstructions] = useState('');
  const [entriesText, setEntriesText] = useState(() => activeWheel.entries.join('\n'));
  const [paletteId, setPaletteId] = useState<PaletteId>(activeWheel.paletteId);
  const [allowWheelSpin, setAllowWheelSpin] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Assignments list state
  const [assignmentsByKey, setAssignmentsByKey] = useState<{
    key: string;
    items: StudentAssignment[];
  }>({ key: '', items: [] });
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAppUrl, setCopiedAppUrl] = useState(false);
  const [quickQrOpen, setQuickQrOpen] = useState(false);
  const [downloadingQuickQr, setDownloadingQuickQr] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const quickQrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const shareOrigin = useSyncExternalStore(
    subscribeNoop,
    getShareOrigin,
    getOriginServer
  );
  const sharePageUrl = useSyncExternalStore(
    subscribeNoop,
    getSharePageUrlClient,
    getSharePageUrlServer
  );
  const isPreviewHost = useSyncExternalStore(
    subscribeNoop,
    isPrivatePreviewHost,
    getPreviewServer
  );

  useEffect(() => {
    if (!sharePageUrl || !quickQrCanvasRef.current) return;
    renderQrToCanvas(quickQrCanvasRef.current, sharePageUrl, 136).catch(() => {
      // Ignore transient canvas render errors
    });
  }, [sharePageUrl]);

  const handleCopySharePageUrl = async () => {
    const origin = getShareOrigin();
    const url = origin ? `${origin}/tasks` : '/tasks';
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
    setCopiedAppUrl(true);
    window.setTimeout(() => setCopiedAppUrl(false), 1800);
  };

  const handleDownloadQuickQr = async () => {
    setDownloadingQuickQr(true);
    try {
      await downloadQrPng(sharePageUrl, 'pickerwel-join-qr');
    } finally {
      setDownloadingQuickQr(false);
    }
  };

  // Modals
  const [qrModalTarget, setQrModalTarget] = useState<StudentAssignment | null>(null);
  const [submissionsTarget, setSubmissionsTarget] = useState<StudentAssignment | null>(null);
  const [mathTypeOpen, setMathTypeOpen] = useState(false);

  const loadFromActiveWheel = () => {
    setTitle(activeWheel.title || '');
    setEntriesText(activeWheel.entries.join('\n'));
    setPaletteId(activeWheel.paletteId);
  };

  // Load owner's assignments strictly isolated to current account
  const googleUid = isApprovedCloudUser && user ? user.uid : '';
  const passcodeMemberId = isApprovedPasscodeUser && passcodeSession ? passcodeSession.memberId : '';
  const activeOwnerKey = googleUid ? `g:${googleUid}` : passcodeMemberId ? `p:${passcodeMemberId}` : '';

  const assignments = assignmentsByKey.key === activeOwnerKey ? assignmentsByKey.items : [];
  const loadingList = Boolean(activeOwnerKey && assignmentsByKey.key !== activeOwnerKey);

  useEffect(() => {
    if (googleUid) {
      const key = `g:${googleUid}`;
      const unsub = subscribeUserAssignments(googleUid, (list) => {
        setAssignmentsByKey({ key, items: list });
      });
      return () => unsub();
    }
    if (passcodeMemberId) {
      let active = true;
      const key = `p:${passcodeMemberId}`;
      const ids = loadPasscodeAssignmentIds(passcodeMemberId);
      Promise.all(ids.map((id) => getStudentAssignment(id).catch(() => null))).then(
        (results) => {
          if (!active) return;
          const valid = results
            .filter((item): item is StudentAssignment =>
              Boolean(item && item.ownerId === passcodeMemberId)
            )
            .sort((a, b) => b.createdAtMs - a.createdAtMs);
          setAssignmentsByKey({ key, items: valid });
        }
      );
      return () => {
        active = false;
      };
    }
  }, [googleUid, passcodeMemberId]);

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateTasks) return;
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setFormError(t.tasksTitlePlaceholder);
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      const entries = entriesText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 200);

      const ownerId = googleUid || passcodeMemberId;
      const ownerType = googleUid ? 'google' : 'passcode';

      const created = await createStudentAssignment({
        ownerId,
        ownerType,
        ownerDisplayName: currentDisplayName || 'Teacher',
        title: cleanTitle,
        instructions,
        entries,
        paletteId,
        allowWheelSpin,
      });

      if (passcodeMemberId) {
        const existingIds = loadPasscodeAssignmentIds(passcodeMemberId);
        const nextIds = [created.id, ...existingIds.filter((id) => id !== created.id)];
        savePasscodeAssignmentIds(passcodeMemberId, nextIds);
        const key = `p:${passcodeMemberId}`;
        setAssignmentsByKey((prev) => ({
          key,
          items: [created, ...(prev.key === key ? prev.items.filter((a) => a.id !== created.id) : [])],
        }));
      }

      setToastMsg(t.tasksCreatedSuccess);
      window.setTimeout(() => setToastMsg(null), 2600);
      setQrModalTarget(created);
    } catch {
      setFormError(t.authPasscodeNetworkError);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (assignment: StudentAssignment) => {
    const url = buildStudentTaskUrl(assignment.id);
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
    setCopiedId(assignment.id);
    window.setTimeout(() => {
      setCopiedId((curr) => (curr === assignment.id ? null : curr));
    }, 1800);
  };

  const handleToggleActive = async (assignment: StudentAssignment) => {
    if (!googleUid && !isAdmin) return;
    setBusyId(assignment.id);
    try {
      await updateStudentAssignment(assignment.id, { active: !assignment.active });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (assignment: StudentAssignment) => {
    if (!googleUid && !isAdmin) return;
    setBusyId(assignment.id);
    try {
      await deleteStudentAssignment(assignment.id);
    } finally {
      setBusyId(null);
    }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      setActiveNav('home');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0 space-y-2.5">
            <button
              type="button"
              onClick={handleBack}
              className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span>{t.backBtn}</span>
            </button>
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                {t.tasksPageTitle}
              </h1>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-3xl">
                {t.tasksPageDesc}
              </p>
            </div>
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveNav('admin')}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
            >
              <ShieldCheck className="w-4 h-4 text-[#3B82F6]" />
              <span>{t.tasksOpenAdminAllBtn}</span>
            </button>
          )}
        </div>

        {/* Quick Share App Link & Live QR-Code Card (Always Visible) */}
        <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
          {/* Live Scannable QR Preview */}
          <button
            type="button"
            onClick={() => setQuickQrOpen(true)}
            title={t.quickQrEnlargeBtn}
            aria-label={t.quickQrEnlargeBtn}
            className="p-2.5 rounded-2xl bg-white border border-slate-200 shadow-sm hover:ring-2 hover:ring-blue-500/40 transition-all cursor-pointer shrink-0"
          >
            <canvas
              ref={quickQrCanvasRef}
              width={136}
              height={136}
              className="w-[128px] h-[128px] sm:w-[136px] sm:h-[136px] block"
            />
          </button>

          {/* Link Copy + Projector QR Actions */}
          <div className="flex-1 min-w-0 w-full space-y-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                <Link2 className="w-4 h-4 text-[#3B82F6] shrink-0" />
                <span>{t.quickAppLinkTitle}</span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {t.quickAppLinkDesc}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={sharePageUrl}
                onFocus={(e) => e.currentTarget.select()}
                aria-label={t.quickAppLinkTitle}
                className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleCopySharePageUrl}
                className="h-10 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer shrink-0 whitespace-nowrap"
              >
                {copiedAppUrl ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedAppUrl ? t.tasksCopiedLinkBtn : t.quickCopyLinkBtn}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setQuickQrOpen(true)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-300 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Maximize2 className="w-3.5 h-3.5 shrink-0" />
                <span>{t.quickQrEnlargeBtn}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadQuickQr}
                disabled={downloadingQuickQr}
                className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 shrink-0" />
                <span>{t.tasksQrDownloadBtn}</span>
              </button>
            </div>

            {isPreviewHost && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{t.qrPreviewHostNotice}</span>
              </div>
            )}
          </div>
        </div>

        {/* Participant Instant Join (No Registration Required) */}
        {!canCreateTasks && (
          <QuickJoinTaskCard
            language={settings.language}
            soundEnabled={settings.soundEnabled}
            hapticsEnabled={settings.hapticsEnabled}
          />
        )}

        {/* Secondary Card: Optional Sign-In for Teachers / Hosts */}
        {!isSignedIn && (
          <div className="p-5 sm:p-6 rounded-2xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="space-y-1 min-w-0">
                <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {t.tasksAuthGateTitle}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                  {t.tasksAuthGateDesc}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openAuthModal}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4 text-[#3B82F6]" />
              <span>{t.createAccountCta}</span>
            </button>
          </div>
        )}

        {/* Pending / Revoked Gate */}
        {isSignedIn && !canCreateTasks && (
          <div className="p-6 sm:p-8 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {t.tasksPendingGateTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-lg mx-auto">
              {t.tasksPendingGateDesc}
            </p>
          </div>
        )}

        {/* Approved User Workspace */}
        {canCreateTasks && (
          <>
            {/* Per-User Privacy Notice */}
            <div className="p-3.5 sm:p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6] dark:text-blue-400 shrink-0 mt-0.5" />
              <span>{t.tasksPrivacyNotice}</span>
            </div>

            {/* Create New Task Card */}
            <form
              onSubmit={handleCreateAssignment}
              className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {t.tasksCreateTitle}
                </h2>
                <button
                  type="button"
                  onClick={loadFromActiveWheel}
                  className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.tasksLoadFromWheelBtn}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-7 space-y-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-task-title"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {t.tasksTitleLabel}
                    </label>
                    <input
                      id="student-task-title"
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      maxLength={120}
                      placeholder={t.tasksTitlePlaceholder}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="student-task-instructions"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {t.tasksInstructionsLabel}
                      </label>
                      <button
                        type="button"
                        onClick={() => setMathTypeOpen(true)}
                        title={
                          settings.language === 'km'
                            ? 'បើក MathType សរសេររូបមន្ត គណិត•រូប•គីមី'
                            : 'Open MathType Equation Studio'
                        }
                        className="min-h-[30px] px-2.5 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100/80 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Sigma className="w-3.5 h-3.5" />
                        <span>MathType</span>
                      </button>
                    </div>
                    <textarea
                      id="student-task-instructions"
                      value={instructions}
                      onChange={(e) => setInstructions(e.target.value)}
                      rows={4}
                      maxLength={2000}
                      placeholder={t.tasksInstructionsPlaceholder}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                    {hasExplicitMathSyntax(instructions) && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap overflow-x-auto">
                        <MathText text={instructions} explicitOnly />
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-5 space-y-3.5">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-task-entries"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {t.tasksEntriesLabel}
                    </label>
                    <textarea
                      id="student-task-entries"
                      value={entriesText}
                      onChange={(e) => setEntriesText(e.target.value)}
                      rows={5}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={allowWheelSpin}
                        onChange={(e) => setAllowWheelSpin(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-[#3B82F6] focus:ring-blue-500"
                      />
                      <span>{t.tasksAllowSpinLabel}</span>
                    </label>

                    <div className="flex items-center gap-1.5">
                      {(Object.keys(WHEEL_PALETTES) as PaletteId[]).map((pid) => {
                        const pal = WHEEL_PALETTES[pid];
                        return (
                          <button
                            key={pid}
                            type="button"
                            onClick={() => setPaletteId(pid)}
                            title={settings.language === 'km' ? pal.nameKm : pal.nameEn}
                            className={`w-5 h-5 rounded-full cursor-pointer transition-transform ${
                              paletteId === pid
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
                  </div>
                </div>
              </div>

              {formError && (
                <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{formError}</p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {toastMsg ? (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1.5">
                    <Check className="w-4 h-4" />
                    <span>{toastMsg}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {t.tasksStudentTeacherLabel}: <strong className="text-slate-700 dark:text-slate-200">{currentDisplayName}</strong>
                  </span>
                )}

                <button
                  type="submit"
                  disabled={creating}
                  className="min-h-[42px] px-5 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" />
                  <span>{creating ? t.tasksCreatingBtn : t.tasksCreateBtn}</span>
                </button>
              </div>
            </form>

            {/* Passcode Submission Visibility Note */}
            {isApprovedPasscodeUser && (
              <div className="p-3.5 sm:p-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300">
                <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
                <span>{t.tasksPasscodeSubmissionsNote}</span>
              </div>
            )}

            {/* My Private Links & QR-Codes List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  {t.tasksMyListTitle}
                  {assignments.length > 0 && (
                    <span className="ml-2 text-sm font-mono tabular-nums font-semibold text-slate-400">
                      ({assignments.length})
                    </span>
                  )}
                </h2>
              </div>

              {loadingList ? (
                <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                  ...
                </div>
              ) : assignments.length === 0 ? (
                <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-2">
                  <QrCode className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="font-display text-base font-semibold text-slate-800 dark:text-slate-200">
                    {t.tasksEmptyTitle}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {t.tasksEmptyDesc}
                  </p>
                </div>
              ) : (
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {assignments.map((item) => {
                    const isCopied = copiedId === item.id;
                    const isBusy = busyId === item.id;
                    const url = buildStudentTaskUrl(item.id, shareOrigin);
                    return (
                      <div
                        key={item.id}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                      >
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <h3 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                              {item.title}
                            </h3>
                            <span
                              className={`text-xs font-semibold ${
                                item.active
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              · {item.active ? t.tasksStatusOpen : t.tasksStatusPaused}
                            </span>
                          </div>

                          {item.instructions && (
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                              {item.instructions}
                            </p>
                          )}

                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap tabular-nums">
                            <span className="font-mono truncate max-w-[260px] sm:max-w-[360px] text-slate-600 dark:text-slate-300">
                              {url}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{t.entriesCount(item.entries.length)}</span>
                            <span aria-hidden="true">·</span>
                            <span suppressHydrationWarning>
                              {new Date(item.createdAtMs).toLocaleDateString()}
                            </span>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyLink(item)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{isCopied ? t.tasksCopiedLinkBtn : t.tasksCopyLinkBtn}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setQrModalTarget(item)}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <QrCode className="w-3.5 h-3.5 text-[#3B82F6] dark:text-blue-400" />
                            <span>{t.tasksShowQrBtn}</span>
                          </button>

                          {(googleUid || isAdmin) && (
                            <button
                              type="button"
                              onClick={() => setSubmissionsTarget(item)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Inbox className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>{t.tasksSubmissionsBtn}</span>
                            </button>
                          )}

                          <Link
                            href={`/task/${item.id}`}
                            title={t.tasksOpenStudentBtn}
                            aria-label={t.tasksOpenStudentBtn}
                            className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>

                          {(googleUid || isAdmin) && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleToggleActive(item)}
                                title={item.active ? t.tasksPauseBtn : t.tasksResumeBtn}
                                aria-label={item.active ? t.tasksPauseBtn : t.tasksResumeBtn}
                                className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                              >
                                {item.active ? (
                                  <PauseCircle className="w-4 h-4 text-amber-500" />
                                ) : (
                                  <PlayCircle className="w-4 h-4 text-emerald-500" />
                                )}
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleDelete(item)}
                                title={t.tasksDeleteBtn}
                                aria-label={t.tasksDeleteBtn}
                                className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <QuickQrModal
        isOpen={quickQrOpen}
        initialPath="/tasks"
        language={settings.language}
        onClose={() => setQuickQrOpen(false)}
      />

      <QrShareModal
        assignment={qrModalTarget}
        language={settings.language}
        onClose={() => setQrModalTarget(null)}
      />

      <AssignmentSubmissionsModal
        assignment={submissionsTarget}
        isAdmin={isAdmin}
        ownerUid={googleUid || undefined}
        language={settings.language}
        onClose={() => setSubmissionsTarget(null)}
      />

      <StemFormulaEditorModal
        open={mathTypeOpen}
        language={settings.language}
        accentColor="#3B82F6"
        targetLabel={t.tasksInstructionsLabel}
        onClose={() => setMathTypeOpen(false)}
        onInsert={(formula) =>
          setInstructions((prev) => (prev.trim() ? `${prev} ${formula}` : formula))
        }
      />
    </div>
  );
}
