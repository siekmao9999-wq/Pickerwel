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
  UserPlus,
  ClipboardList,
  Pencil,
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
  type RegistrationRequest,
  type StudentAssignment,
  type UserPreferences,
} from '@/lib/firestore-service';
import {
  buildPublicFormUrl,
  deleteCloudForm,
  subscribeAllCloudForms,
  updateCloudFormAdminStatus,
} from '@/lib/firestore-forms';
import type { CustomForm } from '@/lib/forms-model';
import { getShareOrigin } from '@/lib/share-origin';

const subscribeNoop = () => () => {};
const getOriginServer = () => '';

type AdminTab =
  | 'passcodeMembers'
  | 'passcodes'
  | 'requests'
  | 'googleUsers'
  | 'studentTasks'
  | 'studentForms';

function buildSuggestedCode(seed: string): string {
  const cleaned = seed.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = (cleaned.slice(-4) || '2026').padEnd(4, '7');
  return `PW${suffix}`;
}

export function AdminView() {
  const {
    user,
    userProfile,
    allUsers,
    reviewUser,
    adminPasscodes,
    passcodeMembers,
    registrationRequests,
    approveRegistrationWithCode,
    rejectRegistration,
    removeRegistrationRequest,
    createPasscode,
    togglePasscode,
    removePasscode,
    reviewPasscodeMember,
    updatePasscodeMember,
    removePasscodeMember,
    appAdminName,
    saveAppAdminName,
    autoDropEnabled,
    defaultAutoCode,
    saveAutoDropConfig,
    settings,
  } = usePickerwel();

  const t = COPY[settings.language];
  const [activeTab, setActiveTab] = useState<AdminTab>('passcodeMembers');
  const [memberFilter, setMemberFilter] = useState<'all' | 'approved' | 'rejected'>('all');
  const [filter, setFilter] = useState<'all' | AccountStatus>('pending');
  const [requestFilter, setRequestFilter] = useState<'all' | AccountStatus>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [memberEditDraft, setMemberEditDraft] = useState<{
    displayName: string;
    passcode: string;
    adminNote: string;
  }>({ displayName: '', passcode: '', adminNote: '' });
  const [memberEditError, setMemberEditError] = useState<string | null>(null);
  const [requestCodeDrafts, setRequestCodeDrafts] = useState<Record<string, string>>({});
  const [editingRequestCodeId, setEditingRequestCodeId] = useState<string | null>(null);
  const [requestErrorById, setRequestErrorById] = useState<Record<string, string>>({});
  const [googleCodeDrafts, setGoogleCodeDrafts] = useState<Record<string, string>>({});
  const [googleErrorById, setGoogleErrorById] = useState<Record<string, string>>({});

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
  const [autoDropDraft, setAutoDropDraft] = useState<boolean | null>(null);
  const [defaultCodeDraft, setDefaultCodeDraft] = useState<string | null>(null);
  const [savingAutoDrop, setSavingAutoDrop] = useState(false);
  const [autoDropSaved, setAutoDropSaved] = useState(false);
  const [autoDropError, setAutoDropError] = useState<string | null>(null);

  // Admin All Student Assignments & User Forms state
  const [allAssignments, setAllAssignments] = useState<StudentAssignment[]>([]);
  const [allForms, setAllForms] = useState<CustomForm[]>([]);
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [selectedFormOwnerFilter, setSelectedFormOwnerFilter] = useState<string>('all');
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);
  const [copiedFormId, setCopiedFormId] = useState<string | null>(null);
  const [qrModalTarget, setQrModalTarget] = useState<StudentAssignment | null>(null);
  const [submissionsTarget, setSubmissionsTarget] = useState<StudentAssignment | null>(null);

  const isApprovedAdmin = Boolean(
    user && userProfile?.role === 'admin' && userProfile?.status === 'approved'
  );

  useEffect(() => {
    if (!isApprovedAdmin) return;
    const unsubTasks = subscribeAllAssignments((list) => {
      setAllAssignments(list);
    });
    const unsubForms = subscribeAllCloudForms((list) => {
      setAllForms(list);
    });
    return () => {
      unsubTasks();
      unsubForms();
    };
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

  const formOwnerOptions = useMemo(() => {
    const map = new Map<string, { ownerId: string; ownerDisplayName: string; ownerType: string }>();
    for (const f of allForms) {
      if (f.ownerId && !map.has(f.ownerId)) {
        map.set(f.ownerId, {
          ownerId: f.ownerId,
          ownerDisplayName: f.ownerDisplayName || 'Teacher',
          ownerType: f.ownerType || 'google',
        });
      }
    }
    return Array.from(map.values());
  }, [allForms]);

  const taskCountByOwner = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of allAssignments) {
      counts.set(a.ownerId, (counts.get(a.ownerId) || 0) + 1);
    }
    return counts;
  }, [allAssignments]);

  const formCountByOwner = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of allForms) {
      if (f.ownerId) {
        counts.set(f.ownerId, (counts.get(f.ownerId) || 0) + 1);
      }
    }
    return counts;
  }, [allForms]);

  if (!user || userProfile?.role !== 'admin') {
    return null;
  }

  const pendingGoogleCount = allUsers.filter((u) => u.status === 'pending').length;
  const pendingRequestsCount = registrationRequests.filter((r) => r.status === 'pending').length;

  const filteredRequests = registrationRequests.filter((r) => {
    if (requestFilter !== 'all' && r.status !== requestFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      r.displayName.toLowerCase().includes(q) ||
      r.note.toLowerCase().includes(q) ||
      r.assignedCode.toLowerCase().includes(q)
    );
  });

  const filteredGoogleUsers = allUsers.filter((u) => {
    if (filter !== 'all' && u.status !== filter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.assignedCode || '').toLowerCase().includes(q)
    );
  });

  const activeMembersCount = passcodeMembers.filter((m) => m.status === 'approved').length;
  const suspendedMembersCount = passcodeMembers.filter((m) => m.status === 'rejected').length;

  const filteredPasscodeMembers = passcodeMembers.filter((m) => {
    if (memberFilter !== 'all' && m.status !== memberFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      m.displayName.toLowerCase().includes(q) ||
      m.passcode.toLowerCase().includes(q) ||
      (m.adminNote || '').toLowerCase().includes(q)
    );
  });

  const filteredForms = allForms.filter((f) => {
    if (selectedFormOwnerFilter !== 'all' && f.ownerId !== selectedFormOwnerFilter) {
      return false;
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      f.title.toLowerCase().includes(q) ||
      (f.ownerDisplayName || '').toLowerCase().includes(q) ||
      f.description.toLowerCase().includes(q)
    );
  });

  const handleAction = async (
    target: UserPreferences,
    nextStatus: AccountStatus,
    nextRole: 'user' | 'admin'
  ) => {
    setGoogleErrorById((prev) => ({ ...prev, [target.uid]: '' }));
    const draftCode = (googleCodeDrafts[target.uid] || '').trim().toUpperCase();
    if (nextStatus === 'approved' && draftCode && !isValidPasscodeFormat(draftCode)) {
      setGoogleErrorById((prev) => ({ ...prev, [target.uid]: t.authPasscodeFormatError }));
      return;
    }
    setBusyId(target.uid);
    try {
      await reviewUser(
        target.uid,
        nextStatus,
        nextRole,
        nextStatus === 'approved' && draftCode ? draftCode : undefined,
        target.displayName
      );
      if (draftCode) {
        setGoogleCodeDrafts((prev) => {
          const next = { ...prev };
          delete next[target.uid];
          return next;
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'INVALID_PASSCODE_FORMAT') {
        setGoogleErrorById((prev) => ({ ...prev, [target.uid]: t.authPasscodeFormatError }));
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleAssignCodeToRequest = async (req: RegistrationRequest) => {
    const rawCode = (
      requestCodeDrafts[req.id] ?? (req.assignedCode || buildSuggestedCode(req.id))
    )
      .trim()
      .toUpperCase();
    setRequestErrorById((prev) => ({ ...prev, [req.id]: '' }));
    if (!isValidPasscodeFormat(rawCode)) {
      setRequestErrorById((prev) => ({ ...prev, [req.id]: t.authPasscodeFormatError }));
      return;
    }
    setBusyId(req.id);
    try {
      await approveRegistrationWithCode(req, rawCode);
      setEditingRequestCodeId((curr) => (curr === req.id ? null : curr));
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      setRequestErrorById((prev) => ({
        ...prev,
        [req.id]:
          msg === 'INVALID_PASSCODE_FORMAT'
            ? t.authPasscodeFormatError
            : t.authPasscodeNetworkError,
      }));
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

  const handleCopyFormLink = async (form: CustomForm) => {
    const url = buildPublicFormUrl(form.id, shareOrigin);
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
    setCopiedFormId(form.id);
    window.setTimeout(() => {
      setCopiedFormId((curr) => (curr === form.id ? null : curr));
    }, 1800);
  };

  const mainTabs: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'passcodeMembers', label: t.adminTabPasscodeMembers, icon: Users, count: passcodeMembers.length },
    { id: 'passcodes', label: t.adminTabPasscodes, icon: KeyRound, count: adminPasscodes.length },
    { id: 'studentTasks', label: t.adminTabStudentTasks, icon: QrCode, count: allAssignments.length },
    { id: 'studentForms', label: t.adminTabUserForms, icon: ClipboardList, count: allForms.length },
    { id: 'googleUsers', label: t.adminTabGoogleUsers, icon: ShieldCheck, count: pendingGoogleCount },
    { id: 'requests', label: t.adminTabRequests, icon: UserPlus, count: pendingRequestsCount },
  ];

  const requestFilterTabs: { id: 'all' | AccountStatus; label: string }[] = [
    { id: 'pending', label: `${t.filterPending} (${pendingRequestsCount})` },
    { id: 'approved', label: t.filterApproved },
    { id: 'rejected', label: t.filterRejected },
    { id: 'all', label: t.filterAll },
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

        {/* Live Admin Supervision Summary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {t.adminSummaryTotalMembers}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {passcodeMembers.length}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {t.adminSummaryActiveMembers}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {activeMembersCount}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
              {t.adminSummarySuspendedMembers}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
              {suspendedMembersCount}
            </p>
          </div>
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <p className="text-xs font-medium text-[#3B82F6] dark:text-blue-400">
              {t.adminSummaryContentCount}
            </p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
              {allAssignments.length + allForms.length}
            </p>
          </div>
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

        {/* Instant Auto-Drop Code Settings Card */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setAutoDropError(null);
            const nextEnabled = autoDropDraft ?? autoDropEnabled;
            const nextCode = (defaultCodeDraft ?? defaultAutoCode).trim().toUpperCase();
            if (nextCode && !isValidPasscodeFormat(nextCode)) {
              setAutoDropError(t.authPasscodeFormatError);
              return;
            }
            setSavingAutoDrop(true);
            try {
              await saveAutoDropConfig(nextEnabled, nextCode);
              setAutoDropDraft(null);
              setDefaultCodeDraft(null);
              setAutoDropSaved(true);
              window.setTimeout(() => setAutoDropSaved(false), 1800);
            } catch (err) {
              const msg = err instanceof Error ? err.message : '';
              setAutoDropError(
                msg === 'INVALID_PASSCODE_FORMAT'
                  ? t.authPasscodeFormatError
                  : t.authPasscodeNetworkError
              );
            } finally {
              setSavingAutoDrop(false);
            }
          }}
          className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className="flex items-center gap-1.5 font-display text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                <KeyRound className="w-4 h-4 text-[#3B82F6] shrink-0" />
                <span>{t.adminAutoDropTitle}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                {t.adminAutoDropDesc}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setAutoDropDraft(!(autoDropDraft ?? autoDropEnabled))}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
                (autoDropDraft ?? autoDropEnabled)
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>
                {(autoDropDraft ?? autoDropEnabled)
                  ? t.adminAutoDropEnabledLabel
                  : t.adminAutoDropDisabledLabel}
              </span>
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1 min-w-0 space-y-1.5">
              <label
                htmlFor="admin-auto-drop-code"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                {t.adminDefaultCodeLabel}
              </label>
              <div className="flex gap-2">
                <input
                  id="admin-auto-drop-code"
                  type="text"
                  list="admin-active-passcodes"
                  value={defaultCodeDraft ?? defaultAutoCode}
                  onChange={(e) => setDefaultCodeDraft(e.target.value.toUpperCase())}
                  maxLength={32}
                  placeholder={t.adminDefaultCodePlaceholder}
                  className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-sm tracking-wider uppercase text-slate-900 dark:text-white placeholder:font-sans placeholder:tracking-normal placeholder:normal-case placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setDefaultCodeDraft(generateRandomPasscode('PW-'))}
                  title={t.passcodeGenerateRandomBtn}
                  className="h-10 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{t.passcodeGenerateRandomBtn}</span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingAutoDrop}
              className="h-10 px-4 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {autoDropSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.adminNameSavedMsg}</span>
                </>
              ) : (
                <span>{t.adminAutoDropSaveBtn}</span>
              )}
            </button>
          </div>

          {autoDropError && (
            <p className="text-xs text-rose-600 dark:text-rose-400">{autoDropError}</p>
          )}
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

        {/* Shared datalist of existing active passcodes for quick assignment */}
        <datalist id="admin-active-passcodes">
          {adminPasscodes
            .filter((p) => p.active)
            .map((p) => (
              <option key={p.code} value={p.code}>
                {p.label ? `${p.code} — ${p.label}` : p.code}
              </option>
            ))}
        </datalist>

        {/* ============================================================ */}
        {/* TAB 0: USER REGISTRATION REQUESTS -> ADMIN ASSIGNS CODE      */}
        {/* ============================================================ */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <KeyRound className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
              <span>{t.adminRequestsNotice}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              {requestFilterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setRequestFilter(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    requestFilter === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredRequests.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.adminRequestsEmpty}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map((req) => {
                  const isBusy = busyId === req.id;
                  const isEditingCode =
                    req.status !== 'approved' || editingRequestCodeId === req.id;
                  const codeValue =
                    requestCodeDrafts[req.id] ??
                    (req.assignedCode || buildSuggestedCode(req.id));
                  const reqError = requestErrorById[req.id];
                  const isCopied = copiedCode === req.assignedCode && Boolean(req.assignedCode);

                  return (
                    <div key={req.id} className="p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2.5 flex-wrap">
                            <span className="font-display text-base font-semibold text-slate-900 dark:text-white truncate">
                              {req.displayName}
                            </span>
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                req.status === 'approved'
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : req.status === 'rejected'
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              {req.status === 'approved' ? (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              ) : req.status === 'rejected' ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <Clock className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {req.status === 'approved'
                                  ? t.statusApproved
                                  : req.status === 'rejected'
                                  ? t.statusRejected
                                  : t.statusPending}
                              </span>
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            {req.note && (
                              <>
                                <span className="text-slate-700 dark:text-slate-300 font-medium">
                                  {req.note}
                                </span>
                                <span aria-hidden="true">·</span>
                              </>
                            )}
                            <span className="tabular-nums" suppressHydrationWarning>
                              {new Date(req.createdAtMs).toLocaleDateString()}
                            </span>
                            {req.assignedCode && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {t.adminAssignedCodeLabel}:{' '}
                                  <strong className="font-mono text-slate-900 dark:text-white tracking-wider">
                                    {req.assignedCode}
                                  </strong>
                                </span>
                              </>
                            )}
                          </p>
                        </div>

                        {isEditingCode ? (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                list="admin-active-passcodes"
                                value={codeValue}
                                onChange={(e) =>
                                  setRequestCodeDrafts((prev) => ({
                                    ...prev,
                                    [req.id]: e.target.value.toUpperCase(),
                                  }))
                                }
                                maxLength={32}
                                placeholder={t.adminAssignCodePlaceholder}
                                aria-label={t.passcodeInputLabel}
                                className="w-36 sm:w-40 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold tracking-wider uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setRequestCodeDrafts((prev) => ({
                                    ...prev,
                                    [req.id]: generateRandomPasscode('PW'),
                                  }))
                                }
                                title={t.passcodeGenerateRandomBtn}
                                aria-label={t.passcodeGenerateRandomBtn}
                                className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer shrink-0"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAssignCodeToRequest(req)}
                              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>{t.adminAssignCodeApproveBtn}</span>
                            </button>

                            {req.status === 'pending' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(req.id);
                                  try {
                                    await rejectRegistration(req.id);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="min-h-[40px] px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 hover:bg-rose-100 text-rose-700 dark:text-rose-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                              >
                                <UserX className="w-3.5 h-3.5" />
                                <span>{t.rejectBtn}</span>
                              </button>
                            )}

                            {req.status === 'approved' && (
                              <button
                                type="button"
                                onClick={() => setEditingRequestCodeId(null)}
                                className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                              >
                                {t.close}
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleCopyCode(req.assignedCode)}
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
                              onClick={() => handleCopyInviteLink(req.assignedCode)}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-950/70 text-xs font-semibold text-[#3B82F6] dark:text-blue-400 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              {copiedInviteCode === req.assignedCode ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {copiedInviteCode === req.assignedCode
                                  ? t.passcodeCopiedLinkBtn
                                  : t.passcodeCopyLinkBtn}
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setRequestCodeDrafts((prev) => ({
                                  ...prev,
                                  [req.id]: req.assignedCode || generateRandomPasscode('PW'),
                                }));
                                setEditingRequestCodeId(req.id);
                              }}
                              className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              <span>{t.adminChangeCodeBtn}</span>
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={async () => {
                                setBusyId(req.id);
                                try {
                                  await removeRegistrationRequest(req.id);
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
                        )}
                      </div>

                      {reqError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{reqError}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

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
        {/* TAB 2: PASSCODE REGISTERED MEMBERS (UNDER ADMIN CONTROL)     */}
        {/* ============================================================ */}
        {activeTab === 'passcodeMembers' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
              <span>{t.adminMembersControlNotice}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
              {(
                [
                  { id: 'all', label: `${t.adminMemberFilterAll} (${passcodeMembers.length})` },
                  { id: 'approved', label: `${t.adminMemberFilterActive} (${activeMembersCount})` },
                  { id: 'rejected', label: `${t.adminMemberFilterSuspended} (${suspendedMembersCount})` },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMemberFilter(tab.id)}
                  className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                    memberFilter === tab.id
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredPasscodeMembers.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.passcodeMembersEmpty}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPasscodeMembers.map((member) => {
                  const isBusy = busyId === member.id;
                  const isEditing = editingMemberId === member.id;
                  const memberTasks = taskCountByOwner.get(member.id) || 0;
                  const memberForms = formCountByOwner.get(member.id) || 0;
                  const isCopied = copiedCode === member.passcode;

                  return (
                    <div key={member.id} className="p-4 sm:p-5 space-y-3">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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

                          <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 flex-wrap">
                            <span>
                              {t.passcodeUsedLabel}:{' '}
                              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {member.passcode}
                              </span>
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums" suppressHydrationWarning>
                              {new Date(member.createdAtMs).toLocaleDateString()}
                            </span>
                            {memberTasks > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTeacherFilter(member.id);
                                    setActiveTab('studentTasks');
                                  }}
                                  className="text-[#3B82F6] dark:text-blue-400 hover:underline font-semibold cursor-pointer"
                                >
                                  {t.adminMemberTasksCount(memberTasks)}
                                </button>
                              </>
                            )}
                            {memberForms > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFormOwnerFilter(member.id);
                                    setActiveTab('studentForms');
                                  }}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
                                >
                                  {t.adminMemberFormsCount(memberForms)}
                                </button>
                              </>
                            )}
                          </p>

                          {member.adminNote && !isEditing && (
                            <p className="text-xs text-slate-600 dark:text-slate-300">
                              <span className="font-semibold text-slate-500 dark:text-slate-400">
                                {t.accessBlockedAdminNoteLabel}:{' '}
                              </span>
                              {member.adminNote}
                            </p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyCode(member.passcode)}
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
                            onClick={() => {
                              setMemberEditError(null);
                              if (isEditing) {
                                setEditingMemberId(null);
                              } else {
                                setMemberEditDraft({
                                  displayName: member.displayName,
                                  passcode: member.passcode,
                                  adminNote: member.adminNote || '',
                                });
                                setEditingMemberId(member.id);
                              }
                            }}
                            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            <span>{isEditing ? t.close : t.adminEditMemberBtn}</span>
                          </button>

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
                              <span>{t.adminMemberSuspendBtn}</span>
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
                              <span>{t.adminMemberRestoreBtn}</span>
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

                      {isEditing && (
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            setMemberEditError(null);
                            const cleanedName = memberEditDraft.displayName.trim();
                            const cleanedCode = memberEditDraft.passcode.trim().toUpperCase();
                            if (!cleanedName) {
                              setMemberEditError(t.authNameRequiredError);
                              return;
                            }
                            if (!isValidPasscodeFormat(cleanedCode)) {
                              setMemberEditError(t.authPasscodeFormatError);
                              return;
                            }
                            setBusyId(member.id);
                            try {
                              await updatePasscodeMember(member.id, {
                                displayName: cleanedName,
                                passcode: cleanedCode,
                                adminNote: memberEditDraft.adminNote.trim(),
                              });
                              setEditingMemberId(null);
                            } catch {
                              setMemberEditError(t.authPasscodeNetworkError);
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {t.authNameLabel}
                              </label>
                              <input
                                type="text"
                                value={memberEditDraft.displayName}
                                onChange={(e) =>
                                  setMemberEditDraft((prev) => ({
                                    ...prev,
                                    displayName: e.target.value,
                                  }))
                                }
                                maxLength={80}
                                className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                                {t.passcodeInputLabel}
                              </label>
                              <div className="flex gap-1.5">
                                <input
                                  type="text"
                                  list="admin-active-passcodes"
                                  value={memberEditDraft.passcode}
                                  onChange={(e) =>
                                    setMemberEditDraft((prev) => ({
                                      ...prev,
                                      passcode: e.target.value.toUpperCase(),
                                    }))
                                  }
                                  maxLength={32}
                                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-mono text-xs font-bold tracking-wider uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setMemberEditDraft((prev) => ({
                                      ...prev,
                                      passcode: generateRandomPasscode('PW-'),
                                    }))
                                  }
                                  title={t.passcodeGenerateRandomBtn}
                                  aria-label={t.passcodeGenerateRandomBtn}
                                  className="h-9 w-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer shrink-0"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              {t.adminMemberNoteLabel}
                            </label>
                            <input
                              type="text"
                              value={memberEditDraft.adminNote}
                              onChange={(e) =>
                                setMemberEditDraft((prev) => ({
                                  ...prev,
                                  adminNote: e.target.value,
                                }))
                              }
                              maxLength={160}
                              placeholder={t.adminMemberNotePlaceholder}
                              className="w-full h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>

                          {memberEditError && (
                            <p className="text-xs text-rose-600 dark:text-rose-400">
                              {memberEditError}
                            </p>
                          )}

                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingMemberId(null)}
                              className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {t.close}
                            </button>
                            <button
                              type="submit"
                              disabled={isBusy}
                              className="h-9 px-4 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
                            >
                              {t.adminSaveMemberBtn}
                            </button>
                          </div>
                        </form>
                      )}
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
                          {item.assignedCode && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>
                                {t.adminAssignedCodeLabel}:{' '}
                                <strong className="font-mono text-slate-800 dark:text-slate-100">
                                  {item.assignedCode}
                                </strong>
                              </span>
                            </>
                          )}
                        </p>
                        {googleErrorById[item.uid] && (
                          <p className="text-xs text-rose-600 dark:text-rose-400">
                            {googleErrorById[item.uid]}
                          </p>
                        )}
                      </div>

                      {!isPrimaryAdmin && !isSelf && (
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {item.status !== 'approved' && (
                            <>
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  list="admin-active-passcodes"
                                  value={googleCodeDrafts[item.uid] ?? ''}
                                  onChange={(e) =>
                                    setGoogleCodeDrafts((prev) => ({
                                      ...prev,
                                      [item.uid]: e.target.value.toUpperCase(),
                                    }))
                                  }
                                  maxLength={32}
                                  placeholder={t.adminOptionalCodePlaceholder}
                                  aria-label={t.passcodeInputLabel}
                                  className="w-36 h-10 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs tracking-wider uppercase text-slate-900 dark:text-white placeholder:font-sans placeholder:tracking-normal placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGoogleCodeDrafts((prev) => ({
                                      ...prev,
                                      [item.uid]: generateRandomPasscode('PW'),
                                    }))
                                  }
                                  title={t.passcodeGenerateRandomBtn}
                                  aria-label={t.passcodeGenerateRandomBtn}
                                  className="h-10 w-10 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer shrink-0"
                                >
                                  <RefreshCw className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(item, 'approved', 'user')}
                                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
                              >
                                <UserCheck className="w-3.5 h-3.5" />
                                <span>
                                  {(googleCodeDrafts[item.uid] || '').trim()
                                    ? t.adminApproveWithCodeBtn
                                    : t.approveBtn}
                                </span>
                              </button>
                            </>
                          )}

                          {item.status === 'approved' && item.assignedCode && (
                            <button
                              type="button"
                              onClick={() => handleCopyCode(item.assignedCode!)}
                              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              {copiedCode === item.assignedCode ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                              <span>
                                {copiedCode === item.assignedCode
                                  ? t.passcodeCopiedBtn
                                  : t.passcodeCopyBtn}
                              </span>
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

        {/* ============================================================ */}
        {/* TAB 5: ALL USERS' PUBLISHED FORMS (ADMIN FULL CONTROL)       */}
        {/* ============================================================ */}
        {activeTab === 'studentForms' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-slate-700 dark:text-slate-200 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
                <span>{t.adminFormsAllDesc}</span>
              </p>

              {formOwnerOptions.length > 0 && (
                <select
                  value={selectedFormOwnerFilter}
                  onChange={(e) => setSelectedFormOwnerFilter(e.target.value)}
                  aria-label={t.adminTasksFilterAllTeachers}
                  className="h-9 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                >
                  <option value="all">{t.adminTasksFilterAllTeachers}</option>
                  {formOwnerOptions.map((owner) => (
                    <option key={owner.ownerId} value={owner.ownerId}>
                      {owner.ownerDisplayName} ({owner.ownerType === 'passcode' ? 'Code' : 'Google'})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filteredForms.length === 0 ? (
              <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center text-sm text-slate-500 dark:text-slate-400">
                {t.adminFormsEmpty}
              </div>
            ) : (
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                {filteredForms.map((form) => {
                  const isBusy = busyId === form.id;
                  const isCopied = copiedFormId === form.id;
                  const url = buildPublicFormUrl(form.id, shareOrigin);
                  const isAccepting = form.settings.acceptingResponses && form.published;

                  return (
                    <div
                      key={form.id}
                      className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                            {form.title}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              isAccepting
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            · {isAccepting ? t.adminFormsAccepting : t.adminFormsClosed}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-2 flex-wrap">
                          <span>
                            {t.adminTasksOwnerLabel}:{' '}
                            <strong className="text-slate-900 dark:text-white">
                              {form.ownerDisplayName || 'Teacher'}
                            </strong>{' '}
                            ({form.ownerType === 'passcode' ? 'Code' : 'Google'})
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums" suppressHydrationWarning>
                            {new Date(form.updatedAtMs).toLocaleDateString()}
                          </span>
                        </p>

                        <p className="font-mono text-xs text-slate-500 dark:text-slate-400 truncate max-w-[420px]">
                          {url}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyFormLink(form)}
                          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                          <span>{isCopied ? t.tasksCopiedLinkBtn : t.tasksCopyLinkBtn}</span>
                        </button>

                        <Link
                          href={`/form/${form.id}`}
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
                            setBusyId(form.id);
                            try {
                              await updateCloudFormAdminStatus(form.id, {
                                acceptingResponses: !form.settings.acceptingResponses,
                              });
                            } finally {
                              setBusyId(null);
                            }
                          }}
                          title={
                            form.settings.acceptingResponses
                              ? t.adminFormsPauseBtn
                              : t.adminFormsResumeBtn
                          }
                          aria-label={
                            form.settings.acceptingResponses
                              ? t.adminFormsPauseBtn
                              : t.adminFormsResumeBtn
                          }
                          className="min-h-[38px] min-w-[38px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          {form.settings.acceptingResponses ? (
                            <PauseCircle className="w-4 h-4 text-amber-500" />
                          ) : (
                            <PlayCircle className="w-4 h-4 text-emerald-500" />
                          )}
                        </button>

                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={async () => {
                            setBusyId(form.id);
                            try {
                              await deleteCloudForm(form.id);
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
