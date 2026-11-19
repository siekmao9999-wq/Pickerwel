'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  RotateCcw,
  Shuffle,
  CheckCircle2,
  Layers,
  Trophy,
} from 'lucide-react';
import { MathText } from '../MathText';
import type { OfflineQuiz, QuizQuestion } from '@/lib/offline-quizzes';
import { COPY, type Language } from '@/lib/i18n';
import { playCorrectSound, playTickSound, playWinSound, triggerHaptic } from '@/lib/sound';

interface KahootFlashcardsModeProps {
  quiz: OfflineQuiz;
  language: Language;
  soundEnabled: boolean;
  confettiEnabled: boolean;
  hapticsEnabled: boolean;
  onExit: () => void;
  onStartLearn: () => void;
  onStartPlaySolo: () => void;
}

export function KahootFlashcardsMode({
  quiz,
  language,
  soundEnabled,
  confettiEnabled,
  hapticsEnabled,
  onExit,
  onStartLearn,
  onStartPlaySolo,
}: KahootFlashcardsModeProps) {
  const t = COPY[language];
  const totalCount = quiz.questions.length;

  const [deck, setDeck] = useState<QuizQuestion[]>(() => [...quiz.questions]);
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [masteredIds, setMasteredIds] = useState<string[]>([]);

  const activeCard = deck[cardIdx] ?? null;
  const isComplete = deck.length === 0;

  const handleRestart = () => {
    setDeck([...quiz.questions]);
    setCardIdx(0);
    setFlipped(false);
    setMasteredIds([]);
  };

  const handleShuffle = () => {
    setDeck((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });
    setCardIdx(0);
    setFlipped(false);
    if (soundEnabled) playTickSound(0.2);
  };

  const handleFlip = useCallback(() => {
    if (!activeCard) return;
    setFlipped((f) => !f);
    if (soundEnabled) playTickSound(0.25);
    if (hapticsEnabled) triggerHaptic(12);
  }, [activeCard, hapticsEnabled, soundEnabled]);

  const handlePrev = useCallback(() => {
    if (deck.length <= 1) return;
    setFlipped(false);
    setCardIdx((i) => (i - 1 + deck.length) % deck.length);
  }, [deck.length]);

  const handleNext = useCallback(() => {
    if (deck.length <= 1) return;
    setFlipped(false);
    setCardIdx((i) => (i + 1) % deck.length);
  }, [deck.length]);

  const handleGotIt = () => {
    if (!activeCard) return;
    if (soundEnabled) playCorrectSound();
    if (hapticsEnabled) triggerHaptic(20);
    const nextMastered = masteredIds.includes(activeCard.id)
      ? masteredIds
      : [...masteredIds, activeCard.id];
    const nextDeck = deck.filter((_, idx) => idx !== cardIdx);
    setMasteredIds(nextMastered);
    setDeck(nextDeck);
    setCardIdx(nextDeck.length > 0 ? cardIdx % nextDeck.length : 0);
    setFlipped(false);

    if (nextDeck.length === 0) {
      if (soundEnabled) playWinSound();
      if (
        confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({ particleCount: 95, spread: 70, origin: { y: 0.54 } });
      }
    }
  };

  const handleStudyAgain = () => {
    if (!activeCard) return;
    if (soundEnabled) playTickSound(0.18);
    if (deck.length > 1) {
      const moved = [...deck.slice(0, cardIdx), ...deck.slice(cardIdx + 1), activeCard];
      setDeck(moved);
      setCardIdx(cardIdx % moved.length);
    }
    setFlipped(false);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isComplete) return;
      if (e.key === ' ') {
        e.preventDefault();
        handleFlip();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleFlip, handleNext, handlePrev, isComplete]);

  if (isComplete) {
    return (
      <div className="max-w-2xl mx-auto p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-[#46178F] to-[#25076B] text-white text-center space-y-5 shadow-xl">
        <Trophy className="w-12 h-12 text-amber-300 mx-auto" />
        <div className="space-y-1.5">
          <h2 className="font-display text-2xl sm:text-3xl font-bold">
            {t.kahootFlashCompleteTitle}
          </h2>
          <p className="text-sm text-purple-100">{t.kahootFlashCompleteDesc}</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleRestart}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-[#46178F] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.kahootFlashRestart}</span>
          </button>
          <button
            type="button"
            onClick={onStartLearn}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#1368CE] hover:bg-blue-600 text-white text-sm font-bold cursor-pointer"
          >
            {t.kahootLearnBtn}
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

  const progressPct = totalCount > 0 ? Math.round((masteredIds.length / totalCount) * 100) : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Header Bar */}
      <div className="p-4 rounded-2xl bg-[#46178F] text-white space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-1.5 text-purple-200 hover:text-white font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.kahootBackToStudio}</span>
          </button>

          <div className="flex items-center gap-2 font-semibold">
            <Layers className="w-4 h-4 text-amber-300" />
            <span>{t.kahootFlashcardsTitle}</span>
          </div>

          <div className="flex items-center gap-3 font-mono tabular-nums">
            <span className="font-bold">
              {cardIdx + 1}/{deck.length}
            </span>
            <button
              type="button"
              onClick={handleShuffle}
              title={t.kahootFlashShuffle}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.kahootFlashShuffle}</span>
            </button>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-purple-950 overflow-hidden">
          <div
            className="h-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Flip Card */}
      {activeCard && (
        <div className="space-y-4">
          <AnimatePresence mode="wait">
            <motion.button
              key={`${activeCard.id}-${flipped ? 'back' : 'front'}`}
              type="button"
              onClick={handleFlip}
              initial={{ opacity: 0, rotateX: -12, scale: 0.98 }}
              animate={{ opacity: 1, rotateX: 0, scale: 1 }}
              exit={{ opacity: 0, rotateX: 12, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={`w-full min-h-[300px] sm:min-h-[340px] p-6 sm:p-9 rounded-3xl border shadow-lg text-center flex flex-col items-center justify-between gap-6 cursor-pointer transition-colors ${
                flipped
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                  : 'bg-gradient-to-br from-[#5A18B8] via-[#46178F] to-[#2B0C63] border-purple-700 text-white'
              }`}
            >
              <div className="w-full flex items-center justify-between text-xs font-semibold">
                <span className={flipped ? 'text-emerald-700 dark:text-emerald-300' : 'text-purple-200'}>
                  {flipped ? t.kahootFlashBackLabel : t.kahootFlashFrontLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 ${
                    flipped ? 'text-emerald-700 dark:text-emerald-300' : 'text-purple-200'
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Flip</span>
                </span>
              </div>

              {!flipped ? (
                <div className="space-y-4 max-w-xl">
                  <div className="px-5 py-4 rounded-2xl bg-white/95 text-slate-900 font-display text-lg sm:text-2xl font-bold shadow-sm">
                    <MathText text={activeCard.prompt} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4 w-full max-w-lg">
                  <div className="p-4 rounded-2xl bg-emerald-600 text-white font-display text-xl sm:text-2xl font-bold shadow-sm flex items-center justify-center gap-2.5">
                    <CheckCircle2 className="w-6 h-6 shrink-0" />
                    <span>
                      <MathText text={activeCard.options[activeCard.correctIndex]} />
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-left text-xs">
                    {activeCard.options.map((opt, idx) => (
                      <div
                        key={idx}
                        className={`px-3 py-2 rounded-xl border ${
                          idx === activeCard.correctIndex
                            ? 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 text-emerald-900 dark:text-emerald-100 font-bold'
                            : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        <MathText text={opt} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <p
                className={`text-xs ${
                  flipped ? 'text-emerald-700/80 dark:text-emerald-300/80' : 'text-purple-200/90'
                }`}
              >
                {t.kahootFlashTapToFlip}
              </p>
            </motion.button>
          </AnimatePresence>

          {/* Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={deck.length <= 1}
                aria-label="Previous card"
                className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={deck.length <= 1}
                aria-label="Next card"
                className="min-h-[42px] min-w-[42px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 inline-flex items-center justify-center cursor-pointer disabled:opacity-40"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="flex items-center gap-2.5 flex-1 sm:flex-initial justify-end">
              <button
                type="button"
                onClick={handleStudyAgain}
                className="min-h-[42px] px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-800 dark:text-amber-200 text-xs sm:text-sm font-semibold cursor-pointer whitespace-nowrap"
              >
                {t.kahootFlashStudyAgain}
              </button>
              <button
                type="button"
                onClick={handleGotIt}
                className="min-h-[42px] px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{t.kahootFlashGotIt}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
