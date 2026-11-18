'use client';

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Flame,
  Zap,
  Shield,
  Sparkles,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Plus,
  Pencil,
  Trash2,
  Play,
  Clock,
  Shuffle,
  UserCheck,
  Trophy,
  Triangle,
  Diamond,
  Circle,
  Square,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { MathText } from '../MathText';
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
  type QuizQuestion,
  type SubjectId,
} from '@/lib/offline-quizzes';
import { QUICK_START_ENTRIES } from '@/lib/templates';
import {
  playCorrectSound,
  playWrongSound,
  playWinSound,
  playTickSound,
  triggerHaptic,
} from '@/lib/sound';
import { COPY } from '@/lib/i18n';

interface WaygroundGameProps {
  quizzes: OfflineQuiz[];
  onCreateQuiz: (preset?: QuizCreatePreset) => void;
  onEditQuiz: (quiz: OfflineQuiz) => void;
  onDeleteQuiz: (quizId: string) => void;
}

interface AnswerLog {
  prompt: string;
  options: [string, string, string, string];
  chosenIndex: number | null;
  correctIndex: number;
  isCorrect: boolean;
  timedOut: boolean;
  pointsEarned: number;
}

const CHOICE_LETTERS = ['A', 'B', 'C', 'D'] as const;
const CHOICE_ICONS = [Triangle, Diamond, Circle, Square] as const;

const OPTION_ACTIVE_STYLES = [
  'bg-blue-600 hover:bg-blue-700 border-blue-700 text-white',
  'bg-emerald-600 hover:bg-emerald-700 border-emerald-700 text-white',
  'bg-amber-600 hover:bg-amber-700 border-amber-700 text-white',
  'bg-violet-600 hover:bg-violet-700 border-violet-700 text-white',
];

const BEST_SCORES_KEY = 'pickerwel_wayground_best_v1';

function loadBestScores(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BEST_SCORES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, number>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveBestScores(scores: Record<string, number>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BEST_SCORES_KEY, JSON.stringify(scores));
  } catch {
    // Ignore storage quota errors
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function shuffleQuestionOptions(q: QuizQuestion): QuizQuestion {
  const tagged = q.options.map((text, idx) => ({
    text,
    isCorrect: idx === q.correctIndex,
  }));
  const shuffled = shuffleArray(tagged);
  const nextCorrectIndex = shuffled.findIndex((item) => item.isCorrect) as
    | 0
    | 1
    | 2
    | 3;
  return {
    ...q,
    options: shuffled.map((item) => item.text) as [
      string,
      string,
      string,
      string,
    ],
    correctIndex: nextCorrectIndex,
  };
}

export function WaygroundGame({
  quizzes,
  onCreateQuiz,
  onEditQuiz,
  onDeleteQuiz,
}: WaygroundGameProps) {
  const { activeWheel, settings } = usePickerwel();
  const t = COPY[settings.language];

  const [phase, setPhase] = useState<'SELECT' | 'PLAYING' | 'SUMMARY'>('SELECT');
  const [activeQuiz, setActiveQuiz] = useState<OfflineQuiz | null>(null);
  const [runQuestions, setRunQuestions] = useState<QuizQuestion[]>([]);
  const [qIndex, setQIndex] = useState(0);

  // Lobby options
  const [filterSubject, setFilterSubject] = useState<'all' | SubjectId>('all');
  const [filterGrade, setFilterGrade] = useState<'all' | GradeId>('all');
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(false);
  const [bestScores, setBestScores] = useState<Record<string, number>>({});

  // Run state
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [timeLeft, setTimeLeft] = useState(20);
  const [lastPoints, setLastPoints] = useState(0);
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [pickedStudent, setPickedStudent] = useState<string | null>(null);
  const [isNewBest, setIsNewBest] = useState(false);

  // Power-ups (1 use each per quiz run)
  const [usedFifty, setUsedFifty] = useState(false);
  const [eliminatedOpts, setEliminatedOpts] = useState<number[]>([]);
  const [usedDouble, setUsedDouble] = useState(false);
  const [doubleActive, setDoubleActive] = useState(false);
  const [usedShield, setUsedShield] = useState(false);
  const [shieldActive, setShieldActive] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setBestScores(loadBestScores());
    });
  }, []);

  const currentQuestion = runQuestions[qIndex] ?? null;
  const revealed = selectedOpt !== null || timedOut;

  const startQuiz = (quiz: OfflineQuiz) => {
    let prepared = [...quiz.questions];
    if (shuffleQuestions) {
      prepared = shuffleArray(prepared);
    }
    if (shuffleOptions) {
      prepared = prepared.map(shuffleQuestionOptions);
    }

    setActiveQuiz(quiz);
    setRunQuestions(prepared);
    setQIndex(0);
    setScore(0);
    setStreak(0);
    setBestStreak(0);
    setSelectedOpt(null);
    setTimedOut(false);
    setTimeLeft(prepared[0]?.timeLimitSec || 20);
    setLastPoints(0);
    setLogs([]);
    setPickedStudent(null);
    setIsNewBest(false);
    setUsedFifty(false);
    setEliminatedOpts([]);
    setUsedDouble(false);
    setDoubleActive(false);
    setUsedShield(false);
    setShieldActive(false);
    setPhase('PLAYING');
  };

  // Per-question countdown timer
  useEffect(() => {
    if (phase !== 'PLAYING' || !timerEnabled || !currentQuestion || revealed) {
      return;
    }

    const timerId = setTimeout(() => {
      const next = timeLeft - 1;
      if (next <= 0) {
        setTimeLeft(0);
        setTimedOut(true);
        setLastPoints(0);
        setDoubleActive(false);
        if (shieldActive) {
          setShieldActive(false);
        } else {
          setStreak(0);
        }
        if (settings.soundEnabled) playWrongSound();
        if (settings.hapticsEnabled) triggerHaptic([40, 25, 40]);
        setLogs((prev) => [
          ...prev,
          {
            prompt: currentQuestion.prompt,
            options: currentQuestion.options,
            chosenIndex: null,
            correctIndex: currentQuestion.correctIndex,
            isCorrect: false,
            timedOut: true,
            pointsEarned: 0,
          },
        ]);
      } else {
        setTimeLeft(next);
        if (next <= 5 && settings.soundEnabled) {
          playTickSound();
        }
      }
    }, 1000);

    return () => clearTimeout(timerId);
  }, [
    currentQuestion,
    phase,
    revealed,
    settings.hapticsEnabled,
    settings.soundEnabled,
    shieldActive,
    timeLeft,
    timerEnabled,
  ]);

  const handleUseFifty = () => {
    if (!currentQuestion || usedFifty || revealed) return;
    const wrongIndices = [0, 1, 2, 3].filter(
      (i) => i !== currentQuestion.correctIndex
    );
    const shuffled = shuffleArray(wrongIndices);
    setEliminatedOpts(shuffled.slice(0, 2));
    setUsedFifty(true);
    if (settings.soundEnabled) playTickSound();
  };

  const handleUseDouble = () => {
    if (usedDouble || revealed) return;
    setDoubleActive(true);
    setUsedDouble(true);
    if (settings.soundEnabled) playTickSound();
  };

  const handleUseShield = () => {
    if (usedShield || revealed) return;
    setShieldActive(true);
    setUsedShield(true);
    if (settings.soundEnabled) playTickSound();
  };

  const handlePickStudent = () => {
    const pool =
      activeWheel.entries.length > 0 ? activeWheel.entries : QUICK_START_ENTRIES;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    setPickedStudent(chosen);
    if (settings.soundEnabled) playTickSound();
    if (settings.hapticsEnabled) triggerHaptic(15);
  };

  const handleAnswer = useCallback(
    (optIdx: number) => {
      if (
        !currentQuestion ||
        revealed ||
        eliminatedOpts.includes(optIdx)
      ) {
        return;
      }

      setSelectedOpt(optIdx);
      const isCorrect = optIdx === currentQuestion.correctIndex;

      let earned = 0;
      let nextStreak = streak;

      if (isCorrect) {
        nextStreak = streak + 1;
        const comboBonus = Math.min(4, nextStreak - 1) * 40;
        const speedBonus = timerEnabled
          ? Math.round((timeLeft / Math.max(1, currentQuestion.timeLimitSec)) * 50)
          : 0;
        earned = (100 + comboBonus + speedBonus) * (doubleActive ? 2 : 1);
        setScore((s) => s + earned);
        setStreak(nextStreak);
        setBestStreak((b) => Math.max(b, nextStreak));
        if (settings.soundEnabled) playCorrectSound();
        if (settings.hapticsEnabled) triggerHaptic(18);
      } else {
        if (shieldActive) {
          setShieldActive(false);
        } else {
          setStreak(0);
        }
        if (settings.soundEnabled) playWrongSound();
        if (settings.hapticsEnabled) triggerHaptic([40, 25, 40]);
      }

      setLastPoints(earned);
      setDoubleActive(false);
      setLogs((prev) => [
        ...prev,
        {
          prompt: currentQuestion.prompt,
          options: currentQuestion.options,
          chosenIndex: optIdx,
          correctIndex: currentQuestion.correctIndex,
          isCorrect,
          timedOut: false,
          pointsEarned: earned,
        },
      ]);
    },
    [
      currentQuestion,
      doubleActive,
      eliminatedOpts,
      revealed,
      settings.hapticsEnabled,
      settings.soundEnabled,
      shieldActive,
      streak,
      timeLeft,
      timerEnabled,
    ]
  );

  const handleNext = useCallback(() => {
    if (!activeQuiz) return;
    if (qIndex + 1 < runQuestions.length) {
      const nextQ = runQuestions[qIndex + 1];
      setQIndex((i) => i + 1);
      setSelectedOpt(null);
      setTimedOut(false);
      setTimeLeft(nextQ?.timeLimitSec || 20);
      setEliminatedOpts([]);
      setLastPoints(0);
      setPickedStudent(null);
    } else {
      const prevBest = bestScores[activeQuiz.id] || 0;
      const beatBest = score > prevBest;
      if (beatBest) {
        const updated = { ...bestScores, [activeQuiz.id]: score };
        setBestScores(updated);
        saveBestScores(updated);
        setIsNewBest(true);
      }
      setPhase('SUMMARY');
      if (settings.soundEnabled) playWinSound();
      if (
        settings.confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({ particleCount: 90, spread: 75, origin: { y: 0.55 } });
      }
    }
  }, [
    activeQuiz,
    bestScores,
    qIndex,
    runQuestions,
    score,
    settings.confettiEnabled,
    settings.soundEnabled,
  ]);

  // Keyboard shortcuts during active gameplay: 1-4 / A-D to answer, Enter to go next
  useEffect(() => {
    if (phase !== 'PLAYING') return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (!revealed) {
        if (key === '1' || key === 'a') {
          e.preventDefault();
          handleAnswer(0);
        } else if (key === '2' || key === 'b') {
          e.preventDefault();
          handleAnswer(1);
        } else if (key === '3' || key === 'c') {
          e.preventDefault();
          handleAnswer(2);
        } else if (key === '4' || key === 'd') {
          e.preventDefault();
          handleAnswer(3);
        }
      } else if (key === 'enter' || key === ' ') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnswer, handleNext, phase, revealed]);

  if (phase === 'SELECT' || !activeQuiz) {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {t.waygroundQuizTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.waygroundQuizDesc}
            </p>
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
            className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createQuizBtn}</span>
          </button>
        </div>

        {/* Full-Featured Session Options & Subject/Grade Filter Bar */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2.5">
          <select
            aria-label={t.quizSubjectLabel}
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value as 'all' | SubjectId);
              setFilterGrade('all');
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
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
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100"
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

          <button
            type="button"
            onClick={() => setTimerEnabled((v) => !v)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              timerEnabled
                ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{t.wgTimerLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShuffleQuestions((v) => !v)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              shuffleQuestions
                ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{t.wgShuffleQLabel}</span>
          </button>

          <button
            type="button"
            onClick={() => setShuffleOptions((v) => !v)}
            className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
              shuffleOptions
                ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            <Shuffle className="w-3.5 h-3.5" />
            <span>{t.wgShuffleOptsLabel}</span>
          </button>
        </div>

        {/* Quiz Library Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {quizzes
            .filter((quiz) => {
              if (filterSubject !== 'all' && resolveQuizSubjectId(quiz) !== filterSubject) return false;
              if (filterGrade !== 'all' && resolveQuizGradeId(quiz) !== filterGrade) return false;
              return true;
            })
            .map((quiz) => {
            const best = bestScores[quiz.id] || 0;
            const sid = resolveQuizSubjectId(quiz);
            const gid = resolveQuizGradeId(quiz);
            return (
              <div
                key={quiz.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-4"
              >
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {getSubjectLabel(sid, settings.language)}
                    <span aria-hidden="true"> · </span>
                    {getGradeLabel(gid, settings.language, true)}
                    <span aria-hidden="true"> · </span>
                    {t.questionsCount(quiz.questions.length)}
                    {best > 0 && (
                      <>
                        <span aria-hidden="true"> · </span>
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">
                          {t.wgBestScoreLabel}: {best}
                        </span>
                      </>
                    )}
                  </p>
                  <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
                    {quiz.title}
                  </h3>
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => startQuiz(quiz)}
                    className="min-h-[40px] px-4 py-1.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#4F46E5] hover:opacity-95 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{t.startQuizBtn}</span>
                  </button>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEditQuiz(quiz)}
                      aria-label={t.editQuizBtn}
                      className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {quizzes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => onDeleteQuiz(quiz.id)}
                        aria-label={t.deleteQuizBtn}
                        className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
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
      </div>
    );
  }

  if (phase === 'SUMMARY') {
    const correctCount = logs.filter((l) => l.isCorrect).length;
    const accuracy =
      logs.length > 0 ? Math.round((correctCount / logs.length) * 100) : 0;

    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="p-6 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-5">
          <Trophy className="w-10 h-10 text-amber-500 mx-auto" />
          <div>
            {isNewBest && (
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
                {t.stroopNewRecord}
              </p>
            )}
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {activeQuiz.title}
            </p>
            <h2 className="mt-1 font-display text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
              {score} {t.scoreLabel}
            </h2>
          </div>

          <div className="grid grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.accuracyLabel}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {accuracy}%
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.correctFeedback}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                {correctCount}/{logs.length}
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/70">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.streakLabel}
              </p>
              <p className="mt-1 font-mono text-xl font-bold text-amber-500 tabular-nums">
                {bestStreak}x
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => startQuiz(activeQuiz)}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#8B5CF6] to-[#4F46E5] text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.playAgainBtn}</span>
            </button>
            <button
              type="button"
              onClick={() => setPhase('SELECT')}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {t.quizLibraryTitle}
            </button>
          </div>
        </div>

        {/* Question Review */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
          {logs.map((log, idx) => (
            <div key={idx} className="p-4 flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {log.isCorrect ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {idx + 1}. <MathText text={log.prompt} />
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {CHOICE_LETTERS[log.correctIndex]}. <MathText text={log.options[log.correctIndex]} />
                    </span>
                    {!log.isCorrect && log.chosenIndex !== null && (
                      <span className="text-rose-600 dark:text-rose-400">
                        {' '}
                        · {t.wgYourAnswerLabel}: {CHOICE_LETTERS[log.chosenIndex]}.{' '}
                        <MathText text={log.options[log.chosenIndex]} />
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">
                +{log.pointsEarned}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // PLAYING STATE
  const progressPct =
    ((qIndex + (revealed ? 1 : 0)) / Math.max(1, runQuestions.length)) * 100;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Top Wayground HUD */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
          <button
            type="button"
            onClick={() => setPhase('SELECT')}
            className="text-slate-300 hover:text-white font-medium cursor-pointer"
          >
            ← {t.quizLibraryTitle}
          </button>

          <div className="flex items-center gap-4 tabular-nums">
            {timerEnabled && (
              <span
                className={`inline-flex items-center gap-1 font-mono font-bold ${
                  timeLeft <= 5 && !revealed ? 'text-rose-400' : 'text-sky-300'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{timeLeft}s</span>
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-semibold text-amber-400">
              <Flame className="w-4 h-4" />
              <span>{streak}x</span>
            </span>
            <span className="font-mono font-bold text-base">{score} pts</span>
            <span className="text-slate-300 font-mono">
              {qIndex + 1}/{runQuestions.length}
            </span>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#8B5CF6] to-[#3B82F6] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question Stage */}
      {currentQuestion && (
        <div className="p-5 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          {/* Optional Wheel Student Picker Strip */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
              {pickedStudent ? (
                <span className="inline-flex items-center gap-1.5 text-[#3B82F6] dark:text-blue-400">
                  <UserCheck className="w-4 h-4" />
                  <span>
                    {t.wgStudentTurnLabel}: <strong>{pickedStudent}</strong>
                  </span>
                </span>
              ) : (
                <span>{activeQuiz.title}</span>
              )}
            </div>
            <button
              type="button"
              onClick={handlePickStudent}
              className="min-h-[36px] px-3 py-1 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5 text-[#3B82F6]" />
              <span>{t.wgPickStudentBtn}</span>
            </button>
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-center leading-relaxed">
            <MathText text={currentQuestion.prompt} />
          </h3>

          {/* Power-ups Bar */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              disabled={usedFifty || revealed}
              onClick={handleUseFifty}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-35 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>{t.powerFifty}</span>
            </button>

            <button
              type="button"
              disabled={usedDouble || revealed}
              onClick={handleUseDouble}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold disabled:opacity-35 inline-flex items-center gap-1.5 cursor-pointer ${
                doubleActive
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>{t.powerDouble}</span>
            </button>

            <button
              type="button"
              disabled={usedShield || revealed}
              onClick={handleUseShield}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl border text-xs font-semibold disabled:opacity-35 inline-flex items-center gap-1.5 cursor-pointer ${
                shieldActive
                  ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-emerald-500" />
              <span>{t.powerShield}</span>
            </button>
          </div>

          {/* Explicit 4-Choice 2x2 Grid Layout (A, B, C, D) */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {[0, 1, 2, 3].map((idx) => {
              const opt = currentQuestion.options[idx] || `${CHOICE_LETTERS[idx]}`;
              const ShapeIcon = CHOICE_ICONS[idx];
              const isEliminated = eliminatedOpts.includes(idx);
              const isChosen = selectedOpt === idx;
              const isCorrect = idx === currentQuestion.correctIndex;

              let tileClass = `${OPTION_ACTIVE_STYLES[idx]} shadow-sm`;
              let letterBadgeClass = 'bg-black/20 text-white';

              if (isEliminated && !revealed) {
                tileClass =
                  'bg-slate-100 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400 border-dashed border-slate-300 dark:border-slate-600 line-through cursor-not-allowed';
                letterBadgeClass =
                  'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400';
              } else if (revealed) {
                if (isCorrect) {
                  tileClass =
                    'bg-emerald-600 text-white border-emerald-700 ring-2 ring-emerald-400/80 shadow-md';
                  letterBadgeClass = 'bg-black/20 text-white';
                } else if (isChosen) {
                  tileClass =
                    'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-400/80 shadow-md';
                  letterBadgeClass = 'bg-black/20 text-white';
                } else {
                  tileClass =
                    'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-600';
                  letterBadgeClass =
                    'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
                }
              }

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={revealed || isEliminated}
                  onClick={() => handleAnswer(idx)}
                  className={`min-h-[84px] sm:min-h-[96px] p-3.5 sm:p-4 rounded-2xl border-2 font-bold text-sm sm:text-lg flex items-center justify-between gap-2.5 sm:gap-3 text-left transition-all cursor-pointer disabled:cursor-default ${tileClass}`}
                >
                  <span className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <span
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl font-mono text-xs sm:text-sm font-bold flex items-center justify-center gap-0.5 shrink-0 ${letterBadgeClass}`}
                    >
                      {CHOICE_LETTERS[idx]}
                    </span>
                    <span className="break-words leading-snug">
                      <MathText text={opt} />
                    </span>
                  </span>

                  <span className="shrink-0 flex items-center gap-1.5">
                    {revealed && isCorrect ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : revealed && isChosen && !isCorrect ? (
                      <XCircle className="w-5 h-5" />
                    ) : (
                      <ShapeIcon className="w-4 h-4 opacity-70" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Instant Feedback Footer */}
          {revealed ? (
            <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
              <div className="text-sm font-semibold">
                {selectedOpt === currentQuestion.correctIndex ? (
                  <span className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                    {t.correctFeedback} +{lastPoints} pts
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">
                    {timedOut ? t.timeOutFeedback : t.wrongFeedback} ·{' '}
                    {CHOICE_LETTERS[currentQuestion.correctIndex]}.{' '}
                    <MathText text={currentQuestion.options[currentQuestion.correctIndex]} />
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleNext}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-[#3B82F6] hover:opacity-95 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {qIndex + 1 < runQuestions.length
                    ? t.nextQuestionBtn
                    : t.finishQuizBtn}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              {t.wgKeyboardHint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
