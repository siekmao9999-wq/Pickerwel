'use client';

import React, { useEffect, useState } from 'react';
import { X, CheckCircle2, Trash2, Inbox, Clock, Users, Sparkles } from 'lucide-react';
import { COPY, type Language } from '@/lib/i18n';
import {
  deleteSubmission,
  subscribeAssignmentSubmissions,
  updateSubmissionStatus,
  type StudentAssignment,
  type StudentSubmission,
} from '@/lib/firestore-service';

interface AssignmentSubmissionsModalProps {
  assignment: StudentAssignment | null;
  isAdmin: boolean;
  ownerUid?: string;
  language: Language;
  onClose: () => void;
}

export function AssignmentSubmissionsModal({
  assignment,
  isAdmin,
  ownerUid,
  language,
  onClose,
}: AssignmentSubmissionsModalProps) {
  const t = COPY[language];
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const assignmentId = assignment?.id ?? '';
  const loading = Boolean(assignmentId && loadedForId !== assignmentId);

  useEffect(() => {
    if (!assignmentId) return;
    const unsub = subscribeAssignmentSubmissions(
      assignmentId,
      { isAdmin, ownerUid },
      (list) => {
        setSubmissions(list);
        setLoadedForId(assignmentId);
      }
    );
    return () => unsub();
  }, [assignmentId, isAdmin, ownerUid]);

  useEffect(() => {
    if (!assignment) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assignment, onClose]);

  if (!assignment) return null;

  const handleToggleReviewed = async (sub: StudentSubmission) => {
    setBusyId(sub.id);
    try {
      await updateSubmissionStatus(
        assignment.id,
        sub.id,
        sub.status === 'reviewed' ? 'submitted' : 'reviewed'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (subId: string) => {
    setBusyId(subId);
    try {
      await deleteSubmission(assignment.id, subId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.tasksSubmissionsBtn}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl max-h-[86vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white truncate">
              {assignment.title}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {t.tasksSubmissionsBtn} ·{' '}
              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-200">
                {submissions.length}
              </span>
              {isAdmin && (
                <>
                  {' · '}
                  {t.adminTasksOwnerLabel}: {assignment.ownerDisplayName}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
              ...
            </div>
          ) : submissions.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center gap-2 text-slate-500 dark:text-slate-400">
              <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-600" />
              <p className="text-sm max-w-sm">{t.tasksSubmissionsEmpty}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {submissions.map((sub) => {
                const isBusy = busyId === sub.id;
                return (
                  <div
                    key={sub.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                            {sub.studentName}
                          </span>
                          {sub.groupLabel && (
                            <span className="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                              <Users className="w-3 h-3" />
                              <span>{sub.groupLabel}</span>
                            </span>
                          )}
                          <span
                            className={`text-xs font-semibold ${
                              sub.status === 'reviewed'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}
                          >
                            · {sub.status === 'reviewed' ? t.tasksReviewedTag : t.tasksSubmittedTag}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 tabular-nums">
                          <Clock className="w-3 h-3" />
                          <span suppressHydrationWarning>
                            {new Date(sub.submittedAtMs).toLocaleString()}
                          </span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleToggleReviewed(sub)}
                          className={`min-h-[34px] px-2.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                            sub.status === 'reviewed'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                              : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{t.tasksMarkReviewedBtn}</span>
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleDelete(sub.id)}
                          aria-label={t.tasksDeleteBtn}
                          className="min-h-[34px] min-w-[34px] rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center justify-center cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {sub.drawnItem && (
                      <div className="flex items-center gap-1.5 text-xs text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/70 dark:border-indigo-900/60 rounded-lg px-2.5 py-1.5">
                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium truncate">
                          {t.tasksStudentSpinResultLabel}: {sub.drawnItem}
                        </span>
                      </div>
                    )}

                    <p className="text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words leading-relaxed bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-xl p-3">
                      {sub.answerText}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
