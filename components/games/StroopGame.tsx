'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import confetti from 'canvas-confetti';
import {
  Palette,
  Type,
  Shuffle,
  Play,
  RotateCcw,
  Trophy,
  Flame,
  Check,
  X,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import {
  playCorrectSound,
  playWrongSound,
  playWinSound,
  playTickSound,
  triggerHaptic,
} from '@/lib/sound';
import { COPY } from '@/lib/i18n';

type ReadingRuleMode = 'color' | 'word' | 'mixed';
type ActiveTask = 'color' | 'word';
type GameStage = 'LOBBY' | 'PLAYING' | 'SUMMARY';

interface ColorDef {
  id: string;
  labelKm: string;
  labelEn: string;
  inkHex: string;
  swatchHex: string;
}

const STROOP_COLORS: ColorDef[] = [
  {
    id: 'red',
    labelKm: 'ក្រហម',
    labelEn: 'Red',
    inkHex: '#F87171',
    swatchHex: '#EF4444',
  },
  {
    id: 'blue',
    labelKm: 'ខៀវ',
    labelEn: 'Blue',
    inkHex: '#60A5FA',
    swatchHex: '#3B82F6',
  },
  {
    id: 'green',
    labelKm: 'បៃតង',
    labelEn: 'Green',
    inkHex: '#34D399',
    swatchHex: '#10B981',
  },
  {
    id: 'yellow',
    labelKm: 'លឿង',
    labelEn: 'Yellow',
    inkHex: '#FACC15',
    swatchHex: '#EAB308',
  },
  {
    id: 'purple',
    labelKm: 'ស្វាយ',
    labelEn: 'Purple',
    inkHex: '#C084FC',
    swatchHex: '#8B5CF6',
  },
  {
    id: 'orange',
    labelKm: 'ទឹកក្រូច',
    labelEn: 'Orange',
    inkHex: '#FB923C',
    swatchHex: '#F97316',
  },
];

interface StimulusCard {
  id: number;
  wordColor: ColorDef;
  inkColor: ColorDef;
  task: ActiveTask;
}

interface StroopBestStats {
  bestScore: number;
  bestStreak: number;
}

const BEST_STORAGE_KEY = 'pickerwel_stroop_best_v1';

function loadStroopBest(): StroopBestStats {
  if (typeof window === 'undefined') return { bestScore: 0, bestStreak: 0 };
  try {
    const raw = window.localStorage.getItem(BEST_STORAGE_KEY);
    if (!raw) return { bestScore: 0, bestStreak: 0 };
    const parsed = JSON.parse(raw) as Partial<StroopBestStats>;
    return {
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestStreak: typeof parsed.bestStreak === 'number' ? parsed.bestStreak : 0,
    };
  } catch {
    return { bestScore: 0, bestStreak: 0 };
  }
}

function saveStroopBest(stats: StroopBestStats) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(BEST_STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Ignore storage quota errors
  }
}

function generateStimulus(
  paletteSize: 4 | 6,
  ruleMode: ReadingRuleMode,
  prev: StimulusCard | null,
  seqId: number
): StimulusCard {
  const pool = STROOP_COLORS.slice(0, paletteSize);
  const wordIdx = Math.floor(Math.random() * pool.length);
  const wordColor = pool[wordIdx];

  // ~80% incongruent trials (word != ink color) for genuine Stroop challenge
  const makeIncongruent = Math.random() < 0.82;
  let inkColor = wordColor;
  if (makeIncongruent) {
    const others = pool.filter((c) => c.id !== wordColor.id);
    inkColor = others[Math.floor(Math.random() * others.length)];
  }

  // Prevent identical repeat card back-to-back
  if (prev && prev.wordColor.id === wordColor.id && prev.inkColor.id === inkColor.id) {
    const altOthers = pool.filter((c) => c.id !== inkColor.id);
    inkColor = altOthers[Math.floor(Math.random() * altOthers.length)];
  }

  let task: ActiveTask = 'color';
  if (ruleMode === 'word') {
    task = 'word';
  } else if (ruleMode === 'mixed') {
    task = Math.random() < 0.5 ? 'color' : 'word';
  }

  return {
    id: seqId,
    wordColor,
    inkColor,
    task,
  };
}

export function StroopGame() {
  const { settings } = usePickerwel();
  const t = COPY[settings.language];
  const isKm = settings.language === 'km';

  const [stage, setStage] = useState<GameStage>('LOBBY');
  const [ruleMode, setRuleMode] = useState<ReadingRuleMode>('mixed');
  const [durationSec, setDurationSec] = useState<0 | 30 | 45 | 60>(45);
  const [paletteSize, setPaletteSize] = useState<4 | 6>(4);

  const [timeLeft, setTimeLeft] = useState(45);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [reactionSumMs, setReactionSumMs] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);

  const [bestStats, setBestStats] = useState<StroopBestStats>({
    bestScore: 0,
    bestStreak: 0,
  });

  const [currentCard, setCurrentCard] = useState<StimulusCard>(() => ({
    id: 1,
    wordColor: STROOP_COLORS[0],
    inkColor: STROOP_COLORS[1],
    task: 'color',
  }));
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);

  const cardShownAtRef = useRef<number>(0);
  const seqRef = useRef<number>(2);
  const feedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setBestStats(loadStroopBest());
    });
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    };
  }, []);

  const finishRound = useCallback(
    (finalScore: number, finalBestStreak: number) => {
      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      setStage('SUMMARY');

      const prevBest = loadStroopBest();
      const beatScore = durationSec > 0 && finalScore > prevBest.bestScore;
      const nextBest: StroopBestStats = {
        bestScore: Math.max(prevBest.bestScore, finalScore),
        bestStreak: Math.max(prevBest.bestStreak, finalBestStreak),
      };
      saveStroopBest(nextBest);
      setBestStats(nextBest);
      setIsNewRecord(beatScore);

      if (settings.soundEnabled) playWinSound();
      if (
        (beatScore || finalScore >= 500) &&
        settings.confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({ particleCount: 75, spread: 70, origin: { y: 0.58 } });
      }
    },
    [durationSec, settings.confettiEnabled, settings.soundEnabled]
  );

  // Countdown Timer when durationSec > 0
  useEffect(() => {
    if (stage !== 'PLAYING' || durationSec === 0) return;
    if (timeLeft <= 0) {
      queueMicrotask(() => finishRound(score, maxStreak));
      return;
    }
    const timer = setTimeout(() => {
      const next = timeLeft - 1;
      setTimeLeft(next);
      if (next <= 5 && next > 0 && settings.soundEnabled) {
        playTickSound();
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [durationSec, finishRound, maxStreak, score, settings.soundEnabled, stage, timeLeft]);

  const startRound = () => {
    if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
    const nextSeq = seqRef.current++;
    const firstCard = generateStimulus(paletteSize, ruleMode, null, nextSeq);
    setCurrentCard(firstCard);
    cardShownAtRef.current = performance.now();
    setTimeLeft(durationSec);
    setScore(0);
    setStreak(0);
    setMaxStreak(0);
    setCorrectCount(0);
    setTotalAnswered(0);
    setReactionSumMs(0);
    setIsNewRecord(false);
    setFeedback(null);
    setStage('PLAYING');
  };

  const advanceCard = useCallback(
    (prevCard: StimulusCard) => {
      const nextSeq = seqRef.current++;
      const next = generateStimulus(paletteSize, ruleMode, prevCard, nextSeq);
      setCurrentCard(next);
      cardShownAtRef.current = performance.now();
    },
    [paletteSize, ruleMode]
  );

  const handleAnswer = useCallback(
    (chosenColor: ColorDef) => {
      if (stage !== 'PLAYING') return;

      const reactionMs = Math.max(
        120,
        Math.min(5000, Math.round(performance.now() - cardShownAtRef.current))
      );
      const targetColor =
        currentCard.task === 'color' ? currentCard.inkColor : currentCard.wordColor;
      const isRight = chosenColor.id === targetColor.id;

      setTotalAnswered((n) => n + 1);
      setReactionSumMs((s) => s + reactionMs);

      if (isRight) {
        const nextStreak = streak + 1;
        const speedBonus = Math.max(0, Math.round((2000 - Math.min(2000, reactionMs)) / 40));
        const streakBonus = Math.min(50, nextStreak * 10);
        const points = 100 + speedBonus + streakBonus;

        setScore((s) => s + points);
        setStreak(nextStreak);
        setMaxStreak((m) => Math.max(m, nextStreak));
        setCorrectCount((c) => c + 1);
        setFeedback('correct');
        if (settings.soundEnabled) playCorrectSound();
        if (settings.hapticsEnabled) triggerHaptic(18);
      } else {
        setStreak(0);
        setFeedback('wrong');
        if (settings.soundEnabled) playWrongSound();
        if (settings.hapticsEnabled) triggerHaptic([35, 20, 35]);
      }

      if (feedbackTimerRef.current) clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 240);

      advanceCard(currentCard);
    },
    [
      advanceCard,
      currentCard,
      settings.hapticsEnabled,
      settings.soundEnabled,
      stage,
      streak,
    ]
  );

  const visibleColors = STROOP_COLORS.slice(0, paletteSize);

  // Keyboard shortcuts 1..6 during PLAYING
  useEffect(() => {
    if (stage !== 'PLAYING') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < visibleColors.length) {
        e.preventDefault();
        handleAnswer(visibleColors[idx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleAnswer, stage, visibleColors]);

  const accuracyPct =
    totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
  const avgReactionMs =
    totalAnswered > 0 ? Math.round(reactionSumMs / totalAnswered) : 0;

  if (stage === 'SUMMARY') {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center">
          <Trophy className="w-8 h-8 text-amber-500" />
        </div>

        <div>
          {isNewRecord && (
            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">
              {t.stroopNewRecord}
            </p>
          )}
          <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {t.stroopTitle}
          </h2>
          <p className="mt-2 font-mono text-4xl font-bold tabular-nums text-[#3B82F6] dark:text-blue-400">
            {score.toLocaleString()}
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.stroopCorrectCountLabel}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {correctCount}/{totalAnswered}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.accuracyLabel}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {accuracyPct}%
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.stroopBestStreakLabel}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {maxStreak}
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70">
            <p className="text-xs text-slate-500 dark:text-slate-400">{t.stroopAvgSpeedLabel}</p>
            <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
              {avgReactionMs}ms
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
          <button
            type="button"
            onClick={startRound}
            className="min-h-[46px] px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.playAgainBtn}</span>
          </button>
          <button
            type="button"
            onClick={() => setStage('LOBBY')}
            className="min-h-[46px] px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            {t.stroopModeLabel}
          </button>
        </div>
      </div>
    );
  }

  if (stage === 'PLAYING') {
    const isColorTask = currentCard.task === 'color';
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        {/* Top Unobtrusive HUD */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm font-semibold">
            <span className="inline-flex items-center gap-1.5 font-mono tabular-nums text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-[#3B82F6]" />
              <span>{durationSec > 0 ? `${timeLeft}s` : '∞'}</span>
            </span>

            <span className="font-mono tabular-nums text-[#3B82F6] dark:text-blue-400">
              {t.scoreLabel}: {score}
            </span>

            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-amber-600 dark:text-amber-400">
              <Flame className="w-4 h-4" />
              <span>{streak}x</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {durationSec === 0 && (
              <button
                type="button"
                onClick={() => advanceCard(currentCard)}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>{t.stroopNextCardBtn}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={() => finishRound(score, maxStreak)}
              className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              {t.stroopEndRoundBtn}
            </button>
          </div>
        </div>

        {/* High-Contrast Stimulus Display Stage */}
        <div
          className={`relative rounded-2xl bg-slate-900 dark:bg-slate-950 border p-6 sm:p-10 text-center transition-colors duration-150 ${
            feedback === 'correct'
              ? 'border-emerald-500'
              : feedback === 'wrong'
              ? 'border-rose-500'
              : 'border-slate-800'
          }`}
        >
          {/* Explicit Task Cue (Non-Hue-Only Icon + Text) */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800 text-slate-100 text-xs sm:text-sm font-bold">
            {isColorTask ? (
              <Palette className="w-4 h-4 text-amber-400 shrink-0" />
            ) : (
              <Type className="w-4 h-4 text-sky-400 shrink-0" />
            )}
            <span>{isColorTask ? t.stroopTaskColor : t.stroopTaskWord}</span>
          </div>

          {/* Stimulus Word rendered in Ink Color */}
          <div className="py-8 sm:py-10 select-none">
            <p
              className="font-display text-5xl sm:text-7xl font-bold tracking-tight leading-tight transition-transform duration-150"
              style={{ color: currentCard.inkColor.inkHex }}
            >
              {isKm ? currentCard.wordColor.labelKm : currentCard.wordColor.labelEn}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              {isKm ? currentCard.wordColor.labelEn : currentCard.wordColor.labelKm}
            </p>
          </div>

          {/* Instant Correct/Wrong Visual Overlay Indicator */}
          {feedback && (
            <div
              className={`absolute top-4 right-4 inline-flex items-center gap-1 text-xs font-bold ${
                feedback === 'correct' ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {feedback === 'correct' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>{t.correctFeedback}</span>
                </>
              ) : (
                <>
                  <X className="w-4 h-4" />
                  <span>{t.wrongFeedback}</span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Color & Word Answer Buttons */}
        <div
          className={`grid gap-3 ${
            paletteSize === 4 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'
          }`}
        >
          {visibleColors.map((colorDef, index) => (
            <button
              key={colorDef.id}
              type="button"
              onClick={() => handleAnswer(colorDef)}
              className="min-h-[64px] px-4 py-3 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500 dark:hover:border-blue-500 active:scale-[0.98] flex items-center justify-between gap-3 transition-all cursor-pointer shadow-sm"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span
                  className="w-8 h-8 rounded-xl shrink-0 border border-black/10"
                  style={{ backgroundColor: colorDef.swatchHex }}
                  aria-hidden="true"
                />
                <span className="text-left min-w-0">
                  <span className="block font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white truncate">
                    {isKm ? colorDef.labelKm : colorDef.labelEn}
                  </span>
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    {isKm ? colorDef.labelEn : colorDef.labelKm}
                  </span>
                </span>
              </span>
              <span className="hidden sm:inline-block font-mono text-xs font-semibold tabular-nums text-slate-400">
                {index + 1}
              </span>
            </button>
          ))}
        </div>

        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          {t.stroopKeyboardHint}
        </p>
      </div>
    );
  }

  // LOBBY STAGE
  const ruleHint =
    ruleMode === 'color'
      ? t.stroopModeColorHint
      : ruleMode === 'word'
      ? t.stroopModeWordHint
      : t.stroopModeMixedHint;

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-7 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.stroopTitle}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {t.stroopDesc}
          </p>
        </div>

        <div className="flex items-center gap-5 text-xs text-slate-600 dark:text-slate-300 shrink-0">
          <div>
            <span className="text-slate-400">{t.stroopBestScoreLabel}: </span>
            <span className="font-mono font-bold tabular-nums text-[#3B82F6] dark:text-blue-400">
              {bestStats.bestScore.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-400">{t.stroopBestStreakLabel}: </span>
            <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {bestStats.bestStreak}x
            </span>
          </div>
        </div>
      </div>

      {/* Live Preview Example Card */}
      <div className="rounded-2xl bg-slate-900 dark:bg-slate-950 border border-slate-800 p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-center sm:text-left">
          <p className="text-xs font-semibold text-slate-400">
            {ruleMode === 'word' ? t.stroopTaskWord : t.stroopTaskColor}
          </p>
          <p className="mt-1 text-xs sm:text-sm text-slate-300 max-w-md">
            {ruleHint}
          </p>
        </div>
        <div className="px-6 py-3 rounded-xl bg-slate-800/80 text-center shrink-0">
          <span
            className="font-display text-3xl sm:text-4xl font-bold"
            style={{ color: '#60A5FA' }}
          >
            {isKm ? 'ក្រហម' : 'RED'}
          </span>
        </div>
      </div>

      {/* Rule Selector */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
          {t.stroopModeLabel}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { id: 'color' as const, label: t.stroopModeColor, icon: Palette },
            { id: 'word' as const, label: t.stroopModeWord, icon: Type },
            { id: 'mixed' as const, label: t.stroopModeMixed, icon: Shuffle },
          ].map((opt) => {
            const Icon = opt.icon;
            const active = ruleMode === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setRuleMode(opt.id)}
                className={`min-h-[48px] px-4 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                  active
                    ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{opt.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Duration & Color Count */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.stroopDurationLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {([30, 45, 60, 0] as const).map((sec) => (
              <button
                key={sec}
                type="button"
                onClick={() => setDurationSec(sec)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  durationSec === sec
                    ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {sec === 0 ? t.stroopEndless : `${sec} ${t.seconds}`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t.stroopDifficultyLabel}
          </p>
          <div className="flex flex-wrap gap-2">
            {([
              { size: 4 as const, label: t.stroop4Colors },
              { size: 6 as const, label: t.stroop6Colors },
            ]).map((item) => (
              <button
                key={item.size}
                type="button"
                onClick={() => setPaletteSize(item.size)}
                className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  paletteSize === item.size
                    ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div className="pt-2">
        <button
          type="button"
          onClick={startRound}
          className="w-full sm:w-auto min-h-[48px] px-7 py-3 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{t.startQuizBtn}</span>
        </button>
      </div>
    </div>
  );
}
