'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { X, Copy, Check, Download, QrCode, ArrowLeft, Info } from 'lucide-react';
import { COPY, type Language } from '@/lib/i18n';
import { downloadQrPng, renderQrToCanvas } from '@/lib/qr-names';
import { getShareOrigin, isPrivatePreviewHost } from '@/lib/share-origin';

export type QuickQrTargetPath = '/tasks' | '/' | '/games';

interface QuickQrModalProps {
  isOpen: boolean;
  initialPath?: QuickQrTargetPath;
  language: Language;
  onClose: () => void;
}

const subscribeNoop = () => () => {};
const getOriginServer = () => '';
const getPreviewServer = () => false;

export function QuickQrModal({
  isOpen,
  initialPath = '/tasks',
  language,
  onClose,
}: QuickQrModalProps) {
  const t = COPY[language];
  const origin = useSyncExternalStore(subscribeNoop, getShareOrigin, getOriginServer);
  const isPreviewHost = useSyncExternalStore(
    subscribeNoop,
    isPrivatePreviewHost,
    getPreviewServer
  );
  const [selectedPath, setSelectedPath] = useState<QuickQrTargetPath>(initialPath);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const shareUrl = origin ? `${origin}${selectedPath === '/' ? '' : selectedPath}` : selectedPath;

  useEffect(() => {
    if (!isOpen || !shareUrl || !canvasRef.current) return;
    renderQrToCanvas(canvasRef.current, shareUrl, 280).catch(() => {
      // Ignore transient canvas render errors
    });
  }, [isOpen, shareUrl]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const slug = selectedPath === '/' ? 'home' : selectedPath.replace('/', '');
      await downloadQrPng(shareUrl, `pickerwel-${slug}-qr`);
    } finally {
      setDownloading(false);
    }
  };

  const targets: { path: QuickQrTargetPath; label: string }[] = [
    { path: '/tasks', label: t.quickQrTabJoin },
    { path: '/', label: t.quickQrTabHome },
    { path: '/games', label: t.quickQrTabGames },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.quickAppLinkTitle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md max-h-[92dvh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[#3B82F6] dark:text-blue-400">
              <QrCode className="w-4 h-4 shrink-0" />
              <h2 className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                {t.quickAppLinkTitle}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.quickAppLinkDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Quick Page Switcher */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {targets.map((item) => {
              const active = selectedPath === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => setSelectedPath(item.path)}
                  className={`min-h-[36px] px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap truncate ${
                    active
                      ? 'bg-white dark:bg-slate-900 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {/* Large Projector-Ready QR Canvas */}
          <div className="flex flex-col items-center justify-center py-5 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="p-3.5 rounded-2xl bg-white shadow-sm border border-slate-200">
              <canvas
                ref={canvasRef}
                width={280}
                height={280}
                className="w-[232px] h-[232px] sm:w-[260px] sm:h-[260px] block"
              />
            </div>
          </div>

          {/* Copy Link Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t.quickCopyLinkBtn}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="h-10 px-3.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.tasksCopiedLinkBtn : t.quickCopyLinkBtn}</span>
            </button>
          </div>

          {/* No-Signup Confirmation */}
          <div className="space-y-2">
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 flex items-start gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-300">
              <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>{t.tasksNoSignupNote}</span>
            </div>
            {isPreviewHost && (
              <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 flex items-start gap-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-200">
                <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{t.qrPreviewHostNotice}</span>
              </div>
            )}
          </div>

          {/* Back & Download QR PNG */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>{t.backBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
            >
              <Download className="w-4 h-4 shrink-0" />
              <span>{t.tasksQrDownloadBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
