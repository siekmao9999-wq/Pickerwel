'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Shuffle, Eye, EyeOff, RotateCcw, Trash2, Sparkles } from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { getSegmentColors } from '@/lib/palettes';
import { playCardFlipSound, playCorrectSound, playWinSound, triggerHaptic } from '@/lib/sound';
import { QUICK_START_ENTRIES } from '@/lib/templates';
import { COPY } from '@/lib/i18n';

interface CardItem {
  id: string;
  label: string;
  color: string;
  suit: '♠' | '♥' | '♦' | '♣';
  flipped: boolean;
  matched: boolean;
}

const SUITS: ('♠' | '♥' | '♦' | '♣')[] = ['♠', '♥', '♦', '♣'];

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function CardFlipGame() {
  const { activeWheel, logSpinOutcome, settings } = usePickerwel();
  const t = COPY[settings.language];

  const [mode, setMode] = useState<'draw' | 'memory'>('draw');
  const [cards, setCards] = useState<CardItem[]>([]);
  const [selectedPair, setSelectedPair] = useState<string[]>([]);
  const [moves, setMoves] = useState(0);
  const [lockedBoard, setLockedBoard] = useState(false);

  const buildDeck = (nextMode: 'draw' | 'memory') => {
    const source =
      activeWheel.entries.length > 0 ? activeWheel.entries : QUICK_START_ENTRIES;
    const colors = getSegmentColors(source.length, activeWheel.paletteId);

    if (nextMode === 'draw') {
      const deck: CardItem[] = source.map((label, idx) => ({
        id: `draw_${idx}_${Date.now()}`,
        label,
        color: colors[idx] || '#3B82F6',
        suit: SUITS[idx % SUITS.length],
        flipped: false,
        matched: false,
      }));
      setCards(shuffleArray(deck));
    } else {
      const pairBase = source.slice(0, 8);
      const pairColors = getSegmentColors(pairBase.length, activeWheel.paletteId);
      const paired: CardItem[] = [];
      pairBase.forEach((label, idx) => {
        const suit = SUITS[idx % SUITS.length];
        const color = pairColors[idx] || '#3B82F6';
        paired.push(
          { id: `mem_a_${idx}_${Date.now()}`, label, color, suit, flipped: false, matched: false },
          { id: `mem_b_${idx}_${Date.now()}`, label, color, suit, flipped: false, matched: false }
        );
      });
      setCards(shuffleArray(paired));
    }
    setSelectedPair([]);
    setMoves(0);
    setLockedBoard(false);
  };

  useEffect(() => {
    queueMicrotask(() => buildDeck(mode));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWheel.id, activeWheel.entries, activeWheel.paletteId, mode]);

  const handleCardClick = (card: CardItem) => {
    if (lockedBoard || card.matched) return;

    if (mode === 'draw') {
      if (settings.soundEnabled) playCardFlipSound();
      if (settings.hapticsEnabled) triggerHaptic(12);
      const nextFlipped = !card.flipped;
      setCards((prev) =>
        prev.map((c) => (c.id === card.id ? { ...c, flipped: nextFlipped } : c))
      );
      if (nextFlipped) {
        logSpinOutcome({
          winner: card.label,
          winnerColor: card.color,
          removedAfterSpin: false,
        }).catch(() => {});
      }
      return;
    }

    // Memory Match mode
    if (card.flipped) return;
    if (settings.soundEnabled) playCardFlipSound();
    if (settings.hapticsEnabled) triggerHaptic(12);

    const nextCards = cards.map((c) =>
      c.id === card.id ? { ...c, flipped: true } : c
    );
    setCards(nextCards);

    const nextSelection = [...selectedPair, card.id];
    setSelectedPair(nextSelection);

    if (nextSelection.length === 2) {
      setMoves((m) => m + 1);
      setLockedBoard(true);
      const first = nextCards.find((c) => c.id === nextSelection[0]);
      const second = nextCards.find((c) => c.id === nextSelection[1]);

      if (first && second && first.label === second.label) {
        if (settings.soundEnabled) playCorrectSound();
        const updated = nextCards.map((c) =>
          c.id === first.id || c.id === second.id ? { ...c, matched: true } : c
        );
        setCards(updated);
        setSelectedPair([]);
        setLockedBoard(false);

        if (updated.every((c) => c.matched)) {
          if (settings.soundEnabled) playWinSound();
          if (
            settings.confettiEnabled &&
            typeof window !== 'undefined' &&
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ) {
            confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
          }
        }
      } else {
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c) =>
              c.id === nextSelection[0] || c.id === nextSelection[1]
                ? { ...c, flipped: false }
                : c
            )
          );
          setSelectedPair([]);
          setLockedBoard(false);
        }, 700);
      }
    }
  };

  const matchedPairs = cards.filter((c) => c.matched).length / 2;
  const totalPairs = cards.length / 2;
  const memoryComplete = mode === 'memory' && cards.length > 0 && cards.every((c) => c.matched);

  return (
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.cardsTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.cardsDesc}</p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'draw'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.cardModeDraw}
          </button>
          <button
            type="button"
            onClick={() => setMode('memory')}
            className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
              mode === 'memory'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {t.cardModeMemory}
          </button>
        </div>
      </div>

      {/* Felt Card Table */}
      <div className="p-4 sm:p-6 rounded-3xl bg-[#0F5132] dark:bg-slate-900 border border-emerald-900/40 dark:border-slate-800 shadow-inner space-y-4">
        {/* Action Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3 text-xs font-medium tabular-nums">
            {mode === 'memory' ? (
              <>
                <span>
                  {t.movesLabel}: <strong>{moves}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.matchesLabel}: <strong>{matchedPairs}/{totalPairs}</strong>
                </span>
              </>
            ) : (
              <span>{t.entriesCount(cards.length)}</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => buildDeck(mode)}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>{t.shuffle}</span>
            </button>

            {mode === 'draw' && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setCards((prev) => prev.map((c) => ({ ...c, flipped: true })))
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t.revealAllBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCards((prev) => prev.map((c) => ({ ...c, flipped: false })))
                  }
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <EyeOff className="w-3.5 h-3.5" />
                  <span>{t.hideAllBtn}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {memoryComplete ? (
          <div className="py-12 px-4 text-center text-white space-y-3">
            <Sparkles className="w-10 h-10 text-amber-300 mx-auto" />
            <h3 className="font-display text-2xl font-bold">{t.memoryWinTitle}</h3>
            <p className="text-sm text-emerald-100 tabular-nums">
              {t.movesLabel}: {moves}
            </p>
            <button
              type="button"
              onClick={() => buildDeck('memory')}
              className="mt-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-[#0F5132] text-sm font-bold inline-flex items-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.playAgainBtn}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {cards.map((card, idx) => {
              const isRedSuit = card.suit === '♥' || card.suit === '♦';
              return (
                <div key={card.id} className="relative h-32 sm:h-36 [perspective:1000px]">
                  <button
                    type="button"
                    onClick={() => handleCardClick(card)}
                    className={`relative w-full h-full transition-transform duration-300 [transform-style:preserve-3d] cursor-pointer focus-visible:outline-none ${
                      card.flipped || card.matched ? '[transform:rotateY(180deg)]' : ''
                    }`}
                  >
                    {/* Card Back (Face-down) */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] border-2 border-white/80 shadow-md flex flex-col items-center justify-center p-3 [backface-visibility:hidden]">
                      <div className="w-full h-full rounded-xl border border-white/30 flex flex-col items-center justify-center gap-1">
                        <span className="text-white/90 text-xl font-bold">{card.suit}</span>
                        <span className="font-mono text-xs font-semibold text-white/80 tabular-nums">
                          #{idx + 1}
                        </span>
                      </div>
                    </div>

                    {/* Card Front (Revealed) */}
                    <div
                      className={`absolute inset-0 rounded-2xl bg-white dark:bg-slate-800 border-2 shadow-lg flex flex-col justify-between p-3 [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                        card.matched
                          ? 'border-emerald-400 ring-2 ring-emerald-400/50'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className={isRedSuit ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}>
                          {card.suit}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: card.color }}
                        />
                      </div>

                      <p className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white text-center break-words line-clamp-3">
                        {card.label}
                      </p>

                      <div className="flex items-center justify-end text-xs font-bold">
                        <span className={isRedSuit ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}>
                          {card.suit}
                        </span>
                      </div>
                    </div>
                  </button>

                  {mode === 'draw' && card.flipped && cards.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCards((prev) => prev.filter((c) => c.id !== card.id));
                      }}
                      aria-label={t.deleteWheel}
                      className="absolute -top-2 -right-2 z-10 w-7 h-7 rounded-full bg-rose-600 text-white flex items-center justify-center shadow cursor-pointer hover:bg-rose-700"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
