'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  QrCode,
  Camera,
  CameraOff,
  ImageUp,
  ArrowRight,
  Link2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { COPY, type Language } from '@/lib/i18n';
import { decodeCodeFromCanvas } from '@/lib/qr-names';
import { resolveJoinTarget, type JoinTarget } from '@/lib/share-origin';
import { playScanBeepSound, triggerHaptic } from '@/lib/sound';
import { PlayerJoinProfileModal } from './PlayerJoinProfileModal';

interface QuickJoinTaskCardProps {
  language: Language;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
}

export function QuickJoinTaskCard({
  language,
  soundEnabled,
  hapticsEnabled,
}: QuickJoinTaskCardProps) {
  const t = COPY[language];
  const router = useRouter();

  const [linkInput, setLinkInput] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<JoinTarget | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const scannedLockRef = useRef(false);

  const promptProfileForTarget = (target: JoinTarget, fromScan: boolean) => {
    if (scannedLockRef.current) return true;
    scannedLockRef.current = true;
    setErrorMsg(null);
    if (fromScan) {
      if (soundEnabled) playScanBeepSound();
      if (hapticsEnabled) triggerHaptic(28);
    }
    setCameraOpen(false);
    setPendingTarget(target);
    return true;
  };

  const navigateToTarget = (raw: string, fromScan = false) => {
    const target = resolveJoinTarget(raw);
    if (!target) {
      setErrorMsg(t.tasksJoinInvalidLink);
      return false;
    }
    return promptProfileForTarget(target, fromScan);
  };

  const handleConfirmPlayerProfile = () => {
    const target = pendingTarget;
    if (!target) return;
    setPendingTarget(null);
    if (target.kind === 'internal') {
      router.push(target.path);
    } else {
      window.location.assign(target.url);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    scannedLockRef.current = false;
    navigateToTarget(linkInput, false);
  };

  // Live Camera QR Scanner
  useEffect(() => {
    if (!cameraOpen) return;
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      return;
    }

    let cancelled = false;
    let stream: MediaStream | null = null;
    let rafId: number | null = null;
    let lastCheck = 0;

    const scanLoop = (now: number) => {
      if (cancelled || scannedLockRef.current) return;
      if (now - lastCheck >= 220) {
        lastCheck = now;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (video && canvas && video.readyState >= 2 && video.videoWidth > 0) {
          const maxDim = 640;
          const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
          const w = Math.max(1, Math.round(video.videoWidth * scale));
          const h = Math.max(1, Math.round(video.videoHeight * scale));
          if (canvas.width !== w) canvas.width = w;
          if (canvas.height !== h) canvas.height = h;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0, w, h);
            void decodeCodeFromCanvas(canvas, false).then((decoded) => {
              if (!decoded || cancelled || scannedLockRef.current) return;
              const target = resolveJoinTarget(decoded);
              if (target) {
                scannedLockRef.current = true;
                if (soundEnabled) playScanBeepSound();
                if (hapticsEnabled) triggerHaptic(28);
                setCameraOpen(false);
                setPendingTarget(target);
              } else {
                setErrorMsg(t.tasksJoinInvalidLink);
              }
            });
          }
        }
      }
      rafId = requestAnimationFrame(scanLoop);
    };

    navigator.mediaDevices
      .getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = mediaStream;
          void video.play().catch(() => {
            // Ignore autoplay race
          });
        }
        rafId = requestAnimationFrame(scanLoop);
      })
      .catch(() => {
        if (!cancelled) {
          setCameraOpen(false);
          setErrorMsg(t.tasksJoinCameraError);
        }
      });

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [
    cameraOpen,
    hapticsEnabled,
    router,
    soundEnabled,
    t.tasksJoinCameraError,
    t.tasksJoinInvalidLink,
  ]);

  const handleToggleCamera = () => {
    setErrorMsg(null);
    if (!cameraOpen) {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setErrorMsg(t.tasksJoinCameraError);
        return;
      }
      scannedLockRef.current = false;
      setCameraOpen(true);
    } else {
      setCameraOpen(false);
    }
  };

  const handleQrImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErrorMsg(null);
    scannedLockRef.current = false;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 1024;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          setErrorMsg(t.tasksJoinQrNotFound);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const decoded = await decodeCodeFromCanvas(canvas, true);
        if (!decoded) {
          setErrorMsg(t.tasksJoinQrNotFound);
          return;
        }
        navigateToTarget(decoded, true);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setErrorMsg(t.tasksJoinQrNotFound);
    };
    img.src = url;
  };

  return (
    <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-slate-900 border-2 border-blue-200/80 dark:border-blue-900/70 shadow-sm space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-[#3B82F6] dark:text-blue-400 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>{t.tasksNoSignupNote}</span>
            </div>
            <h2 className="mt-1 font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
              {t.tasksJoinCardTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {t.tasksJoinCardDesc}
            </p>
          </div>
        </div>
      </div>

      {/* Paste Link or Task Code Form */}
      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
        <div className="relative flex-1 min-w-0">
          <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={linkInput}
            onChange={(e) => {
              setLinkInput(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={t.tasksJoinInputPlaceholder}
            aria-label={t.tasksJoinInputPlaceholder}
            className="w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          type="submit"
          className="h-11 px-5 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer shrink-0 whitespace-nowrap"
        >
          <span>{t.tasksJoinNowBtn}</span>
          <ArrowRight className="w-4 h-4 shrink-0" />
        </button>
      </form>

      {/* Camera QR Scan & Upload QR Image Actions */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={handleToggleCamera}
          className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap ${
            cameraOpen
              ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 hover:bg-rose-100'
              : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100'
          }`}
        >
          {cameraOpen ? <CameraOff className="w-4 h-4 shrink-0" /> : <Camera className="w-4 h-4 text-[#3B82F6] shrink-0" />}
          <span>{cameraOpen ? t.tasksJoinStopCameraBtn : t.tasksJoinScanCameraBtn}</span>
        </button>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
        >
          <ImageUp className="w-4 h-4 text-[#3B82F6] shrink-0" />
          <span>{t.tasksJoinUploadQrBtn}</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleQrImageFile}
          className="hidden"
        />
      </div>

      {/* Live Camera Viewfinder */}
      {cameraOpen && (
        <div className="rounded-xl overflow-hidden bg-slate-950 border border-slate-800 space-y-2 p-3">
          <div className="relative w-full max-w-sm mx-auto aspect-square rounded-lg overflow-hidden bg-black">
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <div className="pointer-events-none absolute inset-6 border-2 border-blue-400/90 rounded-xl shadow-[0_0_0_9999px_rgba(2,6,23,0.45)]" />
          </div>
          <p className="text-center text-xs text-slate-300">{t.tasksJoinScanningHint}</p>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/70 flex items-center gap-2 text-xs font-medium text-rose-700 dark:text-rose-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Required Name + Avatar Check-In Modal before entering the scanned link */}
      <PlayerJoinProfileModal
        isOpen={Boolean(pendingTarget)}
        language={language}
        targetLabel={pendingTarget?.displayUrl}
        submitLabel={t.playerJoinEnterBtn}
        onConfirm={handleConfirmPlayerProfile}
        onClose={() => {
          setPendingTarget(null);
          scannedLockRef.current = false;
        }}
      />
    </section>
  );
}
