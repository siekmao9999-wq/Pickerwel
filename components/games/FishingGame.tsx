'use client';

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { Anchor, RotateCcw, Trash2, Fish } from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { getSegmentColors } from '@/lib/palettes';
import { playSplashSound, playTickSound, playWinSound, triggerHaptic } from '@/lib/sound';
import { QUICK_START_ENTRIES } from '@/lib/templates';
import { COPY } from '@/lib/i18n';

interface SwimmingFish {
  id: string;
  label: string;
  color: string;
  x: number; // 0..100 (%)
  y: number; // 24..86 (%)
  speed: number;
  dir: 1 | -1;
  phase: number;
}

type FishingPhase = 'IDLE' | 'CASTING' | 'REELING' | 'CAUGHT';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

export function FishingGame() {
  const { activeWheel, updateActiveWheel, logSpinOutcome, settings } = usePickerwel();
  const t = COPY[settings.language];

  const [pondEntries, setPondEntries] = useState<string[]>(() =>
    activeWheel.entries.length > 0 ? [...activeWheel.entries] : [...QUICK_START_ENTRIES]
  );
  const [fishList, setFishList] = useState<SwimmingFish[]>([]);
  const [phase, setPhase] = useState<FishingPhase>('IDLE');
  const [hookPos, setHookPos] = useState<{ x: number; y: number }>({ x: 50, y: 6 });
  const [hookedFishId, setHookedFishId] = useState<string | null>(null);
  const [caughtFish, setCaughtFish] = useState<SwimmingFish | null>(null);
  const [catchCount, setCatchCount] = useState(0);
  const [splashPos, setSplashPos] = useState<{ x: number; y: number; key: number } | null>(null);

  const swimRafRef = useRef<number | null>(null);
  const hookRafRef = useRef<number | null>(null);
  const fishListRef = useRef<SwimmingFish[]>([]);
  const splashKeyRef = useRef(1);

  useEffect(() => {
    fishListRef.current = fishList;
  }, [fishList]);

  // Sync pond when active wheel changes
  useEffect(() => {
    const source =
      activeWheel.entries.length > 0 ? activeWheel.entries : QUICK_START_ENTRIES;
    const colors = getSegmentColors(source.length, activeWheel.paletteId);
    queueMicrotask(() => {
      if (hookRafRef.current) cancelAnimationFrame(hookRafRef.current);
      setPondEntries([...source]);
      setFishList(
        source.map((label, idx) => ({
          id: `fish_${idx}_${label}`,
          label,
          color: colors[idx] || '#3B82F6',
          x: 10 + ((idx * 19) % 80),
          y: 28 + ((idx * 13) % 54),
          speed: 0.045 + (idx % 4) * 0.015,
          dir: idx % 2 === 0 ? 1 : -1,
          phase: idx * 0.9,
        }))
      );
      setPhase('IDLE');
      setHookedFishId(null);
      setCaughtFish(null);
      setHookPos({ x: 50, y: 6 });
      setSplashPos(null);
    });
  }, [activeWheel.id, activeWheel.entries, activeWheel.paletteId]);

  // Smooth swimming animation
  useEffect(() => {
    if (fishList.length === 0) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(48, now - last);
      last = now;

      setFishList((prev) =>
        prev.map((f) => {
          // Freeze horizontal swim if this fish is hooked or caught
          if (
            (phase === 'REELING' || phase === 'CAUGHT') &&
            (hookedFishId === f.id || caughtFish?.id === f.id)
          ) {
            return f;
          }
          let nextX = f.x + f.dir * f.speed * (dt / 16);
          let nextDir = f.dir;
          if (nextX > 90) {
            nextX = 90;
            nextDir = -1;
          } else if (nextX < 10) {
            nextX = 10;
            nextDir = 1;
          }
          return {
            ...f,
            x: nextX,
            dir: nextDir,
            phase: f.phase + 0.03 * (dt / 16),
          };
        })
      );

      swimRafRef.current = requestAnimationFrame(tick);
    };
    swimRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (swimRafRef.current) cancelAnimationFrame(swimRafRef.current);
    };
  }, [fishList.length, phase, hookedFishId, caughtFish?.id]);

  useEffect(() => {
    return () => {
      if (hookRafRef.current) cancelAnimationFrame(hookRafRef.current);
    };
  }, []);

  const revealCaughtFish = (target: SwimmingFish) => {
    setCaughtFish(target);
    setCatchCount((c) => c + 1);
    setPhase('CAUGHT');
    if (settings.soundEnabled) playWinSound();
    if (settings.hapticsEnabled) triggerHaptic([40, 30, 80]);
    if (
      settings.confettiEnabled &&
      typeof window !== 'undefined' &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      confetti({
        particleCount: 70,
        spread: 65,
        origin: { y: 0.55 },
        colors: [target.color, '#3B82F6', '#FBBF24', '#10B981'],
      });
    }
  };

  const catchTargetFish = (target: SwimmingFish) => {
    if (phase !== 'IDLE' || fishList.length === 0) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setHookPos({ x: target.x, y: target.y });
      setHookedFishId(target.id);
      revealCaughtFish(target);
      return;
    }

    setPhase('CASTING');
    setHookedFishId(null);
    setHookPos({ x: 50, y: 6 });

    if (settings.soundEnabled) playSplashSound();
    if (settings.hapticsEnabled) triggerHaptic(18);

    const startX = 50;
    const startY = 6;
    const castDuration = 480;
    const reelDuration = 760;
    const castStart = performance.now();
    let splashed = false;
    let reelStart = 0;
    let biteX = target.x;
    let biteY = target.y;

    const animateCastAndReel = (now: number) => {
      const castElapsed = now - castStart;
      if (castElapsed < castDuration) {
        const p = easeOutCubic(castElapsed / castDuration);
        const liveFish =
          fishListRef.current.find((f) => f.id === target.id) || target;
        const curX = startX + (liveFish.x - startX) * p;
        const curY = startY + (liveFish.y - startY) * p;
        setHookPos({ x: curX, y: curY });

        if (!splashed && curY >= 14) {
          splashed = true;
          setSplashPos({ x: curX, y: 14, key: splashKeyRef.current++ });
        }

        hookRafRef.current = requestAnimationFrame(animateCastAndReel);
        return;
      }

      // Hook latched onto the fish — begin REELING phase
      if (reelStart === 0) {
        const latchedFish =
          fishListRef.current.find((f) => f.id === target.id) || target;
        biteX = latchedFish.x;
        biteY = latchedFish.y;
        reelStart = now;
        setPhase('REELING');
        setHookedFishId(target.id);
        if (settings.soundEnabled) playTickSound();
        if (settings.hapticsEnabled) triggerHaptic(22);
      }

      const reelElapsed = now - reelStart;
      if (reelElapsed < reelDuration) {
        const rp = easeInOutQuad(reelElapsed / reelDuration);
        const curX = biteX + (50 - biteX) * rp;
        const curY = biteY + (14 - biteY) * rp;
        setHookPos({ x: curX, y: curY });
        setFishList((prev) =>
          prev.map((f) =>
            f.id === target.id ? { ...f, x: curX, y: curY } : f
          )
        );
        hookRafRef.current = requestAnimationFrame(animateCastAndReel);
        return;
      }

      // Reached surface
      setHookPos({ x: 50, y: 14 });
      setSplashPos({ x: 50, y: 14, key: splashKeyRef.current++ });
      const finalFish =
        fishListRef.current.find((f) => f.id === target.id) || target;
      revealCaughtFish(finalFish);
    };

    hookRafRef.current = requestAnimationFrame(animateCastAndReel);
  };

  const handleCastRandom = () => {
    if (fishList.length === 0 || phase !== 'IDLE') return;
    const picked = fishList[Math.floor(Math.random() * fishList.length)];
    catchTargetFish(picked);
  };

  const handleKeepFish = async () => {
    if (caughtFish) {
      await logSpinOutcome({
        winner: caughtFish.label,
        winnerColor: caughtFish.color,
        removedAfterSpin: false,
      });
    }
    setCaughtFish(null);
    setHookedFishId(null);
    setHookPos({ x: 50, y: 6 });
    setPhase('IDLE');
  };

  const handleRemoveFish = async () => {
    if (!caughtFish) return;
    const idxToRemove = pondEntries.indexOf(caughtFish.label);
    const nextEntries =
      idxToRemove >= 0
        ? pondEntries.filter((_, i) => i !== idxToRemove)
        : pondEntries;
    setPondEntries(nextEntries);
    if (activeWheel.entries.length > 1) {
      updateActiveWheel({ entries: nextEntries });
    }
    await logSpinOutcome({
      winner: caughtFish.label,
      winnerColor: caughtFish.color,
      removedAfterSpin: true,
      updatedEntries: nextEntries,
    });
    setFishList((prev) => prev.filter((f) => f.id !== caughtFish.id));
    setCaughtFish(null);
    setHookedFishId(null);
    setHookPos({ x: 50, y: 6 });
    setPhase('IDLE');
  };

  const handleRefillPond = () => {
    if (hookRafRef.current) cancelAnimationFrame(hookRafRef.current);
    const source =
      activeWheel.entries.length > 0 ? activeWheel.entries : QUICK_START_ENTRIES;
    const colors = getSegmentColors(source.length, activeWheel.paletteId);
    setPondEntries([...source]);
    setFishList(
      source.map((label, idx) => ({
        id: `fish_${Date.now()}_${idx}`,
        label,
        color: colors[idx] || '#3B82F6',
        x: 10 + ((idx * 19) % 80),
        y: 28 + ((idx * 13) % 54),
        speed: 0.045 + (idx % 4) * 0.015,
        dir: idx % 2 === 0 ? 1 : -1,
        phase: idx * 0.9,
      }))
    );
    setPhase('IDLE');
    setHookedFishId(null);
    setCaughtFish(null);
    setHookPos({ x: 50, y: 6 });
    setSplashPos(null);
  };

  const lineVisible = phase === 'CASTING' || phase === 'REELING';

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.fishingTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.fishingDesc}{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="tabular-nums">{t.entriesCount(fishList.length)}</span>{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="tabular-nums">
              {t.caughtCountLabel}: {catchCount}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCastRandom}
            disabled={phase !== 'IDLE' || fishList.length === 0}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Anchor className={`w-4 h-4 ${phase === 'REELING' ? 'animate-spin' : ''}`} />
            <span>
              {phase === 'CASTING'
                ? t.castingLine
                : phase === 'REELING'
                ? t.reelingIn
                : t.castHookBtn}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRefillPond}
            title={t.refillPondBtn}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.refillPondBtn}</span>
          </button>
        </div>
      </div>

      {/* Interactive Animated Fishing Pond */}
      <div className="relative w-full h-[380px] sm:h-[430px] rounded-3xl overflow-hidden border border-cyan-200 dark:border-slate-800 bg-gradient-to-b from-sky-100 via-cyan-200 to-teal-400 dark:from-slate-900 dark:via-cyan-950 dark:to-teal-950 shadow-inner select-none">
        {/* Sky & Water Surface Line */}
        <div
          className="absolute top-[14%] inset-x-0 h-px bg-white/70 dark:bg-cyan-400/30"
          aria-hidden="true"
        />

        {/* Decorative Lily Pads */}
        <div
          className="absolute top-[11%] left-[12%] w-12 h-4 rounded-full bg-emerald-500/70 dark:bg-emerald-700/60"
          aria-hidden="true"
        />
        <div
          className="absolute top-[12%] right-[16%] w-16 h-4 rounded-full bg-emerald-500/65 dark:bg-emerald-700/55"
          aria-hidden="true"
        />

        {/* Top Fishing Rod Tip & Reel Spool */}
        <div
          className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center"
          aria-hidden="true"
        >
          <div className="w-24 h-2.5 rounded-b-full bg-slate-800 dark:bg-slate-200 shadow-sm" />
          <div
            className={`w-5 h-5 -mt-0.5 rounded-full border-2 border-amber-400 bg-slate-900 flex items-center justify-center ${
              phase === 'REELING' ? 'animate-spin' : ''
            }`}
          >
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          </div>
        </div>

        {/* Splash Ripple Ring at Water Entry */}
        {splashPos && (
          <div
            key={splashPos.key}
            style={{ left: `${splashPos.x}%`, top: `${splashPos.y}%` }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 z-20"
            aria-hidden="true"
          >
            <span className="block w-10 h-4 rounded-full border-2 border-white/80 animate-ping" />
          </div>
        )}

        {/* Fishing Line, Bobber & Hook */}
        {lineVisible && (
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full z-20"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line
              x1="50"
              y1="5"
              x2={hookPos.x}
              y2={hookPos.y}
              stroke="#0F172A"
              strokeWidth="0.45"
              className="dark:stroke-slate-100"
            />
            {/* Red/White Float Bobber near line */}
            <circle
              cx={50 + (hookPos.x - 50) * 0.25}
              cy={Math.max(13, 5 + (hookPos.y - 5) * 0.25)}
              r="1.15"
              fill="#EF4444"
              stroke="#FFFFFF"
              strokeWidth="0.35"
            />
            {/* J-Hook at Tip */}
            <path
              d={`M ${hookPos.x} ${hookPos.y - 1.5} L ${hookPos.x} ${hookPos.y + 1.2} Q ${
                hookPos.x + 1.4
              } ${hookPos.y + 2.4} ${hookPos.x + 2.2} ${hookPos.y + 0.8}`}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Empty Pond State */}
        {fishList.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
            <Fish className="w-10 h-10 text-teal-800/60 dark:text-cyan-300/60 mb-2" />
            <p className="font-display text-base font-semibold text-slate-800 dark:text-white">
              {t.pondEmptyMsg}
            </p>
            <button
              type="button"
              onClick={handleRefillPond}
              className="mt-4 min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
            >
              {t.refillPondBtn}
            </button>
          </div>
        ) : (
          fishList.map((fish) => {
            const isHooked = hookedFishId === fish.id;
            const bobY = isHooked ? 0 : Math.sin(fish.phase) * 1.6;
            const isTarget = caughtFish?.id === fish.id || isHooked;
            return (
              <button
                key={fish.id}
                type="button"
                disabled={phase !== 'IDLE'}
                onClick={() => catchTargetFish(fish)}
                style={{
                  left: `${fish.x}%`,
                  top: `${fish.y + bobY}%`,
                  transform: `translate(-50%, -50%) scale(${isTarget ? 1.15 : 1})`,
                }}
                className="absolute z-10 group flex flex-col items-center cursor-pointer focus-visible:outline-none"
              >
                <span className="px-2 py-0.5 mb-1 rounded-md bg-white/90 dark:bg-slate-900/90 text-[11px] sm:text-xs font-semibold text-slate-900 dark:text-white shadow-sm whitespace-nowrap max-w-[120px] truncate">
                  {fish.label}
                </span>
                <svg
                  width="54"
                  height="32"
                  viewBox="0 0 60 36"
                  style={{
                    transform: isHooked
                      ? `rotate(${fish.dir === -1 ? '32deg' : '-32deg'}) ${
                          fish.dir === -1 ? 'scaleX(-1)' : 'scaleX(1)'
                        }`
                      : fish.dir === -1
                      ? 'scaleX(-1)'
                      : 'scaleX(1)',
                  }}
                  className="drop-shadow-md transition-transform group-hover:scale-110"
                >
                  {/* Tail */}
                  <polygon points="14,18 2,7 2,29" fill={fish.color} opacity="0.88" />
                  {/* Body */}
                  <ellipse cx="34" cy="18" rx="22" ry="13" fill={fish.color} />
                  {/* Fin */}
                  <polygon points="28,7 36,2 39,9" fill={fish.color} opacity="0.8" />
                  {/* Eye */}
                  <circle cx="47" cy="15" r="3.2" fill="#FFFFFF" />
                  <circle cx="48" cy="15" r="1.6" fill="#0F172A" />
                </svg>
              </button>
            );
          })
        )}

        {/* Caught Fish Overlay Banner */}
        {phase === 'CAUGHT' && caughtFish && (
          <div className="absolute inset-0 z-30 bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-2xl">
              <div
                className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-3"
                style={{ backgroundColor: caughtFish.color }}
              >
                <Fish className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.fishCaughtLabel}
              </p>
              <h3 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white break-words">
                {caughtFish.label}
              </h3>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleKeepFish}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] text-white text-xs font-semibold cursor-pointer"
                >
                  {t.keepFishBtn}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveFish}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.removeFishBtn}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
