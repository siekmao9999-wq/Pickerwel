'use client';

import React, { useState, useEffect, useRef } from 'react';
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
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Play,
  Pencil,
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
  type SubjectId,
} from '@/lib/offline-quizzes';
import { playCorrectSound, playWrongSound, playWinSound, playTickSound, triggerHaptic } from '@/lib/sound';
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

const KAHOOT_TILES = [
  {
    bg: 'bg-[#E21B3C] hover:bg-rose-700',
    icon: Triangle,
    label: 'A',
  },
  {
    bg: 'bg-[#1368CE] hover:bg-blue-700',
    icon: Diamond,
    label: 'B',
  },
  {
    bg: 'bg-[#D89E00] hover:bg-amber-600',
    icon: Circle,
    label: 'C',
  },
  {
    bg: 'bg-[#26890C] hover:bg-emerald-700',
    icon: Square,
    label: 'D',
  },
];

export function KahootGame({
  quizzes,
  onCreateQuiz,
  onEditQuiz,
}: KahootGameProps) {
  const { activeWheel, settings } = usePickerwel();
  const t = COPY[settings.language];

  const [phase, setPhase] = useState<'LOBBY' | 'QUESTION' | 'REVEAL' | 'PODIUM'>('LOBBY');
  const [selectedQuizId, setSelectedQuizId] = useState<string>(quizzes[0]?.id || '');
  const [filterSubject, setFilterSubject] = useState<'all' | SubjectId>('all');
  const [filterGrade, setFilterGrade] = useState<'all' | GradeId>('all');
  const [playMode, setPlayMode] = useState<'solo' | 'teams'>('solo');
  const [players, setPlayers] = useState<PlayerScore[]>([
    { name: 'ក្រុម A', score: 0, correctCount: 0 },
    { name: 'ក្រុម B', score: 0, correctCount: 0 },
  ]);
  const [newPlayerName, setNewPlayerName] = useState('');

  const [qIndex, setQIndex] = useState(0);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [timeLeftMs, setTimeLeftMs] = useState(20000);
  const [chosenOpt, setChosenOpt] = useState<number | null>(null);
  const [lastAwardedPts, setLastAwardedPts] = useState(0);

  const deadlineRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  const activeQuiz = quizzes.find((q) => q.id === selectedQuizId) || quizzes[0];
  const currentQuestion = activeQuiz?.questions[qIndex] ?? null;

  const handleImportWheelPlayers = () => {
    const names = activeWheel.entries.slice(0, 8);
    if (names.length === 0) return;
    setPlayers(names.map((name) => ({ name, score: 0, correctCount: 0 })));
    setPlayMode('teams');
  };

  const handleAddPlayer = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newPlayerName.trim();
    if (!name || players.length >= 8) return;
    setPlayers((prev) => [...prev, { name, score: 0, correctCount: 0 }]);
    setNewPlayerName('');
  };

  const startShow = () => {
    if (!activeQuiz || activeQuiz.questions.length === 0) return;
    const basePlayers =
      playMode === 'solo'
        ? [{ name: settings.language === 'km' ? 'អ្នកលេង' : 'Player', score: 0, correctCount: 0 }]
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
        setChosenOpt(-1); // Timeout
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

  if (phase === 'LOBBY') {
    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {t.kahootLobbyTitle}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.quizLibraryTitle}
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
            className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap self-start"
          >
            <Plus className="w-4 h-4" />
            <span>{t.createQuizBtn}</span>
          </button>
        </div>

        {/* Subject & Grade Level Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label={t.quizSubjectLabel}
            value={filterSubject}
            onChange={(e) => {
              setFilterSubject(e.target.value as 'all' | SubjectId);
              setFilterGrade('all');
            }}
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
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
            className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-800 dark:text-slate-100"
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
        </div>

        {/* Quiz Picker */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {quizzes
            .filter((quiz) => {
              if (filterSubject !== 'all' && resolveQuizSubjectId(quiz) !== filterSubject) return false;
              if (filterGrade !== 'all' && resolveQuizGradeId(quiz) !== filterGrade) return false;
              return true;
            })
            .map((quiz) => {
            const selected = activeQuiz?.id === quiz.id;
            const sid = resolveQuizSubjectId(quiz);
            const gid = resolveQuizGradeId(quiz);
            return (
              <div
                key={quiz.id}
                onClick={() => setSelectedQuizId(quiz.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') setSelectedQuizId(quiz.id);
                }}
                className={`p-4 rounded-2xl border text-left transition-colors cursor-pointer flex flex-col justify-between gap-3 ${
                  selected
                    ? 'border-[#4F46E5] bg-indigo-50/70 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300'
                }`}
              >
                <div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {getSubjectLabel(sid, settings.language)} · {getGradeLabel(gid, settings.language, true)} · {t.questionsCount(quiz.questions.length)}
                  </p>
                  <h3 className="mt-1 font-display text-sm font-bold text-slate-900 dark:text-white">
                    {quiz.title}
                  </h3>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditQuiz(quiz);
                    }}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>{t.editQuizBtn}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Mode Selection: Solo vs Pass-and-Play Teams */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPlayMode('solo')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                playMode === 'solo'
                  ? 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              {t.kahootModeSolo}
            </button>
            <button
              type="button"
              onClick={() => setPlayMode('teams')}
              className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-semibold border inline-flex items-center gap-1.5 transition-colors cursor-pointer ${
                playMode === 'teams'
                  ? 'border-[#4F46E5] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>{t.kahootModeTeams}</span>
            </button>
          </div>

          {playMode === 'teams' && (
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <form onSubmit={handleAddPlayer} className="flex items-center gap-2 flex-1 min-w-[200px]">
                  <input
                    type="text"
                    value={newPlayerName}
                    onChange={(e) => setNewPlayerName(e.target.value)}
                    placeholder={t.addPlayerPlaceholder}
                    className="flex-1 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[40px] px-3.5 rounded-xl bg-slate-900 dark:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    {t.addBtn}
                  </button>
                </form>

                <button
                  type="button"
                  onClick={handleImportWheelPlayers}
                  className="min-h-[40px] px-3.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 text-xs font-semibold cursor-pointer whitespace-nowrap"
                >
                  {t.importWheelPlayers}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {players.map((p, idx) => (
                  <div
                    key={idx}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-200"
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
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={startShow}
            className="w-full sm:w-auto min-h-[48px] px-8 py-3 rounded-xl bg-gradient-to-r from-[#4F46E5] to-[#3B82F6] hover:opacity-95 text-white text-sm font-bold inline-flex items-center justify-center gap-2 shadow-lg cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{t.startQuizBtn}</span>
          </button>
        </div>
      </div>
    );
  }

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
            onClick={startShow}
            className="min-h-[44px] px-6 py-2.5 rounded-xl bg-white text-[#46178F] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.playAgainBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => setPhase('LOBBY')}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold cursor-pointer"
          >
            {t.quizLibraryTitle}
          </button>
        </div>
      </div>
    );
  }

  // QUESTION OR REVEAL STATE
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
            onClick={() => setPhase('LOBBY')}
            className="text-purple-200 hover:text-white font-medium cursor-pointer"
          >
            ← {t.quizLibraryTitle}
          </button>

          {playMode === 'teams' && currentPlayer && (
            <span className="font-semibold text-amber-300">
              {t.currentTurnLabel}: {currentPlayer.name}
            </span>
          )}

          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="font-bold text-base">{secondsLeft}s</span>
            <span className="text-purple-200">
              {qIndex + 1}/{activeQuiz.questions.length}
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
      {currentQuestion && (
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
