'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shuffle, Layers, RotateCcw, Sparkles, Check } from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { playCardFlipSound, playCorrectSound, triggerHaptic } from '@/lib/sound';
import { COPY } from '@/lib/i18n';

export type CardSuit = '♠' | '♥' | '♦' | '♣' | '★';
export type CardRank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'
  | 'JOKER';

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: CardRank;
  isRed: boolean;
  faceUp: boolean;
}

const SUITS: { symbol: Exclude<CardSuit, '★'>; isRed: boolean }[] = [
  { symbol: '♠', isRed: false },
  { symbol: '♥', isRed: true },
  { symbol: '♣', isRed: false },
  { symbol: '♦', isRed: true },
];

const RANKS: Exclude<CardRank, 'JOKER'>[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
];

const STORAGE_KEY = 'pickerwel_virtual_deck_v1';

function createOrderedDeck(includeJokers: boolean): PlayingCard[] {
  const cards: PlayingCard[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${suit.symbol}_${rank}`,
        suit: suit.symbol,
        rank,
        isRed: suit.isRed,
        faceUp: false,
      });
    }
  }
  if (includeJokers) {
    cards.push(
      { id: 'joker_red', suit: '★', rank: 'JOKER', isRed: true, faceUp: false },
      { id: 'joker_black', suit: '★', rank: 'JOKER', isRed: false, faceUp: false }
    );
  }
  return cards;
}

function fisherYatesShuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface PersistedDeckState {
  deck: PlayingCard[];
  drawn: PlayingCard[];
  includeJokers: boolean;
}

function loadSavedDeck(): PersistedDeckState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedDeckState>;
    if (!Array.isArray(parsed.deck) || !Array.isArray(parsed.drawn)) return null;
    return {
      deck: parsed.deck,
      drawn: parsed.drawn.map((c) => ({ ...c, faceUp: true })),
      includeJokers: Boolean(parsed.includeJokers),
    };
  } catch {
    return null;
  }
}

function saveDeckState(state: PersistedDeckState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

export function VirtualDeckGame() {
  const { settings } = usePickerwel();
  const t = COPY[settings.language];

  const [includeJokers, setIncludeJokers] = useState(false);
  const [deck, setDeck] = useState<PlayingCard[]>(() => createOrderedDeck(false));
  const [drawn, setDrawn] = useState<PlayingCard[]>([]);
  const [isShuffling, setIsShuffling] = useState(false);
  const [shuffledNotice, setShuffledNotice] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const flipTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shuffleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimers = useCallback(() => {
    flipTimersRef.current.forEach((id) => clearTimeout(id));
    flipTimersRef.current = [];
    if (shuffleTimerRef.current) {
      clearTimeout(shuffleTimerRef.current);
      shuffleTimerRef.current = null;
    }
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      const saved = loadSavedDeck();
      if (saved && (saved.deck.length > 0 || saved.drawn.length > 0)) {
        setIncludeJokers(saved.includeJokers);
        setDeck(saved.deck);
        setDrawn(saved.drawn);
      } else {
        const fresh = fisherYatesShuffle(createOrderedDeck(false));
        setDeck(fresh);
      }
      setHydrated(true);
    });
    return () => clearPendingTimers();
  }, [clearPendingTimers]);

  useEffect(() => {
    if (!hydrated) return;
    saveDeckState({ deck, drawn, includeJokers });
  }, [deck, drawn, includeJokers, hydrated]);

  const handleReshuffle = useCallback(
    (nextJokers = includeJokers) => {
      clearPendingTimers();
      setIsShuffling(true);
      setShuffledNotice(false);

      if (settings.soundEnabled) playCardFlipSound();
      if (settings.hapticsEnabled) triggerHaptic([20, 25, 20]);

      const freshDeck = fisherYatesShuffle(createOrderedDeck(nextJokers));

      shuffleTimerRef.current = setTimeout(() => {
        setDeck(freshDeck);
        setDrawn([]);
        setIsShuffling(false);
        setShuffledNotice(true);
        if (settings.soundEnabled) playCorrectSound();

        noticeTimerRef.current = setTimeout(() => {
          setShuffledNotice(false);
        }, 2000);
      }, 320);
    },
    [clearPendingTimers, includeJokers, settings.hapticsEnabled, settings.soundEnabled]
  );

  const handleToggleJokers = () => {
    const next = !includeJokers;
    setIncludeJokers(next);
    handleReshuffle(next);
  };

  const handleDrawCards = (count: number) => {
    if (isShuffling || deck.length === 0) return;
    const takeCount = Math.min(count, deck.length);
    const picked = deck.slice(0, takeCount).map((card) => ({ ...card, faceUp: false }));
    const remaining = deck.slice(takeCount);

    setDeck(remaining);
    setDrawn((prev) => [...picked.reverse(), ...prev]);

    if (settings.soundEnabled) playCardFlipSound();
    if (settings.hapticsEnabled) triggerHaptic(18);

    picked.forEach((card, idx) => {
      const timer = setTimeout(() => {
        setDrawn((prev) =>
          prev.map((item) => (item.id === card.id ? { ...item, faceUp: true } : item))
        );
        if (idx > 0 && settings.soundEnabled) {
          playCardFlipSound();
        }
      }, 70 + idx * 140);
      flipTimersRef.current.push(timer);
    });
  };

  const toggleDrawnCardFlip = (cardId: string) => {
    if (settings.soundEnabled) playCardFlipSound();
    if (settings.hapticsEnabled) triggerHaptic(10);
    setDrawn((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, faceUp: !card.faceUp } : card
      )
    );
  };

  const totalCards = includeJokers ? 54 : 52;
  const latestCard = drawn[0] || null;
  const stackLayers = Math.min(4, Math.ceil(deck.length / 13));

  return (
    <div className="space-y-4">
      {/* Header + Deck Options */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.deckTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{t.deckDesc}</p>
        </div>

        <button
          type="button"
          onClick={handleToggleJokers}
          className={`min-h-[40px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer self-start whitespace-nowrap ${
            includeJokers
              ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span>{t.deckIncludeJokers}</span>
        </button>
      </div>

      {/* Felt Card Table */}
      <div className="p-4 sm:p-6 rounded-3xl bg-[#0F5132] dark:bg-slate-900 border border-emerald-900/40 dark:border-slate-800 shadow-inner space-y-6">
        {/* Table HUD & Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-white">
          <div className="flex items-center gap-3 text-xs sm:text-sm font-medium tabular-nums">
            <span>
              {t.deckRemainingLabel}:{' '}
              <strong className="font-mono">
                {deck.length}/{totalCards}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {t.deckDrawnLabel}: <strong className="font-mono">{drawn.length}</strong>
            </span>
            {shuffledNotice && (
              <>
                <span aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                  <Check className="w-3.5 h-3.5" />
                  <span>{t.deckShuffledNotice}</span>
                </span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleDrawCards(1)}
              disabled={deck.length === 0 || isShuffling}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-white text-[#0F5132] hover:bg-emerald-50 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{t.deckDrawOneBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => handleDrawCards(3)}
              disabled={deck.length === 0 || isShuffling}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {t.deckDrawThreeBtn}
            </button>

            <button
              type="button"
              onClick={() => handleDrawCards(5)}
              disabled={deck.length === 0 || isShuffling}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {t.deckDrawFiveBtn}
            </button>

            <button
              type="button"
              onClick={() => handleReshuffle()}
              disabled={isShuffling}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Shuffle className={`w-3.5 h-3.5 ${isShuffling ? 'animate-spin' : ''}`} />
              <span>{t.deckReshuffleBtn}</span>
            </button>
          </div>
        </div>

        {/* Center Deal Zone: Draw Stack + Latest Revealed Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center py-2">
          {/* Left: Stacked Virtual Deck */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="relative w-40 h-56 sm:w-44 sm:h-60">
              {deck.length > 0 ? (
                <>
                  {/* Visual Stack Layers */}
                  {Array.from({ length: stackLayers }).map((_, idx) => (
                    <div
                      key={idx}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-2xl bg-indigo-900 border border-white/30 shadow-md"
                      style={{
                        transform: `translate(${(stackLayers - idx) * 3}px, ${
                          (stackLayers - idx) * 3
                        }px)`,
                      }}
                    />
                  ))}

                  {/* Interactive Top Card of Deck */}
                  <motion.button
                    type="button"
                    onClick={() => handleDrawCards(1)}
                    animate={
                      isShuffling
                        ? {
                            x: [0, -14, 14, -8, 0],
                            rotate: [0, -5, 5, -2, 0],
                          }
                        : { x: 0, rotate: 0 }
                    }
                    transition={{ duration: 0.3 }}
                    whileHover={{ y: -4 }}
                    whileTap={{ scale: 0.97 }}
                    aria-label={t.deckDrawOneBtn}
                    className="relative w-full h-full rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] border-2 border-white/90 shadow-xl p-3 flex flex-col items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                  >
                    <div className="w-full h-full rounded-xl border border-white/35 flex flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.16)_0%,transparent_70%)]">
                      <span className="text-3xl text-white/95 tracking-widest">♠ ♥</span>
                      <span className="font-mono text-2xl font-bold text-white tabular-nums">
                        {deck.length}
                      </span>
                      <span className="text-[11px] font-semibold text-white/85 px-2 text-center">
                        {t.deckDrawOneBtn}
                      </span>
                    </div>
                  </motion.button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => handleReshuffle()}
                  className="w-full h-full rounded-2xl border-2 border-dashed border-white/40 bg-white/5 hover:bg-white/10 text-white flex flex-col items-center justify-center gap-3 p-4 text-center cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-8 h-8 text-amber-300" />
                  <span className="text-xs font-semibold leading-relaxed">
                    {t.deckEmptyMsg}
                  </span>
                  <span className="px-3 py-1.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold">
                    {t.deckReshuffleBtn}
                  </span>
                </button>
              )}
            </div>
            <p className="text-xs text-emerald-100/85 text-center">
              {deck.length > 0 ? t.deckTapPrompt : t.deckEmptyMsg}
            </p>
          </div>

          {/* Right: Latest Picked Card Showcase with 3D Flip */}
          <div className="flex flex-col items-center justify-center gap-3">
            <div className="w-40 h-56 sm:w-44 sm:h-60 [perspective:1100px]">
              <AnimatePresence mode="wait">
                {latestCard ? (
                  <motion.button
                    key={latestCard.id}
                    type="button"
                    onClick={() => toggleDrawnCardFlip(latestCard.id)}
                    initial={{ opacity: 0, x: -36, scale: 0.92 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    transition={{ duration: 0.22 }}
                    className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] cursor-pointer focus-visible:outline-none ${
                      latestCard.faceUp ? '[transform:rotateY(180deg)]' : ''
                    }`}
                  >
                    {/* Back */}
                    <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] border-2 border-white/85 shadow-xl p-3 [backface-visibility:hidden]">
                      <div className="w-full h-full rounded-xl border border-white/30 flex items-center justify-center text-white/90 text-2xl">
                        ♦ ♣
                      </div>
                    </div>

                    {/* Front */}
                    <div className="absolute inset-0 rounded-2xl bg-white border-2 border-slate-200 shadow-2xl p-3.5 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)]">
                      <div
                        className={`flex flex-col items-start leading-none font-bold ${
                          latestCard.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        <span className="font-mono text-xl sm:text-2xl tabular-nums">
                          {latestCard.rank === 'JOKER' ? '★' : latestCard.rank}
                        </span>
                        <span className="text-lg">{latestCard.suit}</span>
                      </div>

                      <div
                        className={`flex flex-col items-center justify-center ${
                          latestCard.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        <span className="text-5xl sm:text-6xl leading-none">
                          {latestCard.suit}
                        </span>
                        {latestCard.rank === 'JOKER' && (
                          <span className="mt-1 font-mono text-xs font-bold tracking-wider">
                            JOKER
                          </span>
                        )}
                      </div>

                      <div
                        className={`flex flex-col items-end leading-none font-bold rotate-180 ${
                          latestCard.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        <span className="font-mono text-xl sm:text-2xl tabular-nums">
                          {latestCard.rank === 'JOKER' ? '★' : latestCard.rank}
                        </span>
                        <span className="text-lg">{latestCard.suit}</span>
                      </div>
                    </div>
                  </motion.button>
                ) : (
                  <div className="w-full h-full rounded-2xl border-2 border-dashed border-white/25 bg-black/10 flex flex-col items-center justify-center p-4 text-center text-emerald-100/75 text-xs">
                    <span className="text-2xl mb-2 opacity-60">♠ ♥ ♦ ♣</span>
                    <span>{t.deckLastPickedLabel}</span>
                  </div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-xs text-emerald-100/85">
              {latestCard
                ? `${t.deckLastPickedLabel}: ${
                    latestCard.rank === 'JOKER'
                      ? 'JOKER ★'
                      : `${latestCard.rank} ${latestCard.suit}`
                  }`
                : t.deckLastPickedLabel}
            </p>
          </div>
        </div>

        {/* Drawn Cards Grid */}
        <div className="pt-4 border-t border-white/15 space-y-3">
          <div className="flex items-center justify-between text-xs text-emerald-100">
            <span className="font-semibold">{t.deckHistoryLabel}</span>
            <span className="font-mono tabular-nums">{drawn.length}</span>
          </div>

          {drawn.length === 0 ? (
            <p className="py-6 text-center text-xs sm:text-sm text-emerald-100/75">
              {t.deckNoDrawnYet}
            </p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
              {drawn.map((card, index) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => toggleDrawnCardFlip(card.id)}
                  aria-label={`${card.rank} ${card.suit}`}
                  className="relative h-28 sm:h-32 [perspective:900px] cursor-pointer focus-visible:outline-none"
                >
                  <div
                    className={`relative w-full h-full transition-transform duration-500 [transform-style:preserve-3d] ${
                      card.faceUp ? '[transform:rotateY(180deg)]' : ''
                    }`}
                  >
                    {/* Face-down Back */}
                    <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] border border-white/80 shadow flex items-center justify-center [backface-visibility:hidden]">
                      <span className="text-white/85 text-lg">♠</span>
                    </div>

                    {/* Face-up Playing Card */}
                    <div
                      className={`absolute inset-0 rounded-xl bg-white shadow-md p-2 flex flex-col justify-between [backface-visibility:hidden] [transform:rotateY(180deg)] ${
                        index === 0
                          ? 'ring-2 ring-amber-400 border border-amber-400'
                          : 'border border-slate-200'
                      }`}
                    >
                      <div
                        className={`flex items-center justify-between text-xs font-bold leading-none ${
                          card.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        <span className="font-mono tabular-nums">
                          {card.rank === 'JOKER' ? '★' : card.rank}
                        </span>
                        <span>{card.suit}</span>
                      </div>

                      <div
                        className={`text-2xl sm:text-3xl text-center leading-none ${
                          card.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        {card.suit}
                      </div>

                      <div
                        className={`flex items-center justify-between text-xs font-bold leading-none rotate-180 ${
                          card.isRed ? 'text-rose-600' : 'text-slate-900'
                        }`}
                      >
                        <span className="font-mono tabular-nums">
                          {card.rank === 'JOKER' ? '★' : card.rank}
                        </span>
                        <span>{card.suit}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
