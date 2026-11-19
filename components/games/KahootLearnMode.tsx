'use client';

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Trophy,
  Triangle,
  Diamond,
  Circle,
  Square,
  BookOpenCheck,
} from 'lucide-react';
import { MathText } from '../MathText';
import type { OfflineQuiz, QuizQuestion } from '@/lib/offline-quizzes';
import { COPY, type Language } from '@/lib/i18n';
import { playCorrectSound, playWrongSound, playWinSound, triggerHaptic } from '@/lib/sound';

interface KahootLearnModeProps {
  quiz: OfflineQuiz;
  language: Language;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  hapticsEnabled: boolean;
  onExit: () => void;
  onStartPlaySolo: () => void;
}

const LEARN_TILES = [
  { bg: 'bg-[#E21B3C] hover:bg-rose-700', icon: Triangle, keyLabel: '1' },
  { bg: 'bg-[#1368CE] hover:bg-blue-700', icon: Diamond, keyLabel: '2' },
  { bg: 'bg-[#D89E00] hover:bg-amber-600', icon: Circle, keyLabel: '3' },
  { bg: 'bg-[#26890C] hover:bg-emerald-700', icon: Square, keyLabel: '4' },
];

export function KahootLearnMode({
  quiz,
  language,
  soundEnabled,
  confettiEnabled,
  hapticsEnabled,
  onExit,
  onStartPlaySolo,
}: KahootLearnModeProps) {
  const t = COPY[language];
  const totalQuestions = quiz.questions.length;

  const [queue, setQueue] = useState<QuizQuestion[]>(() => [...quiz.questions]);
  const [masteredIds, setMasteredIds] = useState<string[]>([]);
  const [retryIds, setRetryIds] = useState<string[]>([]);
  const [chosenOpt, setChosenOpt] = useState<number | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [correctAttempts, setCorrectAttempts] = useState(0);

  const currentQ = queue[0] ?? null;
  const isComplete = queue.length === 0;
  const isRetryCard = Boolean(currentQ && retryIds.includes(currentQ.id));

  const handleRestart = () => {
    setQueue([...quiz.questions]);
    setMasteredIds([]);
    setRetryIds([]);
    setChosenOpt(null);
    setAttempts(0);
    setCorrectAttempts(0);
  };

  const handleChoose = useCallback(
    (optIdx: number) => {
      if (!currentQ || chosenOpt !== null) return;
      setChosenOpt(optIdx);
      setAttempts((a) => a + 1);
      const isCorrect = optIdx === currentQ.correctIndex;
      if (isCorrect) {
        setCorrectAttempts((c) => c + 1);
        if (soundEnabled) playCorrectSound();
        if (hapticsEnabled) triggerHaptic(20);
      } else {
        if (soundEnabled) playWrongSound();
        if (hapticsEnabled) triggerHaptic([35, 25, 35]);
      }
    },
    [chosenOpt, currentQ, hapticsEnabled, soundEnabled]
  );

  const handleContinue = useCallback(() => {
    if (!currentQ || chosenOpt === null) return;
    const isCorrect = chosenOpt === currentQ.correctIndex;
    const rest = queue.slice(1);

    if (isCorrect) {
      const nextMastered = masteredIds.includes(currentQ.id)
        ? masteredIds
        : [...masteredIds, currentQ.id];
      setMasteredIds(nextMastered);
      setQueue(rest);
      if (rest.length === 0) {
        if (soundEnabled) playWinSound();
        if (
          confettiEnabled &&
          typeof window !== 'undefined' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          confetti({ particleCount: 95, spread: 72, origin: { y: 0.54 } });
        }
      }
    } else {
      setRetryIds((prev) => (prev.includes(currentQ.id) ? prev : [...prev, currentQ.id]));
      setQueue([...rest, currentQ]);
    }
    setChosenOpt(null);
  }, [chosenOpt, confettiEnabled, currentQ, masteredIds, queue, soundEnabled]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isComplete) return;
      if (chosenOpt === null) {
        if (['1', '2', '3', '4'].includes(e.key)) {
          handleChoose(Number(e.key) - 1);
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleContinue();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [chosenOpt, handleChoose, handleContinue, isComplete]);

  if (isComplete) {
    const accuracy = attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : 100;
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#1368CE] to-[#0D47A1] text-white text-center space-y-5 shadow-xl">
        <Trophy className="w-12 h-12 text-amber-300 mx-auto" />
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            {t.kahootLearnCompleteTitle}
          </h2>
          <p className="text-sm text-blue-100">{t.kahootLearnCompleteDesc}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <div className="p-3.5 rounded-2xl bg-white/15">
            <p className="text-xs text-blue-100">{t.accuracyLabel}</p>
            <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">{accuracy}%</p>
          </div>
          <div className="p-3.5 rounded-2xl bg-white/15">
            <p className="text-xs text-blue-100">{t.kahootLearnTitle}</p>
            <p className="font-mono text-2xl font-bold tabular-nums mt-0.5">
              {masteredIds.length}/{totalQuestions}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-[#1368CE] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.playAgainBtn}</span>
          </button>
          <button
            type="button"
            onClick={onStartPlaySolo}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 text-sm font-bold cursor-pointer"
          >
            {t.kahootPlaySoloBtn}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-sm font-semibold cursor-pointer"
          >
            {t.kahootBackToStudio}
          </button>
        </div>
      </div>
    );
  }

  const progressPct = totalQuestions > 0 ? Math.round((masteredIds.length / totalQuestions) * 100) : 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-[#1368CE] text-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 text-blue-100 hover:text-white font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.kahootBackToStudio}</span>
          </button>

          <div className="flex items-center gap-2 font-semibold">
            <BookOpenCheck className="w-4 h-4 text-amber-300" />
            <span>{t.kahootLearnTitle}</span>
          </div>

          <span className="font-mono tabular-nums font-bold">
            {t.kahootLearnMastered(masteredIds.length, totalQuestions)}
          </span>
        </div>

        <div className="h-2 w-full rounded-full bg-blue-950/60 overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Question Stage */}
      {currentQ && (
        <div className="p-5 sm:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{t.kahootLearnHint}</span>
            {isRetryCard && (
              <span className="font-semibold text-amber-600 dark:text-amber-400 shrink-0">
                · {t.kahootLearnRetryBadge}
              </span>
            )}
          </div>

          <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white text-center leading-snug">
            <MathText text={currentQ.prompt} />
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {currentQ.options.map((opt, idx) => {
              const tile = LEARN_TILES[idx];
              const ShapeIcon = tile.icon;
              const revealed = chosenOpt !== null;
              const isCorrect = idx === currentQ.correctIndex;
              const isChosen = chosenOpt === idx;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={revealed}
                  onClick={() => handleChoose(idx)}
                  className={`min-h-[74px] p-4 rounded-2xl text-white font-semibold text-sm sm:text-base flex items-center justify-between gap-3 shadow-md transition-all cursor-pointer ${
                    tile.bg
                  } ${
                    revealed
                      ? isCorrect
                        ? 'ring-4 ring-emerald-400 scale-[1.01]'
                        : isChosen
                        ? 'opacity-85 ring-4 ring-rose-300'
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
                  {revealed && isCorrect && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                  {revealed && isChosen && !isCorrect && <XCircle className="w-5 h-5 shrink-0" />}
                </button>
              );
            })}
          </div>

          {chosenOpt !== null && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-sm font-bold">
                {chosenOpt === currentQ.correctIndex ? (
                  <span className="text-emerald-600 dark:text-emerald-400">
                    {t.correctFeedback}
                  </span>
                ) : (
                  <span className="text-rose-600 dark:text-rose-400">
                    {t.wrongFeedback} · {t.correctAnswerLabel}:{' '}
                    <span className="text-slate-900 dark:text-white">
                      <MathText text={currentQ.options[currentQ.correctIndex]} />
                    </span>
                  </span>
                )}
              </p>

              <button
                type="button"
                onClick={handleContinue}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1368CE] hover:bg-blue-700 text-white text-sm font-bold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <span>{t.kahootLearnContinueBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
