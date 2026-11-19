'use client';

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  KeyRound,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Power,
  Users,
  Plus,
  QrCode,
  Inbox,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Link2,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { QrShareModal } from './QrShareModal';
import { AssignmentSubmissionsModal } from './AssignmentSubmissionsModal';
import { COPY } from '@/lib/i18n';
import {
  BOOTSTRAP_ADMIN_EMAIL,
  buildStudentTaskUrl,
  deleteStudentAssignment,
  generateRandomPasscode,
  isValidPasscodeFormat,
  subscribeAllAssignments,
  updateStudentAssignment,
  type AccountStatus,
  type StudentAssignment,
  type UserPreferences,
} from '@/lib/firestore-service';
import { getShareOrigin } from '@/lib/share-origin';

const subscribeNoop = () => () => {};
const getOriginServer = () => '';

type AdminTab = 'passcodes' | 'passcodeMembers' | 'googleUsers' | 'studentTasks';

export function AdminView() {
  const {
    user,
    userProfile,
    allUsers,
    reviewUser,
    adminPasscodes,
    passcodeMembers,
    createPasscode,
    togglePasscode,
    removePasscode,
    reviewPasscodeMember,
    removePasscodeMember,
    appAdminName,
    saveAppAdminName,
    settings,
  } = usePickerwel();

  const t = COPY[settings.language];
  const [activeTab, setActiveTab] = useState<AdminTab>('passcodes');
  const [filter, setFilter] = useState<'all' | AccountStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  // Passcode creator state
  const [newCode, setNewCode] = useState('PW-2026');
  const shareOrigin = useSyncExternalStore(
    subscribeNoop,
    getShareOrigin,
    getOriginServer
  );
  const [newLabel, setNewLabel] = useState('');
  const [codeError, setCodeError] = useState<string | null>(null);
  const [creatingCode, setCreatingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedInviteCode, setCopiedInviteCode] = useState<string | null>(null);
  const [adminNameDraft, setAdminNameDraft] = useState<string | null>(null);
  const [savingAdminName, setSavingAdminName] = useState(false);
  const [adminNameSaved, setAdminNameSaved] = useState(false);

  // Admin All Student Assignments state
  const [allAssignments, setAllAssignments] = useState<StudentAssignment[]>([]);
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [qrModalTarget, setQrModalTarget] = useState<StudentAssignment | null>(null);
  const [submissionsTarget, setSubmissionsTarget] = useState<StudentAssignment | null>(null);

  const isApprovedAdmin = Boolean(
    user && userProfile?.role === 'admin' && userProfile?.status === 'approved'
  );

  useEffect(() => {
    if (!isApprovedAdmin) return;
    const unsub = subscribeAllAssignments((list) => {
      setAllAssignments(list);
    });
    return () => unsub();
  }, [isApprovedAdmin]);

  const teacherOptions = useMemo(() => {
    const map = new Map<string, { ownerId: string; ownerDisplayName: string; ownerType: string }>();
    for (const a of allAssignments) {
      if (!map.has(a.ownerId)) {
        map.set(a.ownerId, {
          ownerId: a.ownerId,
          ownerDisplayName: a.ownerDisplayName,
          ownerType: a.ownerType,
        });
      }
    }
    return Array.from(map.values());
  }, [allAssignments]);

  if (!user || userProfile?.role !== 'admin') {
    return null;
  }

  const pendingGoogleCount = allUsers.filter((u) => u.status === 'pending').length;

  const filteredGoogleUsers = allUsers.filter((u) => {
    if (filter !== 'all' && u.status !== filter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const filteredPasscodeMembers = passcodeMembers.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.displayName.toLowerCase().includes(q) ||
      m.passcode.toLowerCase().includes(q)
    );
  });

  const handleAction = async (
    target: UserPreferences,
    nextStatus: AccountStatus,
    nextRole: 'user' | 'admin'
  ) => {
    setBusyId(target.uid);
    try {
      await reviewUser(target.uid, nextStatus, nextRole);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreatePasscode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const cleaned = newCode.trim().toUpperCase();
    if (!isValidPasscodeFormat(cleaned)) {
      setCodeError(t.authPasscodeFormatError);
      return;
    }

    setCreatingCode(true);
    try {
      await createPasscode(cleaned, newLabel);
      setNewCode(generateRandomPasscode('PW'));
      setNewLabel('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'PASSCODE_EXISTS') {
        setCodeError(t.passcodeExistsError);
      } else if (msg === 'INVALID_PASSCODE_FORMAT') {
        setCodeError(t.authPasscodeFormatError);
      } else {
        setCodeError(t.authPasscodeNetworkError);
      }
    } finally {
      setCreatingCode(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((curr) => (curr === code ? null : curr)), 1800);
    } catch {
      // Ignore clipboard error
    }
  };

  const handleCopyInviteLink = async (code: string) => {
    const origin = shareOrigin || getShareOrigin();
    const inviteUrl = `${origin}/?code=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      const input = document.createElement('input');
      input.value = inviteUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopiedInviteCode(code);
    window.setTimeout(() => {
      setCopiedInviteCode((curr) => (curr === code ? null : curr));
    }, 1800);
  };

  const filteredAssignments = allAssignments.filter((item) => {
    if (selectedTeacherFilter !== 'all' && item.ownerId !== selectedTeacherFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.ownerDisplayName.toLowerCase().includes(q) ||
      item.instructions.toLowerCase().includes(q)
    );
  });

  const handleCopyTaskLink = async (item: StudentAssignment) => {
    const url = buildStudentTaskUrl(item.id);
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
    setCopiedTaskId(item.id);
    window.setTimeout(() => {
      setCopiedTaskId((curr) => (curr === item.id ? null : curr));
    }, 1800);
  };

  const mainTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'passcodes', label: t.adminTabPasscodes, icon: KeyRound, count: adminPasscodes.length },
    { id: 'passcodeMembers', label: t.adminTabPasscodeMembers, icon: Users, count: passcodeMembers.length },
    { id: 'googleUsers', label: t.adminTabGoogleUsers, icon: ShieldCheck, count: pendingGoogleCount },
    { id: 'studentTasks', label: t.adminTabStudentTasks, icon: QrCode, count: allAssignments.length },
  ];

  const filterTabs: { id: 'all' | AccountStatus; label: string }[] = [
    { id: 'pending', label: `${t.filterPending} (${pendingGoogleCount})` },
    { id: 'approved', label: t.filterApproved },
    { id: 'rejected', label: t.filterRejected },
    { id: 'all', label: t.filterAll },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header + Search */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.adminTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.adminDesc}
            </p>
          </div>

          {activeTab !== 'passcodes' && (
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
          )}
        </div>

        {/* Admin Name Shown on App Editor */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const value = (adminNameDraft ?? appAdminName).trim();
            if (!value) return;
            setSavingAdminName(true);
            try {
              await saveAppAdminName(value);
              setAdminNameDraft(null);
              setAdminNameSaved(true);
              setTimeout(() => setAdminNameSaved(false), 1800);
            } finally {
              setSavingAdminName(false);
            }
          }}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-3"
        >
          <div className="flex-1 min-w-0 space-y-1.5">
            <label
              htmlFor="app-admin-name-input"
              className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>{t.adminNameSettingLabel}</span>
            </label>
            <input
              id="app-admin-name-input"
              type="text"
              value={adminNameDraft ?? appAdminName}
              onChange={(e) => setAdminNameDraft(e.target.value)}
              maxLength={80}
              placeholder={t.adminNameSettingPlaceholder}
              className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            disabled={savingAdminName || !(adminNameDraft ?? appAdminName).trim()}
            className="h-10 px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            {adminNameSaved ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-600" />
                <span>{t.adminNameSavedMsg}</span>
              </>
            ) : (
              <span>{t.adminNameSaveBtn}</span>
            )}
          </button>
        </form>

        {/* Main Section Segmented Tabs */}
        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`min-h-[40px] px-3.5 py-2 text-xs font-semibold rounded-lg inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 text-[#3B82F6] dark:text-blue-400 shrink-0" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                    ({tab.count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ============================================================ */}
        {/* TAB 1: PASSCODES GENERATOR & MANAGER                         */}
        {/* ============================================================ */}
        {activeTab === 'passcodes' && (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
              <span>{t.passcodeAdminOnlyNotice}</span>
            </div>

            <form
              onSubmit={handleCreatePasscode}
              className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
            >
              <div>
                <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
                  {t.passcodeGenTitle}
                </h2>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {t.passcodeGenDesc}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-5 space-y-1.5">
                  <label
                    htmlFor="admin-new-passcode"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t.passcodeInputLabel}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="admin-new-passcode"
                      type="text"
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                      maxLength={32}
                      placeholder={t.passcodeInputPlaceholder}
                      className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm tracking-wider uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={() => setNewCode(generateRandomPasscode('PW'))}
                      title={t.passcodeGenerateRandomBtn}
                      className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>{t.passcodeGenerateRandomBtn}</span>
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-4 space-y-1.5">
                  <label
                    htmlFor="admin-new-passcode-label"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    {t.passcodeLabelInput}
                  </label>
                  <input
                    id="admin-new-passcode-label"
                    type="text"
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    maxLength={80}
                    placeholder={t.passcodeLabelPlaceholder}
                    className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="sm:col-span-3">
                  <button
                    type="submit"
                    disabled={creatingCode}
                    className="w-full h-10 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{t.passcodeCreateBtn}</span>
                  </button>
                </div>
              </div>

              {codeError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">{codeError}</p>
              )}
            </form>

            {adminPasscodes.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.passcodeEmptyState}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {adminPasscodes.map((item) => {
                  const isBusy = busyId === item.code;
                  const isCopied = copiedCode === item.code;
                  const memberCount = passcodeMembers.filter(
                    (m) => m.passcode === item.code
                  ).length;

                  return (
                    <div
                      key={item.code}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-mono text-base font-bold tracking-wider text-slate-900 dark:text-white">
                            {item.code}
                          </span>
                          {item.label && (
                            <span className="text-xs text-slate-600 dark:text-slate-300">
                              · {item.label}
                            </span>
                          )}
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                              item.active
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400 dark:text-slate-500'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.active ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span>
                              {item.active ? t.passcodeActiveStatus : t.passcodeDisabledStatus}
                            </span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                          <span suppressHydrationWarning>
                            {new Date(item.createdAtMs).toLocaleDateString()}
                          </span>
                          <span aria-hidden="true"> · </span>
                          {memberCount} {t.adminTabPasscodeMembers}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(item.code)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{isCopied ? t.passcodeCopiedBtn : t.passcodeCopyBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyInviteLink(item.code)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {copiedInviteCode === item.code ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Link2 className="w-3.5 h-3.5" />
                          )}
                          <span>
                            {copiedInviteCode === item.code
                              ? t.passcodeCopiedLinkBtn
                              : t.passcodeCopyLinkBtn}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(item.code);
                            try {
                              await togglePasscode(item.code, !item.active);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                        >
                          <Power className="w-3.5 h-3.5" />
                          <span>
                            {item.active ? t.passcodeToggleDisable : t.passcodeToggleEnable}
                          </span>
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(item.code);
                            try {
                              await removePasscode(item.code);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          aria-label={t.passcodeDeleteBtn}
                          className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: PASSCODE REGISTERED MEMBERS (NAME + PASSCODE)         */}
        {/* ============================================================ */}
        {activeTab === 'passcodeMembers' && (
          <div>
            {filteredPasscodeMembers.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.passcodeMembersEmpty}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPasscodeMembers.map((member) => {
                  const isBusy = busyId === member.id;
                  return (
                    <div
                      key={member.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                            {member.displayName}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold ${
                              member.status === 'approved'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {member.status === 'approved' ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <XCircle className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {member.status === 'approved' ? t.statusApproved : t.statusRejected}
                            </span>
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {t.passcodeUsedLabel}:{' '}
                          <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                            {member.passcode}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className="tabular-nums" suppressHydrationWarning>
                            {new Date(member.createdAtMs).toLocaleDateString()}
                          </span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {member.status === 'approved' ? (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(member.id);
                              try {
                                await reviewPasscodeMember(member.id, 'rejected');
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>{t.revokeBtn}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(member.id);
                              try {
                                await reviewPasscodeMember(member.id, 'approved');
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>{t.restoreAccessBtn}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(member.id);
                            try {
                              await removePasscodeMember(member.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          aria-label={t.passcodeDeleteBtn}
                          className="min-h-[38px] min-w-[38px] px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-rose-600 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: GOOGLE CLOUD USERS APPROVAL                           */}
        {/* ============================================================ */}
        {activeTab === 'googleUsers' && (
          <div className="space-y-4">
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

            {filteredGoogleUsers.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.noUsersInFilter}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredGoogleUsers.map((item) => {
                  const isSelf = item.uid === user.uid;
                  const isPrimaryAdmin = item.email.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;
                  const isBusy = busyId === item.uid;

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
                          <span className="tabular-nums" suppressHydrationWarning>
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
                              onClick={() => handleAction(item, 'approved', 'user')}
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
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 4: ALL USERS' STUDENT TASKS (ADMIN FULL VISIBILITY)      */}
        {/* ============================================================ */}
        {activeTab === 'studentTasks' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <span>{t.adminTasksAllDesc}</span>
              </p>

              {teacherOptions.length > 0 && (
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => setSelectedTeacherFilter(e.target.value)}
                  aria-label={t.adminTasksFilterAllTeachers}
                  className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                >
                  <option value="all">{t.adminTasksFilterAllTeachers}</option>
                  {teacherOptions.map((teacher) => (
                    <option key={teacher.ownerId} value={teacher.ownerId}>
                      {teacher.ownerDisplayName} ({teacher.ownerType === 'passcode' ? 'Passcode' : 'Google'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filteredAssignments.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.adminTasksEmpty}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredAssignments.map((item) => {
                  const isBusy = busyId === item.id;
                  const isCopied = copiedTaskId === item.id;
                  const url = buildStudentTaskUrl(item.id, shareOrigin);

                  return (
                    <div
                      key={item.id}
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                            {item.title}
                          </span>
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

                        <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                          <span>
                            {t.adminTasksOwnerLabel}:{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {item.ownerDisplayName}
                            </strong>{' '}
                            ({item.ownerType === 'passcode' ? 'Passcode' : 'Google'})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">
                            {t.entriesCount(item.entries.length)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums" suppressHydrationWarning>
                            {new Date(item.createdAtMs).toLocaleDateString()}
                          </span>
                        </p>

                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-[420px]">
                          {url}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyTaskLink(item)}
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
                          <QrCode className="w-3.5 h-3.5 text-[#3B82F6]" />
                          <span>{t.tasksShowQrBtn}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSubmissionsTarget(item)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Inbox className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>{t.tasksSubmissionsBtn}</span>
                        </button>

                        <Link
                          href={`/task/${item.id}`}
                          title={t.tasksOpenStudentBtn}
                          aria-label={t.tasksOpenStudentBtn}
                          className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Link>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(item.id);
                            try {
                              await updateStudentAssignment(item.id, { active: !item.active });
                            } finally {
                              setBusyId(null);
                            }
                          }}
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
                          onClick={async () => {
                            setBusyId(item.id);
                            try {
                              await deleteStudentAssignment(item.id);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          title={t.tasksDeleteBtn}
                          aria-label={t.tasksDeleteBtn}
                          className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-600 dark:text-rose-400 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <QrShareModal
        assignment={qrModalTarget}
        language={settings.language}
        onClose={() => setQrModalTarget(null)}
      />

      <AssignmentSubmissionsModal
        assignment={submissionsTarget}
        isAdmin={true}
        language={settings.language}
        onClose={() => setSubmissionsTarget(null)}
      />
    </div>
  );
}
