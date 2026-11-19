'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Award,
  CheckCircle2,
  Clock,
  Flame,
  GraduationCap,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  ShieldCheck,
  Shuffle,
  Snowflake,
  Sparkles,
  Trash2,
  Trophy,
  UserPlus,
  Users,
  X,
  XCircle,
  Zap,
  ArrowRight,
  SkipForward,
  Check,
  ListChecks,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import {
  getGradeLabel,
  getSubjectLabel,
  resolveQuizGradeId,
  resolveQuizSubjectId,
  type OfflineQuiz,
  type QuizQuestion,
} from '@/lib/offline-quizzes';
import {
  SubjectGradeQuizPicker,
  type QuizCreatePreset,
} from './SubjectGradeQuizPicker';
import { MathText } from '../MathText';
import {
  playCardFlipSound,
  playCorrectSound,
  playTickSound,
  playWinSound,
  playWrongSound,
  triggerHaptic,
} from '@/lib/sound';

interface QuizizzGameProps {
  quizzes: OfflineQuiz[];
  onCreateQuiz: (preset?: QuizCreatePreset) => void;
  onEditQuiz: (quiz: OfflineQuiz) => void;
  onDeleteQuiz: (quizId: string) => void;
}

type QuizizzMode = 'solo' | 'classroom';
type QuizizzPhase = 'setup' | 'playing' | 'redemption_pick' | 'redemption_play' | 'summary';
type PowerUpKey = 'fifty' | 'double' | 'freeze' | 'saver';

interface PreparedQuestion {
  source: QuizQuestion;
  options: [string, string, string, string];
  correctIndex: number;
}

interface AnswerRecord {
  questionIndex: number;
  question: PreparedQuestion;
  playerId: string;
  playerName: string;
  selectedIndex: number | null; // null = timeout
  isCorrect: boolean;
  pointsEarned: number;
  redeemed?: boolean;
}

interface ClassroomPlayer {
  id: string;
  name: string;
  score: number;
  correct: number;
  answered: number;
  streak: number;
  bestStreak: number;
}

const BEST_SCORES_STORAGE_KEY = 'pickerwel_quizizz_best_v1';

const OPTION_STYLES = [
  {
    key: 'A',
    bg: 'bg-[#2563EB] hover:bg-[#1D4ED8] text-white border-[#1D4ED8]',
    keyBg: 'bg-white/20 text-white',
  },
  {
    key: 'B',
    bg: 'bg-[#0D9488] hover:bg-[#0F766E] text-white border-[#0F766E]',
    keyBg: 'bg-white/20 text-white',
  },
  {
    key: 'C',
    bg: 'bg-[#D97706] hover:bg-[#B45309] text-white border-[#B45309]',
    keyBg: 'bg-white/20 text-white',
  },
  {
    key: 'D',
    bg: 'bg-[#E11D48] hover:bg-[#BE123C] text-white border-[#BE123C]',
    keyBg: 'bg-white/20 text-white',
  },
] as const;

function readBestScores(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BEST_SCORES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeBestScores(scores: Record<string, number>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BEST_SCORES_STORAGE_KEY, JSON.stringify(scores));
  } catch {
    // Ignore quota errors
  }
}

function shuffleArray<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareQuestions(
  quiz: OfflineQuiz,
  shuffleQ: boolean,
  shuffleOpts: boolean
): PreparedQuestion[] {
  const ordered = shuffleQ ? shuffleArray(quiz.questions) : [...quiz.questions];
  return ordered.map((q) => {
    if (!shuffleOpts) {
      return {
        source: q,
        options: [...q.options] as [string, string, string, string],
        correctIndex: q.correctIndex,
      };
    }
    const tagged = q.options.map((text, idx) => ({
      text,
      isCorrect: idx === q.correctIndex,
    }));
    const mixed = shuffleArray(tagged);
    return {
      source: q,
      options: [
        mixed[0].text,
        mixed[1].text,
        mixed[2].text,
        mixed[3].text,
      ],
      correctIndex: mixed.findIndex((item) => item.isCorrect),
    };
  });
}

export function QuizizzGame({
  quizzes,
  onCreateQuiz,
  onEditQuiz,
  onDeleteQuiz,
}: QuizizzGameProps) {
  const { settings, activeWheel } = usePickerwel();
  const isKm = settings.language === 'km';

  const [selectedQuizId, setSelectedQuizId] = useState<string>(
    quizzes[0]?.id ?? ''
  );
  const [mode, setMode] = useState<QuizizzMode>('solo');
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleOptions, setShuffleOptions] = useState(true);
  const [powerUpsEnabled, setPowerUpsEnabled] = useState(true);

  const [rosterNames, setRosterNames] = useState<string[]>(() =>
    isKm ? ['ក្រុម ១', 'ក្រុម ២'] : ['Team 1', 'Team 2']
  );
  const [newPlayerInput, setNewPlayerInput] = useState('');

  const [bestScores, setBestScores] = useState<Record<string, number>>(() =>
    readBestScores()
  );

  // Active game state
  const [phase, setPhase] = useState<QuizizzPhase>('setup');
  const [prepared, setPrepared] = useState<PreparedQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [players, setPlayers] = useState<ClassroomPlayer[]>([]);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [records, setRecords] = useState<AnswerRecord[]>([]);

  // Per-question state
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [lastPointsEarned, setLastPointsEarned] = useState(0);
  const [lastFeedbackNote, setLastFeedbackNote] = useState<string>('');
  const [timeLeftMs, setTimeLeftMs] = useState(15000);
  const [totalTimeMs, setTotalTimeMs] = useState(15000);

  // Power-ups inventory & active flags for current question
  const [inventory, setInventory] = useState<Record<PowerUpKey, number>>({
    fifty: 1,
    double: 1,
    freeze: 1,
    saver: 1,
  });
  const [eliminatedOptions, setEliminatedOptions] = useState<number[]>([]);
  const [doubleActive, setDoubleActive] = useState(false);
  const [freezeActive, setFreezeActive] = useState(false);
  const [saverActive, setSaverActive] = useState(false);
  const [powerUpEarnedBanner, setPowerUpEarnedBanner] = useState<string | null>(null);

  // Redemption state (Solo mode)
  const [redemptionRecordIdx, setRedemptionRecordIdx] = useState<number | null>(null);
  const [redemptionDone, setRedemptionDone] = useState(false);
  const [isNewBest, setIsNewBest] = useState(false);

  const lastTickSecondRef = useRef<number>(-1);

  const selectedQuiz = useMemo(
    () => quizzes.find((q) => q.id === selectedQuizId) ?? quizzes[0] ?? null,
    [quizzes, selectedQuizId]
  );

  const activeQuestion = useMemo(() => {
    if (phase === 'redemption_play' && redemptionRecordIdx !== null) {
      return records[redemptionRecordIdx]?.question ?? null;
    }
    return prepared[currentIdx] ?? null;
  }, [phase, redemptionRecordIdx, records, prepared, currentIdx]);

  const activePlayer = players[activePlayerIdx] ?? players[0] ?? null;

  const soloStats = useMemo(() => {
    const total = records.length;
    const correct = records.filter((r) => r.isCorrect).length;
    const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
    const score = players[0]?.score ?? 0;
    const streak = players[0]?.streak ?? 0;
    const bestStreak = players[0]?.bestStreak ?? 0;
    return { total, correct, accuracy, score, streak, bestStreak };
  }, [records, players]);

  const missedRecords = useMemo(
    () =>
      records
        .map((rec, index) => ({ rec, index }))
        .filter((item) => !item.rec.isCorrect),
    [records]
  );

  const resetQuestionVisuals = useCallback(
    (question: PreparedQuestion | null, useTimer: boolean) => {
      const limitSec = Math.max(5, question?.source.timeLimitSec || 15);
      setSelectedOption(null);
      setRevealed(false);
      setTimedOut(false);
      setLastPointsEarned(0);
      setLastFeedbackNote('');
      setEliminatedOptions([]);
      setDoubleActive(false);
      setFreezeActive(false);
      setSaverActive(false);
      setPowerUpEarnedBanner(null);
      setTotalTimeMs(limitSec * 1000);
      setTimeLeftMs(useTimer ? limitSec * 1000 : limitSec * 1000);
      lastTickSecondRef.current = limitSec;
    },
    []
  );

  const handleStartGame = () => {
    if (!selectedQuiz || selectedQuiz.questions.length === 0) return;

    const preparedList = prepareQuestions(
      selectedQuiz,
      shuffleQuestions,
      shuffleOptions
    );

    const initialPlayers: ClassroomPlayer[] =
      mode === 'solo'
        ? [
            {
              id: 'solo',
              name: isKm ? 'អ្នកលេង' : 'Player',
              score: 0,
              correct: 0,
              answered: 0,
              streak: 0,
              bestStreak: 0,
            },
          ]
        : (rosterNames.length >= 2
            ? rosterNames
            : isKm
            ? ['ក្រុម ១', 'ក្រុម ២']
            : ['Team 1', 'Team 2']
          ).map((name, i) => ({
            id: `p_${i}_${name}`,
            name,
            score: 0,
            correct: 0,
            answered: 0,
            streak: 0,
            bestStreak: 0,
          }));

    setPrepared(preparedList);
    setPlayers(initialPlayers);
    setActivePlayerIdx(0);
    setCurrentIdx(0);
    setRecords([]);
    setRedemptionRecordIdx(null);
    setRedemptionDone(false);
    setIsNewBest(false);
    setInventory({ fifty: 1, double: 1, freeze: 1, saver: 1 });
    resetQuestionVisuals(preparedList[0] ?? null, timerEnabled);
    setPhase('playing');
    if (settings.soundEnabled) playCardFlipSound();
  };

  const finalizeGame = useCallback(
    (finalPlayers: ClassroomPlayer[]) => {
      setPhase('summary');
      if (settings.soundEnabled) playWinSound();
      if (settings.hapticsEnabled) triggerHaptic([35, 50, 70]);

      if (selectedQuiz) {
        const topScore = Math.max(0, ...finalPlayers.map((p) => p.score));
        const prevBest = bestScores[selectedQuiz.id] ?? 0;
        if (topScore > prevBest) {
          const updated = { ...bestScores, [selectedQuiz.id]: topScore };
          setBestScores(updated);
          writeBestScores(updated);
          setIsNewBest(true);
        } else {
          setIsNewBest(false);
        }
      }
    },
    [bestScores, selectedQuiz, settings.hapticsEnabled, settings.soundEnabled]
  );

  const handleAnswer = useCallback(
    (optionIndex: number | null) => {
      if (revealed || !activeQuestion || !activePlayer) return;

      const isTimeout = optionIndex === null;
      const isCorrect = !isTimeout && optionIndex === activeQuestion.correctIndex;
      const timeRatio =
        timerEnabled && totalTimeMs > 0
          ? Math.max(0, Math.min(1, timeLeftMs / totalTimeMs))
          : 0.7;

      // Redemption play mode
      if (phase === 'redemption_play' && redemptionRecordIdx !== null) {
        setSelectedOption(optionIndex);
        setRevealed(true);
        setTimedOut(isTimeout);

        const earned = isCorrect ? 500 : 0;
        setLastPointsEarned(earned);

        if (isCorrect) {
          if (settings.soundEnabled) playCorrectSound();
          if (settings.hapticsEnabled) triggerHaptic(25);
          setLastFeedbackNote(
            isKm
              ? 'ស្តារពិន្ទុជោគជ័យ! +500 ពិន្ទុ'
              : 'Redemption succeeded! +500 pts'
          );
          setRecords((prev) =>
            prev.map((rec, idx) =>
              idx === redemptionRecordIdx
                ? {
                    ...rec,
                    selectedIndex: optionIndex,
                    isCorrect: true,
                    pointsEarned: rec.pointsEarned + earned,
                    redeemed: true,
                  }
                : rec
            )
          );
          setPlayers((prev) =>
            prev.map((p, idx) =>
              idx === 0
                ? { ...p, score: p.score + earned, correct: p.correct + 1 }
                : p
            )
          );
        } else {
          if (settings.soundEnabled) playWrongSound();
          if (settings.hapticsEnabled) triggerHaptic([40, 30, 40]);
          setLastFeedbackNote(
            isKm ? 'មិនទាន់ត្រូវទេ — ពិនិត្យចម្លើយត្រឹមត្រូវខាងលើ' : 'Not quite — review the correct answer above'
          );
        }
        setRedemptionDone(true);
        return;
      }

      // Standard playing phase
      setSelectedOption(optionIndex);
      setRevealed(true);
      setTimedOut(isTimeout);

      const nextStreak = isCorrect
        ? activePlayer.streak + 1
        : saverActive
        ? activePlayer.streak
        : 0;

      let earned = 0;
      let note = '';

      if (isCorrect) {
        const basePoints = 600;
        const speedBonus = Math.round(400 * timeRatio);
        const streakBonus = Math.min(300, activePlayer.streak * 100);
        const raw = basePoints + speedBonus + streakBonus;
        earned = doubleActive ? raw * 2 : raw;

        note = doubleActive
          ? isKm
            ? `ចម្លើយត្រឹមត្រូវ! គុណ 2× = +${earned.toLocaleString()} ពិន្ទុ`
            : `Correct! 2× Power-Up = +${earned.toLocaleString()} pts`
          : isKm
          ? `ត្រឹមត្រូវ! +${earned.toLocaleString()} ពិន្ទុ`
          : `Correct! +${earned.toLocaleString()} pts`;

        if (settings.soundEnabled) playCorrectSound();
        if (settings.hapticsEnabled) triggerHaptic(22);

        // Award bonus power-up every 3-streak
        if (powerUpsEnabled && nextStreak > 0 && nextStreak % 3 === 0) {
          const keys: PowerUpKey[] = ['fifty', 'double', 'freeze', 'saver'];
          const bonusKey = keys[Math.floor(Math.random() * keys.length)];
          setInventory((prev) => ({ ...prev, [bonusKey]: prev[bonusKey] + 1 }));
          const bonusNames: Record<PowerUpKey, string> = isKm
            ? {
                fifty: '50/50',
                double: 'គុណពិន្ទុ 2×',
                freeze: 'បង្កកម៉ោង',
                saver: 'ការពារ Streak',
              }
            : {
                fifty: '50/50',
                double: '2× Points',
                freeze: 'Time Freeze',
                saver: 'Streak Saver',
              };
          setPowerUpEarnedBanner(
            isKm
              ? `Streak ×${nextStreak}! ទទួលបានជំនួយ +1 ${bonusNames[bonusKey]}`
              : `Streak ×${nextStreak}! Earned +1 ${bonusNames[bonusKey]}`
          );
        }
      } else {
        if (settings.soundEnabled) playWrongSound();
        if (settings.hapticsEnabled) triggerHaptic([35, 25, 35]);
        if (saverActive && activePlayer.streak > 0) {
          note = isKm
            ? 'ជំនួយការពារ Streak បានរក្សា Streak របស់អ្នក!'
            : 'Streak Saver protected your streak!';
        } else if (isTimeout) {
          note = isKm ? 'អស់ម៉ោងហើយ!' : 'Time is up!';
        } else {
          note = isKm ? 'ចម្លើយមិនទាន់ត្រឹមត្រូវទេ' : 'Incorrect answer';
        }
      }

      setLastPointsEarned(earned);
      setLastFeedbackNote(note);

      setPlayers((prev) =>
        prev.map((p, idx) =>
          idx === activePlayerIdx
            ? {
                ...p,
                score: p.score + earned,
                correct: p.correct + (isCorrect ? 1 : 0),
                answered: p.answered + 1,
                streak: nextStreak,
                bestStreak: Math.max(p.bestStreak, nextStreak),
              }
            : p
        )
      );

      setRecords((prev) => [
        ...prev,
        {
          questionIndex: currentIdx,
          question: activeQuestion,
          playerId: activePlayer.id,
          playerName: activePlayer.name,
          selectedIndex: optionIndex,
          isCorrect,
          pointsEarned: earned,
        },
      ]);
    },
    [
      activePlayer,
      activePlayerIdx,
      activeQuestion,
      currentIdx,
      doubleActive,
      isKm,
      phase,
      powerUpsEnabled,
      redemptionRecordIdx,
      revealed,
      saverActive,
      settings.hapticsEnabled,
      settings.soundEnabled,
      timeLeftMs,
      timerEnabled,
      totalTimeMs,
    ]
  );

  // Countdown timer effect
  useEffect(() => {
    if (
      (phase !== 'playing' && phase !== 'redemption_play') ||
      revealed ||
      !timerEnabled ||
      freezeActive
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      setTimeLeftMs((prev) => {
        const next = Math.max(0, prev - 100);
        const sec = Math.ceil(next / 1000);
        if (sec > 0 && sec <= 3 && sec !== lastTickSecondRef.current) {
          lastTickSecondRef.current = sec;
          if (settings.soundEnabled) playTickSound(0.18);
        }
        return next;
      });
    }, 100);

    return () => window.clearInterval(interval);
  }, [phase, revealed, timerEnabled, freezeActive, settings.soundEnabled]);

  // Trigger timeout when clock hits 0
  useEffect(() => {
    if (
      (phase === 'playing' || phase === 'redemption_play') &&
      timerEnabled &&
      !freezeActive &&
      !revealed &&
      timeLeftMs <= 0
    ) {
      queueMicrotask(() => {
        handleAnswer(null);
      });
    }
  }, [phase, timerEnabled, freezeActive, revealed, timeLeftMs, handleAnswer]);

  const handleNextStep = useCallback(() => {
    if (phase === 'redemption_play') {
      finalizeGame(players);
      return;
    }

    const nextIdx = currentIdx + 1;
    if (nextIdx < prepared.length) {
      setCurrentIdx(nextIdx);
      if (mode === 'classroom' && players.length > 0) {
        setActivePlayerIdx((prev) => (prev + 1) % players.length);
      }
      resetQuestionVisuals(prepared[nextIdx], timerEnabled);
      if (settings.soundEnabled) playCardFlipSound();
      return;
    }

    // All questions completed: check if Solo Redemption Round applies
    const hasMissed = records.some((r) => !r.isCorrect);
    if (mode === 'solo' && hasMissed && !redemptionDone) {
      setPhase('redemption_pick');
      if (settings.soundEnabled) playCardFlipSound();
      return;
    }

    finalizeGame(players);
  }, [
    currentIdx,
    finalizeGame,
    mode,
    phase,
    players,
    prepared,
    records,
    redemptionDone,
    resetQuestionVisuals,
    settings.soundEnabled,
    timerEnabled,
  ]);

  // Keyboard shortcuts (1-4 to answer, Enter/Space for Next)
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'redemption_play') return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (!revealed) {
        const keyMap: Record<string, number> = {
          '1': 0,
          '2': 1,
          '3': 2,
          '4': 3,
          a: 0,
          b: 1,
          c: 2,
          d: 3,
        };
        const idx = keyMap[e.key.toLowerCase()];
        if (idx !== undefined && !eliminatedOptions.includes(idx)) {
          e.preventDefault();
          handleAnswer(idx);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleNextStep();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [eliminatedOptions, handleAnswer, handleNextStep, phase, revealed]);

  const handleUsePowerUp = (key: PowerUpKey) => {
    if (revealed || !activeQuestion || inventory[key] <= 0) return;

    if (key === 'fifty') {
      if (eliminatedOptions.length > 0) return;
      const wrongIndices = [0, 1, 2, 3].filter(
        (i) => i !== activeQuestion.correctIndex
      );
      const toRemove = shuffleArray(wrongIndices).slice(0, 2);
      setEliminatedOptions(toRemove);
      setInventory((prev) => ({ ...prev, fifty: prev.fifty - 1 }));
      if (settings.soundEnabled) playCardFlipSound();
      return;
    }

    if (key === 'double') {
      if (doubleActive) return;
      setDoubleActive(true);
      setInventory((prev) => ({ ...prev, double: prev.double - 1 }));
      if (settings.soundEnabled) playCardFlipSound();
      return;
    }

    if (key === 'freeze') {
      if (freezeActive || !timerEnabled) return;
      setFreezeActive(true);
      setInventory((prev) => ({ ...prev, freeze: prev.freeze - 1 }));
      if (settings.soundEnabled) playCardFlipSound();
      return;
    }

    if (key === 'saver') {
      if (saverActive) return;
      setSaverActive(true);
      setInventory((prev) => ({ ...prev, saver: prev.saver - 1 }));
      if (settings.soundEnabled) playCardFlipSound();
    }
  };

  const handleAddPlayer = () => {
    const trimmed = newPlayerInput.trim();
    if (!trimmed || rosterNames.length >= 12) return;
    setRosterNames((prev) => [...prev, trimmed]);
    setNewPlayerInput('');
  };

  const handleImportWheelPlayers = () => {
    const wheelNames = activeWheel.entries
      .map((e) => e.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (wheelNames.length >= 2) {
      setRosterNames(wheelNames);
      if (settings.soundEnabled) playCardFlipSound();
    }
  };

  const handleStartRedemptionQuestion = (recordIdx: number) => {
    const target = records[recordIdx];
    if (!target) return;
    setRedemptionRecordIdx(recordIdx);
    resetQuestionVisuals(target.question, timerEnabled);
    setPhase('redemption_play');
    if (settings.soundEnabled) playCardFlipSound();
  };

  // ==================== SETUP / LOBBY ====================
  if (phase === 'setup') {
    const subjectLabel = selectedQuiz
      ? getSubjectLabel(resolveQuizSubjectId(selectedQuiz), settings.language)
      : '';
    const gradeLabel = selectedQuiz
      ? getGradeLabel(resolveQuizGradeId(selectedQuiz), settings.language)
      : '';
    const bestForSelected = selectedQuiz ? bestScores[selectedQuiz.id] ?? 0 : 0;

    return (
      <div className="space-y-6">
        {/* Header Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                    {isKm ? 'Quizizz ក្រៅបណ្ដាញ (Offline)' : 'Quizizz Studio (Offline)'}
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {isKm
                      ? 'ឆ្លើយសំណួរតាមល្បឿនផ្ទាល់ខ្លួន មានជំនួយ Power-Ups ការប្រកួតក្រុម និងជុំស្តារពិន្ទុ (Redemption) ដោយមិនបាច់មានអ៊ីនធឺណិត។'
                      : 'Self-paced mastery & turn-based classroom races with Quizizz Power-Ups, live accuracy bar, and Redemption rounds — 100% offline.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Segmented Switch */}
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start shrink-0">
              <button
                type="button"
                onClick={() => setMode('solo')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'solo'
                    ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                <span>{isKm ? 'អនុវត្តម្នាក់ឯង' : 'Solo Mastery'}</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('classroom')}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  mode === 'classroom'
                    ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>{isKm ? 'ប្រកួតក្នុងថ្នាក់' : 'Classroom Race'}</span>
              </button>
            </div>
          </div>

          {/* Quiz Picker */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isKm ? 'ជ្រើសរើសសំណុំសំណួរ' : 'Select Quiz Set'}
                </label>
                {selectedQuiz && quizzes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      const fallback = quizzes.find((q) => q.id !== selectedQuiz.id);
                      onDeleteQuiz(selectedQuiz.id);
                      if (fallback) setSelectedQuizId(fallback.id);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isKm ? 'លុបសំណុំនេះ' : 'Delete set'}</span>
                  </button>
                )}
              </div>

              <SubjectGradeQuizPicker
                quizzes={quizzes}
                selectedQuizId={selectedQuiz?.id ?? ''}
                language={settings.language}
                onSelectQuiz={setSelectedQuizId}
                onCreateQuiz={onCreateQuiz}
                onEditQuiz={onEditQuiz}
              />

              {/* Unboxed Quiz Metadata Summary */}
              {selectedQuiz && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {subjectLabel}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span>{gradeLabel}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="tabular-nums">
                      {selectedQuiz.questions.length}{' '}
                      {isKm ? 'សំណួរ' : 'questions'}
                    </span>
                  </div>
                  {bestForSelected > 0 && (
                    <div className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                      <Trophy className="w-4 h-4" />
                      <span>
                        {isKm ? 'ពិន្ទុខ្ពស់បំផុត៖' : 'Best:'}{' '}
                        {bestForSelected.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Classroom Roster Panel */}
              {mode === 'classroom' && (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {isKm
                        ? `បញ្ជីក្រុម ឬសិស្ស (${rosterNames.length}/12)`
                        : `Players / Teams (${rosterNames.length}/12)`}
                    </span>
                    <button
                      type="button"
                      onClick={handleImportWheelPlayers}
                      disabled={activeWheel.entries.length < 2}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:border-violet-400 disabled:opacity-40 cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>
                        {isKm ? 'ទាញឈ្មោះពីកងវិល' : 'Import from Wheel'}
                      </span>
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPlayerInput}
                      onChange={(e) => setNewPlayerInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddPlayer();
                        }
                      }}
                      placeholder={
                        isKm ? 'វាយឈ្មោះសិស្ស ឬក្រុម...' : 'Add player or team name...'
                      }
                      className="flex-1 min-h-[40px] px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddPlayer}
                      disabled={!newPlayerInput.trim() || rosterNames.length >= 12}
                      className="min-h-[40px] px-3.5 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-sm font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{isKm ? 'បន្ថែម' : 'Add'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {rosterNames.map((name, idx) => (
                      <div
                        key={`${name}-${idx}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100"
                      >
                        <span className="truncate">
                          {idx + 1}. {name}
                        </span>
                        {rosterNames.length > 2 && (
                          <button
                            type="button"
                            onClick={() =>
                              setRosterNames((prev) =>
                                prev.filter((_, i) => i !== idx)
                              )
                            }
                            aria-label="Remove player"
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
            </div>

            {/* Right Column: Session Options & Launch CTA */}
            <div className="lg:col-span-5 flex flex-col justify-between gap-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 sm:p-5">
              <div className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  {isKm ? 'ការកំណត់ហ្គេម' : 'Session Settings'}
                </h3>

                {[
                  {
                    id: 'timer',
                    icon: Clock,
                    label: isKm ? 'កំណត់ម៉ោងរាប់ថយក្រោយ' : 'Countdown Timer',
                    hint: isKm ? 'ទទួលបានពិន្ទុបន្ថែមពេលឆ្លើយលឿន' : 'Earn speed bonus points',
                    value: timerEnabled,
                    toggle: () => setTimerEnabled((v) => !v),
                  },
                  {
                    id: 'powerups',
                    icon: Zap,
                    label: isKm ? 'បើកជំនួយ Power-Ups' : 'Enable Power-Ups',
                    hint: isKm ? '50/50 · គុណ 2× · បង្កកម៉ោង · ការពារ Streak' : '50/50 · 2× · Freeze · Streak Saver',
                    value: powerUpsEnabled,
                    toggle: () => setPowerUpsEnabled((v) => !v),
                  },
                  {
                    id: 'shuffleQ',
                    icon: Shuffle,
                    label: isKm ? 'ច្របល់លំដាប់សំណួរ' : 'Shuffle Questions',
                    hint: isKm ? 'បង្ហាញសំណួរតាមលំដាប់ចៃដន្យ' : 'Randomize question order',
                    value: shuffleQuestions,
                    toggle: () => setShuffleQuestions((v) => !v),
                  },
                  {
                    id: 'shuffleOpts',
                    icon: ListChecks,
                    label: isKm ? 'ច្របល់ជម្រើសចម្លើយ' : 'Shuffle Answer Choices',
                    hint: isKm ? 'ការពារការចាំទីតាំង A/B/C/D' : 'Randomize A/B/C/D order',
                    value: shuffleOptions,
                    toggle: () => setShuffleOptions((v) => !v),
                  },
                ].map((opt) => {
                  const Icon = opt.icon;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={opt.toggle}
                      aria-pressed={opt.value}
                      className="w-full flex items-center justify-between gap-3 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-violet-400 transition-colors text-left cursor-pointer"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon className="w-4 h-4 text-violet-600 dark:text-violet-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white">
                            {opt.label}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            {opt.hint}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 shrink-0 ${
                          opt.value
                            ? 'bg-violet-600 justify-end'
                            : 'bg-slate-300 dark:bg-slate-700 justify-start'
                        }`}
                      >
                        <span className="w-5 h-5 rounded-full bg-white shadow-sm" />
                      </span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={handleStartGame}
                disabled={!selectedQuiz || selectedQuiz.questions.length === 0}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white font-bold text-base shadow-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {isKm ? 'ចាប់ផ្តើមលេង Quizizz' : 'Start Quizizz Session'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== REDEMPTION PICKER (SOLO) ====================
  if (phase === 'redemption_pick') {
    const candidates = missedRecords.slice(0, 3);
    return (
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {isKm
                  ? 'ជុំស្តារពិន្ទុ (Redemption Question)'
                  : 'Redemption Question Round'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {isKm
                  ? 'ជ្រើសរើសសំណួរ ១ ដែលអ្នកបានឆ្លើយខុស ដើម្បីឆ្លើយម្តងទៀត និងទទួលបាន +500 ពិន្ទុបន្ថែម!'
                  : 'Pick 1 missed question to retry for +500 bonus points and boost your accuracy.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => finalizeGame(players)}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold inline-flex items-center gap-1.5 self-start cursor-pointer"
          >
            <SkipForward className="w-4 h-4" />
            <span>{isKm ? 'រំលងទៅលទ្ធផល' : 'Skip to Results'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {candidates.map(({ rec, index }, cardIdx) => (
            <button
              key={index}
              type="button"
              onClick={() => handleStartRedemptionQuestion(index)}
              className="group p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 hover:border-amber-500 dark:hover:border-amber-400 text-left flex flex-col justify-between gap-4 transition-all cursor-pointer"
            >
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                  {isKm ? `ឱកាសទី ${cardIdx + 1}` : `Redemption #${cardIdx + 1}`} · Q
                  {rec.questionIndex + 1}
                </div>
                <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white line-clamp-3">
                  <MathText text={rec.question.source.prompt} />
                </div>
              </div>
              <div className="inline-flex items-center gap-1.5 text-xs font-bold text-violet-600 dark:text-violet-400 group-hover:translate-x-0.5 transition-transform">
                <span>{isKm ? 'ឆ្លើយសំណួរនេះម្តងទៀត' : 'Retry this question'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ==================== SUMMARY / REVIEW ====================
  if (phase === 'summary') {
    const sortedPlayers = [...players].sort((a, b) => b.score - a.score);
    const totalAnswered = records.length;
    const totalCorrect = records.filter((r) => r.isCorrect).length;
    const overallAccuracy =
      totalAnswered > 0 ? Math.round((totalCorrect / totalAnswered) * 100) : 0;

    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-violet-600 text-white flex items-center justify-center shrink-0">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {isKm ? 'លទ្ធផលសង្ខេប Quizizz' : 'Quizizz Session Summary'}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {selectedQuiz?.title}
                  {isNewBest && (
                    <span className="ml-2 font-bold text-amber-600 dark:text-amber-400">
                      · {isKm ? 'កំណត់ត្រាពិន្ទុខ្ពស់ថ្មី!' : 'New High Score!'}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleStartGame}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isKm ? 'លេងម្តងទៀត' : 'Play Again'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPhase('setup')}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold cursor-pointer"
              >
                {isKm ? 'ត្រឡប់ទៅការកំណត់' : 'Back to Setup'}
              </button>
            </div>
          </div>

          {/* Core Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isKm ? 'ភាពត្រឹមត្រូវ (Accuracy)' : 'Accuracy'}
              </div>
              <div className="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {overallAccuracy}%
              </div>
              <div className="mt-2 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full"
                  style={{ width: `${overallAccuracy}%` }}
                />
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {mode === 'solo'
                  ? isKm
                    ? 'ពិន្ទុសរុប'
                    : 'Total Score'
                  : isKm
                  ? 'ពិន្ទុលេខ ១'
                  : 'Top Score'}
              </div>
              <div className="mt-1 text-2xl font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                {(sortedPlayers[0]?.score ?? 0).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isKm ? 'ឆ្លើយត្រូវ' : 'Correct'}
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                {totalCorrect} / {totalAnswered}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                {isKm ? 'Streak ខ្ពស់បំផុត' : 'Best Streak'}
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums flex items-center gap-1.5">
                <Flame className="w-5 h-5" />
                <span>
                  {Math.max(0, ...sortedPlayers.map((p) => p.bestStreak))}
                </span>
              </div>
            </div>
          </div>

          {/* Classroom Leaderboard */}
          {mode === 'classroom' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                <span>
                  {isKm ? 'តារាងចំណាត់ថ្នាក់ក្នុងថ្នាក់' : 'Classroom Leaderboard'}
                </span>
              </h3>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                {sortedPlayers.map((p, rank) => {
                  const acc =
                    p.answered > 0
                      ? Math.round((p.correct / p.answered) * 100)
                      : 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 bg-white dark:bg-slate-900"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center tabular-nums shrink-0 ${
                            rank === 0
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                              : rank === 1
                              ? 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200'
                              : rank === 2
                              ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {rank + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                            {p.name}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                            {p.correct}/{p.answered} ({acc}%) · Streak{' '}
                            {p.bestStreak}
                          </div>
                        </div>
                      </div>
                      <div className="text-base font-bold text-violet-600 dark:text-violet-400 tabular-nums">
                        {p.score.toLocaleString()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Question-by-Question Review */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {isKm ? 'ពិនិត្យចម្លើយលម្អិត' : 'Question Review'}
            </h3>
            <div className="space-y-2.5">
              {records.map((rec, idx) => (
                <div
                  key={`${rec.questionIndex}-${idx}`}
                  className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      {rec.isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {rec.redeemed
                              ? isKm
                                ? 'ស្តារបានត្រឹមត្រូវ'
                                : 'Redeemed'
                              : isKm
                              ? 'ត្រឹមត្រូវ'
                              : 'Correct'}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400">
                          <XCircle className="w-4 h-4" />
                          <span>{isKm ? 'ខុស' : 'Missed'}</span>
                        </span>
                      )}
                      <span className="text-slate-400">·</span>
                      <span className="text-slate-500 dark:text-slate-400 tabular-nums">
                        Q{rec.questionIndex + 1}
                      </span>
                      {mode === 'classroom' && (
                        <>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            {rec.playerName}
                          </span>
                        </>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 dark:text-white">
                      <MathText text={rec.question.source.prompt} />
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-x-4 gap-y-1">
                      <span>
                        <strong className="text-emerald-700 dark:text-emerald-400">
                          {isKm ? 'ចម្លើយត្រឹមត្រូវ៖' : 'Correct:'}
                        </strong>{' '}
                        <MathText
                          text={rec.question.options[rec.question.correctIndex]}
                        />
                      </span>
                      {!rec.isCorrect && rec.selectedIndex !== null && (
                        <span>
                          <strong className="text-rose-700 dark:text-rose-400">
                            {isKm ? 'បានជ្រើស៖' : 'Selected:'}
                          </strong>{' '}
                          <MathText
                            text={rec.question.options[rec.selectedIndex]}
                          />
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-slate-700 dark:text-slate-200 tabular-nums shrink-0">
                    +{rec.pointsEarned.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==================== ACTIVE GAMEPLAY (PLAYING / REDEMPTION_PLAY) ====================
  if (!activeQuestion || !activePlayer) return null;

  const isRedemption = phase === 'redemption_play';
  const timerPercent =
    totalTimeMs > 0 ? Math.max(0, Math.min(100, (timeLeftMs / totalTimeMs) * 100)) : 100;
  const secondsDisplay = Math.ceil(timeLeftMs / 1000);

  return (
    <div className="space-y-4">
      {/* Top HUD Bar */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="font-bold text-slate-900 dark:text-white tabular-nums">
              {isRedemption
                ? isKm
                  ? 'ជុំស្តារពិន្ទុ'
                  : 'Redemption'
                : `${currentIdx + 1} / ${prepared.length}`}
            </span>
            <span className="text-slate-300 dark:text-slate-600">·</span>
            {mode === 'classroom' ? (
              <span className="font-semibold text-violet-700 dark:text-violet-300">
                {isKm ? 'វេនរបស់៖' : 'Turn:'} {activePlayer.name}
              </span>
            ) : (
              <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                {isKm ? 'ភាពត្រឹមត្រូវ' : 'Accuracy'} {soloStats.accuracy}%
              </span>
            )}
            <span className="text-slate-300 dark:text-slate-600">·</span>
            <span className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
              <Flame className="w-4 h-4" />
              <span>{activePlayer.streak}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-base sm:text-lg font-bold text-violet-600 dark:text-violet-400 tabular-nums">
              {activePlayer.score.toLocaleString()}{' '}
              <span className="text-xs font-medium text-slate-500">
                {isKm ? 'ពិន្ទុ' : 'pts'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPhase('setup')}
              className="min-h-[34px] px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
            >
              {isKm ? 'ចាកចេញ' : 'Exit'}
            </button>
          </div>
        </div>

        {/* Countdown Progress Bar */}
        {timerEnabled && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full transition-all duration-100 rounded-full ${
                  freezeActive
                    ? 'bg-sky-400'
                    : timerPercent > 40
                    ? 'bg-violet-600'
                    : timerPercent > 20
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${timerPercent}%` }}
              />
            </div>
            <div className="flex items-center gap-1 text-xs font-bold tabular-nums min-w-[46px] justify-end text-slate-700 dark:text-slate-200">
              {freezeActive ? (
                <Snowflake className="w-3.5 h-3.5 text-sky-500" />
              ) : (
                <Clock className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span>{secondsDisplay}s</span>
            </div>
          </div>
        )}
      </div>

      {/* Question Card */}
      <div className="rounded-2xl bg-slate-900 dark:bg-slate-950 text-white p-6 sm:p-8 shadow-sm border border-slate-800 space-y-6">
        <div className="text-center space-y-2 max-w-3xl mx-auto">
          {doubleActive && (
            <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
              <Zap className="w-3.5 h-3.5" />
              <span>
                {isKm ? 'កំពុងប្រើគុណពិន្ទុ 2×' : '2× Points Active'}
              </span>
            </div>
          )}
          <div className="font-display text-xl sm:text-2xl md:text-[1.7rem] font-bold leading-snug">
            <MathText text={activeQuestion.source.prompt} />
          </div>
        </div>

        {/* 4 Quizizz Answer Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {activeQuestion.options.map((optionText, idx) => {
            const style = OPTION_STYLES[idx];
            const isEliminated = eliminatedOptions.includes(idx);
            const isCorrectOpt = idx === activeQuestion.correctIndex;
            const isSelected = selectedOption === idx;

            let tileClass = `${style.bg} border-b-4`;
            if (isEliminated && !revealed) {
              tileClass =
                'bg-slate-800/40 text-slate-500 border border-slate-700/60 opacity-35 pointer-events-none';
            } else if (revealed) {
              if (isCorrectOpt) {
                tileClass =
                  'bg-emerald-600 text-white border-2 border-emerald-300 ring-2 ring-emerald-400/50';
              } else if (isSelected) {
                tileClass =
                  'bg-rose-700 text-white border-2 border-rose-300';
              } else {
                tileClass =
                  'bg-slate-800/60 text-slate-400 border border-slate-700 opacity-50';
              }
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={revealed || isEliminated}
                onClick={() => handleAnswer(idx)}
                className={`min-h-[76px] p-4 rounded-xl text-left flex items-center justify-between gap-3 transition-all cursor-pointer disabled:cursor-default ${tileClass}`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-lg text-sm font-bold flex items-center justify-center shrink-0 ${
                      revealed ? 'bg-black/20 text-white' : style.keyBg
                    }`}
                  >
                    {style.key}
                  </span>
                  <span className="text-base sm:text-lg font-semibold leading-snug break-words">
                    <MathText text={optionText} />
                  </span>
                </div>

                {revealed && isCorrectOpt && (
                  <CheckCircle2 className="w-6 h-6 text-white shrink-0" />
                )}
                {revealed && isSelected && !isCorrectOpt && (
                  <XCircle className="w-6 h-6 text-white shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* Power-Ups Strip (during live question before reveal) */}
        {powerUpsEnabled && !isRedemption && !revealed && (
          <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-semibold text-slate-400">
              {isKm ? 'ជំនួយ Power-Ups (ចុចដើម្បីប្រើ)៖' : 'Power-Ups:'}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {[
                {
                  key: 'fifty' as PowerUpKey,
                  icon: Scissors,
                  label: '50/50',
                  active: eliminatedOptions.length > 0,
                  disabled: inventory.fifty <= 0 || eliminatedOptions.length > 0,
                },
                {
                  key: 'double' as PowerUpKey,
                  icon: Zap,
                  label: isKm ? 'គុណ 2×' : '2× Points',
                  active: doubleActive,
                  disabled: inventory.double <= 0 || doubleActive,
                },
                {
                  key: 'freeze' as PowerUpKey,
                  icon: Snowflake,
                  label: isKm ? 'បង្កកម៉ោង' : 'Freeze',
                  active: freezeActive,
                  disabled:
                    !timerEnabled || inventory.freeze <= 0 || freezeActive,
                },
                {
                  key: 'saver' as PowerUpKey,
                  icon: ShieldCheck,
                  label: isKm ? 'ការពារ Streak' : 'Streak Saver',
                  active: saverActive,
                  disabled: inventory.saver <= 0 || saverActive,
                },
              ].map((pu) => {
                const Icon = pu.icon;
                return (
                  <button
                    key={pu.key}
                    type="button"
                    disabled={pu.disabled}
                    onClick={() => handleUsePowerUp(pu.key)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      pu.active
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{pu.label}</span>
                    <span className="tabular-nums opacity-80">
                      ({inventory[pu.key]})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Reveal Feedback & Next Action */}
        {revealed && (
          <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm sm:text-base font-bold">
                {selectedOption === activeQuestion.correctIndex ? (
                  <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                )}
                <span
                  className={
                    selectedOption === activeQuestion.correctIndex
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  }
                >
                  {lastFeedbackNote}
                </span>
                {lastPointsEarned > 0 && (
                  <span className="text-amber-300 tabular-nums">
                    (+{lastPointsEarned.toLocaleString()})
                  </span>
                )}
              </div>
              {powerUpEarnedBanner && (
                <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{powerUpEarnedBanner}</span>
                </div>
              )}
              {timedOut && (
                <div className="text-xs text-slate-400">
                  {isKm
                    ? 'ចុច "សំណួរបន្ទាប់" ដើម្បីបន្ត។'
                    : 'Press Next Question to continue.'}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2 shrink-0 cursor-pointer"
            >
              <span>
                {isRedemption
                  ? isKm
                    ? 'មើលលទ្ធផលចុងក្រោយ'
                    : 'See Final Results'
                  : currentIdx + 1 < prepared.length
                  ? isKm
                    ? 'សំណួរបន្ទាប់'
                    : 'Next Question'
                  : isKm
                  ? 'បញ្ចប់ហ្គេម'
                  : 'Finish Session'}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
