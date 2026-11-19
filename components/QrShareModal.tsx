'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { X, Copy, Check, Download, ExternalLink, QrCode, ShieldCheck, ArrowLeft, Info } from 'lucide-react';
import { COPY, type Language } from '@/lib/i18n';
import { buildStudentTaskUrl, type StudentAssignment } from '@/lib/firestore-service';
import { downloadQrPng, renderQrToCanvas } from '@/lib/qr-names';
import { getShareOrigin, isPrivatePreviewHost } from '@/lib/share-origin';

interface QrShareModalProps {
  assignment: StudentAssignment | null;
  language: Language;
  onClose: () => void;
}

const subscribeNoop = () => () => {};
const getPreviewServer = () => false;
const getOriginServer = () => '';

export function QrShareModal({ assignment, language, onClose }: QrShareModalProps) {
  const t = COPY[language];
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const shareOrigin = useSyncExternalStore(
    subscribeNoop,
    getShareOrigin,
    getOriginServer
  );
  const isPreviewHost = useSyncExternalStore(
    subscribeNoop,
    isPrivatePreviewHost,
    getPreviewServer
  );

  const shareUrl = assignment ? buildStudentTaskUrl(assignment.id, shareOrigin) : '';

  useEffect(() => {
    if (!assignment || !shareUrl || !canvasRef.current) return;
    let active = true;
    renderQrToCanvas(canvasRef.current, shareUrl, 248).catch(() => {
      if (active) {
        // Ignore transient canvas render errors
      }
    });
    return () => {
      active = false;
    };
  }, [assignment, shareUrl]);

  useEffect(() => {
    if (!assignment) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [assignment, onClose]);

  if (!assignment) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback copy via temporary input
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleDownloadQr = async () => {
    setDownloading(true);
    try {
      await downloadQrPng(shareUrl, `pickerwel-task-${assignment.title}`);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.tasksQrModalTitle}
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
                {t.tasksQrModalTitle}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t.tasksQrModalDesc}
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
          <div className="text-center space-y-1">
            <p className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
              {assignment.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.tasksStudentTeacherLabel}: <span className="font-semibold text-slate-700 dark:text-slate-200">{assignment.ownerDisplayName}</span>
            </p>
          </div>

          {/* QR Code Surface */}
          <div className="flex flex-col items-center justify-center py-4 px-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="p-3 rounded-xl bg-white shadow-sm border border-slate-200">
              <canvas
                ref={canvasRef}
                width={248}
                height={248}
                className="w-[216px] h-[216px] sm:w-[236px] sm:h-[236px] block"
              />
            </div>
          </div>

          {/* Share URL Box + Copy */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              aria-label={t.tasksCopyLinkBtn}
              className="flex-1 min-w-0 h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handleCopy}
              className="h-10 px-3.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? t.tasksCopiedLinkBtn : t.tasksCopyLinkBtn}</span>
            </button>
          </div>

          {/* No-Signup & Privacy Footnote */}
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
            <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
              <span>{t.tasksPrivacyNotice}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleDownloadQr}
                disabled={downloading}
                className="min-h-[42px] px-4 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 whitespace-nowrap"
              >
                <Download className="w-4 h-4 shrink-0" />
                <span>{t.tasksQrDownloadBtn}</span>
              </button>

              <Link
                href={`/task/${assignment.id}`}
                onClick={onClose}
                className="min-h-[42px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 shrink-0" />
                <span>{t.tasksOpenStudentBtn}</span>
              </Link>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-full min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>{t.backBtn}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
