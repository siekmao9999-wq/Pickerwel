'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScanLine,
  QrCode,
  Camera,
  CameraOff,
  SwitchCamera,
  ImageUp,
  Plus,
  Trash2,
  X,
  Check,
  Download,
  AlertCircle,
  WifiOff,
  FileText,
  FileSpreadsheet,
  Loader2,
  Upload,
} from 'lucide-react';
import {
  MAX_QR_UTF8_BYTES,
  decodeCodeFromCanvas,
  downloadQrPng,
  getUtf8ByteLength,
  parseScannedPayload,
  renderQrToCanvas,
} from '@/lib/qr-names';
import { MAX_ENTRY_CHARS, MAX_WHEEL_ENTRIES } from '@/lib/entries-io';
import { playScanBeepSound, triggerHaptic } from '@/lib/sound';
import { COPY, type Language } from '@/lib/i18n';

interface NameScannerModalProps {
  isOpen: boolean;
  initialTab?: 'scan' | 'document' | 'create-qr';
  entries: string[];
  wheelTitle?: string;
  language: Language;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  onClose: () => void;
  onApplyEntries: (nextEntries: string[], addedCount: number) => void;
}

export function NameScannerModal({
  isOpen,
  initialTab = 'scan',
  entries,
  wheelTitle,
  language,
  soundEnabled,
  hapticsEnabled,
  onClose,
  onApplyEntries,
}: NameScannerModalProps) {
  const t = COPY[language];
  const [activeTab, setActiveTab] = useState<'scan' | 'document' | 'create-qr'>(
    initialTab
  );
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatusMsg, setScanStatusMsg] = useState<string | null>(null);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [scannedNames, setScannedNames] = useState<string[]>([]);
  const [manualInput, setManualInput] = useState('');
  const [docScanning, setDocScanning] = useState(false);
  const [docDragOver, setDocDragOver] = useState(false);

  // QR generator state
  const [qrSourceMode, setQrSourceMode] = useState<'wheel' | 'custom'>('wheel');
  const [customQrText, setCustomQrText] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const captureInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const lastScannedRef = useRef<{ text: string; at: number }>({
    text: '',
    at: 0,
  });
  const scannedNamesRef = useRef<string[]>([]);
  const skipDuplicatesRef = useRef(true);

  useEffect(() => {
    scannedNamesRef.current = scannedNames;
  }, [scannedNames]);

  useEffect(() => {
    skipDuplicatesRef.current = skipDuplicates;
  }, [skipDuplicates]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCameraActive(false);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const handleParsedNames = (
    incoming: string[],
    source: 'camera' | 'image'
  ) => {
    if (incoming.length === 0) return;

    const current = scannedNamesRef.current;
    const existingSet = new Set(
      current.map((n) => n.trim().toLocaleLowerCase())
    );

    const toAdd: string[] = [];
    let skipped = 0;

    for (const rawName of incoming) {
      const cleaned = rawName.trim().slice(0, MAX_ENTRY_CHARS);
      if (!cleaned) continue;
      const key = cleaned.toLocaleLowerCase();
      if (skipDuplicatesRef.current && existingSet.has(key)) {
        skipped += 1;
        continue;
      }
      existingSet.add(key);
      toAdd.push(cleaned);
    }

    if (toAdd.length > 0) {
      const next = [...current, ...toAdd].slice(0, MAX_WHEEL_ENTRIES);
      scannedNamesRef.current = next;
      setScannedNames(next);
      setCameraError(null);
      setScanStatusMsg(t.scanLastCaptured(toAdd.length));
      if (soundEnabled) playScanBeepSound();
      if (hapticsEnabled) triggerHaptic(28);
    } else if (skipped > 0) {
      setScanStatusMsg(t.scanDuplicateSkipped(incoming[0]));
    } else if (source === 'image') {
      setCameraError(t.scanImageNotFoundError);
    }
  };

  // Live Camera Stream + Frame Scanner Loop
  useEffect(() => {
    if (!isOpen || activeTab !== 'scan' || !cameraActive) return;
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      const id = window.setTimeout(() => {
        setCameraStarting(false);
        setCameraActive(false);
        setCameraError(t.scanCameraPermissionError);
      }, 0);
      return () => window.clearTimeout(id);
    }

    const videoEl = videoRef.current;
    let cancelled = false;
    let activeStream: MediaStream | null = null;
    let intervalId: number | null = null;
    let busyDecoding = false;

    const acquireCameraStream = async (): Promise<MediaStream> => {
      const attempts: MediaStreamConstraints[] = [
        {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: {
            facingMode: { ideal: facingMode },
          },
          audio: false,
        },
        {
          video: true,
          audio: false,
        },
      ];

      let lastErr: unknown;
      for (const constraints of attempts) {
        try {
          return await navigator.mediaDevices.getUserMedia(constraints);
        } catch (err) {
          lastErr = err;
          const errName = err instanceof DOMException ? err.name : '';
          // Permission denied or security error will not succeed on looser constraints
          if (errName === 'NotAllowedError' || errName === 'SecurityError') {
            throw err;
          }
        }
      }
      throw lastErr;
    };

    const startCamera = async () => {
      setCameraStarting(true);
      try {
        const stream = await acquireCameraStream();

        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }

        activeStream = stream;
        if (videoEl) {
          videoEl.setAttribute('playsinline', 'true');
          videoEl.muted = true;
          videoEl.srcObject = stream;
          await videoEl.play().catch(() => {});
        }
        setCameraStarting(false);

        intervalId = window.setInterval(async () => {
          if (cancelled || busyDecoding) return;
          if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0) {
            return;
          }

          busyDecoding = true;
          try {
            if (!scanCanvasRef.current) {
              scanCanvasRef.current = document.createElement('canvas');
            }
            const canvas = scanCanvasRef.current;
            const scale = Math.min(
              1,
              720 / Math.max(videoEl.videoWidth, videoEl.videoHeight)
            );
            canvas.width = Math.max(1, Math.round(videoEl.videoWidth * scale));
            canvas.height = Math.max(1, Math.round(videoEl.videoHeight * scale));
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return;

            ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
            const rawText = await decodeCodeFromCanvas(canvas, false);
            if (!rawText) return;

            const now = Date.now();
            if (
              lastScannedRef.current.text === rawText &&
              now - lastScannedRef.current.at < 1800
            ) {
              return;
            }
            lastScannedRef.current = { text: rawText, at: now };

            const parsed = parseScannedPayload(rawText);
            if (parsed.length > 0) {
              handleParsedNames(parsed, 'camera');
            }
          } finally {
            busyDecoding = false;
          }
        }, 170);
      } catch {
        if (!cancelled) {
          setCameraStarting(false);
          setCameraActive(false);
          setCameraError(t.scanCameraPermissionError);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      setCameraStarting(false);
      if (intervalId !== null) window.clearInterval(intervalId);
      if (activeStream) {
        activeStream.getTracks().forEach((tr) => tr.stop());
      }
      if (videoEl) {
        videoEl.srcObject = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, activeTab, cameraActive, facingMode]);

  const handleScanImageFile = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setCameraError(null);
    const objectUrl = URL.createObjectURL(file);

    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new window.Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Image load failed'));
        el.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      const maxDim = 1280;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setCameraError(t.scanImageNotFoundError);
        return;
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const rawText = await decodeCodeFromCanvas(canvas, true);
      if (!rawText) {
        setCameraError(t.scanImageNotFoundError);
        return;
      }

      const parsed = parseScannedPayload(rawText);
      if (parsed.length === 0) {
        setCameraError(t.scanImageNotFoundError);
        return;
      }
      handleParsedNames(parsed, 'image');
    } catch {
      setCameraError(t.scanImageNotFoundError);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  const processDocumentFile = async (file: File) => {
    setDocScanning(true);
    setCameraError(null);
    setScanStatusMsg(null);
    try {
      const { scanDocumentFile } = await import('@/lib/document-scanner');
      const result = await scanDocumentFile(file);
      if (result.entries.length === 0) {
        setCameraError(t.scanDocEmptyError);
        return;
      }

      const current = scannedNamesRef.current;
      const existingSet = new Set(
        current.map((n) => n.trim().toLocaleLowerCase())
      );

      const toAdd: string[] = [];
      for (const item of result.entries) {
        const cleaned = item.trim().slice(0, MAX_ENTRY_CHARS);
        if (!cleaned) continue;
        const key = cleaned.toLocaleLowerCase();
        if (skipDuplicatesRef.current && existingSet.has(key)) continue;
        existingSet.add(key);
        toAdd.push(cleaned);
      }

      if (toAdd.length > 0) {
        const next = [...current, ...toAdd].slice(0, MAX_WHEEL_ENTRIES);
        scannedNamesRef.current = next;
        setScannedNames(next);
        setScanStatusMsg(t.scanDocSuccess(toAdd.length, file.name));
        if (soundEnabled) playScanBeepSound();
        if (hapticsEnabled) triggerHaptic(28);
      } else {
        setScanStatusMsg(t.scanDuplicateSkipped(result.entries[0]));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'LEGACY_DOC_UNSUPPORTED') {
        setCameraError(t.scanDocLegacyDocError);
      } else {
        setCameraError(t.scanDocReadError);
      }
    } finally {
      setDocScanning(false);
    }
  };

  const handleDocumentInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await processDocumentFile(file);
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = manualInput.trim().slice(0, MAX_ENTRY_CHARS);
    if (!cleaned) return;
    handleParsedNames([cleaned], 'camera');
    setManualInput('');
  };

  const qrPayloadText = useMemo(() => {
    if (qrSourceMode === 'wheel') {
      return entries.join('\n');
    }
    return customQrText.trim();
  }, [qrSourceMode, entries, customQrText]);

  const qrByteLength = useMemo(
    () => getUtf8ByteLength(qrPayloadText),
    [qrPayloadText]
  );
  const qrTooLong = qrByteLength > MAX_QR_UTF8_BYTES;

  useEffect(() => {
    if (!isOpen || activeTab !== 'create-qr') return;
    const canvas = qrCanvasRef.current;
    if (!canvas) return;
    if (!qrPayloadText || qrTooLong) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    renderQrToCanvas(canvas, qrPayloadText, 240).catch(() => {});
  }, [isOpen, activeTab, qrPayloadText, qrTooLong]);

  if (!isOpen) return null;

  const handleCloseModal = () => {
    setCameraActive(false);
    setCameraError(null);
    setScanStatusMsg(null);
    onClose();
  };

  const handleApplyToWheel = (mode: 'append' | 'replace') => {
    if (scannedNames.length === 0) return;
    const next =
      mode === 'append'
        ? [...entries, ...scannedNames].slice(0, MAX_WHEEL_ENTRIES)
        : [...scannedNames].slice(0, MAX_WHEEL_ENTRIES);
    setCameraActive(false);
    onApplyEntries(next, scannedNames.length);
    setScannedNames([]);
    setScanStatusMsg(null);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="name-scanner-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseModal();
      }}
    >
      <div className="w-full max-w-2xl max-h-[92dvh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3
              id="name-scanner-modal-title"
              className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"
            >
              <ScanLine className="w-5 h-5 text-[#3B82F6] shrink-0" />
              <span className="truncate">{t.scanNamesTitle}</span>
            </h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 leading-relaxed">
              <WifiOff className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              <span>{t.scanNamesDesc}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            aria-label={t.close}
            className="min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 sm:px-5 pt-3">
          <div className="grid grid-cols-1 min-[480px]:grid-cols-3 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setActiveTab('scan');
                setCameraError(null);
              }}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'scan'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ScanLine className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.scanTabScanner}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraActive(false);
                setCameraError(null);
                setActiveTab('document');
              }}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'document'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.scanTabDocument}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraActive(false);
                setCameraError(null);
                setActiveTab('create-qr');
              }}
              className={`min-h-[36px] px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                activeTab === 'create-qr'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{t.scanTabCreateQr}</span>
            </button>
          </div>
        </div>

        {/* Body */}
        {activeTab !== 'create-qr' ? (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {activeTab === 'scan' ? (
              <>
                {/* Camera Viewport */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-950 overflow-hidden relative aspect-[16/10] sm:aspect-[16/9] flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${
                  cameraActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />

              {cameraActive ? (
                <>
                  {cameraStarting && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/75 text-white">
                      <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
                      <span className="text-xs font-medium">{t.scanCameraStarting}</span>
                    </div>
                  )}

                  {/* Scanning Frame Reticle */}
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 sm:w-56 sm:h-56 rounded-2xl border-2 border-blue-400/90 shadow-[0_0_0_9999px_rgba(2,6,23,0.42)] relative">
                      <span className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-white rounded-tl-lg" />
                      <span className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-white rounded-tr-lg" />
                      <span className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-white rounded-bl-lg" />
                      <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-white rounded-br-lg" />
                    </div>
                  </div>

                  {/* Camera Overlay Controls */}
                  <div className="absolute top-3 right-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setFacingMode((m) =>
                          m === 'environment' ? 'user' : 'environment'
                        )
                      }
                      title={t.scanCameraFlip}
                      aria-label={t.scanCameraFlip}
                      className="min-h-[36px] px-2.5 rounded-lg bg-slate-900/80 hover:bg-slate-900 text-white text-xs font-medium inline-flex items-center gap-1.5 backdrop-blur-sm cursor-pointer whitespace-nowrap"
                    >
                      <SwitchCamera className="w-4 h-4 shrink-0" />
                      <span className="hidden sm:inline">{t.scanCameraFlip}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCameraActive(false)}
                      className="min-h-[36px] px-2.5 rounded-lg bg-rose-600/90 hover:bg-rose-600 text-white text-xs font-medium inline-flex items-center gap-1.5 backdrop-blur-sm cursor-pointer whitespace-nowrap"
                    >
                      <CameraOff className="w-4 h-4 shrink-0" />
                      <span>{t.scanCameraPause}</span>
                    </button>
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4 sm:p-5 text-center bg-slate-900/95">
                  {cameraError ? (
                    <AlertCircle className="w-8 h-8 text-rose-400 mb-2 shrink-0" />
                  ) : (
                    <ScanLine className="w-9 h-9 text-blue-400 mb-2 shrink-0" />
                  )}
                  <p
                    className={`text-xs max-w-md leading-relaxed mb-3.5 ${
                      cameraError ? 'text-rose-200 font-medium' : 'text-slate-300'
                    }`}
                  >
                    {cameraError || t.scanCameraHint}
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCameraError(null);
                        setCameraActive(true);
                      }}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Camera className="w-4 h-4 shrink-0" />
                      <span>{t.scanCameraStart}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => captureInputRef.current?.click()}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Camera className="w-4 h-4 shrink-0 text-emerald-400" />
                      <span>{t.scanCapturePhotoBtn}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <ImageUp className="w-4 h-4 shrink-0" />
                      <span>{t.scanFromImageBtn}</span>
                    </button>
                  </div>
                </div>
              )}

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleScanImageFile}
                className="hidden"
              />
              <input
                ref={captureInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleScanImageFile}
                className="hidden"
              />
            </div>

            {/* Secondary Image Scan + Duplicate Toggle Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => captureInputRef.current?.click()}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Camera className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{t.scanCapturePhotoBtn}</span>
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <ImageUp className="w-3.5 h-3.5 shrink-0" />
                  <span>{t.scanFromImageBtn}</span>
                </button>
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                />
                <span>{t.scanSkipDuplicates}</span>
              </label>
            </div>
              </>
            ) : (
              /* PDF / Excel / Word (.docx) Document Scanner Sub-Panel */
              <div className="space-y-3">
                <input
                  ref={docInputRef}
                  type="file"
                  accept=".pdf,.xlsx,.xls,.ods,.docx,.csv,.txt,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={handleDocumentInputChange}
                  className="hidden"
                />
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDocDragOver(true);
                  }}
                  onDragLeave={() => setDocDragOver(false)}
                  onDrop={async (e) => {
                    e.preventDefault();
                    setDocDragOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) await processDocumentFile(file);
                  }}
                  className={`rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
                    docDragOver
                      ? 'border-[#3B82F6] bg-blue-50/70 dark:bg-blue-950/30'
                      : 'border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center justify-center gap-3 mb-3 text-[#3B82F6] dark:text-blue-400">
                    <FileText className="w-7 h-7" />
                    <FileSpreadsheet className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {t.scanDocDropTitle}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto leading-relaxed">
                    {t.scanDocDropHint}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      disabled={docScanning}
                      onClick={() => docInputRef.current?.click()}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {docScanning ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                          <span>{t.scanDocScanning}</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4 shrink-0" />
                          <span>{t.scanDocChooseBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={skipDuplicates}
                      onChange={(e) => setSkipDuplicates(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                    <span>{t.scanSkipDuplicates}</span>
                  </label>
                </div>
              </div>
            )}

            {/* Status / Error Feedback */}
            {cameraError && (
              <div className="px-3.5 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{cameraError}</span>
              </div>
            )}

            {scanStatusMsg && !cameraError && (
              <div className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <Check className="w-4 h-4 shrink-0" />
                <span>{scanStatusMsg}</span>
              </div>
            )}

            {/* Scanned Names Queue */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  {t.scanQueueTitle}{' '}
                  <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500">
                    ({scannedNames.length})
                  </span>
                </span>
                {scannedNames.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setScannedNames([]);
                      setScanStatusMsg(null);
                    }}
                    className="text-xs font-medium text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.scanClearQueue}</span>
                  </button>
                )}
              </div>

              {/* Manual Quick Entry inside Queue */}
              <form onSubmit={handleManualAdd} className="flex items-center gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  maxLength={MAX_ENTRY_CHARS}
                  placeholder={t.scanManualQuickPlaceholder}
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="min-h-[36px] px-3 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{t.addBtn}</span>
                </button>
              </form>

              {scannedNames.length === 0 ? (
                <p className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  {t.scanQueueEmpty}
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-700/60">
                  {scannedNames.map((name, idx) => (
                    <div
                      key={`${idx}-${name}`}
                      className="py-1.5 flex items-center justify-between gap-2 text-xs text-slate-800 dark:text-slate-100"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono tabular-nums text-slate-400 dark:text-slate-500 w-6 text-right shrink-0">
                          {idx + 1}.
                        </span>
                        <span className="truncate font-medium">{name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setScannedNames((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                        aria-label={`Remove ${name}`}
                        className="min-h-[28px] min-w-[28px] rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Offline QR Code Generator Tab */
          <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4 space-y-4">
            <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setQrSourceMode('wheel')}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  qrSourceMode === 'wheel'
                    ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {t.scanQrSourceWheel} ({entries.length})
              </button>
              <button
                type="button"
                onClick={() => setQrSourceMode('custom')}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  qrSourceMode === 'custom'
                    ? 'border-[#3B82F6] bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                }`}
              >
                {t.scanQrSourceCustom}
              </button>
            </div>

            {qrSourceMode === 'custom' && (
              <textarea
                value={customQrText}
                onChange={(e) => setCustomQrText(e.target.value)}
                rows={4}
                placeholder={t.scanQrCustomPlaceholder}
                className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}

            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-5 flex flex-col items-center text-center space-y-3">
              {qrTooLong ? (
                <div className="py-6 px-4 text-xs text-amber-600 dark:text-amber-400 flex items-center gap-2 max-w-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{t.scanQrTooLongWarn}</span>
                </div>
              ) : !qrPayloadText ? (
                <p className="py-8 text-xs text-slate-500 dark:text-slate-400">
                  {t.emptyWheelTitle}
                </p>
              ) : (
                <>
                  <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <canvas
                      ref={qrCanvasRef}
                      width={240}
                      height={240}
                      className="w-[210px] h-[210px] sm:w-[240px] sm:h-[240px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadQrPng(
                        qrPayloadText,
                        `${wheelTitle || 'pickerwel'}-names-qr`
                      )
                    }
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-4 h-4 shrink-0" />
                    <span>{t.scanQrDownloadBtn}</span>
                  </button>
                </>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md leading-relaxed">
                {t.scanQrHelp}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleCloseModal}
            className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            {t.close}
          </button>

          {activeTab !== 'create-qr' && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={scannedNames.length === 0}
                onClick={() => handleApplyToWheel('replace')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 text-xs font-semibold text-slate-800 dark:text-slate-100 transition-colors cursor-pointer whitespace-nowrap"
              >
                {t.scanApplyReplaceBtn(scannedNames.length)}
              </button>
              <button
                type="button"
                disabled={scannedNames.length === 0}
                onClick={() => handleApplyToWheel('append')}
                className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-40 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Check className="w-4 h-4 shrink-0" />
                <span>{t.scanApplyAppendBtn(scannedNames.length)}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
