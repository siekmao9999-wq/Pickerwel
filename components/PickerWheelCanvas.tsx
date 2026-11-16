'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Sparkles, Wind, Music, Disc3 } from 'lucide-react';
import { getSegmentColors, getContrastTextColor, type PaletteId } from '@/lib/palettes';
import {
  SPIN_SOUND_OPTIONS,
  playSpinStepSound,
  previewSpinSound,
  startSpinAmbient,
  triggerHaptic,
  type SpinAmbientController,
  type SpinSoundId,
} from '@/lib/sound';
import { COPY, type Language } from '@/lib/i18n';

export interface SpinResultPayload {
  winner: string;
  winnerIndex: number;
  winnerColor: string;
}

interface PickerWheelCanvasProps {
  entries: string[];
  paletteId: PaletteId;
  spinDuration: number;
  soundEnabled: boolean;
  spinSound?: SpinSoundId;
  onChangeSpinSound?: (sound: SpinSoundId) => void;
  language?: Language;
  hapticsEnabled: boolean;
  spinLabel: string;
  emptyTitle: string;
  emptyDesc: string;
  hoveredSliceIndex: number | null;
  onHoverSlice: (idx: number | null) => void;
  onSpinComplete: (result: SpinResultPayload) => void;
  spinTriggerCount?: number;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1)}…`;
}

export function PickerWheelCanvas({
  entries,
  paletteId,
  spinDuration,
  soundEnabled,
  spinSound,
  onChangeSpinSound,
  language = 'km',
  hapticsEnabled,
  spinLabel,
  emptyTitle,
  emptyDesc,
  hoveredSliceIndex,
  onHoverSlice,
  onSpinComplete,
  spinTriggerCount = 0,
}: PickerWheelCanvasProps) {
  const [rotation, setRotation] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [clapperTilt, setClapperTilt] = useState(0);
  const [internalSpinSound, setInternalSpinSound] = useState<SpinSoundId>('classic-tick');

  const activeSpinSound: SpinSoundId = spinSound ?? internalSpinSound;
  const t = COPY[language];

  const rotationRef = useRef(0);
  const isSpinningRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const clapperTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHapticAtRef = useRef(0);
  const prevTriggerRef = useRef(spinTriggerCount);
  const ambientControllerRef = useRef<SpinAmbientController | null>(null);
  const stepCounterRef = useRef(0);

  // Pointer drag / swipe-to-spin state
  const dragStateRef = useRef<{
    active: boolean;
    lastAngle: number;
    lastTime: number;
    velocityDegPerMs: number;
  }>({
    active: false,
    lastAngle: 0,
    lastTime: 0,
    velocityDegPerMs: 0,
  });

  const count = entries.length;
  const colors = getSegmentColors(count, paletteId);
  const sliceAngle = count > 0 ? 360 / count : 360;

  const triggerClapperBounce = useCallback(
    (direction = 1) => {
      setClapperTilt(direction >= 0 ? -20 : 20);
      if (clapperTimeoutRef.current) clearTimeout(clapperTimeoutRef.current);
      clapperTimeoutRef.current = setTimeout(() => {
        setClapperTilt(0);
      }, 65);
    },
    []
  );

  const launchSpin = useCallback(
    (directionSign = 1, extraVelocityBoost = 0) => {
      if (isSpinningRef.current || entries.length < 2) return;

      isSpinningRef.current = true;
      setIsSpinning(true);
      onHoverSlice(null);

      const durationMs = Math.min(10, Math.max(3, spinDuration)) * 1000;
      const startRotation = rotationRef.current;
      const baseTurns = 5 + Math.floor(Math.random() * 4) + Math.min(4, Math.floor(extraVelocityBoost));
      const randomOffset = Math.random() * 360;
      const totalDelta = directionSign * (baseTurns * 360 + randomOffset);
      const targetRotation = startRotation + totalDelta;

      const startTime = performance.now();
      let lastPegBucket = Math.floor(startRotation / sliceAngle);

      if (ambientControllerRef.current) {
        ambientControllerRef.current.stop();
        ambientControllerRef.current = null;
      }
      if (soundEnabled) {
        ambientControllerRef.current = startSpinAmbient(activeSpinSound);
      }

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / durationMs, 1);
        // Smooth physical deceleration (quintic ease-out)
        const eased = 1 - Math.pow(1 - progress, 4.2);
        const currentRotation = startRotation + totalDelta * eased;

        rotationRef.current = currentRotation;
        setRotation(currentRotation);

        if (soundEnabled && ambientControllerRef.current) {
          const speedRatio = Math.pow(1 - progress, 3.2);
          ambientControllerRef.current.update(speedRatio);
        }

        const currentPegBucket = Math.floor(currentRotation / sliceAngle);
        if (currentPegBucket !== lastPegBucket) {
          lastPegBucket = currentPegBucket;
          stepCounterRef.current += 1;
          triggerClapperBounce(directionSign);
          if (soundEnabled) {
            const tickVol = Math.max(0.08, 0.28 * (1 - progress * 0.55));
            playSpinStepSound(activeSpinSound, tickVol, stepCounterRef.current);
          }
          if (hapticsEnabled && now - lastHapticAtRef.current > 48) {
            lastHapticAtRef.current = now;
            triggerHaptic(8);
          }
        }

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          if (ambientControllerRef.current) {
            ambientControllerRef.current.stop();
            ambientControllerRef.current = null;
          }
          isSpinningRef.current = false;
          setIsSpinning(false);
          setClapperTilt(0);

          const normalized = ((currentRotation % 360) + 360) % 360;
          const pointerLocalAngle = (360 - normalized) % 360;
          const winnerIndex = Math.floor(pointerLocalAngle / sliceAngle) % entries.length;
          const winner = entries[winnerIndex];
          const winnerColor = colors[winnerIndex] || '#3B82F6';

          onSpinComplete({
            winner,
            winnerIndex,
            winnerColor,
          });
        }
      };

      rafRef.current = requestAnimationFrame(step);
    },
    [
      activeSpinSound,
      colors,
      entries,
      hapticsEnabled,
      onHoverSlice,
      onSpinComplete,
      sliceAngle,
      soundEnabled,
      spinDuration,
      triggerClapperBounce,
    ]
  );

  // Support external "Keep & Spin Again" trigger
  useEffect(() => {
    if (spinTriggerCount !== prevTriggerRef.current) {
      prevTriggerRef.current = spinTriggerCount;
      launchSpin(1, 0);
    }
  }, [spinTriggerCount, launchSpin]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (clapperTimeoutRef.current) clearTimeout(clapperTimeoutRef.current);
      if (ambientControllerRef.current) {
        ambientControllerRef.current.stop();
        ambientControllerRef.current = null;
      }
    };
  }, []);

  // Swipe / Drag physics around center
  const getPointerAngle = (clientX: number, clientY: number): number => {
    if (!svgRef.current) return 0;
    const rect = svgRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    return (Math.atan2(clientY - cy, clientX - cx) * 180) / Math.PI;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (isSpinningRef.current || entries.length < 2) return;
    // Do not hijack center SPIN button clicks
    if ((e.target as HTMLElement)?.closest('[data-spin-hub="true"]')) return;

    const angle = getPointerAngle(e.clientX, e.clientY);
    dragStateRef.current = {
      active: true,
      lastAngle: angle,
      lastTime: performance.now(),
      velocityDegPerMs: 0,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStateRef.current.active || isSpinningRef.current) return;
    const now = performance.now();
    const angle = getPointerAngle(e.clientX, e.clientY);
    let delta = angle - dragStateRef.current.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    const dt = Math.max(1, now - dragStateRef.current.lastTime);
    dragStateRef.current.velocityDegPerMs = delta / dt;
    dragStateRef.current.lastAngle = angle;
    dragStateRef.current.lastTime = now;

    const nextRotation = rotationRef.current + delta;
    const prevBucket = Math.floor(rotationRef.current / sliceAngle);
    const nextBucket = Math.floor(nextRotation / sliceAngle);
    rotationRef.current = nextRotation;
    setRotation(nextRotation);

    if (prevBucket !== nextBucket && soundEnabled) {
      stepCounterRef.current += 1;
      playSpinStepSound(activeSpinSound, 0.16, stepCounterRef.current);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!dragStateRef.current.active) return;
    dragStateRef.current.active = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture wasn't active
    }

    const v = dragStateRef.current.velocityDegPerMs;
    if (Math.abs(v) > 0.18 && entries.length >= 2) {
      const dir = v >= 0 ? 1 : -1;
      const boost = Math.min(4, Math.abs(v) * 2.5);
      launchSpin(dir, boost);
    }
  };

  const cx = 250;
  const cy = 250;
  const radius = 224;

  // Dynamic font size and character budget based on slice count
  const labelFontSize =
    count <= 8 ? 16 : count <= 14 ? 13.5 : count <= 24 ? 11 : count <= 40 ? 8.5 : 6.5;
  const maxLabelChars = count <= 8 ? 18 : count <= 16 ? 15 : count <= 30 ? 12 : 9;

  return (
    <div className="relative flex flex-col items-center justify-center w-full select-none">
      {/* Glowing radial aura behind wheel (especially luminous in Dark Mode & while spinning) */}
      <div
        className={`pointer-events-none absolute inset-4 rounded-full blur-3xl transition-opacity duration-500 ${
          isSpinning
            ? 'opacity-75 dark:opacity-90 animate-wheel-aura bg-gradient-to-tr from-blue-500/40 via-indigo-500/35 to-purple-500/40'
            : 'opacity-25 dark:opacity-45 bg-gradient-to-tr from-blue-500/20 via-indigo-500/15 to-emerald-400/15'
        }`}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[460px] xl:max-w-[520px] aspect-square flex items-center justify-center">
        {/* Top Clapper Pointer at 12 o'clock */}
        <div
          className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-20 transition-transform duration-75 origin-[50%_10px]"
          style={{ transform: `rotate(${clapperTilt}deg)` }}
          aria-hidden="true"
        >
          <svg width="42" height="50" viewBox="0 0 42 50" className="drop-shadow-lg">
            <path
              d="M21 48 L6 14 C3 7 8 2 15 2 L27 2 C34 2 39 7 36 14 Z"
              fill="#0F172A"
              stroke="#FFFFFF"
              strokeWidth="2.5"
              className="dark:fill-white dark:stroke-slate-900"
            />
            <circle cx="21" cy="14" r="5" fill="#3B82F6" />
          </svg>
        </div>

        {/* Main SVG Wheel */}
        <svg
          ref={svgRef}
          viewBox="0 0 500 500"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`w-full h-full touch-none ${
            entries.length >= 2 && !isSpinning ? 'cursor-grab active:cursor-grabbing' : ''
          }`}
          role="img"
          aria-label="Pickerwel interactive spinning wheel"
        >
          <defs>
            <filter id="wheelShadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#0F172A" floodOpacity="0.18" />
            </filter>
            <linearGradient id="hubGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#4F46E5" />
            </linearGradient>
          </defs>

          {/* Outer Bezel Ring */}
          <circle
            cx={cx}
            cy={cy}
            r={radius + 12}
            className="fill-white dark:fill-slate-800 stroke-slate-200 dark:stroke-slate-700"
            strokeWidth="3"
            filter="url(#wheelShadow)"
          />

          {count === 0 ? (
            <g>
              <circle
                cx={cx}
                cy={cy}
                r={radius}
                className="fill-slate-100 dark:fill-slate-800/90 stroke-slate-300 dark:stroke-slate-700"
                strokeWidth="2"
                strokeDasharray="8 6"
              />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                className="fill-slate-700 dark:fill-slate-200 font-display text-base font-semibold"
              >
                {emptyTitle}
              </text>
              <text
                x={cx}
                y={cy + 18}
                textAnchor="middle"
                className="fill-slate-500 dark:fill-slate-400 text-xs"
              >
                {emptyDesc.slice(0, 44)}
              </text>
            </g>
          ) : (
            <g transform={`rotate(${rotation} ${cx} ${cy})`}>
              {count === 1 ? (
                <g>
                  <circle cx={cx} cy={cy} r={radius} fill={colors[0]} />
                  <text
                    x={cx + radius * 0.52}
                    y={cy}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill={getContrastTextColor(colors[0])}
                    fontSize="18"
                    fontWeight="700"
                    className="font-display pointer-events-none"
                  >
                    {truncateLabel(entries[0], 18)}
                  </text>
                </g>
              ) : (
                entries.map((entry, idx) => {
                  const startDeg = idx * sliceAngle;
                  const endDeg = (idx + 1) * sliceAngle;
                  const midDeg = startDeg + sliceAngle / 2;
                  const p1 = polarToCartesian(cx, cy, radius, startDeg);
                  const p2 = polarToCartesian(cx, cy, radius, endDeg);
                  const largeArc = sliceAngle > 180 ? 1 : 0;
                  const fill = colors[idx];
                  const textColor = getContrastTextColor(fill);
                  const isHovered = !isSpinning && hoveredSliceIndex === idx;

                  return (
                    <g
                      key={`${idx}-${entry}`}
                      onMouseEnter={() => {
                        if (!isSpinning) onHoverSlice(idx);
                      }}
                      onMouseLeave={() => {
                        if (!isSpinning) onHoverSlice(null);
                      }}
                      style={{
                        transformOrigin: `${cx}px ${cy}px`,
                        transform: isHovered ? 'scale(1.045)' : 'scale(1)',
                        transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className="cursor-pointer"
                    >
                      <path
                        d={`M ${cx} ${cy} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 ${largeArc} 1 ${p2.x} ${p2.y} Z`}
                        fill={fill}
                        stroke="#FFFFFF"
                        strokeWidth={count > 40 ? '1' : '2.2'}
                      />
                      {count <= 60 && (
                        <g transform={`rotate(${midDeg - 90} ${cx} ${cy})`}>
                          <text
                            x={cx + radius * 0.62}
                            y={cy}
                            textAnchor="middle"
                            dominantBaseline="central"
                            fill={textColor}
                            fontSize={labelFontSize}
                            fontWeight="600"
                            className="pointer-events-none select-none font-display"
                          >
                            {truncateLabel(entry, maxLabelChars)}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })
              )}

              {/* Outer Rim Boundary Pegs */}
              {count >= 2 &&
                count <= 60 &&
                entries.map((_, idx) => {
                  const pegPos = polarToCartesian(cx, cy, radius + 4, idx * sliceAngle);
                  return (
                    <circle
                      key={`peg-${idx}`}
                      cx={pegPos.x}
                      cy={pegPos.y}
                      r={count > 24 ? 2.5 : 3.6}
                      className="fill-slate-800 dark:fill-slate-100 stroke-white dark:stroke-slate-900"
                      strokeWidth="1.2"
                    />
                  );
                })}
            </g>
          )}
        </svg>

        {/* Center Interactive SPIN Hub Button */}
        <button
          type="button"
          data-spin-hub="true"
          disabled={isSpinning || count < 2}
          onClick={() => launchSpin(1, 0)}
          aria-label={spinLabel}
          className={`absolute z-10 w-[86px] h-[86px] sm:w-[96px] sm:h-[96px] rounded-full flex items-center justify-center font-latin font-bold tracking-wider text-white border-4 border-white dark:border-slate-900 shadow-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-400 ${
            count < 2
              ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-80'
              : isSpinning
              ? 'bg-indigo-600 scale-95 cursor-wait shadow-indigo-500/40'
              : 'bg-gradient-to-br from-[#3B82F6] to-[#4F46E5] hover:scale-105 active:scale-95 cursor-pointer shadow-blue-500/35'
          }`}
        >
          <span className="text-base sm:text-lg">{spinLabel}</span>
        </button>
      </div>

      {/* Inline Spin Sound Selector */}
      <div
        className="mt-3 w-full max-w-xl flex flex-wrap items-center justify-center gap-1.5"
        role="group"
        aria-label={t.spinSoundLabel}
      >
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
          {soundEnabled ? (
            <Volume2 className="w-3.5 h-3.5 text-[#3B82F6]" />
          ) : (
            <VolumeX className="w-3.5 h-3.5 text-slate-400" />
          )}
          <span>{t.spinSoundLabel}:</span>
        </span>
        {SPIN_SOUND_OPTIONS.map((opt) => {
          const isSelected = activeSpinSound === opt.id;
          const Icon =
            opt.id === 'chime-bell'
              ? Music
              : opt.id === 'breeze-whoosh'
              ? Wind
              : opt.id === 'casino-click'
              ? Sparkles
              : Disc3;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                if (onChangeSpinSound) {
                  onChangeSpinSound(opt.id);
                } else {
                  setInternalSpinSound(opt.id);
                }
                previewSpinSound(opt.id);
              }}
              aria-pressed={isSelected}
              className={`min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400 shadow-xs'
                  : 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span>{language === 'km' ? opt.nameKm : opt.nameEn}</span>
            </button>
          );
        })}
        {!soundEnabled && (
          <span className="text-[11px] text-slate-400 dark:text-slate-500 ml-1">
            ({t.spinSoundMutedHint})
          </span>
        )}
      </div>
    </div>
  );
}
