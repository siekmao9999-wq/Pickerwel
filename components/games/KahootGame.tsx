'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import confetti from 'canvas-confetti';
import {
  Triangle,
  Diamond,
  Circle,
  Square,
  Trophy,
  Users,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Pencil,
  Presentation,
  Send,
  BookOpenCheck,
  Layers,
  LayoutGrid,
  BadgeCheck,
  Eye,
  EyeOff,
  Clock,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { MathText } from '../MathText';
import { QrShareModal } from '../QrShareModal';
import { KahootLearnMode } from './KahootLearnMode';
import { KahootFlashcardsMode } from './KahootFlashcardsMode';
import type { QuizCreatePreset } from './SubjectGradeQuizPicker';
import {
  getGradeLabel,
  getSubjectLabel,
  GRADE_GROUPS,
  GRADE_LEVELS,
  resolveQuizGradeId,
  resolveQuizSubjectId,
  SUBJECT_CATALOG,
  type GradeId,
  type OfflineQuiz,
  type SubjectId,
} from '@/lib/offline-quizzes';
import {
  createStudentAssignment,
  type StudentAssignment,
} from '@/lib/firestore-service';
import {
  playCorrectSound,
  playWrongSound,
  playWinSound,
  playTickSound,
  triggerHaptic,
} from '@/lib/sound';
import { COPY } from '@/lib/i18n';

interface KahootGameProps {
  quizzes: OfflineQuiz[];
  onCreateQuiz: (preset?: QuizCreatePreset) => void;
  onEditQuiz: (quiz: OfflineQuiz) => void;
}

interface PlayerScore {
  name: string;
  score: number;
  correctCount: number;
}

type KahootPhase = 'STUDIO' | 'LEARN' | 'FLASHCARDS' | 'QUESTION' | 'REVEAL' | 'PODIUM';

const KAHOOT_TILES = [
  {
    bg: 'bg-[#E21B3C] hover:bg-rose-700',
    barBg: 'bg-[#E21B3C]',
    icon: Triangle,
    label: 'A',
  },
  {
    bg: 'bg-[#1368CE] hover:bg-blue-700',
    barBg: 'bg-[#1368CE]',
    icon: Diamond,
    label: 'B',
  },
  {
    bg: 'bg-[#D89E00] hover:bg-amber-600',
    barBg: 'bg-[#D89E00]',
    icon: Circle,
    label: 'C',
  },
  {
    bg: 'bg-[#26890C] hover:bg-emerald-700',
    barBg: 'bg-[#26890C]',
    icon: Square,
    label: 'D',
  },
];

function savePasscodeAssignmentId(memberId: string, assignmentId: string): void {
  if (typeof window === 'undefined' || !memberId) return;
  const key = `pickerwel_pm_assignments_${memberId}`;
  try {
    const raw = window.localStorage.getItem(key);
    const prev = raw ? (JSON.parse(raw) as unknown) : [];
    const ids = Array.isArray(prev)
      ? prev.filter((v): v is string => typeof v === 'string' && v !== assignmentId)
      : [];
    window.localStorage.setItem(key, JSON.stringify([assignmentId, ...ids].slice(0, 100)));
  } catch {
    // Ignore storage quota errors
  }
}

function buildQuizAssignmentInstructions(quiz: OfflineQuiz, headerText: string): string {
  const letters = ['A', 'B', 'C', 'D'];
  const lines: string[] = [headerText, ''];
  quiz.questions.forEach((q, idx) => {
    lines.push(`${idx + 1}. ${q.prompt}`);
    const opts = q.options
      .map((opt, oi) => `${letters[oi]}) ${opt}`)
      .join('   ');
    lines.push(`   ${opts}`);
  });
  return lines.join('\n').slice(0, 2000);
}

export function KahootGame({
  quizzes,
  onCreateQuiz,
  onEditQuiz,
}: KahootGameProps) {
  const {
    user,
    passcodeSession,
    isSignedIn,
    isApprovedCloudUser,
    currentDisplayName,
    openAuthModal,
    activeWheel,
    settings,
  } = usePickerwel();
  const t = COPY[settings.language];

  const [phase, setPhase] = useState<KahootPhase>('STUDIO');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id || '');
  const [filterSubject, setFilterSubject] = useState<'all' | SubjectId>('all');
  const [filterGrade, setFilterGrade] = useState<'all' | GradeId>('all');
  const [showAnswers, setShowAnswers] = useState(false);

  // Host Live Setup Modal & Players
  const [hostSetupOpen, setHostSetupOpen] = useState(false);
  const [playMode, setPlayMode] = useState<'solo' | 'teams'>('solo');
  const [players, setPlayers] = useState<PlayerScore[]>([
    { name: 'ក្រុម A', score: 0, correctCount: 0 },
    { name: 'ក្រុម B', score: 0, correctCount: 0 },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');

  // Assign (Copy Link & QR-Code) state
  const [assigning, setAssigning] = useState(false);
  const [assignMessage, setAssignMessage] = useState<string | null>(null);
  const [assignedModalTarget, setAssignedModalTarget] = useState<StudentAssignment | null>(null);

  // Active Game state
  const [qIndex, setQIndex] = useState(0);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(20000);
  const [chosenOpt, setChosenOpt] = useState<number | null>(null);
  const [lastAwardedPts, setLastAwardedPts] = useState(0);

  const deadlineRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const filteredQuizzes = useMemo(
    () =>
      quizzes.filter((quiz) => {
        if (filterSubject !== 'all' && resolveQuizSubjectId(quiz) !== filterSubject) {
          return false;
        }
        if (filterGrade !== 'all' && resolveQuizGradeId(quiz) !== filterGrade) {
          return false;
        }
        return true;
      }),
    [filterGrade, filterSubject, quizzes]
  );

  const activeQuizIndex = useMemo(() => {
    const idx = filteredQuizzes.findIndex((q) => q.id === selectedQuizId);
    return idx >= 0 ? idx : 0;
  }, [filteredQuizzes, selectedQuizId]);

  const activeQuiz = filteredQuizzes[activeQuizIndex] || quizzes[0] || null;
  const currentQuestion = activeQuiz?.questions[qIndex] ?? null;

  const isApprovedPasscodeUser = Boolean(
    !user &&
      passcodeSession &&
      passcodeSession.status === 'approved' &&
      passcodeSession.passcodeActive
  );

  const handlePrevQuiz = () => {
    if (filteredQuizzes.length <= 1) return;
    const prevIdx = (activeQuizIndex - 1 + filteredQuizzes.length) % filteredQuizzes.length;
    setSelectedQuizId(filteredQuizzes[prevIdx].id);
  };

  const handleNextQuiz = () => {
    if (filteredQuizzes.length <= 1) return;
    const nextIdx = (activeQuizIndex + 1) % filteredQuizzes.length;
    setSelectedQuizId(filteredQuizzes[nextIdx].id);
  };

  const handleImportWheelPlayers = () => {
    const names = activeWheel.entries.slice(0, 8);
    if (names.length === 0) return;
    setPlayers(names.map((name) => ({ name, score: 0, correctCount: 0 })));
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlayerName.trim();
    if (!name || players.length >= 8) return;
    setPlayers((prev) => [...prev, { name, score: 0, correctCount: 0 }]);
    setNewPlayerName('');
  };

  const startShowWithMode = (mode: 'solo' | 'teams') => {
    if (!activeQuiz || activeQuiz.questions.length === 0) return;
    setPlayMode(mode);
    setHostSetupOpen(false);
    const basePlayers =
      mode === 'solo'
        ? [
            {
              name: settings.language === 'km' ? 'អ្នកលេង' : 'Player',
              score: 0,
              correctCount: 0,
            },
          ]
        : players.length > 0
        ? players.map((p) => ({ ...p, score: 0, correctCount: 0 }))
        : [{ name: 'Team 1', score: 0, correctCount: 0 }];

    setPlayers(basePlayers);
    setQIndex(0);
    setActivePlayerIdx(0);
    setChosenOpt(null);
    setLastAwardedPts(0);
    const limitMs = (activeQuiz.questions[0]?.timeLimitSec || 20) * 1000;
    setTimeLeftMs(limitMs);
    setPhase('QUESTION');
  };

  const handleAssignQuiz = async () => {
    if (!activeQuiz) return;
    setAssignMessage(null);

    if (!isSignedIn) {
      setAssignMessage(t.kahootAssignNeedLogin);
      openAuthModal();
      return;
    }

    const googleUid = isApprovedCloudUser && user ? user.uid : '';
    const passcodeMemberId =
      isApprovedPasscodeUser && passcodeSession ? passcodeSession.memberId : '';

    if (!googleUid && !passcodeMemberId) {
      setAssignMessage(t.kahootAssignPendingErr);
      return;
    }

    setAssigning(true);
    try {
      const instructions = buildQuizAssignmentInstructions(
        activeQuiz,
        t.kahootAssignInstructionsHeader
      );
      const entries = activeQuiz.questions
        .map((q, idx) => `Q${idx + 1}: ${q.prompt.slice(0, 100)}`)
        .slice(0, 200);

      const created = await createStudentAssignment({
        ownerId: googleUid || passcodeMemberId,
        ownerType: googleUid ? 'google' : 'passcode',
        ownerDisplayName: currentDisplayName || 'Teacher',
        title: `Kahoot: ${activeQuiz.title}`.slice(0, 120),
        instructions,
        entries,
        paletteId: activeWheel.paletteId,
        allowWheelSpin: entries.length >= 2,
      });

      if (passcodeMemberId) {
        savePasscodeAssignmentId(passcodeMemberId, created.id);
      }
      setAssignedModalTarget(created);
    } catch {
      setAssignMessage(t.authPasscodeNetworkError);
    } finally {
      setAssigning(false);
    }
  };

  // Countdown loop during QUESTION phase
  useEffect(() => {
    if (phase !== 'QUESTION' || !currentQuestion) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const totalMs = (currentQuestion.timeLimitSec || 20) * 1000;
    deadlineRef.current = performance.now() + totalMs;

    const tick = (now: number) => {
      const rem = Math.max(0, deadlineRef.current - now);
      setTimeLeftMs(rem);
      if (rem <= 0) {
        setChosenOpt(-1);
        setLastAwardedPts(0);
        if (settings.soundEnabled) playWrongSound();
        setPhase('REVEAL');
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [phase, qIndex, currentQuestion, settings.soundEnabled]);

  const handleSelectAnswer = (optIdx: number) => {
    if (phase !== 'QUESTION' || !currentQuestion) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const totalMs = (currentQuestion.timeLimitSec || 20) * 1000;
    const isCorrect = optIdx === currentQuestion.correctIndex;
    const pts = isCorrect ? 500 + Math.round(500 * (timeLeftMs / totalMs)) : 0;

    setChosenOpt(optIdx);
    setLastAwardedPts(pts);

    if (isCorrect) {
      if (settings.soundEnabled) playCorrectSound();
      if (settings.hapticsEnabled) triggerHaptic(20);
      setPlayers((prev) =>
        prev.map((p, idx) =>
          idx === activePlayerIdx
            ? { ...p, score: p.score + pts, correctCount: p.correctCount + 1 }
            : p
        )
      );
    } else {
      if (settings.soundEnabled) playWrongSound();
      if (settings.hapticsEnabled) triggerHaptic([40, 25, 40]);
    }

    setPhase('REVEAL');
  };

  const handleNextQuestion = () => {
    if (!activeQuiz) return;
    if (qIndex + 1 < activeQuiz.questions.length) {
      const nextIdx = qIndex + 1;
      setQIndex(nextIdx);
      setActivePlayerIdx((pIdx) => (pIdx + 1) % players.length);
      setChosenOpt(null);
      setLastAwardedPts(0);
      setTimeLeftMs((activeQuiz.questions[nextIdx]?.timeLimitSec || 20) * 1000);
      if (settings.soundEnabled) playTickSound(0.2);
      setPhase('QUESTION');
    } else {
      setPhase('PODIUM');
      if (settings.soundEnabled) playWinSound();
      if (
        settings.confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({ particleCount: 110, spread: 80, origin: { y: 0.52 } });
      }
    }
  };

  // ============================================================================
  // SELF-STUDY MODES: LEARN & FLASHCARDS
  // ============================================================================
  if (phase === 'LEARN' && activeQuiz) {
    return (
      <KahootLearnMode
        quiz={activeQuiz}
        language={settings.language}
        soundEnabled={settings.soundEnabled}
        confettiEnabled={settings.confettiEnabled}
        hapticsEnabled={settings.hapticsEnabled}
        onExit={() => setPhase('STUDIO')}
        onStartPlaySolo={() => startShowWithMode('solo')}
      />
    );
  }

  if (phase === 'FLASHCARDS' && activeQuiz) {
    return (
      <KahootFlashcardsMode
        quiz={activeQuiz}
        language={settings.language}
        soundEnabled={settings.soundEnabled}
        confettiEnabled={settings.confettiEnabled}
        hapticsEnabled={settings.hapticsEnabled}
        onExit={() => setPhase('STUDIO')}
        onStartLearn={() => setPhase('LEARN')}
        onStartPlaySolo={() => startShowWithMode('solo')}
      />
    );
  }

  // ============================================================================
  // KAHOOT STUDIO PREVIEW (2-Column Slide Grid + Session / Self-Study Sidebar)
  // ============================================================================
  if (phase === 'STUDIO') {
    const sid = activeQuiz ? resolveQuizSubjectId(activeQuiz) : 'general';
    const gid = activeQuiz ? resolveQuizGradeId(activeQuiz) : 'general';

    return (
      <div className="space-y-4">
        {/* Compact Subject / Grade / Quiz Selector & Create Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={t.quizSubjectLabel}
              value={filterSubject}
              onChange={(e) => {
                setFilterSubject(e.target.value as 'all' | SubjectId);
                setFilterGrade('all');
              }}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">{t.allSubjectsLabel}</option>
              {SUBJECT_CATALOG.map((subj) => (
                <option key={subj.id} value={subj.id}>
                  {settings.language === 'km' ? subj.labelKm : subj.labelEn}
                </option>
              ))}
            </select>

            <select
              aria-label={t.quizGradeLabel}
              value={filterGrade}
              onChange={(e) => setFilterGrade(e.target.value as 'all' | GradeId)}
              className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">{t.allGradesLabel}</option>
              {GRADE_GROUPS.map((grp) => (
                <optgroup
                  key={grp.id}
                  label={settings.language === 'km' ? grp.labelKm : grp.labelEn}
                >
                  {GRADE_LEVELS.filter((g) => g.group === grp.id).map((g) => (
                    <option key={g.id} value={g.id}>
                      {settings.language === 'km' ? g.labelKm : g.labelEn}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>

            {filteredQuizzes.length > 0 && (
              <select
                aria-label={t.quizLibraryTitle}
                value={activeQuiz?.id || ''}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100 max-w-[260px]"
              >
                {filteredQuizzes.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title} ({q.questions.length})
                  </option>
                ))}
              </select>
            )}
          </div>

          <button
            type="button"
            onClick={() =>
              onCreateQuiz(
                filterSubject !== 'all' || filterGrade !== 'all'
                  ? {
                      subjectId: filterSubject === 'all' ? 'math' : filterSubject,
                      gradeId: filterGrade === 'all' ? 'grade_7' : filterGrade,
                    }
                  : undefined
              )
            }
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#1368CE] hover:bg-blue-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createQuizBtn}</span>
          </button>
        </div>

        {/* Kahoot Preview Studio Frame */}
        {!activeQuiz ? (
          <div className="p-10 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.noExercisesForFilter}
            </p>
            <button
              type="button"
              onClick={() => {
                setFilterSubject('all');
                setFilterGrade('all');
              }}
              className="min-h-[38px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {t.allSubjectsLabel}
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            {/* Studio Header Bar (matches Kahoot top bar with creator/title + prev/next arrows) */}
            <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-full bg-[#1368CE] text-white font-latin font-black text-xs flex items-center justify-center shrink-0 shadow-sm">
                  K!
                </div>
                <div className="min-w-0 flex items-center gap-1.5 flex-wrap">
                  <span className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white underline decoration-slate-400/70 underline-offset-4 truncate max-w-[260px] sm:max-w-[420px]">
                    {activeQuiz.title}
                  </span>
                  <BadgeCheck className="w-4 h-4 text-[#1368CE] shrink-0" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowAnswers((v) => !v)}
                  className="h-9 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  {showAnswers ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">
                    {showAnswers ? t.kahootHideAnswers : t.kahootShowAnswers}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => onEditQuiz(activeQuiz)}
                  title={t.editQuizBtn}
                  className="h-9 px-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.editQuizBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={handlePrevQuiz}
                  disabled={filteredQuizzes.length <= 1}
                  aria-label="Previous quiz"
                  className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={handleNextQuiz}
                  disabled={filteredQuizzes.length <= 1}
                  aria-label="Next quiz"
                  className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>

                {hostSetupOpen && (
                  <button
                    type="button"
                    onClick={() => setHostSetupOpen(false)}
                    aria-label={t.close}
                    className="h-9 w-9 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* 2-Column Split: Left Question Slides Grid + Right Action Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* LEFT: 2-Column Visual Kahoot Question Cards */}
              <div className="lg:col-span-8 p-4 sm:p-5 bg-slate-50/70 dark:bg-slate-950/40 lg:border-r border-slate-200 dark:border-slate-800 max-h-[680px] overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {activeQuiz.questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="relative overflow-hidden rounded-xl bg-gradient-to-br from-[#5A18B8] via-[#46178F] to-[#2B0C63] p-3 flex flex-col justify-between gap-3 min-h-[228px] shadow-md border border-purple-900/40"
                    >
                      {/* Subtle Geometric Background Accents */}
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -right-10 -bottom-10 w-36 h-36 rounded-full bg-white/5"
                      />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute -left-8 top-10 w-24 h-24 rounded-full bg-purple-400/10"
                      />

                      {/* Prompt Header Box */}
                      <div className="relative z-10 mx-auto w-full rounded-lg bg-[#EFE7FA] text-slate-900 px-3 py-2 text-center shadow-sm">
                        <p className="text-xs sm:text-[13px] font-bold leading-snug line-clamp-3">
                          <MathText text={q.prompt} />
                        </p>
                      </div>

                      {/* Center Visual Stage */}
                      <div className="relative z-10 flex-1 flex flex-col items-center justify-center rounded-lg bg-[#381075]/75 px-3 py-2.5 border border-white/10">
                        <div className="w-full flex items-center justify-between text-[11px] text-purple-200/90 font-mono tabular-nums mb-1">
                          <span>Q{idx + 1}</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {q.timeLimitSec}s
                          </span>
                        </div>
                        {showAnswers ? (
                          <div className="text-center space-y-1">
                            <span className="text-[10px] uppercase tracking-wider text-emerald-300 font-semibold">
                              {t.correctAnswerLabel}
                            </span>
                            <p className="text-xs sm:text-sm font-bold text-white line-clamp-2">
                              <MathText text={q.options[q.correctIndex]} />
                            </p>
                          </div>
                        ) : (
                          <span className="font-latin text-lg font-black tracking-tight text-white/25 select-none">
                            K!
                          </span>
                        )}
                      </div>

                      {/* Bottom 2x2 Color-Coded Kahoot Answer Bars */}
                      <div className="relative z-10 grid grid-cols-2 gap-1.5">
                        {q.options.map((opt, oi) => {
                          const tile = KAHOOT_TILES[oi];
                          const ShapeIcon = tile.icon;
                          const isCorrect = oi === q.correctIndex;
                          return (
                            <div
                              key={oi}
                              className={`h-7 px-2 rounded-md text-white flex items-center justify-between gap-1.5 text-[11px] font-semibold shadow-sm ${
                                tile.barBg
                              } ${
                                showAnswers && !isCorrect ? 'opacity-45' : ''
                              } ${
                                showAnswers && isCorrect ? 'ring-2 ring-white' : ''
                              }`}
                            >
                              <span className="flex items-center gap-1.5 min-w-0">
                                <ShapeIcon className="w-2.5 h-2.5 fill-current shrink-0" />
                                <span className="truncate">
                                  {showAnswers ? <MathText text={opt} /> : ''}
                                </span>
                              </span>
                              {showAnswers && isCorrect && (
                                <CheckCircle2 className="w-3 h-3 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* RIGHT: Kahoot Session & Self-Study Action Sidebar */}
              <div className="lg:col-span-4 p-5 sm:p-6 bg-white dark:bg-slate-900 flex flex-col justify-between gap-6">
                <div className="space-y-6">
                  {/* Kahoot Session Group */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.kahootSessionHeading}
                    </h3>

                    <button
                      type="button"
                      onClick={() => setHostSetupOpen((v) => !v)}
                      className="w-full min-h-[54px] px-4 py-3 rounded-xl bg-[#1368CE] hover:bg-[#0F55AA] text-white font-bold text-sm flex items-center justify-between gap-3 shadow-sm transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Presentation className="w-5 h-5 shrink-0" />
                        <span className="truncate">{t.kahootHostLiveBtn}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>

                    {/* Expandable Host Live Team Setup Panel */}
                    {hostSetupOpen && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-[#1368CE]" />
                            <span>{t.kahootHostSetupTitle}</span>
                          </span>
                          <button
                            type="button"
                            onClick={handleImportWheelPlayers}
                            className="text-[11px] font-semibold text-[#1368CE] dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap"
                          >
                            {t.importWheelPlayers}
                          </button>
                        </div>

                        <form onSubmit={handleAddPlayer} className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={newPlayerName}
                            onChange={(e) => setNewPlayerName(e.target.value)}
                            placeholder={t.addPlayerPlaceholder}
                            className="flex-1 min-w-0 h-9 px-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs"
                          />
                          <button
                            type="submit"
                            className="h-9 px-3 rounded-lg bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer shrink-0"
                          >
                            {t.addBtn}
                          </button>
                        </form>

                        <div className="flex flex-wrap gap-1.5">
                          {players.map((p, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-slate-200"
                            >
                              <span>{p.name}</span>
                              {players.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPlayers((prev) => prev.filter((_, i) => i !== idx))
                                  }
                                  aria-label={`Remove ${p.name}`}
                                  className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => startShowWithMode('teams')}
                          className="w-full min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{t.kahootHostStartBtn}</span>
                        </button>
                      </div>
                    )}

                    <button
                      type="button"
                      disabled={assigning}
                      onClick={handleAssignQuiz}
                      className="w-full min-h-[54px] px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Send className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" />
                        <span className="truncate">
                          {assigning ? t.kahootAssignCreating : t.kahootAssignBtn}
                        </span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </button>

                    {assignMessage && (
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300 px-1">
                        {assignMessage}
                      </p>
                    )}
                  </div>

                  {/* Kahoot Self-Study Group */}
                  <div className="space-y-2.5">
                    <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {t.kahootSelfStudyHeading}
                    </h3>

                    <button
                      type="button"
                      onClick={() => setPhase('LEARN')}
                      className="w-full min-h-[54px] px-4 py-3 rounded-xl bg-[#1368CE] hover:bg-[#0F55AA] text-white font-bold text-sm flex items-center justify-between gap-3 shadow-sm transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <BookOpenCheck className="w-5 h-5 shrink-0" />
                        <span className="truncate">{t.kahootLearnBtn}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setPhase('FLASHCARDS')}
                      className="w-full min-h-[54px] px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Layers className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" />
                        <span className="truncate">{t.kahootFlashcardsBtn}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={() => startShowWithMode('solo')}
                      className="w-full min-h-[54px] px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200/90 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm flex items-center justify-between gap-3 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <LayoutGrid className="w-5 h-5 text-slate-700 dark:text-slate-300 shrink-0" />
                        <span className="truncate">{t.kahootPlaySoloBtn}</span>
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-500 shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Footer Metadata */}
                <p className="text-center text-xs text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 tabular-nums">
                  {getSubjectLabel(sid, settings.language)} ·{' '}
                  {getGradeLabel(gid, settings.language, true)} ·{' '}
                  {t.questionsCount(activeQuiz.questions.length)} · {t.kahootVisibilityOffline}
                </p>
              </div>
            </div>
          </div>
        )}

        <QrShareModal
          assignment={assignedModalTarget}
          language={settings.language}
          onClose={() => setAssignedModalTarget(null)}
        />
      </div>
    );
  }

  // ============================================================================
  // PODIUM SCREEN (After Host Live or Play Solo)
  // ============================================================================
  if (phase === 'PODIUM') {
    const sorted = [...players].sort((a, b) => b.score - a.score);
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#46178F] to-[#25076B] text-white text-center space-y-6 shadow-2xl">
        <Trophy className="w-12 h-12 text-amber-300 mx-auto" />
        <h2 className="font-display text-3xl font-bold">{t.podiumTitle}</h2>

        <div className="space-y-3 text-left">
          {sorted.map((p, idx) => (
            <div
              key={idx}
              className={`px-4 py-3.5 rounded-2xl flex items-center justify-between gap-4 ${
                idx === 0
                  ? 'bg-amber-400 text-slate-900 font-bold'
                  : 'bg-white/10 text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-mono text-lg font-bold tabular-nums w-6">
                  #{idx + 1}
                </span>
                <span className="font-display text-base truncate">{p.name}</span>
              </div>
              <span className="font-mono text-base font-bold tabular-nums shrink-0">
                {p.score} pts
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => startShowWithMode(playMode)}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white text-[#46178F] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.playAgainBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => setPhase('STUDIO')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold cursor-pointer"
          >
            {t.kahootBackToStudio}
          </button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ACTIVE TIMED SHOW: QUESTION & REVEAL (Host Live or Play Solo)
  // ============================================================================
  const totalMs = (currentQuestion?.timeLimitSec || 20) * 1000;
  const secondsLeft = Math.ceil(timeLeftMs / 1000);
  const progressPct = Math.max(0, Math.min(100, (timeLeftMs / totalMs) * 100));
  const currentPlayer = players[activePlayerIdx];
  const sortedStandings = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Kahoot Bar */}
      <div className="p-4 rounded-2xl bg-[#46178F] text-white space-y-3">
        <div className="flex items-center justify-between gap-3 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setPhase('STUDIO')}
            className="text-purple-200 hover:text-white font-medium cursor-pointer"
          >
            ← {t.kahootBackToStudio}
          </button>

          {playMode === 'teams' && currentPlayer && (
            <span className="font-semibold text-amber-300">
              {t.currentTurnLabel}: {currentPlayer.name}
            </span>
          )}

          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="font-bold text-base">{secondsLeft}s</span>
            <span className="text-purple-200">
              {qIndex + 1}/{activeQuiz?.questions.length ?? 0}
            </span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-purple-950 overflow-hidden">
          <div
            className="h-full bg-amber-400 transition-all duration-75"
            style={{ width: `${phase === 'QUESTION' ? progressPct : 0}%` }}
          />
        </div>
      </div>

      {/* Question Card */}
      {currentQuestion && activeQuiz && (
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-center">
            <MathText text={currentQuestion.prompt} />
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentQuestion.options.map((opt, idx) => {
              const tile = KAHOOT_TILES[idx];
              const ShapeIcon = tile.icon;
              const isReveal = phase === 'REVEAL';
              const isCorrect = idx === currentQuestion.correctIndex;
              const isChosen = chosenOpt === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isReveal}
                  onClick={() => handleSelectAnswer(idx)}
                  className={`min-h-[76px] p-4 rounded-2xl text-white font-semibold text-sm sm:text-base flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer ${
                    tile.bg
                  } ${
                    isReveal
                      ? isCorrect
                        ? 'ring-4 ring-emerald-400 scale-[1.01]'
                        : isChosen
                        ? 'opacity-80 ring-4 ring-rose-300'
                        : 'opacity-35'
                      : 'active:scale-[0.98]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-xl bg-black/20 flex items-center justify-center shrink-0">
                      <ShapeIcon className="w-4 h-4 fill-current" />
                    </span>
                    <span className="text-left break-words">
                      <MathText text={opt} />
                    </span>
                  </div>
                  {isReveal && isCorrect && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                  {isReveal && isChosen && !isCorrect && <XCircle className="w-5 h-5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {phase === 'REVEAL' && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <p className="text-sm font-bold">
                  {chosenOpt === currentQuestion.correctIndex ? (
                    <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {t.correctFeedback} +{lastAwardedPts} pts
                    </span>
                  ) : chosenOpt === -1 ? (
                    <span className="text-amber-600 dark:text-amber-400">
                      {t.timeOutFeedback}
                    </span>
                  ) : (
                    <span className="text-rose-600 dark:text-rose-400">
                      {t.wrongFeedback}
                    </span>
                  )}
                </p>

                <button
                  type="button"
                  onClick={handleNextQuestion}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#46178F] hover:bg-purple-900 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>
                    {qIndex + 1 < activeQuiz.questions.length
                      ? t.nextQuestionBtn
                      : t.finishQuizBtn}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {playMode === 'teams' && (
                <div className="pt-2">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">
                    {t.leaderboardTitle}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {sortedStandings.slice(0, 4).map((p, i) => (
                      <div
                        key={i}
                        className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {p.name}
                        </span>
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                          {p.score}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
