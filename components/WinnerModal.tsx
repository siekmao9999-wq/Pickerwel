'use client';

import React, { useEffect } from 'react';
import { Trophy, Trash2, RotateCw, X } from 'lucide-react';
import { COPY } from '@/lib/i18n';
import type { Language } from '@/lib/i18n';
import type { SpinResultPayload } from './PickerWheelCanvas';

interface WinnerModalProps {
  result: SpinResultPayload | null;
  wheelTitle: string;
  language: Language;
  canRemove: boolean;
  winnerImageUrl?: string;
  winnerEmoji?: string;
  winnerEmojiBg?: string;
  winnerColorHex?: string;
  winnerNote?: string;
  onRemoveWinner: () => void;
  onKeepAndSpinAgain: () => void;
  onClose: () => void;
}

export function WinnerModal({
  result,
  wheelTitle,
  language,
  canRemove,
  winnerImageUrl,
  winnerEmoji,
  winnerEmojiBg,
  winnerColorHex,
  winnerNote,
  onRemoveWinner,
  onKeepAndSpinAgain,
  onClose,
}: WinnerModalProps) {
  const t = COPY[language];

  useEffect(() => {
    if (!result) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [result, onClose]);

  if (!result) return null;

  const accentColor = winnerColorHex || result.winnerColor;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-modal-heading"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Top Color Accent Strip matching winning segment */}
        <div
          className="h-3 w-full"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />

        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="absolute top-5 right-4 min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="px-5 sm:px-6 pt-6 sm:pt-7 pb-6 text-center">
          {winnerImageUrl ? (
            <div className="mx-auto mb-4 w-36 h-36 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={winnerImageUrl}
                alt={result.winner}
                className="w-full h-full object-cover"
              />
            </div>
          ) : winnerEmoji ? (
            <div
              className="mx-auto mb-4 w-24 h-24 rounded-2xl flex items-center justify-center text-5xl shadow-md border border-black/10"
              style={{ backgroundColor: winnerEmojiBg || '#F1F5F9' }}
            >
              <span>{winnerEmoji}</span>
            </div>
          ) : winnerColorHex ? (
            <div
              className="mx-auto mb-4 w-20 h-20 rounded-2xl border border-black/15 shadow-md"
              style={{ backgroundColor: winnerColorHex }}
            />
          ) : (
            <div
              className="mx-auto mb-4 w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md"
              style={{ backgroundColor: accentColor }}
            >
              <Trophy className="w-7 h-7" />
            </div>
          )}

          <p
            id="winner-modal-heading"
            className="text-sm font-medium text-slate-500 dark:text-slate-400"
          >
            {t.winnerHeading}
          </p>

          <h2 className="mt-2 font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white break-words">
            {result.winner}
          </h2>

          {winnerNote && (
            <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2">
              {winnerNote}
            </p>
          )}

          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 truncate">
            {t.winnerSubheading} · {wheelTitle}
          </p>

          <div className="mt-7 flex flex-col gap-3">
            <button
              type="button"
              onClick={onKeepAndSpinAgain}
              className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-500/20 transition-all active:scale-[0.99] cursor-pointer"
            >
              <RotateCw className="w-4 h-4 shrink-0" />
              <span className="truncate">{t.keepAndSpinAgain}</span>
            </button>

            {canRemove && (
              <button
                type="button"
                onClick={onRemoveWinner}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/70 font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.removeWinner}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
