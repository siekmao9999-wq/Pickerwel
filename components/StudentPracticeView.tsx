'use client';

import React, { useEffect, useState, useCallback, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Send,
  AlertCircle,
  PauseCircle,
  Sparkles,
  User as UserIcon,
  ArrowLeft,
  BookOpen,
  Pencil,
  Sigma,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { PickerWheelCanvas, type SpinResultPayload } from './PickerWheelCanvas';
import { PlayerAvatarBadge, PlayerProfileFormCard } from './PlayerJoinProfileModal';
import { MathText, hasExplicitMathSyntax } from './MathText';
import { StemFormulaEditorModal } from './forms/StemFormulaEditorModal';
import { COPY } from '@/lib/i18n';
import {
  getStudentAssignment,
  submitStudentWork,
  type StudentAssignment,
} from '@/lib/firestore-service';
import {
  getGuestPlayerProfileServerSnapshot,
  isValidPlayerProfile,
  loadGuestPlayerProfile,
  subscribeGuestPlayerProfile,
  type GuestPlayerProfile,
} from '@/lib/player-profile';
import { playWinSound, triggerHaptic } from '@/lib/sound';

interface StudentPracticeViewProps {
  assignmentId: string;
}

export function StudentPracticeView({ assignmentId }: StudentPracticeViewProps) {
  const router = useRouter();
  const { settings } = usePickerwel();
  const t = COPY[settings.language];

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/tasks');
    }
  };

  const [assignment, setAssignment] = useState<StudentAssignment | null>(null);
  const [loadedForId, setLoadedForId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const playerProfile = useSyncExternalStore(
    subscribeGuestPlayerProfile,
    loadGuestPlayerProfile,
    getGuestPlayerProfileServerSnapshot
  );
  const [editingProfile, setEditingProfile] = useState(false);

  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null);
  const [drawnItem, setDrawnItem] = useState('');
  const [studentNameDraft, setStudentNameDraft] = useState<string | null>(null);
  const [groupLabel, setGroupLabel] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [mathTypeOpen, setMathTypeOpen] = useState(false);

  const studentName = studentNameDraft ?? (playerProfile?.name || '');
  const hasValidProfile = isValidPlayerProfile(playerProfile);
  const loading = loadedForId !== assignmentId;

  const handleConfirmProfile = (profile: GuestPlayerProfile) => {
    setStudentNameDraft(profile.name);
    setEditingProfile(false);
  };

  useEffect(() => {
    let active = true;
    getStudentAssignment(assignmentId)
      .then((doc) => {
        if (!active) return;
        if (!doc) {
          setNotFound(true);
          setAssignment(null);
        } else {
          setNotFound(false);
          setAssignment(doc);
        }
        setLoadedForId(assignmentId);
      })
      .catch(() => {
        if (!active) return;
        setNotFound(true);
        setAssignment(null);
        setLoadedForId(assignmentId);
      });
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const handleSpinComplete = useCallback(
    (result: SpinResultPayload) => {
      setDrawnItem(result.winner);
      if (settings.soundEnabled) playWinSound();
      if (settings.hapticsEnabled) triggerHaptic([40, 25, 65]);
    },
    [settings.hapticsEnabled, settings.soundEnabled]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignment || !assignment.active) return;
    if (!studentName.trim() || !answerText.trim()) {
      setSubmitError(
        !studentName.trim() ? t.tasksStudentNamePlaceholder : t.tasksStudentAnswerPlaceholder
      );
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      await submitStudentWork(assignment.id, assignment.ownerId, {
        studentName: studentName.trim(),
        groupLabel: groupLabel.trim(),
        drawnItem: drawnItem.trim(),
        answerText: answerText.trim(),
      });
      setSubmittedSuccess(true);
      setAnswerText('');
    } catch {
      setSubmitError(t.authPasscodeNetworkError);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-sm text-slate-500 dark:text-slate-400">
        ...
      </div>
    );
  }

  if (notFound || !assignment) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.tasksStudentNotFoundTitle}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.tasksStudentNotFoundDesc}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>{t.navHome}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const showWheel = assignment.allowWheelSpin && assignment.entries.length >= 2;

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Back Button */}
        <div>
          <button
            type="button"
            onClick={handleBack}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{t.backBtn}</span>
          </button>
        </div>

        {/* Assignment Info Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[#3B82F6] dark:text-blue-400">
              <BookOpen className="w-4 h-4" />
              <span>{t.tasksStudentHeaderBadge}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UserIcon className="w-3.5 h-3.5" />
              <span>
                {t.tasksStudentTeacherLabel}:{' '}
                <strong className="text-slate-700 dark:text-slate-200">
                  {assignment.ownerDisplayName}
                </strong>
              </span>
            </span>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            <MathText text={assignment.title} explicitOnly />
          </h1>

          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{t.tasksNoSignupNote}</span>
          </p>

          {assignment.instructions && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/80 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed overflow-x-auto">
              <MathText text={assignment.instructions} explicitOnly />
            </div>
          )}
        </div>

        {/* Paused Notice */}
        {!assignment.active ? (
          <div className="p-8 rounded-2xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/60 text-center space-y-2.5">
            <PauseCircle className="w-10 h-10 text-amber-500 mx-auto" />
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {t.tasksStudentPausedTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              {t.tasksStudentPausedDesc}
            </p>
          </div>
        ) : !hasValidProfile || editingProfile ? (
          /* Mandatory Name + Avatar Check-In Gate (Zero Email Required) */
          <div className="max-w-xl mx-auto p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-200 dark:border-blue-900/70 shadow-sm space-y-4">
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                {t.playerJoinTitle}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                {t.playerJoinDesc}
              </p>
            </div>
            <PlayerProfileFormCard
              language={settings.language}
              targetLabel={assignment.title}
              submitLabel={t.playerJoinEnterBtn}
              initialProfile={playerProfile}
              onConfirm={handleConfirmProfile}
              onBack={editingProfile && hasValidProfile ? () => setEditingProfile(false) : handleBack}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Active Player Identity Strip */}
            <div className="px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <PlayerAvatarBadge
                  avatarId={playerProfile.avatarId === 'custom' ? '' : playerProfile.avatarId}
                  customPhotoDataUrl={playerProfile.customPhotoDataUrl}
                  name={playerProfile.name}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t.playerJoinPreviewLabel}
                  </p>
                  <p className="font-display text-sm font-bold text-slate-900 dark:text-white truncate">
                    {playerProfile.name}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="min-h-[34px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Pencil className="w-3.5 h-3.5 shrink-0" />
                <span>{t.playerJoinEditBtn}</span>
              </button>
            </div>

            <div className={`grid grid-cols-1 ${showWheel ? 'lg:grid-cols-12' : ''} gap-6 items-start`}>
            {/* Optional Interactive Practice Wheel */}
            {showWheel && (
              <div className="lg:col-span-6 p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {t.tasksStudentSpinTitle}
                  </h2>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                    {t.entriesCount(assignment.entries.length)}
                  </span>
                </div>

                <div className="flex items-center justify-center py-2">
                  <PickerWheelCanvas
                    entries={assignment.entries}
                    paletteId={assignment.paletteId}
                    spinDuration={settings.spinDuration}
                    soundEnabled={settings.soundEnabled}
                    spinSound={settings.spinSound}
                    language={settings.language}
                    hapticsEnabled={settings.hapticsEnabled}
                    spinLabel={t.spinButton}
                    emptyTitle={t.emptyWheelTitle}
                    emptyDesc={t.emptyWheelDesc}
                    hoveredSliceIndex={hoveredSliceIndex}
                    onHoverSlice={setHoveredSliceIndex}
                    onSpinComplete={handleSpinComplete}
                  />
                </div>

                {drawnItem && (
                  <div className="p-3.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900 flex items-center gap-2.5">
                    <Sparkles className="w-5 h-5 text-[#3B82F6] dark:text-blue-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-300">
                        {t.tasksStudentSpinResultLabel}
                      </p>
                      <p className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                        {drawnItem}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Student Work Submission Form */}
            <div className={`${showWheel ? 'lg:col-span-6' : 'max-w-2xl mx-auto w-full'} p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800`}>
              {submittedSuccess ? (
                <div className="py-6 text-center space-y-3">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                    {t.tasksStudentSubmittedTitle}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                    {t.tasksStudentSubmittedDesc}
                  </p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSubmittedSuccess(false)}
                      className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
                    >
                      {t.tasksStudentSubmitAnotherBtn}
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {t.tasksStudentFormTitle}
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="student-name-input"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {t.tasksStudentNameLabel} *
                      </label>
                      <input
                        id="student-name-input"
                        type="text"
                        required
                        maxLength={80}
                        value={studentName}
                        onChange={(e) => setStudentNameDraft(e.target.value)}
                        placeholder={t.tasksStudentNamePlaceholder}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="student-group-input"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {t.tasksStudentGroupLabel}
                      </label>
                      <input
                        id="student-group-input"
                        type="text"
                        maxLength={60}
                        value={groupLabel}
                        onChange={(e) => setGroupLabel(e.target.value)}
                        placeholder={t.tasksStudentGroupPlaceholder}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="student-topic-input"
                      className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                    >
                      {t.tasksStudentTopicLabel}
                    </label>
                    <input
                      id="student-topic-input"
                      type="text"
                      maxLength={120}
                      value={drawnItem}
                      onChange={(e) => setDrawnItem(e.target.value)}
                      placeholder={t.tasksStudentTopicPlaceholder}
                      className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="student-answer-input"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {t.tasksStudentAnswerLabel} *
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
                      id="student-answer-input"
                      required
                      rows={6}
                      maxLength={2000}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder={t.tasksStudentAnswerPlaceholder}
                      className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                    />
                    {hasExplicitMathSyntax(answerText) && (
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap overflow-x-auto">
                        <MathText text={answerText} explicitOnly />
                      </div>
                    )}
                  </div>

                  {submitError && (
                    <p className="text-xs font-medium text-rose-600 dark:text-rose-400">
                      {submitError}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                    <span>{submitting ? t.tasksStudentSubmittingBtn : t.tasksStudentSubmitBtn}</span>
                  </button>
                </form>
              )}
            </div>
          </div>
          </div>
        )}
      </div>

      <StemFormulaEditorModal
        open={mathTypeOpen}
        language={settings.language}
        accentColor="#3B82F6"
        targetLabel={t.tasksStudentAnswerLabel}
        onClose={() => setMathTypeOpen(false)}
        onInsert={(formula) =>
          setAnswerText((prev) => (prev.trim() ? `${prev} ${formula}` : formula))
        }
      />
    </div>
  );
}
