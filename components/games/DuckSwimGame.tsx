'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { Flag, Play, RotateCcw, Trash2, Trophy, Waves } from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { getSegmentColors, type PaletteId } from '@/lib/palettes';
import {
  playDuckQuackSound,
  playSplashSound,
  playTickSound,
  playWinSound,
  triggerHaptic,
} from '@/lib/sound';
import { QUICK_START_ENTRIES } from '@/lib/templates';
import { COPY } from '@/lib/i18n';

type DuckRacePhase = 'IDLE' | 'RACING' | 'FINISHED';
type RacePace = 'fast' | 'classic' | 'long';

interface DuckRacer {
  id: string;
  lane: number;
  label: string;
  color: string;
  /** Progress from 0 (start gate) to 1 (finish buoy) */
  progress: number;
  baseSpeed: number;
  currentSpeed: number;
  surgeTimer: number;
  surgeAmount: number;
  bobPhase: number;
  wingPhase: number;
  boostFlash: number;
  finishRank: number | null;
  finishTimeMs: number | null;
}

interface RippleEffect {
  xNorm: number;
  lane: number;
  age: number;
  maxAge: number;
  color: string;
}

const PACE_DURATION_MS: Record<RacePace, number> = {
  fast: 7000,
  classic: 12000,
  long: 18000,
};

const MAX_DISPLAYED_RACERS = 16;

function buildRacers(entries: string[], paletteId: PaletteId): DuckRacer[] {
  const pool = entries.slice(0, MAX_DISPLAYED_RACERS);
  const colors = getSegmentColors(pool.length, paletteId);
  return pool.map((label, idx) => ({
    id: `duck_${idx}_${label}`,
    lane: idx,
    label,
    color: colors[idx] || '#3B82F6',
    progress: 0,
    baseSpeed: 1,
    currentSpeed: 0,
    surgeTimer: 0.4 + Math.random() * 1.4,
    surgeAmount: 0,
    bobPhase: idx * 0.85,
    wingPhase: idx * 1.1,
    boostFlash: 0,
    finishRank: null,
    finishTimeMs: null,
  }));
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function DuckSwimGame() {
  const { activeWheel, updateActiveWheel, logSpinOutcome, settings } = usePickerwel();
  const t = COPY[settings.language];

  const [poolEntries, setPoolEntries] = useState<string[]>(() =>
    activeWheel.entries.length > 0 ? [...activeWheel.entries] : [...QUICK_START_ENTRIES]
  );
  const [phase, setPhase] = useState<DuckRacePhase>('IDLE');
  const [pace, setPace] = useState<RacePace>('classic');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [racesCount, setRacesCount] = useState(0);
  const [podium, setPodium] = useState<DuckRacer[]>([]);
  const [isDark, setIsDark] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const racersRef = useRef<DuckRacer[]>(
    buildRacers(
      activeWheel.entries.length > 0 ? activeWheel.entries : QUICK_START_ENTRIES,
      activeWheel.paletteId
    )
  );
  const ripplesRef = useRef<RippleEffect[]>([]);
  const phaseRef = useRef<DuckRacePhase>('IDLE');
  const paceRef = useRef<RacePace>('classic');
  const raceStartPerfRef = useRef<number>(0);
  const finishCounterRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const waterClockRef = useRef<number>(0);

  const [racerCount, setRacerCount] = useState(() =>
    Math.min(
      MAX_DISPLAYED_RACERS,
      activeWheel.entries.length > 0
        ? activeWheel.entries.length
        : QUICK_START_ENTRIES.length
    )
  );

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    paceRef.current = pace;
  }, [pace]);

  // Track dark mode class cleanly on <html>
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const syncDark = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    syncDark();
    const observer = new MutationObserver(syncDark);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  // Sync lanes when active wheel updates
  useEffect(() => {
    const source =
      activeWheel.entries.length > 0 ? [...activeWheel.entries] : [...QUICK_START_ENTRIES];
    const nextRacers = buildRacers(source, activeWheel.paletteId);
    racersRef.current = nextRacers;
    ripplesRef.current = [];
    finishCounterRef.current = 0;

    queueMicrotask(() => {
      setPoolEntries(source);
      setRacerCount(nextRacers.length);
      setPhase('IDLE');
      phaseRef.current = 'IDLE';
      setElapsedMs(0);
      setPodium([]);
    });
  }, [activeWheel.id, activeWheel.entries, activeWheel.paletteId]);

  const triggerWinnerCelebration = useCallback(
    (winner: DuckRacer, orderedFinishers: DuckRacer[]) => {
      setPodium(orderedFinishers);
      setRacesCount((c) => c + 1);
      setPhase('FINISHED');
      phaseRef.current = 'FINISHED';

      if (settings.soundEnabled) {
        playDuckQuackSound();
        window.setTimeout(() => playWinSound(), 140);
      }
      if (settings.hapticsEnabled) {
        triggerHaptic([45, 30, 80]);
      }
      if (
        settings.confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({
          particleCount: 75,
          spread: 68,
          origin: { y: 0.56 },
          colors: [winner.color, '#FBBF24', '#0EA5E9', '#10B981'],
        });
      }
    },
    [settings.confettiEnabled, settings.hapticsEnabled, settings.soundEnabled]
  );

  // Canvas animation & race physics loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let lastTime = performance.now();
    let lastHudUpdate = 0;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const count = Math.max(1, racersRef.current.length);
      const minHeight = Math.max(340, Math.min(580, count * 46 + 56));
      const targetWidth = Math.max(280, Math.floor(rect.width));
      const targetHeight = Math.max(minHeight, Math.floor(rect.height || minHeight));

      if (canvas.width !== targetWidth * dpr || canvas.height !== targetHeight * dpr) {
        canvas.width = targetWidth * dpr;
        canvas.height = targetHeight * dpr;
        canvas.style.width = `${targetWidth}px`;
        canvas.style.height = `${targetHeight}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { width: targetWidth, height: targetHeight };
    };

    const drawDuck = (
      racer: DuckRacer,
      cx: number,
      cy: number,
      scale: number,
      swimTime: number
    ) => {
      ctx.save();
      const bob =
        reducedMotion
          ? 0
          : Math.sin(racer.bobPhase + swimTime * (phaseRef.current === 'RACING' ? 6 : 2.3)) *
            2.4 *
            scale;
      const tilt =
        reducedMotion || phaseRef.current !== 'RACING'
          ? 0
          : Math.sin(racer.bobPhase + swimTime * 7) * 0.055 +
            Math.min(0.1, racer.boostFlash * 0.08);

      ctx.translate(cx, cy + bob);
      ctx.rotate(tilt);

      // Wake V-trail & foam bubbles behind duck when racing or idling
      const wakeSpeed = phaseRef.current === 'RACING' ? 1 : 0.35;
      ctx.save();
      ctx.strokeStyle = isDark
        ? `rgba(186, 230, 253, ${0.26 * wakeSpeed})`
        : `rgba(255, 255, 255, ${0.65 * wakeSpeed})`;
      ctx.lineWidth = 1.6 * scale;
      ctx.lineCap = 'round';
      const rippleSpread = (6 + Math.sin(swimTime * 8 + racer.lane) * 1.8) * scale;
      ctx.beginPath();
      ctx.moveTo(-11 * scale, 6 * scale);
      ctx.lineTo(-27 * scale, 6 * scale - rippleSpread);
      ctx.moveTo(-11 * scale, 9 * scale);
      ctx.lineTo(-27 * scale, 9 * scale + rippleSpread);
      ctx.stroke();

      if (phaseRef.current === 'RACING') {
        for (let b = 0; b < 3; b++) {
          const offset = ((swimTime * 22 + b * 7 + racer.lane * 5) % 22) * scale;
          ctx.fillStyle = isDark
            ? 'rgba(224, 242, 254, 0.36)'
            : 'rgba(255, 255, 255, 0.72)';
          ctx.beginPath();
          ctx.arc(
            -16 * scale - offset,
            (7 + Math.sin(b * 2.1 + swimTime * 5) * 3) * scale,
            (2.2 - offset / (14 * scale)) * scale,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }
      ctx.restore();

      // Paddling orange foot splash beneath waterline
      const kick = Math.sin(racer.wingPhase) * 3.5 * scale;
      ctx.fillStyle = '#EA580C';
      ctx.beginPath();
      ctx.ellipse(-6 * scale + kick * 0.4, 10.5 * scale, 4.5 * scale, 2.2 * scale, -0.25, 0, Math.PI * 2);
      ctx.fill();

      // Colored swim float ring / racing stripe around lower body
      ctx.fillStyle = racer.color;
      ctx.beginPath();
      ctx.ellipse(0, 7.5 * scale, 13.5 * scale, 5.2 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 1.1 * scale;
      ctx.stroke();

      // Plump golden-yellow duck body
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.ellipse(0, 2.5 * scale, 12.2 * scale, 8.2 * scale, -0.06, 0, Math.PI * 2);
      ctx.fill();

      // Tail feathers perk
      ctx.fillStyle = '#EAB308';
      ctx.beginPath();
      ctx.moveTo(-9.5 * scale, 1 * scale);
      ctx.lineTo(-15.5 * scale, -4.5 * scale);
      ctx.lineTo(-11.5 * scale, 4.5 * scale);
      ctx.closePath();
      ctx.fill();

      // Animated flapping wing
      const wingLift = Math.sin(racer.wingPhase) * 2.5 * scale;
      ctx.fillStyle = '#FDE047';
      ctx.strokeStyle = '#CA8A04';
      ctx.lineWidth = 0.8 * scale;
      ctx.beginPath();
      ctx.ellipse(-1 * scale, (2.2 - wingLift * 0.35) * scale, 6.2 * scale, 3.6 * scale, -0.18 + wingLift * 0.04, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Duck head
      ctx.fillStyle = '#FACC15';
      ctx.beginPath();
      ctx.arc(8.2 * scale, -6.2 * scale, 6.2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Colored Racing Cap / Helmet matching wheel color
      ctx.fillStyle = racer.color;
      ctx.beginPath();
      ctx.arc(7.8 * scale, -7.2 * scale, 6.2 * scale, Math.PI * 1.05, Math.PI * 1.98);
      ctx.closePath();
      ctx.fill();
      // Cap visor
      ctx.fillStyle = racer.color;
      ctx.beginPath();
      ctx.ellipse(12.2 * scale, -8.3 * scale, 3.6 * scale, 1.3 * scale, 0.15, 0, Math.PI * 2);
      ctx.fill();

      // Orange Duck Bill
      ctx.fillStyle = '#F97316';
      ctx.beginPath();
      ctx.ellipse(15.2 * scale, -5.0 * scale, 4.5 * scale, 2.1 * scale, 0.08, 0, Math.PI * 2);
      ctx.fill();

      // Eye + glint
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(10.3 * scale, -6.4 * scale, 1.45 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(10.8 * scale, -6.9 * scale, 0.52 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Boost halo burst when tapped or surging
      if (racer.boostFlash > 0.05) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${racer.boostFlash * 0.85})`;
        ctx.lineWidth = 2 * scale;
        ctx.beginPath();
        ctx.arc(2 * scale, 0, (17 + (1 - racer.boostFlash) * 8) * scale, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.restore();
    };

    const renderFrame = (now: number) => {
      const dtSec = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      waterClockRef.current += dtSec;

      const { width, height } = resizeCanvas();
      const racers = racersRef.current;
      const count = Math.max(1, racers.length);

      const topPad = 24;
      const bottomPad = 18;
      const laneAreaHeight = Math.max(120, height - topPad - bottomPad);
      const laneHeight = laneAreaHeight / count;
      const duckScale = Math.max(0.62, Math.min(1.06, laneHeight / 44));

      const startX = Math.max(54, Math.min(82, width * 0.095));
      const finishX = width - Math.max(46, Math.min(72, width * 0.085));
      const trackSpan = Math.max(80, finishX - startX);

      // Update race physics when RACING
      if (phaseRef.current === 'RACING' && racers.length > 0) {
        const targetDurationSec = PACE_DURATION_MS[paceRef.current] / 1000;
        const baseRate = 1 / targetDurationSec;
        const elapsed = now - raceStartPerfRef.current;

        if (now - lastHudUpdate > 75) {
          lastHudUpdate = now;
          setElapsedMs(elapsed);
        }

        let allFinished = true;
        for (const r of racers) {
          if (r.finishRank !== null) {
            r.boostFlash = Math.max(0, r.boostFlash - dtSec * 2.2);
            continue;
          }
          allFinished = false;

          r.surgeTimer -= dtSec;
          if (r.surgeTimer <= 0) {
            r.surgeTimer = 0.45 + Math.random() * 1.1;
            // Random wave surges so ducks weave and overtake excitedly
            r.surgeAmount = (Math.random() - 0.42) * 0.72;
          }

          const boostBonus = r.boostFlash > 0 ? r.boostFlash * 0.42 : 0;
          const speedMultiplier = Math.max(0.45, 1 + r.surgeAmount + boostBonus);
          r.currentSpeed = baseRate * speedMultiplier;
          r.progress = Math.min(1, r.progress + r.currentSpeed * dtSec);
          r.wingPhase += dtSec * (11 + speedMultiplier * 8);
          r.boostFlash = Math.max(0, r.boostFlash - dtSec * 2.4);

          if (r.progress >= 1 && r.finishRank === null) {
            finishCounterRef.current += 1;
            r.finishRank = finishCounterRef.current;
            r.finishTimeMs = elapsed;
            if (r.finishRank === 1 && settings.soundEnabled) {
              playTickSound(0.28);
            }
          }
        }

        if (allFinished || finishCounterRef.current >= Math.min(3, racers.length)) {
          // Ensure remaining unfinished ducks rank smoothly by current progress
          const ranked = [...racers].sort((a, b) => {
            if (a.finishRank !== null && b.finishRank !== null) {
              return a.finishRank - b.finishRank;
            }
            if (a.finishRank !== null) return -1;
            if (b.finishRank !== null) return 1;
            return b.progress - a.progress;
          });
          setElapsedMs(elapsed);
          triggerWinnerCelebration(ranked[0], ranked.slice(0, 3));
        }
      } else {
        // Gentle idle paddle
        for (const r of racers) {
          r.wingPhase += dtSec * 3.2;
          r.boostFlash = Math.max(0, r.boostFlash - dtSec * 2.2);
        }
      }

      // Draw water background
      const waterGrad = ctx.createLinearGradient(0, 0, 0, height);
      if (isDark) {
        waterGrad.addColorStop(0, '#0C4A6E');
        waterGrad.addColorStop(0.55, '#0F516E');
        waterGrad.addColorStop(1, '#0B3954');
      } else {
        waterGrad.addColorStop(0, '#BAE6FD');
        waterGrad.addColorStop(0.5, '#67E8F9');
        waterGrad.addColorStop(1, '#22D3EE');
      }
      ctx.fillStyle = waterGrad;
      ctx.fillRect(0, 0, width, height);

      // Subtle animated water shimmer bands
      if (!reducedMotion) {
        ctx.save();
        ctx.strokeStyle = isDark
          ? 'rgba(125, 211, 252, 0.08)'
          : 'rgba(255, 255, 255, 0.34)';
        ctx.lineWidth = 1.5;
        for (let w = 0; w < 6; w++) {
          const yBase = topPad + (laneAreaHeight * (w + 0.5)) / 6;
          ctx.beginPath();
          for (let x = 0; x <= width; x += 28) {
            const dy = Math.sin(x * 0.02 + waterClockRef.current * 1.9 + w) * 3;
            if (x === 0) ctx.moveTo(x, yBase + dy);
            else ctx.lineTo(x, yBase + dy);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // Start gate vertical rope & Finish checkered buoy line
      ctx.save();
      ctx.strokeStyle = isDark ? 'rgba(226, 232, 240, 0.25)' : 'rgba(15, 23, 42, 0.18)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(startX, topPad - 6);
      ctx.lineTo(startX, height - bottomPad + 6);
      ctx.stroke();
      ctx.setLineDash([]);

      // Checkered finish strip
      const checkerSize = 6;
      for (let y = topPad - 6; y < height - bottomPad + 2; y += checkerSize) {
        const odd = Math.floor(y / checkerSize) % 2 === 0;
        ctx.fillStyle = odd ? '#FFFFFF' : '#0F172A';
        ctx.fillRect(finishX - 3, y, 6, Math.min(checkerSize, height - bottomPad + 6 - y));
      }

      // Top & bottom finish buoys
      [topPad - 8, height - bottomPad + 6].forEach((by) => {
        ctx.fillStyle = '#EF4444';
        ctx.beginPath();
        ctx.arc(finishX, by, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
      ctx.restore();

      // Lane dividers + lane number / name plates
      racers.forEach((racer, idx) => {
        const laneTop = topPad + idx * laneHeight;
        const laneCenterY = laneTop + laneHeight / 2;

        if (idx > 0) {
          ctx.strokeStyle = isDark
            ? 'rgba(148, 163, 184, 0.16)'
            : 'rgba(15, 23, 42, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(16, laneTop);
          ctx.lineTo(width - 16, laneTop);
          ctx.stroke();
        }

        // Duck screen position
        const duckX = startX + racer.progress * trackSpan;

        // Draw any active tap ripples for this lane
        ripplesRef.current = ripplesRef.current.filter((rp) => {
          rp.age += dtSec;
          if (rp.age >= rp.maxAge) return false;
          if (rp.lane === idx) {
            const p = rp.age / rp.maxAge;
            ctx.save();
            ctx.strokeStyle = isDark
              ? `rgba(255, 255, 255, ${(1 - p) * 0.75})`
              : `rgba(255, 255, 255, ${(1 - p) * 0.92})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.ellipse(
              startX + rp.xNorm * trackSpan,
              laneCenterY + 5 * duckScale,
              (12 + p * 26) * duckScale,
              (5 + p * 11) * duckScale,
              0,
              0,
              Math.PI * 2
            );
            ctx.stroke();
            ctx.restore();
          }
          return true;
        });

        drawDuck(racer, duckX, laneCenterY, duckScale, waterClockRef.current);

        // Crisp readable name tag beside the duck (left on early swim, trails cleanly near finish)
        const fontSize = Math.max(11, Math.min(13, Math.floor(laneHeight * 0.34)));
        ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
        const tagLabel = `${idx + 1}. ${racer.label}`;
        const maxLabelWidth = Math.min(150, width * 0.32);

        let displayText = tagLabel;
        if (ctx.measureText(displayText).width > maxLabelWidth) {
          while (
            displayText.length > 4 &&
            ctx.measureText(`${displayText}…`).width > maxLabelWidth
          ) {
            displayText = displayText.slice(0, -1);
          }
          displayText = `${displayText}…`;
        }

        const textWidth = ctx.measureText(displayText).width;
        const padX = 8;
        const pillW = textWidth + padX * 2;
        const pillH = Math.max(20, fontSize + 8);
        const placeLeft = duckX > finishX - pillW - 26;
        const tagX = placeLeft
          ? Math.max(10, duckX - 22 * duckScale - pillW)
          : Math.min(width - pillW - 8, duckX + 22 * duckScale);
        const tagY = laneCenterY - pillH / 2;

        ctx.save();
        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.84)' : 'rgba(255, 255, 255, 0.9)';
        ctx.strokeStyle = racer.color;
        ctx.lineWidth = 1.4;
        drawRoundedRect(ctx, tagX, tagY, pillW, pillH, 7);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
        ctx.textBaseline = 'middle';
        ctx.fillText(displayText, tagX + padX, laneCenterY + 0.5);
        ctx.restore();
      });

      rafRef.current = requestAnimationFrame(renderFrame);
    };

    rafRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isDark, settings.soundEnabled, triggerWinnerCelebration]);

  const handleStartRace = () => {
    if (racersRef.current.length === 0 || phase === 'RACING') return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Reset positions fairly
    racersRef.current.forEach((r) => {
      r.progress = 0;
      r.surgeTimer = 0.25 + Math.random() * 0.9;
      r.surgeAmount = 0;
      r.finishRank = null;
      r.finishTimeMs = null;
      r.boostFlash = 0;
    });
    ripplesRef.current = [];
    finishCounterRef.current = 0;
    setPodium([]);
    setElapsedMs(0);

    if (reducedMotion) {
      // Fair immediate shuffle finish for reduced-motion accessibility
      const shuffled = [...racersRef.current].sort(() => Math.random() - 0.5);
      shuffled.forEach((r, idx) => {
        r.progress = Math.max(0.75, 1 - idx * 0.05);
        r.finishRank = idx + 1;
        r.finishTimeMs = 1000 + idx * 120;
      });
      triggerWinnerCelebration(shuffled[0], shuffled.slice(0, 3));
      return;
    }

    if (settings.soundEnabled) {
      playDuckQuackSound();
      playSplashSound();
    }
    if (settings.hapticsEnabled) triggerHaptic(22);

    raceStartPerfRef.current = performance.now();
    phaseRef.current = 'RACING';
    setPhase('RACING');
  };

  const handleResetLanes = () => {
    const source =
      activeWheel.entries.length > 0 ? [...activeWheel.entries] : [...QUICK_START_ENTRIES];
    const nextRacers = buildRacers(source, activeWheel.paletteId);
    racersRef.current = nextRacers;
    ripplesRef.current = [];
    finishCounterRef.current = 0;
    phaseRef.current = 'IDLE';
    setPoolEntries(source);
    setRacerCount(nextRacers.length);
    setPhase('IDLE');
    setElapsedMs(0);
    setPodium([]);
  };

  const handleCanvasTap = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || racersRef.current.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const topPad = 24;
    const bottomPad = 18;
    const laneArea = Math.max(120, rect.height - topPad - bottomPad);
    const laneIdx = Math.floor(
      ((clickY - topPad) / laneArea) * racersRef.current.length
    );

    if (laneIdx < 0 || laneIdx >= racersRef.current.length) return;
    const tapped = racersRef.current[laneIdx];
    if (!tapped) return;

    tapped.boostFlash = 1;
    if (phaseRef.current === 'RACING' && tapped.finishRank === null) {
      tapped.progress = Math.min(0.985, tapped.progress + 0.018);
    }

    ripplesRef.current.push({
      xNorm: tapped.progress,
      lane: laneIdx,
      age: 0,
      maxAge: 0.65,
      color: tapped.color,
    });

    if (settings.soundEnabled) playDuckQuackSound();
    if (settings.hapticsEnabled) triggerHaptic(12);
  };

  const handleKeepAndRaceAgain = async () => {
    const winner = podium[0];
    if (winner) {
      await logSpinOutcome({
        winner: winner.label,
        winnerColor: winner.color,
        removedAfterSpin: false,
      });
    }
    racersRef.current.forEach((r) => {
      r.progress = 0;
      r.finishRank = null;
      r.finishTimeMs = null;
      r.boostFlash = 0;
    });
    ripplesRef.current = [];
    finishCounterRef.current = 0;
    phaseRef.current = 'IDLE';
    setPodium([]);
    setElapsedMs(0);
    setPhase('IDLE');
  };

  const handleRemoveWinnerAndNext = async () => {
    const winner = podium[0];
    if (!winner) return;
    const idxToRemove = poolEntries.indexOf(winner.label);
    const nextEntries =
      idxToRemove >= 0
        ? poolEntries.filter((_, i) => i !== idxToRemove)
        : poolEntries;

    setPoolEntries(nextEntries);
    if (activeWheel.entries.length > 1) {
      updateActiveWheel({ entries: nextEntries });
    }
    await logSpinOutcome({
      winner: winner.label,
      winnerColor: winner.color,
      removedAfterSpin: true,
      updatedEntries: nextEntries,
    });

    const nextRacers = buildRacers(nextEntries, activeWheel.paletteId);
    racersRef.current = nextRacers;
    ripplesRef.current = [];
    finishCounterRef.current = 0;
    phaseRef.current = 'IDLE';
    setRacerCount(nextRacers.length);
    setPodium([]);
    setElapsedMs(0);
    setPhase('IDLE');
  };

  const paceOptions: { id: RacePace; label: string }[] = [
    { id: 'fast', label: t.duckSpeedFast },
    { id: 'classic', label: t.duckSpeedClassic },
    { id: 'long', label: t.duckSpeedLong },
  ];

  const winner = podium[0] ?? null;

  return (
    <div className="space-y-4">
      {/* Header + Unobtrusive Metadata + Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.duckTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.duckDesc}{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="tabular-nums">{t.duckRacersCount(racerCount)}</span>{' '}
            <span aria-hidden="true">·</span>{' '}
            <span className="tabular-nums">
              {t.duckRacesCountLabel}: {racesCount}
            </span>
            {phase === 'RACING' && (
              <>
                {' '}
                <span aria-hidden="true">·</span>{' '}
                <span className="font-mono tabular-nums font-semibold text-sky-600 dark:text-sky-400">
                  {(elapsedMs / 1000).toFixed(1)}s
                </span>
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Race Duration Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {paceOptions.map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={phase === 'RACING'}
                onClick={() => setPace(opt.id)}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-60 ${
                  pace === opt.id
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleStartRace}
            disabled={phase === 'RACING' || racerCount === 0}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] hover:from-sky-600 hover:to-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            {phase === 'RACING' ? (
              <Waves className="w-4 h-4 animate-pulse" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            <span>{phase === 'RACING' ? t.duckRacingBtn : t.duckStartBtn}</span>
          </button>

          <button
            type="button"
            onClick={handleResetLanes}
            title={t.duckResetBtn}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{t.duckResetBtn}</span>
          </button>
        </div>
      </div>

      {/* Interactive Swimming Duck Pond Canvas */}
      <div
        ref={containerRef}
        className="relative w-full min-h-[360px] max-h-[600px] rounded-3xl overflow-x-hidden overflow-y-auto border border-sky-200 dark:border-slate-800 shadow-inner select-none bg-sky-200 dark:bg-sky-950"
      >
        {racerCount === 0 ? (
          <div className="min-h-[360px] flex flex-col items-center justify-center p-6 text-center">
            <Waves className="w-10 h-10 text-sky-700/60 dark:text-sky-300/60 mb-2" />
            <p className="font-display text-base font-semibold text-slate-800 dark:text-white">
              {t.duckEmptyMsg}
            </p>
            <button
              type="button"
              onClick={handleResetLanes}
              className="mt-4 min-h-[44px] px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer"
            >
              {t.duckResetBtn}
            </button>
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleCanvasTap}
            className="block w-full cursor-pointer touch-manipulation"
            aria-label={t.duckTitle}
          />
        )}

        {/* Finish Winner & Top 3 Podium Overlay */}
        {phase === 'FINISHED' && winner && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-center shadow-2xl max-h-[90%] overflow-y-auto">
              <div
                className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-3 shadow-md"
                style={{ backgroundColor: winner.color }}
              >
                <Trophy className="w-6 h-6" />
              </div>

              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.duckWinnerLabel}
              </p>
              <h3 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white break-words">
                {winner.label}
              </h3>

              {/* Top 3 Finishers List */}
              {podium.length > 1 && (
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-left space-y-1.5">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    {t.duckPodiumTitle}
                  </p>
                  {podium.map((entry, idx) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between gap-2 text-xs sm:text-sm py-1 px-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-5 h-5 rounded-md text-[11px] font-bold text-white flex items-center justify-center shrink-0 tabular-nums"
                          style={{ backgroundColor: entry.color }}
                        >
                          {idx + 1}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                          {entry.label}
                        </span>
                      </div>
                      <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleKeepAndRaceAgain}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-xs font-semibold cursor-pointer"
                >
                  {t.duckKeepBtn}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveWinnerAndNext}
                  className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.duckRemoveBtn}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t.duckTapHint}
      </p>
    </div>
  );
}
