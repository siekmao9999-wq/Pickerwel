'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, Maximize2, Watch } from 'lucide-react';
import { formatStopwatchMs } from '@/lib/time-format';
import { COPY, type Language } from '@/lib/i18n';
import { playTickSound } from '@/lib/sound';

interface QuickStopwatchBarProps {
  language: Language;
  soundEnabled: boolean;
  onOpenFull: () => void;
}

export function QuickStopwatchBar({
  language,
  soundEnabled,
  onOpenFull,
}: QuickStopwatchBarProps) {
  const t = COPY[language];
  const [running, setRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef(0);
  const accumulatedRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = performance.now();
    const tick = (now: number) => {
      setElapsedMs(accumulatedRef.current + (now - startRef.current));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [running]);

  const toggle = () => {
    if (running) {
      accumulatedRef.current += performance.now() - startRef.current;
      setElapsedMs(accumulatedRef.current);
      setRunning(false);
    } else {
      if (soundEnabled) playTickSound(0.15);
      setRunning(true);
    }
  };

  const reset = () => {
    setRunning(false);
    accumulatedRef.current = 0;
    setElapsedMs(0);
  };

  const display = formatStopwatchMs(elapsedMs);

  return (
    <div className="w-full max-w-md px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <Watch className="w-4 h-4 text-[#3B82F6] shrink-0" />
        <div className="font-mono tabular-nums text-lg font-bold text-slate-900 dark:text-white">
          <span>{display.main}</span>
          <span className="text-xs text-[#3B82F6] dark:text-blue-400">.{display.centis}</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={toggle}
          aria-label={running ? t.pause : t.start}
          className={`min-h-[38px] px-3 rounded-lg text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer ${
            running ? 'bg-amber-500 hover:bg-amber-600' : 'bg-[#3B82F6] hover:bg-blue-600'
          }`}
        >
          {running ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          <span>{running ? t.pause : t.start}</span>
        </button>

        <button
          type="button"
          onClick={reset}
          disabled={elapsedMs === 0}
          aria-label={t.reset}
          className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 disabled:opacity-40 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={onOpenFull}
          aria-label={t.openFullStopwatch}
          title={t.openFullStopwatch}
          className="min-h-[38px] min-w-[38px] rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
