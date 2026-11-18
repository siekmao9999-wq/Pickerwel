'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Flag,
  Timer,
  Watch,
  BellRing,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { COPY } from '@/lib/i18n';
import { playWinSound, playTickSound, triggerHaptic } from '@/lib/sound';
import { formatStopwatchMs } from '@/lib/time-format';
export { formatStopwatchMs };

interface LapRecord {
  lapNumber: number;
  splitMs: number;
  totalMs: number;
}

export function StopwatchView() {
  const { settings } = usePickerwel();
  const t = COPY[settings.language];

  const [mode, setMode] = useState<'stopwatch' | 'timer'>('stopwatch');

  // Stopwatch state
  const [swRunning, setSwRunning] = useState(false);
  const [swElapsedMs, setSwElapsedMs] = useState(0);
  const [laps, setLaps] = useState<LapRecord[]>([]);
  const swStartRef = useRef<number>(0);
  const swAccumulatedRef = useRef<number>(0);
  const swRafRef = useRef<number | null>(null);

  // Countdown Timer state
  const [timerInitialMs, setTimerInitialMs] = useState(60000);
  const [timerRemainingMs, setTimerRemainingMs] = useState(60000);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerFinished, setTimerFinished] = useState(false);
  const [customMin, setCustomMin] = useState('1');
  const [customSec, setCustomSec] = useState('30');
  const timerEndAtRef = useRef<number>(0);
  const timerRafRef = useRef<number | null>(null);

  // Stopwatch animation loop
  useEffect(() => {
    if (!swRunning) {
      if (swRafRef.current) cancelAnimationFrame(swRafRef.current);
      return;
    }

    swStartRef.current = performance.now();
    const tick = (now: number) => {
      setSwElapsedMs(swAccumulatedRef.current + (now - swStartRef.current));
      swRafRef.current = requestAnimationFrame(tick);
    };
    swRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (swRafRef.current) cancelAnimationFrame(swRafRef.current);
    };
  }, [swRunning]);

  // Countdown Timer animation loop
  useEffect(() => {
    if (!timerRunning) {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
      return;
    }

    timerEndAtRef.current = performance.now() + timerRemainingMs;
    const tick = (now: number) => {
      const remaining = Math.max(0, timerEndAtRef.current - now);
      setTimerRemainingMs(remaining);
      if (remaining <= 0) {
        setTimerRunning(false);
        setTimerFinished(true);
        if (settings.soundEnabled) playWinSound();
        if (settings.hapticsEnabled) triggerHaptic([120, 60, 120, 60, 160]);
        return;
      }
      timerRafRef.current = requestAnimationFrame(tick);
    };
    timerRafRef.current = requestAnimationFrame(tick);

    return () => {
      if (timerRafRef.current) cancelAnimationFrame(timerRafRef.current);
    };
  }, [timerRunning, settings.soundEnabled, settings.hapticsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSwToggle = () => {
    if (swRunning) {
      swAccumulatedRef.current = swElapsedMs;
      setSwRunning(false);
    } else {
      setTimerFinished(false);
      if (settings.soundEnabled) playTickSound(0.16);
      setSwRunning(true);
    }
  };

  const handleSwLap = () => {
    if (!swRunning && swElapsedMs === 0) return;
    const currentTotal = swElapsedMs;
    const prevTotal = laps[0]?.totalMs ?? 0;
    const splitMs = Math.max(0, currentTotal - prevTotal);
    setLaps((prev) => [
      {
        lapNumber: prev.length + 1,
        splitMs,
        totalMs: currentTotal,
      },
      ...prev,
    ]);
    if (settings.soundEnabled) playTickSound(0.2);
    if (settings.hapticsEnabled) triggerHaptic(12);
  };

  const handleSwReset = () => {
    setSwRunning(false);
    swAccumulatedRef.current = 0;
    setSwElapsedMs(0);
    setLaps([]);
  };

  const handleSelectPreset = (ms: number) => {
    setTimerRunning(false);
    setTimerFinished(false);
    setTimerInitialMs(ms);
    setTimerRemainingMs(ms);
  };

  const handleApplyCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const mins = Math.max(0, Math.min(180, Number(customMin) || 0));
    const secs = Math.max(0, Math.min(59, Number(customSec) || 0));
    const totalMs = (mins * 60 + secs) * 1000;
    if (totalMs <= 0) return;
    handleSelectPreset(totalMs);
  };

  const handleTimerToggle = () => {
    if (timerRemainingMs <= 0) {
      setTimerRemainingMs(timerInitialMs);
      setTimerFinished(false);
    }
    setTimerFinished(false);
    if (settings.soundEnabled) playTickSound(0.16);
    setTimerRunning((prev) => !prev);
  };

  const handleTimerReset = () => {
    setTimerRunning(false);
    setTimerFinished(false);
    setTimerRemainingMs(timerInitialMs);
  };

  const swDisplay = formatStopwatchMs(swElapsedMs);
  const timerDisplay = formatStopwatchMs(timerRemainingMs);
  const timerProgress = timerInitialMs > 0 ? timerRemainingMs / timerInitialMs : 0;

  let fastestLapNum: number | null = null;
  let slowestLapNum: number | null = null;
  if (laps.length >= 2) {
    let minSplit = Infinity;
    let maxSplit = -Infinity;
    for (const lap of laps) {
      if (lap.splitMs < minSplit) {
        minSplit = lap.splitMs;
        fastestLapNum = lap.lapNumber;
      }
      if (lap.splitMs > maxSplit) {
        maxSplit = lap.splitMs;
        slowestLapNum = lap.lapNumber;
      }
    }
  }

  const presets = [
    { label: '30s', ms: 30000 },
    { label: '1m', ms: 60000 },
    { label: '2m', ms: 120000 },
    { label: '5m', ms: 300000 },
    { label: '10m', ms: 600000 },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header & Mode Switch */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
              {t.stopwatchTitle}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.stopwatchDesc}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
            <button
              type="button"
              onClick={() => setMode('stopwatch')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'stopwatch'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Watch className="w-3.5 h-3.5" />
              <span>{t.stopwatchTab}</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('timer')}
              className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'timer'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Timer className="w-3.5 h-3.5" />
              <span>{t.timerTab}</span>
            </button>
          </div>
        </div>

        {mode === 'stopwatch' ? (
          <div className="space-y-6">
            {/* Digital Stopwatch Card */}
            <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center">
              <div className="font-mono tabular-nums tracking-tight flex items-baseline justify-center">
                <span className="text-5xl sm:text-7xl font-bold text-slate-900 dark:text-white">
                  {swDisplay.main}
                </span>
                <span className="text-2xl sm:text-4xl font-semibold text-[#3B82F6] dark:text-blue-400 ml-1">
                  .{swDisplay.centis}
                </span>
              </div>

              <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={handleSwToggle}
                  className={`min-h-[48px] min-w-[140px] px-6 py-3 rounded-xl font-semibold text-sm text-white inline-flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] cursor-pointer ${
                    swRunning
                      ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/20'
                      : 'bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 shadow-blue-500/25'
                  }`}
                >
                  {swRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{swRunning ? t.pause : swElapsedMs > 0 ? t.resume : t.start}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSwLap}
                  disabled={!swRunning && swElapsedMs === 0}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-sm font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <Flag className="w-4 h-4" />
                  <span>{t.lap}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSwReset}
                  disabled={swElapsedMs === 0 && laps.length === 0}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-40 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.reset}</span>
                </button>
              </div>
            </div>

            {/* Laps Table */}
            <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 overflow-hidden">
              {laps.length === 0 ? (
                <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t.noLapsYet}
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="px-5 py-3 bg-slate-50/80 dark:bg-slate-800/40 grid grid-cols-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>{t.lapHeader}</span>
                    <span className="text-right">{t.splitHeader}</span>
                    <span className="text-right">{t.totalHeader}</span>
                  </div>
                  {laps.map((lap) => {
                    const split = formatStopwatchMs(lap.splitMs);
                    const total = formatStopwatchMs(lap.totalMs);
                    const isFastest = fastestLapNum === lap.lapNumber;
                    const isSlowest = slowestLapNum === lap.lapNumber;
                    return (
                      <div
                        key={lap.lapNumber}
                        className="px-5 py-3 grid grid-cols-3 items-center text-sm font-mono tabular-nums"
                      >
                        <span className="font-sans text-slate-700 dark:text-slate-200 flex items-center gap-2">
                          <span className="font-mono font-semibold">#{lap.lapNumber}</span>
                          {isFastest && (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              {t.fastestLabel}
                            </span>
                          )}
                          {isSlowest && (
                            <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                              {t.slowestLabel}
                            </span>
                          )}
                        </span>
                        <span className="text-right text-slate-800 dark:text-slate-200">
                          {split.main}.{split.centis}
                        </span>
                        <span className="text-right text-slate-500 dark:text-slate-400">
                          {total.main}.{total.centis}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Countdown Timer Mode */
          <div className="space-y-6">
            <div className="p-6 sm:p-10 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
              {/* Circular SVG Progress Ring */}
              <div className="relative w-56 h-56 sm:w-64 sm:h-64 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 220 220" aria-hidden="true">
                  <circle
                    cx="110"
                    cy="110"
                    r="96"
                    fill="none"
                    strokeWidth="10"
                    className="stroke-slate-100 dark:stroke-slate-800"
                  />
                  <circle
                    cx="110"
                    cy="110"
                    r="96"
                    fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 96}
                    strokeDashoffset={2 * Math.PI * 96 * (1 - timerProgress)}
                    className={
                      timerFinished
                        ? 'stroke-rose-500 transition-all duration-150'
                        : 'stroke-[#3B82F6] transition-all duration-75'
                    }
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-mono tabular-nums text-4xl sm:text-5xl font-bold text-slate-900 dark:text-white">
                    {timerDisplay.main}
                  </span>
                  {timerFinished && (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      <BellRing className="w-3.5 h-3.5" />
                      <span>{t.timeUpTitle}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Start / Pause / Reset */}
              <div className="mt-6 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleTimerToggle}
                  className={`min-h-[48px] min-w-[140px] px-6 py-3 rounded-xl font-semibold text-sm text-white inline-flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer ${
                    timerRunning
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700'
                  }`}
                >
                  {timerRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                  <span>{timerRunning ? t.pause : t.start}</span>
                </button>
                <button
                  type="button"
                  onClick={handleTimerReset}
                  className="min-h-[48px] px-5 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>{t.reset}</span>
                </button>
              </div>
            </div>

            {/* Presets + Custom Duration */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  {t.presetLabel}
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => handleSelectPreset(p.ms)}
                      className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors cursor-pointer ${
                        timerInitialMs === p.ms
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleApplyCustom}
                className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2.5"
              >
                <input
                  type="number"
                  min={0}
                  max={180}
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  aria-label={t.customMinutes}
                  className="w-20 h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{t.customMinutes}</span>
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={customSec}
                  onChange={(e) => setCustomSec(e.target.value)}
                  aria-label={t.customSeconds}
                  className="w-20 h-10 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-mono tabular-nums text-slate-900 dark:text-white"
                />
                <span className="text-xs text-slate-500 dark:text-slate-400">{t.customSeconds}</span>
                <button
                  type="submit"
                  className="min-h-[40px] px-4 rounded-lg bg-slate-900 dark:bg-[#3B82F6] text-white text-xs font-semibold cursor-pointer"
                >
                  {t.applyDuration}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
