'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  Gauge,
  Play,
  Plus,
  RotateCcw,
  Shuffle,
  Timer,
  Trash2,
  Trophy,
  Users,
  WavesLadder,
  XCircle,
  Zap,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { MathText } from '../MathText';
import { SubjectGradeQuizPicker, type QuizCreatePreset } from './SubjectGradeQuizPicker';
import { getSegmentColors } from '@/lib/palettes';
import {
  resolveQuizGradeId,
  resolveQuizSubjectId,
  STARTER_OFFLINE_QUIZZES,
  type OfflineQuiz,
  type QuizQuestion,
} from '@/lib/offline-quizzes';
import { QUICK_START_ENTRIES } from '@/lib/templates';
import {
  playCorrectSound,
  playSplashSound,
  playTickSound,
  playWaterStrokeSound,
  playWinSound,
  playWrongSound,
  triggerHaptic,
} from '@/lib/sound';
import { COPY } from '@/lib/i18n';

export interface SwimmingGameProps {
  quizzes?: OfflineQuiz[];
  onCreateQuiz?: (preset?: QuizCreatePreset) => void;
  onEditQuiz?: (quiz: OfflineQuiz) => void;
}

type SwimMode = 'pick_rep' | 'quiz_race' | 'arcade';
type RosterSource = 'students' | 'teams';
type ClassroomPhase = 'IDLE' | 'RACING' | 'QUESTION' | 'CHAMPION';
type ArcadePhase = 'IDLE' | 'PLAYING' | 'FINISHED';
type SwimDistance = 50 | 100 | 150;
type SwimSpeedPreset = 'slow' | 'normal' | 'fast';

interface LaneSwimmer {
  id: string;
  lane: number;
  label: string;
  repName?: string;
  capColor: string;
  suitColor: string;
  progress: number; // 0..1
  targetProgress: number; // used in quiz_race smooth glide
  armPhase: number;
  kickPhase: number;
  surgeTimer: number;
  surgeAmount: number;
  boostFlash: number;
  finishRank: number | null;
  score: number;
}

interface ArcadeSwimmer {
  id: 'player' | 'rival1' | 'rival2';
  lane: number;
  capColor: string;
  suitColor: string;
  meters: number;
  velocity: number;
  armPhase: number;
  kickPhase: number;
  basePace: number;
  paceVariance: number;
  finishTimeMs: number | null;
}

interface PoolRing {
  id: number;
  lap: number;
  laneMeters: number;
  collected: boolean;
}

interface SplashParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  gold: boolean;
}

const LAP_LENGTH_METERS = 50;
const BEST_TIME_STORAGE_KEY = 'pickerwel_swim_best_times_v1';
const SWIM_SPEED_CONFIG: Record<
  SwimSpeedPreset,
  {
    pickRaceDurationSec: number;
    quizGlidePerSec: number;
    arcadeMultiplier: number;
  }
> = {
  slow: { pickRaceDurationSec: 11.5, quizGlidePerSec: 0.38, arcadeMultiplier: 0.75 },
  normal: { pickRaceDurationSec: 6.4, quizGlidePerSec: 0.65, arcadeMultiplier: 1 },
  fast: { pickRaceDurationSec: 3.6, quizGlidePerSec: 1.2, arcadeMultiplier: 1.35 },
};
const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const;

function loadBestTimes(): Partial<Record<SwimDistance, number>> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(BEST_TIME_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<Record<SwimDistance, number>>;
  } catch {
    return {};
  }
}

function saveBestTime(
  distance: SwimDistance,
  timeMs: number
): Partial<Record<SwimDistance, number>> {
  const existing = loadBestTimes();
  const prev = existing[distance];
  const updated =
    prev === undefined || timeMs < prev
      ? { ...existing, [distance]: timeMs }
      : existing;
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(BEST_TIME_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
}

function createInitialArcadeSwimmers(): ArcadeSwimmer[] {
  return [
    {
      id: 'player',
      lane: 0,
      capColor: '#F59E0B',
      suitColor: '#2563EB',
      meters: 0,
      velocity: 0,
      armPhase: 0,
      kickPhase: 0,
      basePace: 0,
      paceVariance: 0,
      finishTimeMs: null,
    },
    {
      id: 'rival1',
      lane: 1,
      capColor: '#EC4899',
      suitColor: '#BE185D',
      meters: 0,
      velocity: 0,
      armPhase: 1.2,
      kickPhase: 0.4,
      basePace: 3.35,
      paceVariance: 0.45,
      finishTimeMs: null,
    },
    {
      id: 'rival2',
      lane: 2,
      capColor: '#10B981',
      suitColor: '#047857',
      meters: 0,
      velocity: 0,
      armPhase: 2.5,
      kickPhase: 1.9,
      basePace: 3.1,
      paceVariance: 0.5,
      finishTimeMs: null,
    },
  ];
}

function createRingsForDistance(distance: SwimDistance): PoolRing[] {
  const laps = distance / LAP_LENGTH_METERS;
  const rings: PoolRing[] = [];
  let idCounter = 1;
  for (let lap = 0; lap < laps; lap++) {
    rings.push({ id: idCounter++, lap, laneMeters: 16 + Math.random() * 8, collected: false });
    rings.push({ id: idCounter++, lap, laneMeters: 33 + Math.random() * 8, collected: false });
  }
  return rings;
}

function drawRoundedPill(
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

export function SwimmingGame({
  quizzes: propQuizzes,
  onCreateQuiz,
  onEditQuiz,
}: SwimmingGameProps) {
  const { activeWheel, updateActiveWheel, logSpinOutcome, settings } = usePickerwel();
  const t = COPY[settings.language];
  const quizzes = propQuizzes && propQuizzes.length > 0 ? propQuizzes : STARTER_OFFLINE_QUIZZES;

  const [mode, setMode] = useState<SwimMode>('pick_rep');
  const [rosterSource, setRosterSource] = useState<RosterSource>('teams');
  const [teamCount, setTeamCount] = useState<number>(4);
  const [repOffset, setRepOffset] = useState<number>(0);
  const [selectedQuizId, setSelectedQuizId] = useState<string>(() => quizzes[0]?.id ?? 'oral');
  const [studentPool, setStudentPool] = useState<string[]>(() =>
    activeWheel.entries.length > 0 ? [...activeWheel.entries] : [...QUICK_START_ENTRIES]
  );

  // Classroom swim state (pick_rep & quiz_race)
  const [classPhase, setClassPhase] = useState<ClassroomPhase>('IDLE');
  const [scoresMap, setScoresMap] = useState<Record<string, number>>({});
  const [turnLaneIdx, setTurnLaneIdx] = useState<number>(0);
  const [questionIdx, setQuestionIdx] = useState<number>(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [chosenWinner, setChosenWinner] = useState<{
    id: string;
    label: string;
    repName?: string;
    capColor: string;
  } | null>(null);

  // Arcade solo & speed state
  const [swimSpeed, setSwimSpeed] = useState<SwimSpeedPreset>('normal');
  const [distance, setDistance] = useState<SwimDistance>(50);
  const [arcadePhase, setArcadePhase] = useState<ArcadePhase>('IDLE');
  const [elapsedMs, setElapsedMs] = useState(0);
  const [playerMeters, setPlayerMeters] = useState(0);
  const [strokesCount, setStrokesCount] = useState(0);
  const [glideLevel, setGlideLevel] = useState(0);
  const [boostNotice, setBoostNotice] = useState(false);
  const [placement, setPlacement] = useState<1 | 2 | 3>(1);
  const [finalTimeMs, setFinalTimeMs] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [bestTimes, setBestTimes] = useState<Partial<Record<SwimDistance, number>>>({});
  const [isDark, setIsDark] = useState(false);

  // Canvas & animation refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const laneSwimmersRef = useRef<LaneSwimmer[]>([]);
  const arcadeSwimmersRef = useRef<ArcadeSwimmer[]>(createInitialArcadeSwimmers());
  const ringsRef = useRef<PoolRing[]>(createRingsForDistance(50));
  const splashesRef = useRef<SplashParticle[]>([]);
  const modeRef = useRef<SwimMode>('pick_rep');
  const classPhaseRef = useRef<ClassroomPhase>('IDLE');
  const arcadePhaseRef = useRef<ArcadePhase>('IDLE');
  const swimSpeedRef = useRef<SwimSpeedPreset>('normal');
  const distanceRef = useRef<SwimDistance>(50);
  const startTimeRef = useRef<number>(0);
  const lastStrokeAtRef = useRef<number>(0);
  const strokeCountRef = useRef<number>(0);
  const finishCounterRef = useRef<number>(0);
  const waterTimeRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const timerIdsRef = useRef<number[]>([]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    classPhaseRef.current = classPhase;
  }, [classPhase]);

  useEffect(() => {
    arcadePhaseRef.current = arcadePhase;
  }, [arcadePhase]);

  useEffect(() => {
    swimSpeedRef.current = swimSpeed;
  }, [swimSpeed]);

  useEffect(() => {
    distanceRef.current = distance;
  }, [distance]);

  useEffect(() => {
    queueMicrotask(() => {
      setBestTimes(loadBestTimes());
    });
  }, []);

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

  useEffect(() => {
    const timers = timerIdsRef.current;
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  // Sync student pool when active wheel changes
  useEffect(() => {
    const source =
      activeWheel.entries.length > 0 ? [...activeWheel.entries] : [...QUICK_START_ENTRIES];
    queueMicrotask(() => {
      setStudentPool(source);
      setScoresMap({});
      setTurnLaneIdx(0);
      setChosenWinner(null);
      setSelectedAnswerIdx(null);
      setAnswerFeedback(null);
      setClassPhase('IDLE');
      classPhaseRef.current = 'IDLE';
    });
  }, [activeWheel.id, activeWheel.entries]);

  // Compute current roster lanes cleanly
  const laneDescriptors = useMemo(() => {
    const maxLanes = mode === 'quiz_race' ? 8 : 10;
    const pool = studentPool.length > 0 ? studentPool : QUICK_START_ENTRIES;

    if (rosterSource === 'teams') {
      const count = Math.max(2, Math.min(6, teamCount));
      const colors = getSegmentColors(count, activeWheel.paletteId);
      return Array.from({ length: count }, (_, idx) => {
        const rep = pool.length > 0 ? pool[(idx + repOffset) % pool.length] : undefined;
        return {
          id: `team_${idx}`,
          label: `${t.swimTeamPrefix} ${idx + 1}`,
          repName: rep,
          color: colors[idx] || '#0EA5E9',
        };
      });
    }

    const visibleStudents = pool.slice(0, maxLanes);
    const colors = getSegmentColors(visibleStudents.length, activeWheel.paletteId);
    return visibleStudents.map((name, idx) => ({
      id: `student_${idx}_${name}`,
      label: name,
      repName: undefined,
      color: colors[idx] || '#3B82F6',
    }));
  }, [activeWheel.paletteId, mode, repOffset, rosterSource, studentPool, t.swimTeamPrefix, teamCount]);

  // Rebuild laneSwimmersRef whenever roster or mode resets to IDLE
  useEffect(() => {
    laneSwimmersRef.current = laneDescriptors.map((item, idx) => ({
      id: item.id,
      lane: idx,
      label: item.label,
      repName: item.repName,
      capColor: item.color,
      suitColor: item.color,
      progress: 0,
      targetProgress: 0,
      armPhase: idx * 0.9,
      kickPhase: idx * 1.1,
      surgeTimer: 0.3 + Math.random() * 1.0,
      surgeAmount: 0,
      boostFlash: 0,
      finishRank: null,
      score: scoresMap[item.id] ?? 0,
    }));
  }, [laneDescriptors, scoresMap]);

  const activeQuiz: OfflineQuiz | null = useMemo(() => {
    if (selectedQuizId === 'oral' && mode === 'pick_rep') return null;
    return quizzes.find((q) => q.id === selectedQuizId) ?? quizzes[0] ?? null;
  }, [mode, quizzes, selectedQuizId]);

  const currentQuestion: QuizQuestion | null = useMemo(() => {
    if (!activeQuiz || activeQuiz.questions.length === 0) return null;
    return activeQuiz.questions[questionIdx % activeQuiz.questions.length];
  }, [activeQuiz, questionIdx]);

  const spawnSplash = useCallback((x: number, y: number, count: number, gold = false) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 18 + Math.random() * 58;
      splashesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 0.35 + Math.random() * 0.25,
        size: 1.8 + Math.random() * 2.4,
        gold,
      });
    }
  }, []);

  const triggerConfetti = useCallback(
    (accentColor = '#0EA5E9') => {
      if (
        settings.confettiEnabled &&
        typeof window !== 'undefined' &&
        !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        confetti({
          particleCount: 70,
          spread: 68,
          origin: { y: 0.56 },
          colors: [accentColor, '#F59E0B', '#10B981', '#3B82F6'],
        });
      }
    },
    [settings.confettiEnabled]
  );

  const finishPickRepRace = useCallback(
    (winner: LaneSwimmer) => {
      classPhaseRef.current = 'QUESTION';
      setClassPhase('QUESTION');
      setSelectedAnswerIdx(null);
      setAnswerFeedback(null);
      setChosenWinner({
        id: winner.id,
        label: winner.label,
        repName: winner.repName,
        capColor: winner.capColor,
      });
      if (settings.soundEnabled) playWinSound();
      if (settings.hapticsEnabled) triggerHaptic([35, 25, 65]);
      triggerConfetti(winner.capColor);
    },
    [settings.hapticsEnabled, settings.soundEnabled, triggerConfetti]
  );

  const handleCompleteArcadeSwim = useCallback(
    (finalElapsed: number, rank: 1 | 2 | 3) => {
      arcadePhaseRef.current = 'FINISHED';
      setArcadePhase('FINISHED');
      setPlacement(rank);
      setFinalTimeMs(finalElapsed);
      setElapsedMs(finalElapsed);

      const prevBest = loadBestTimes()[distanceRef.current];
      const beatRecord = prevBest === undefined || finalElapsed < prevBest;
      const updated = saveBestTime(distanceRef.current, finalElapsed);
      setBestTimes(updated);
      setIsNewRecord(beatRecord);

      if (settings.soundEnabled) playWinSound();
      if (settings.hapticsEnabled) triggerHaptic([40, 25, 70]);
      if (rank === 1) triggerConfetti('#F59E0B');
    },
    [settings.hapticsEnabled, settings.soundEnabled, triggerConfetti]
  );

  const performArcadeStroke = useCallback(() => {
    if (modeRef.current !== 'arcade' || arcadePhaseRef.current !== 'PLAYING') return;

    const now = performance.now();
    const dtSinceLast = now - lastStrokeAtRef.current;
    lastStrokeAtRef.current = now;

    const rhythmHit = dtSinceLast >= 140 && dtSinceLast <= 480;
    const player = arcadeSwimmersRef.current[0];
    if (!player) return;

    const addSpeed = rhythmHit ? 2.1 : 1.55;
    player.velocity = Math.min(6.4, Math.max(player.velocity + addSpeed, 2.8));
    player.armPhase += 1.4;
    strokeCountRef.current += 1;
    setStrokesCount(strokeCountRef.current);

    if (settings.soundEnabled) playWaterStrokeSound(rhythmHit);
    if (settings.hapticsEnabled) triggerHaptic(rhythmHit ? 14 : 8);

    const canvas = canvasRef.current;
    if (canvas) {
      const width = canvas.clientWidth || 600;
      const height = canvas.clientHeight || 310;
      const leftPad = 46;
      const rightPad = 40;
      const lapMeters = player.meters % LAP_LENGTH_METERS;
      const lapIdx = Math.floor(player.meters / LAP_LENGTH_METERS);
      const goingRight = lapIdx % 2 === 0;
      const frac = lapMeters / LAP_LENGTH_METERS;
      const px = goingRight
        ? leftPad + frac * (width - leftPad - rightPad)
        : width - rightPad - frac * (width - leftPad - rightPad);
      const py = 30 + ((height - 48) / 3) * 0.5;
      spawnSplash(px, py, rhythmHit ? 8 : 5, rhythmHit);
    }
  }, [settings.hapticsEnabled, settings.soundEnabled, spawnSplash]);

  // Keyboard support for Arcade solo mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (modeRef.current !== 'arcade' || arcadePhaseRef.current !== 'PLAYING') return;
      if (e.code === 'Space' || e.code === 'ArrowRight' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!e.repeat) performArcadeStroke();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performArcadeStroke]);

  // Unified Canvas Renderer & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let lastFrame = performance.now();
    let lastHudSync = 0;

    const drawPoolBackdrop = (
      width: number,
      height: number,
      leftWall: number,
      rightWall: number,
      deckTop: number,
      poolHeight: number,
      laneCount: number
    ) => {
      const laneH = poolHeight / Math.max(1, laneCount);
      const laneSpan = Math.max(90, rightWall - leftWall);

      ctx.fillStyle = isDark ? '#1E293B' : '#E2E8F0';
      ctx.fillRect(0, 0, width, height);

      const waterGrad = ctx.createLinearGradient(0, deckTop, 0, deckTop + poolHeight);
      if (isDark) {
        waterGrad.addColorStop(0, '#0369A1');
        waterGrad.addColorStop(0.5, '#0284C7');
        waterGrad.addColorStop(1, '#075985');
      } else {
        waterGrad.addColorStop(0, '#7DD3FC');
        waterGrad.addColorStop(0.5, '#38BDF8');
        waterGrad.addColorStop(1, '#0EA5E9');
      }
      ctx.fillStyle = waterGrad;
      ctx.fillRect(leftWall - 4, deckTop, laneSpan + 8, poolHeight);

      // Starting blocks & finish walls
      ctx.fillStyle = isDark ? '#334155' : '#CBD5E1';
      ctx.fillRect(0, deckTop, leftWall - 4, poolHeight);
      ctx.fillRect(rightWall + 4, deckTop, width - rightWall - 4, poolHeight);

      // Touchpads
      ctx.fillStyle = '#F59E0B';
      ctx.fillRect(leftWall - 4, deckTop, 4, poolHeight);
      ctx.fillRect(rightWall, deckTop, 4, poolHeight);

      // Subtle animated water caustics
      if (!reducedMotion) {
        ctx.save();
        ctx.strokeStyle = isDark ? 'rgba(224, 242, 254, 0.11)' : 'rgba(255, 255, 255, 0.34)';
        ctx.lineWidth = 1.4;
        const bands = Math.min(8, Math.max(4, laneCount));
        for (let line = 0; line < bands; line++) {
          const yBase = deckTop + ((line + 0.5) / bands) * poolHeight;
          ctx.beginPath();
          for (let x = leftWall; x <= rightWall; x += 28) {
            const yOff = Math.sin(x * 0.024 + waterTimeRef.current * 2.1 + line) * 2.4;
            if (x === leftWall) ctx.moveTo(x, yBase + yOff);
            else ctx.lineTo(x, yBase + yOff);
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      // Lanes & floating divider ropes
      for (let lane = 0; lane < laneCount; lane++) {
        const laneTop = deckTop + lane * laneH;
        const laneMidY = laneTop + laneH / 2;

        ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.4)' : 'rgba(12, 74, 110, 0.2)';
        ctx.fillRect(leftWall + 20, laneMidY - 1.5, laneSpan - 40, 3);

        ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
        ctx.font = '700 11px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${lane + 1}`, (leftWall - 4) / 2, laneMidY);

        if (lane > 0) {
          for (let x = leftWall; x <= rightWall; x += 14) {
            const isRedZone = x < leftWall + 30 || x > rightWall - 30;
            ctx.fillStyle = isRedZone
              ? '#EF4444'
              : Math.floor(x / 14) % 2 === 0
              ? '#FFFFFF'
              : '#0284C7';
            ctx.beginPath();
            ctx.arc(x, laneTop, 2.7, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }

      // Top pennant flags
      for (let fx = leftWall + 16; fx < rightWall - 14; fx += 28) {
        ctx.fillStyle = Math.floor(fx / 28) % 2 === 0 ? '#3B82F6' : '#FACC15';
        ctx.beginPath();
        ctx.moveTo(fx, 8);
        ctx.lineTo(fx + 11, 8);
        ctx.lineTo(fx + 5.5, 19);
        ctx.closePath();
        ctx.fill();
      }
    };

    const drawSwimmerFigure = (
      sx: number,
      sy: number,
      scale: number,
      capColor: string,
      suitColor: string,
      armPhase: number,
      kickPhase: number,
      goingRight: boolean,
      boostFlash: number
    ) => {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.scale(goingRight ? scale : -scale, scale);

      // Kick foam
      const foam = 3.6 + Math.sin(kickPhase) * 2.2;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
      ctx.beginPath();
      ctx.arc(-19, -2, Math.max(1.4, foam * 0.45), 0, Math.PI * 2);
      ctx.arc(-23, 2, Math.max(1.4, foam * 0.42), 0, Math.PI * 2);
      ctx.fill();

      // Suit torso
      ctx.fillStyle = suitColor;
      ctx.beginPath();
      ctx.ellipse(-2, 0, 13.5, 6, 0, 0, Math.PI * 2);
      ctx.fill();

      // Freestyle rotating arms
      const armAngle = Math.sin(armPhase);
      ctx.strokeStyle = '#FDBA74';
      ctx.lineWidth = 3.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(3, -5);
      ctx.lineTo(3 + armAngle * 10, -10.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(3, 5);
      ctx.lineTo(3 - armAngle * 10, 10.5);
      ctx.stroke();

      // Swim cap
      ctx.fillStyle = capColor;
      ctx.beginPath();
      ctx.arc(12.5, 0, 6, 0, Math.PI * 2);
      ctx.fill();

      // Goggles
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(15, -3.2, 2.2, 6.4);

      if (boostFlash > 0.05) {
        ctx.strokeStyle = `rgba(250, 204, 21, ${boostFlash * 0.9})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(2, 0, 18 + (1 - boostFlash) * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;
      waterTimeRef.current += dt;

      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(280, Math.floor(rect.width));

      const isArcade = modeRef.current === 'arcade';
      const laneList = laneSwimmersRef.current;
      const laneCount = isArcade ? 3 : Math.max(2, laneList.length);
      const height = isArcade ? 310 : Math.max(270, Math.min(460, laneCount * 48 + 52));

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const deckTop = 28;
      const deckBottom = 16;
      const poolHeight = height - deckTop - deckBottom;
      const laneH = poolHeight / laneCount;
      const leftWall = 42;
      const rightWall = width - 34;
      const laneSpan = Math.max(90, rightWall - leftWall);

      drawPoolBackdrop(width, height, leftWall, rightWall, deckTop, poolHeight, laneCount);

      if (isArcade) {
        const targetDistance = distanceRef.current;
        const swimmers = arcadeSwimmersRef.current;

        const speedCfg = SWIM_SPEED_CONFIG[swimSpeedRef.current];

        if (arcadePhaseRef.current === 'PLAYING') {
          const elapsed = now - startTimeRef.current;
          const player = swimmers[0];
          const prevPlayerLap = Math.floor(player.meters / LAP_LENGTH_METERS);
          player.velocity = Math.max(0.45, player.velocity - dt * 2.15);
          player.meters = Math.min(
            targetDistance,
            player.meters + player.velocity * speedCfg.arcadeMultiplier * dt
          );
          player.armPhase += dt * (2.5 + player.velocity * speedCfg.arcadeMultiplier * 2.2);
          player.kickPhase += dt * (4 + player.velocity * speedCfg.arcadeMultiplier * 3.1);

          const nextPlayerLap = Math.floor(player.meters / LAP_LENGTH_METERS);
          if (nextPlayerLap > prevPlayerLap && player.meters < targetDistance) {
            player.velocity = Math.max(player.velocity, 3.6);
            const wallX = prevPlayerLap % 2 === 0 ? rightWall : leftWall;
            spawnSplash(wallX, deckTop + laneH * 0.5, 12, true);
            if (settings.soundEnabled) playSplashSound();
          }

          const currentLap = Math.floor(
            Math.min(player.meters, targetDistance - 0.01) / LAP_LENGTH_METERS
          );
          const lapLocalMeters = player.meters - currentLap * LAP_LENGTH_METERS;
          for (const ring of ringsRef.current) {
            if (!ring.collected && ring.lap === currentLap) {
              if (Math.abs(lapLocalMeters - ring.laneMeters) < 2.2) {
                ring.collected = true;
                player.velocity = Math.min(6.8, player.velocity + 1.9);
                setBoostNotice(true);
                const tid = window.setTimeout(() => setBoostNotice(false), 750);
                timerIdsRef.current.push(tid);
                if (settings.soundEnabled) playCorrectSound();
                const goingRight = currentLap % 2 === 0;
                const rx = goingRight
                  ? leftWall + (ring.laneMeters / LAP_LENGTH_METERS) * laneSpan
                  : rightWall - (ring.laneMeters / LAP_LENGTH_METERS) * laneSpan;
                spawnSplash(rx, deckTop + laneH * 0.5, 10, true);
              }
            }
          }

          if (player.meters >= targetDistance && player.finishTimeMs === null) {
            player.finishTimeMs = elapsed;
          }

          for (let i = 1; i < swimmers.length; i++) {
            const rival = swimmers[i];
            if (rival.finishTimeMs !== null) continue;
            const prevLap = Math.floor(rival.meters / LAP_LENGTH_METERS);
            const wave = Math.sin(waterTimeRef.current * (1.7 + i * 0.5) + i * 2) * rival.paceVariance;
            rival.velocity = Math.max(2.1, rival.basePace + wave);
            rival.meters = Math.min(
              targetDistance,
              rival.meters + rival.velocity * speedCfg.arcadeMultiplier * dt
            );
            rival.armPhase += dt * (3 + rival.velocity * speedCfg.arcadeMultiplier * 2.1);
            rival.kickPhase += dt * (4 + rival.velocity * speedCfg.arcadeMultiplier * 3);

            const nextLap = Math.floor(rival.meters / LAP_LENGTH_METERS);
            if (nextLap > prevLap && rival.meters < targetDistance) {
              const wallX = prevLap % 2 === 0 ? rightWall : leftWall;
              spawnSplash(wallX, deckTop + laneH * (i + 0.5), 8, false);
            }
            if (rival.meters >= targetDistance && rival.finishTimeMs === null) {
              rival.finishTimeMs = elapsed;
            }
          }

          if (now - lastHudSync > 65) {
            lastHudSync = now;
            setElapsedMs(elapsed);
            setPlayerMeters(Math.min(targetDistance, player.meters));
            setGlideLevel(Math.round(Math.min(100, (player.velocity / 6.2) * 100)));
          }

          if (player.finishTimeMs !== null) {
            const ahead = swimmers
              .slice(1)
              .filter((r) => r.finishTimeMs !== null && r.finishTimeMs < player.finishTimeMs!)
              .length;
            const rank = (ahead + 1) as 1 | 2 | 3;
            setPlayerMeters(targetDistance);
            setGlideLevel(0);
            handleCompleteArcadeSwim(player.finishTimeMs, rank);
          }
        }

        // Draw active rings on Lane 1
        const player = swimmers[0];
        const activeLap = Math.floor(
          Math.min(player.meters, targetDistance - 0.01) / LAP_LENGTH_METERS
        );
        const lane1Y = deckTop + laneH * 0.5;
        for (const ring of ringsRef.current) {
          if (ring.collected || ring.lap !== activeLap) continue;
          const goingRight = ring.lap % 2 === 0;
          const rx = goingRight
            ? leftWall + (ring.laneMeters / LAP_LENGTH_METERS) * laneSpan
            : rightWall - (ring.laneMeters / LAP_LENGTH_METERS) * laneSpan;
          const pulse = reducedMotion ? 1 : 1 + Math.sin(waterTimeRef.current * 6 + ring.id) * 0.1;
          ctx.save();
          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(rx, lane1Y, 10 * pulse, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(250, 204, 21, 0.25)';
          ctx.beginPath();
          ctx.arc(rx, lane1Y, 8 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }

        const names = [t.swimYouLabel, t.swimRival1, t.swimRival2];
        swimmers.forEach((sw, idx) => {
          const clampedMeters = Math.min(sw.meters, targetDistance);
          const rawLap = Math.floor(clampedMeters / LAP_LENGTH_METERS);
          const atWall = clampedMeters >= targetDistance;
          const lapIdx = atWall ? Math.max(0, targetDistance / LAP_LENGTH_METERS - 1) : rawLap;
          const goingRight = lapIdx % 2 === 0;
          const lapProg = atWall
            ? 1
            : (clampedMeters - lapIdx * LAP_LENGTH_METERS) / LAP_LENGTH_METERS;
          const sx = goingRight
            ? leftWall + 14 + lapProg * (laneSpan - 28)
            : rightWall - 14 - lapProg * (laneSpan - 28);
          const sy = deckTop + laneH * (idx + 0.5);

          drawSwimmerFigure(
            sx,
            sy,
            0.95,
            sw.capColor,
            sw.suitColor,
            sw.armPhase,
            sw.kickPhase,
            goingRight,
            0
          );

          const label = names[idx] || '';
          ctx.save();
          ctx.font = '600 11px system-ui, -apple-system, sans-serif';
          const tw = ctx.measureText(label).width;
          const lx = Math.max(leftWall + 4, Math.min(rightWall - tw - 16, sx - tw / 2 - 6));
          const ly = sy - 23;
          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.86)' : 'rgba(255, 255, 255, 0.92)';
          drawRoundedPill(ctx, lx, ly, tw + 12, 16, 5);
          ctx.fill();
          ctx.fillStyle = idx === 0 ? '#D97706' : isDark ? '#F8FAFC' : '#0F172A';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, lx + 6, ly + 8.5);
          ctx.restore();
        });
      } else {
        // Classroom modes: 'pick_rep' & 'quiz_race'
        const scale = Math.max(0.65, Math.min(0.95, laneH / 46));
        const racers = laneSwimmersRef.current;
        const speedCfg = SWIM_SPEED_CONFIG[swimSpeedRef.current];

        if (modeRef.current === 'pick_rep' && classPhaseRef.current === 'RACING') {
          let firstWinner: LaneSwimmer | null = null;
          for (const r of racers) {
            if (r.finishRank !== null) continue;
            r.surgeTimer -= dt;
            if (r.surgeTimer <= 0) {
              r.surgeTimer = 0.35 + Math.random() * 0.95;
              r.surgeAmount = (Math.random() - 0.42) * 0.72;
            }
            const boostBonus = r.boostFlash > 0 ? r.boostFlash * 0.45 : 0;
            const speed = Math.max(
              0.42,
              (1 + r.surgeAmount + boostBonus) / speedCfg.pickRaceDurationSec
            );
            r.progress = Math.min(1, r.progress + speed * dt);
            r.armPhase += dt * (9 + speed * 25);
            r.kickPhase += dt * (11 + speed * 28);
            r.boostFlash = Math.max(0, r.boostFlash - dt * 2.4);

            if (r.progress >= 1 && r.finishRank === null) {
              finishCounterRef.current += 1;
              r.finishRank = finishCounterRef.current;
              if (r.finishRank === 1) {
                firstWinner = r;
              }
            }
          }
          if (firstWinner) {
            finishPickRepRace(firstWinner);
          }
        } else if (modeRef.current === 'quiz_race') {
          for (const r of racers) {
            const diff = r.targetProgress - r.progress;
            if (Math.abs(diff) > 0.002) {
              const step = Math.sign(diff) * Math.min(Math.abs(diff), dt * speedCfg.quizGlidePerSec);
              r.progress += step;
              r.armPhase += dt * (11 + speedCfg.quizGlidePerSec * 7);
              r.kickPhase += dt * (13 + speedCfg.quizGlidePerSec * 8);
            } else {
              r.progress = r.targetProgress;
              r.armPhase += dt * 2.5;
              r.kickPhase += dt * 3.5;
            }
            r.boostFlash = Math.max(0, r.boostFlash - dt * 2.1);
          }
        } else {
          for (const r of racers) {
            r.armPhase += dt * 2.6;
            r.kickPhase += dt * 3.6;
            r.boostFlash = Math.max(0, r.boostFlash - dt * 2.1);
          }
        }

        racers.forEach((sw, idx) => {
          const sx = leftWall + 16 + sw.progress * (laneSpan - 32);
          const sy = deckTop + laneH * (idx + 0.5);

          drawSwimmerFigure(
            sx,
            sy,
            scale,
            sw.capColor,
            sw.suitColor,
            sw.armPhase,
            sw.kickPhase,
            true,
            sw.boostFlash
          );

          const fullLabel = sw.repName ? `${sw.label} · ${sw.repName}` : sw.label;
          ctx.save();
          const fontSize = Math.max(11, Math.min(12, Math.floor(laneH * 0.3)));
          ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
          const maxW = Math.min(170, width * 0.38);
          let shown = fullLabel;
          if (ctx.measureText(shown).width > maxW) {
            while (shown.length > 4 && ctx.measureText(`${shown}…`).width > maxW) {
              shown = shown.slice(0, -1);
            }
            shown = `${shown}…`;
          }
          const tw = ctx.measureText(shown).width;
          const padX = 7;
          const pillW = tw + padX * 2;
          const pillH = fontSize + 7;
          const placeLeft = sx > rightWall - pillW - 24;
          const tagX = placeLeft
            ? Math.max(leftWall + 6, sx - 20 * scale - pillW)
            : Math.min(rightWall - pillW - 6, sx + 19 * scale);
          const tagY = sy - pillH / 2;

          ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)';
          ctx.strokeStyle = sw.capColor;
          ctx.lineWidth = 1.4;
          drawRoundedPill(ctx, tagX, tagY, pillW, pillH, 6);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(shown, tagX + padX, sy + 0.5);
          ctx.restore();
        });
      }

      // Draw splash particles
      splashesRef.current = splashesRef.current.filter((p) => {
        p.life += dt;
        if (p.life >= p.maxLife) return false;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const alpha = 1 - p.life / p.maxLife;
        ctx.fillStyle = p.gold
          ? `rgba(250, 204, 21, ${alpha})`
          : `rgba(255, 255, 255, ${alpha * 0.9})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [finishPickRepRace, handleCompleteArcadeSwim, isDark, settings.soundEnabled, spawnSplash, t.swimRival1, t.swimRival2, t.swimYouLabel]);

  // --- Classroom Pick-Rep Actions ---
  const startPickRepRace = () => {
    const swimmers = laneSwimmersRef.current;
    if (swimmers.length === 0 || classPhase === 'RACING') return;

    swimmers.forEach((r) => {
      r.progress = 0;
      r.targetProgress = 0;
      r.finishRank = null;
      r.surgeTimer = 0.25 + Math.random() * 0.85;
      r.surgeAmount = 0;
      r.boostFlash = 0;
    });
    splashesRef.current = [];
    finishCounterRef.current = 0;
    setChosenWinner(null);
    setSelectedAnswerIdx(null);
    setAnswerFeedback(null);

    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      const picked = swimmers[Math.floor(Math.random() * swimmers.length)];
      picked.progress = 1;
      picked.finishRank = 1;
      finishPickRepRace(picked);
      return;
    }

    if (settings.soundEnabled) playSplashSound();
    if (settings.hapticsEnabled) triggerHaptic(20);
    classPhaseRef.current = 'RACING';
    setClassPhase('RACING');
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'arcade') {
      if (arcadePhase === 'PLAYING') performArcadeStroke();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas || laneSwimmersRef.current.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const deckTop = 28;
    const poolHeight = Math.max(100, rect.height - deckTop - 16);
    const laneIdx = Math.floor(
      ((clickY - deckTop) / poolHeight) * laneSwimmersRef.current.length
    );

    if (laneIdx < 0 || laneIdx >= laneSwimmersRef.current.length) return;
    const tapped = laneSwimmersRef.current[laneIdx];
    if (!tapped) return;

    tapped.boostFlash = 1;
    if (mode === 'pick_rep' && classPhase === 'RACING' && tapped.finishRank === null) {
      tapped.progress = Math.min(0.985, tapped.progress + 0.02);
    } else if (mode === 'quiz_race' && classPhase !== 'CHAMPION') {
      setTurnLaneIdx(laneIdx);
    }

    const leftWall = 42;
    const rightWall = rect.width - 34;
    const sx = leftWall + 16 + tapped.progress * Math.max(90, rightWall - leftWall - 32);
    const sy = deckTop + (poolHeight / laneSwimmersRef.current.length) * (laneIdx + 0.5);
    spawnSplash(sx, sy, 8, true);
    if (settings.soundEnabled) playTickSound(0.24);
  };

  const handlePickRepQuizAnswer = (optionIdx: number) => {
    if (!currentQuestion || selectedAnswerIdx !== null || !chosenWinner) return;
    setSelectedAnswerIdx(optionIdx);
    const isRight = optionIdx === currentQuestion.correctIndex;
    setAnswerFeedback(isRight ? 'correct' : 'wrong');

    if (isRight) {
      if (settings.soundEnabled) playCorrectSound();
      if (settings.hapticsEnabled) triggerHaptic([25, 25, 50]);
      setScoresMap((prev) => ({
        ...prev,
        [chosenWinner.id]: (prev[chosenWinner.id] ?? 0) + 1,
      }));
      triggerConfetti(chosenWinner.capColor);
    } else {
      if (settings.soundEnabled) playWrongSound();
      if (settings.hapticsEnabled) triggerHaptic(40);
    }
  };

  const handleOralMark = (isRight: boolean) => {
    if (!chosenWinner) return;
    setAnswerFeedback(isRight ? 'correct' : 'wrong');
    if (isRight) {
      if (settings.soundEnabled) playCorrectSound();
      setScoresMap((prev) => ({
        ...prev,
        [chosenWinner.id]: (prev[chosenWinner.id] ?? 0) + 1,
      }));
      triggerConfetti(chosenWinner.capColor);
    } else {
      if (settings.soundEnabled) playWrongSound();
    }
  };

  const handleNextPickRepRound = async (removeStudent: boolean) => {
    if (chosenWinner) {
      const winnerText = chosenWinner.repName
        ? `${chosenWinner.label} (${chosenWinner.repName})`
        : chosenWinner.label;
      let updatedEntries = studentPool;
      if (removeStudent && rosterSource === 'students') {
        const idx = studentPool.indexOf(chosenWinner.label);
        if (idx >= 0 && studentPool.length > 1) {
          updatedEntries = studentPool.filter((_, i) => i !== idx);
          setStudentPool(updatedEntries);
          if (activeWheel.entries.length > 1) {
            updateActiveWheel({ entries: updatedEntries });
          }
        }
      }
      await logSpinOutcome({
        winner: winnerText,
        winnerColor: chosenWinner.capColor,
        removedAfterSpin: removeStudent && rosterSource === 'students',
        updatedEntries,
      });
    }

    laneSwimmersRef.current.forEach((r) => {
      r.progress = 0;
      r.targetProgress = 0;
      r.finishRank = null;
      r.boostFlash = 0;
    });
    setChosenWinner(null);
    setSelectedAnswerIdx(null);
    setAnswerFeedback(null);
    setQuestionIdx((q) => q + 1);
    if (rosterSource === 'teams') {
      setRepOffset((o) => o + 1);
    }
    classPhaseRef.current = 'IDLE';
    setClassPhase('IDLE');
  };

  // --- Classroom Quiz-Race Actions ---
  const handleQuizRaceAnswer = async (optionIdx: number) => {
    if (!currentQuestion || selectedAnswerIdx !== null || classPhase === 'CHAMPION') return;
    const racers = laneSwimmersRef.current;
    const activeSwimmer = racers[turnLaneIdx % Math.max(1, racers.length)];
    if (!activeSwimmer) return;

    setSelectedAnswerIdx(optionIdx);
    const isRight = optionIdx === currentQuestion.correctIndex;
    setAnswerFeedback(isRight ? 'correct' : 'wrong');

    if (isRight) {
      if (settings.soundEnabled) {
        playCorrectSound();
        playWaterStrokeSound(true);
      }
      if (settings.hapticsEnabled) triggerHaptic([20, 20, 45]);

      const step = 0.25; // 4 correct answers reaches the finish wall
      activeSwimmer.targetProgress = Math.min(1, activeSwimmer.targetProgress + step);
      activeSwimmer.boostFlash = 1;
      setScoresMap((prev) => ({
        ...prev,
        [activeSwimmer.id]: (prev[activeSwimmer.id] ?? 0) + 1,
      }));

      const canvas = canvasRef.current;
      if (canvas) {
        const w = canvas.clientWidth || 600;
        const h = canvas.clientHeight || 300;
        const leftWall = 42;
        const rightWall = w - 34;
        const sx = leftWall + 16 + activeSwimmer.targetProgress * Math.max(90, rightWall - leftWall - 32);
        const sy = 28 + ((h - 44) / Math.max(1, racers.length)) * (activeSwimmer.lane + 0.5);
        spawnSplash(sx, sy, 12, true);
      }

      if (activeSwimmer.targetProgress >= 1) {
        const tid = window.setTimeout(async () => {
          setChosenWinner({
            id: activeSwimmer.id,
            label: activeSwimmer.label,
            repName: activeSwimmer.repName,
            capColor: activeSwimmer.capColor,
          });
          classPhaseRef.current = 'CHAMPION';
          setClassPhase('CHAMPION');
          if (settings.soundEnabled) playWinSound();
          triggerConfetti(activeSwimmer.capColor);
          await logSpinOutcome({
            winner: activeSwimmer.repName
              ? `${activeSwimmer.label} (${activeSwimmer.repName})`
              : activeSwimmer.label,
            winnerColor: activeSwimmer.capColor,
            removedAfterSpin: false,
          });
        }, 700);
        timerIdsRef.current.push(tid);
        return;
      }
    } else {
      if (settings.soundEnabled) playWrongSound();
      if (settings.hapticsEnabled) triggerHaptic(35);
    }

    const tid = window.setTimeout(() => {
      setSelectedAnswerIdx(null);
      setAnswerFeedback(null);
      setQuestionIdx((q) => q + 1);
      setTurnLaneIdx((idx) => (idx + 1) % Math.max(1, racers.length));
    }, 1050);
    timerIdsRef.current.push(tid);
  };

  const resetClassroomRace = () => {
    laneSwimmersRef.current.forEach((r) => {
      r.progress = 0;
      r.targetProgress = 0;
      r.finishRank = null;
      r.boostFlash = 0;
    });
    splashesRef.current = [];
    setChosenWinner(null);
    setSelectedAnswerIdx(null);
    setAnswerFeedback(null);
    setTurnLaneIdx(0);
    classPhaseRef.current = 'IDLE';
    setClassPhase('IDLE');
  };

  // --- Arcade Solo Actions ---
  const startArcadeSwim = () => {
    const swimmers = createInitialArcadeSwimmers();
    arcadeSwimmersRef.current = swimmers;
    ringsRef.current = createRingsForDistance(distance);
    splashesRef.current = [];
    strokeCountRef.current = 0;
    lastStrokeAtRef.current = 0;
    setStrokesCount(0);
    setPlayerMeters(0);
    setElapsedMs(0);
    setGlideLevel(0);
    setIsNewRecord(false);

    swimmers[0].velocity = 3.2;
    swimmers[1].velocity = swimmers[1].basePace;
    swimmers[2].velocity = swimmers[2].basePace;

    if (settings.soundEnabled) playSplashSound();
    if (settings.hapticsEnabled) triggerHaptic(20);

    startTimeRef.current = performance.now();
    arcadePhaseRef.current = 'PLAYING';
    setArcadePhase('PLAYING');
  };

  const resetArcadePool = (nextDistance?: SwimDistance) => {
    const dist = nextDistance ?? distance;
    if (nextDistance) {
      setDistance(nextDistance);
      distanceRef.current = nextDistance;
    }
    arcadeSwimmersRef.current = createInitialArcadeSwimmers();
    ringsRef.current = createRingsForDistance(dist);
    splashesRef.current = [];
    strokeCountRef.current = 0;
    arcadePhaseRef.current = 'IDLE';
    setArcadePhase('IDLE');
    setPlayerMeters(0);
    setElapsedMs(0);
    setStrokesCount(0);
    setGlideLevel(0);
    setIsNewRecord(false);
  };

  const handleModeSwitch = (nextMode: SwimMode) => {
    setMode(nextMode);
    modeRef.current = nextMode;
    resetClassroomRace();
    resetArcadePool();
  };

  const totalLaps = distance / LAP_LENGTH_METERS;
  const currentLapDisplay = Math.min(totalLaps, Math.floor(playerMeters / LAP_LENGTH_METERS) + 1);
  const currentBestMs = bestTimes[distance];
  const activeTurnDescriptor =
    laneDescriptors[turnLaneIdx % Math.max(1, laneDescriptors.length)];

  return (
    <div className="space-y-4">
      {/* Header + 3 Play Mode Switcher */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.swimTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.swimDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl self-start">
          {(
            [
              { id: 'pick_rep', label: t.swimModePickRep },
              { id: 'quiz_race', label: t.swimModeQuizRace },
              { id: 'arcade', label: t.swimModeArcade },
            ] as { id: SwimMode; label: string }[]
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleModeSwitch(item.id)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                mode === item.id
                  ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode-Specific Controls Toolbar */}
      {mode !== 'arcade' ? (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Students vs Teams & Group Reps Toggle */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
              <button
                type="button"
                disabled={classPhase === 'RACING'}
                onClick={() => {
                  setRosterSource('teams');
                  resetClassroomRace();
                }}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                  rosterSource === 'teams'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>{t.swimRosterTeams}</span>
              </button>
              <button
                type="button"
                disabled={classPhase === 'RACING'}
                onClick={() => {
                  setRosterSource('students');
                  resetClassroomRace();
                }}
                className={`min-h-[36px] px-2.5 py-1 text-xs font-semibold rounded-lg cursor-pointer whitespace-nowrap disabled:opacity-50 ${
                  rosterSource === 'students'
                    ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {t.swimRosterStudents}
              </button>
            </div>

            {rosterSource === 'teams' && (
              <>
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  {[2, 3, 4, 5, 6].map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      disabled={classPhase === 'RACING'}
                      onClick={() => {
                        setTeamCount(cnt);
                        resetClassroomRace();
                      }}
                      className={`min-h-[36px] min-w-[34px] px-2 text-xs font-semibold rounded-lg cursor-pointer tabular-nums disabled:opacity-50 ${
                        teamCount === cnt
                          ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={classPhase === 'RACING'}
                  onClick={() => setRepOffset((o) => o + 1)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>{t.swimShuffleRepsBtn}</span>
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Hierarchical Subject + Grade Level (1-12) + Exercise Picker */}
            <SubjectGradeQuizPicker
              quizzes={quizzes}
              selectedQuizId={selectedQuizId}
              language={settings.language}
              includeOralOption={mode === 'pick_rep'}
              onSelectQuiz={(quizId) => {
                setSelectedQuizId(quizId);
                setQuestionIdx(0);
                setSelectedAnswerIdx(null);
                setAnswerFeedback(null);
              }}
              onCreateQuiz={onCreateQuiz}
              onEditQuiz={onEditQuiz}
            />

            {onCreateQuiz && (
              <button
                type="button"
                onClick={() =>
                  onCreateQuiz(
                    activeQuiz
                      ? {
                          subjectId: resolveQuizSubjectId(activeQuiz),
                          gradeId: resolveQuizGradeId(activeQuiz),
                        }
                      : undefined
                  )
                }
                className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t.swimCreateQuizShort}</span>
              </button>
            )}

            {/* Swim Speed Selector */}
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
              role="group"
              aria-label={t.swimSpeedLabel}
            >
              <span className="pl-2 pr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>{t.swimSpeedLabel}</span>
              </span>
              {(
                [
                  { id: 'slow', label: t.swimSpeedSlow },
                  { id: 'normal', label: t.swimSpeedNormal },
                  { id: 'fast', label: t.swimSpeedFast },
                ] as { id: SwimSpeedPreset; label: string }[]
              ).map((sp) => (
                <button
                  key={sp.id}
                  type="button"
                  onClick={() => setSwimSpeed(sp.id)}
                  className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                    swimSpeed === sp.id
                      ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {sp.label}
                </button>
              ))}
            </div>

            {mode === 'pick_rep' && (
              <button
                type="button"
                disabled={classPhase === 'RACING' || laneDescriptors.length === 0}
                onClick={startPickRepRace}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] hover:from-sky-600 hover:to-blue-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-2 shadow-sm cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <Play className="w-4 h-4" />
                <span>
                  {classPhase === 'RACING' ? t.swimRacingWaitBtn : t.swimStartPickRaceBtn}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={resetClassroomRace}
              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t.swimResetBtn}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Arcade Controls & Live HUD */
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                {([50, 100, 150] as SwimDistance[]).map((dist) => (
                  <button
                    key={dist}
                    type="button"
                    disabled={arcadePhase === 'PLAYING'}
                    onClick={() => resetArcadePool(dist)}
                    className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 tabular-nums ${
                      distance === dist
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {dist}m
                  </button>
                ))}
              </div>

              {/* Swim Speed Selector */}
              <div
                className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl"
                role="group"
                aria-label={t.swimSpeedLabel}
              >
                <span className="pl-2 pr-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400 inline-flex items-center gap-1 whitespace-nowrap">
                  <Gauge className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                  <span>{t.swimSpeedLabel}</span>
                </span>
                {(
                  [
                    { id: 'slow', label: t.swimSpeedSlow },
                    { id: 'normal', label: t.swimSpeedNormal },
                    { id: 'fast', label: t.swimSpeedFast },
                  ] as { id: SwimSpeedPreset; label: string }[]
                ).map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => setSwimSpeed(sp.id)}
                    className={`min-h-[34px] px-2.5 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                      swimSpeed === sp.id
                        ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-sky-300 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {sp.label}
                  </button>
                ))}
              </div>
            </div>

            {arcadePhase === 'IDLE' ? (
              <button
                type="button"
                onClick={startArcadeSwim}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] hover:from-sky-600 hover:to-blue-700 text-white text-sm font-semibold inline-flex items-center gap-2 shadow-md cursor-pointer whitespace-nowrap"
              >
                <Play className="w-4 h-4" />
                <span>{t.swimStartBtn}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => resetArcadePool()}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.swimResetBtn}</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {t.swimDistanceLabel}
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {playerMeters.toFixed(1)}m / {distance}m
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {t.swimLapLabel}
              </span>
              <span className="font-mono font-bold tabular-nums text-slate-900 dark:text-white">
                {currentLapDisplay} / {totalLaps}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {t.swimTimeLabel}
              </span>
              <span className="font-mono font-bold tabular-nums text-sky-600 dark:text-sky-400">
                {(elapsedMs / 1000).toFixed(2)}s
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">
                {t.swimBestLabel}
              </span>
              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {currentBestMs !== undefined ? `${(currentBestMs / 1000).toFixed(2)}s` : '—'}
              </span>
            </div>
          </div>
        </>
      )}

      {/* Classroom Scoreboard & Active Turn Strip (for pick_rep & quiz_race) */}
      {mode !== 'arcade' && (
        <div className="flex flex-wrap items-center gap-2">
          {laneDescriptors.map((item, idx) => {
            const isTurn = mode === 'quiz_race' && idx === turnLaneIdx % laneDescriptors.length;
            const pts = scoresMap[item.id] ?? 0;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (mode === 'quiz_race' && classPhase !== 'CHAMPION') {
                    setTurnLaneIdx(idx);
                  }
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer ${
                  isTurn
                    ? 'bg-sky-50 dark:bg-sky-950/50 border-sky-500 text-sky-800 dark:text-sky-200 ring-2 ring-sky-400/30'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <span className="truncate max-w-[140px]">
                  {item.repName ? `${item.label} · ${item.repName}` : item.label}
                </span>
                <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {pts}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Olympic Pool Canvas Arena */}
      <div
        ref={containerRef}
        className="relative w-full rounded-3xl overflow-hidden border border-sky-200 dark:border-slate-800 shadow-inner select-none bg-sky-200 dark:bg-slate-900"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handleCanvasPointerDown}
          className="block w-full cursor-pointer touch-manipulation"
          aria-label={t.swimTitle}
        />

        {mode === 'arcade' && boostNotice && (
          <div className="pointer-events-none absolute top-3 right-3 z-20 px-3 py-1 rounded-lg bg-amber-400 text-slate-950 text-xs font-bold inline-flex items-center gap-1 shadow-md">
            <Zap className="w-3.5 h-3.5" />
            <span>{t.swimSpeedBoost}</span>
          </div>
        )}

        {/* Pick-Rep Winner + Question Challenge Modal (full viewport overlay so math & options never clip) */}
        {mode === 'pick_rep' && classPhase === 'QUESTION' && chosenWinner && (
          <div className="fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
            <div
              role="dialog"
              aria-modal="true"
              className="w-full max-w-lg rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-2xl max-h-[90dvh] overflow-y-auto space-y-4"
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-sm"
                  style={{ backgroundColor: chosenWinner.capColor }}
                >
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    {t.swimChosenToAnswer}
                  </p>
                  <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
                    {chosenWinner.label}
                    {chosenWinner.repName ? ` · ${t.swimRepLabel}: ${chosenWinner.repName}` : ''}
                  </h3>
                </div>
              </div>

              {currentQuestion ? (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{activeQuiz?.title}</span>
                    <span className="tabular-nums">
                      {t.swimQuestionCounter(
                        (questionIdx % (activeQuiz?.questions.length || 1)) + 1,
                        activeQuiz?.questions.length || 1
                      )}
                    </span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                    <MathText text={currentQuestion.prompt} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {currentQuestion.options.map((opt, idx) => {
                      const chosen = selectedAnswerIdx === idx;
                      const isRightOption = idx === currentQuestion.correctIndex;
                      const revealed = selectedAnswerIdx !== null;
                      return (
                        <button
                          key={idx}
                          type="button"
                          disabled={revealed}
                          onClick={() => handlePickRepQuizAnswer(idx)}
                          className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                            revealed
                              ? isRightOption
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                                : chosen
                                ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-800 dark:text-rose-200'
                                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-400 text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          <span className="w-6 h-6 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                            {OPTION_LETTERS[idx]}
                          </span>
                          <span className="flex-1 break-words">
                            <MathText text={opt} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    {t.swimOralPromptHint}
                  </p>
                  {answerFeedback === null && (
                    <div className="grid grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleOralMark(true)}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.swimCorrectBtn}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOralMark(false)}
                        className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{t.swimWrongBtn}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleNextPickRepRound(false)}
                  className="flex-1 min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  {t.swimNextRoundBtn}
                </button>
                {rosterSource === 'students' && studentPool.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleNextPickRepRound(true)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.swimRemoveAndNextBtn}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quiz-Race Champion Trophy Overlay */}
        {mode === 'quiz_race' && classPhase === 'CHAMPION' && chosenWinner && (
          <div className="absolute inset-0 z-30 bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 text-center shadow-2xl">
              <div
                className="mx-auto w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-3 shadow-md"
                style={{ backgroundColor: chosenWinner.capColor }}
              >
                <Trophy className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {t.swimWinnerCupTitle}
              </p>
              <h3 className="mt-1 font-display text-2xl font-bold text-slate-900 dark:text-white break-words">
                {chosenWinner.label}
              </h3>
              {chosenWinner.repName && (
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {t.swimRepLabel}: {chosenWinner.repName}
                </p>
              )}
              <button
                type="button"
                onClick={resetClassroomRace}
                className="mt-5 w-full min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.playAgainBtn}</span>
              </button>
            </div>
          </div>
        )}

        {/* Arcade Finish Results Overlay */}
        {mode === 'arcade' && arcadePhase === 'FINISHED' && (
          <div className="absolute inset-0 z-30 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 text-center shadow-2xl">
              <div
                className={`mx-auto w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-3 shadow-md ${
                  placement === 1
                    ? 'bg-amber-500'
                    : placement === 2
                    ? 'bg-slate-500'
                    : 'bg-orange-600'
                }`}
              >
                {placement === 1 ? (
                  <Trophy className="w-6 h-6" />
                ) : (
                  <Award className="w-6 h-6" />
                )}
              </div>

              <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {placement === 1
                  ? t.swimPlaceFirst
                  : placement === 2
                  ? t.swimPlaceSecond
                  : t.swimPlaceThird}
              </h3>

              <div className="mt-3 flex items-center justify-center gap-4 text-sm text-slate-600 dark:text-slate-300 tabular-nums">
                <span className="inline-flex items-center gap-1 font-mono font-bold text-sky-600 dark:text-sky-400">
                  <Timer className="w-4 h-4" />
                  {(finalTimeMs / 1000).toFixed(2)}s
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  {t.swimStrokesLabel}: {strokesCount}
                </span>
              </div>

              {isNewRecord && (
                <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  {t.swimNewRecord}
                </p>
              )}

              <button
                type="button"
                onClick={startArcadeSwim}
                className="mt-5 w-full min-h-[44px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{t.playAgainBtn}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Mode-Specific Interactive Bottom Panel */}
      {mode === 'quiz_race' && currentQuestion && classPhase !== 'CHAMPION' && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 space-y-3.5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
              <span className="text-slate-500 dark:text-slate-400">{t.swimTurnPrefix}</span>
              {activeTurnDescriptor && (
                <span className="inline-flex items-center gap-1.5 font-bold">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: activeTurnDescriptor.color }}
                  />
                  <span>
                    {activeTurnDescriptor.repName
                      ? `${activeTurnDescriptor.label} (${activeTurnDescriptor.repName})`
                      : activeTurnDescriptor.label}
                  </span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span>{t.swimTapLaneHint}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-mono">
                {t.swimQuestionCounter(
                  (questionIdx % (activeQuiz?.questions.length || 1)) + 1,
                  activeQuiz?.questions.length || 1
                )}
              </span>
            </div>
          </div>

          <div className="font-display text-base sm:text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
            <MathText text={currentQuestion.prompt} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {currentQuestion.options.map((opt, idx) => {
              const chosen = selectedAnswerIdx === idx;
              const isRightOption = idx === currentQuestion.correctIndex;
              const revealed = selectedAnswerIdx !== null;
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={revealed}
                  onClick={() => handleQuizRaceAnswer(idx)}
                  className={`min-h-[48px] px-3.5 py-2.5 rounded-xl border text-left text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-colors cursor-pointer ${
                    revealed
                      ? isRightOption
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-800 dark:text-emerald-200'
                        : chosen
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-800 dark:text-rose-200'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-500'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-sky-500 text-slate-900 dark:text-slate-100'
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                    {OPTION_LETTERS[idx]}
                  </span>
                  <span className="flex-1 break-words">
                    <MathText text={opt} />
                  </span>
                </button>
              );
            })}
          </div>

          {answerFeedback && (
            <p
              className={`text-xs font-semibold ${
                answerFeedback === 'correct'
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {answerFeedback === 'correct' ? t.swimSurgeMsg : t.swimWrongAnswerMsg}
            </p>
          )}
        </div>
      )}

      {mode === 'pick_rep' && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t.swimTapToPickOrBoost}
        </p>
      )}

      {mode === 'arcade' && (
        <>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <button
              type="button"
              onPointerDown={(e) => {
                if (arcadePhase === 'PLAYING') {
                  e.preventDefault();
                  performArcadeStroke();
                } else if (arcadePhase === 'IDLE') {
                  startArcadeSwim();
                }
              }}
              disabled={arcadePhase === 'FINISHED'}
              className="flex-1 min-h-[54px] px-6 py-3 rounded-2xl bg-gradient-to-r from-[#0EA5E9] to-[#2563EB] hover:from-sky-600 hover:to-blue-700 active:scale-[0.98] text-white text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2.5 shadow-md transition-transform cursor-pointer disabled:opacity-50 touch-manipulation select-none"
            >
              <WavesLadder className="w-5 h-5" />
              <span>{arcadePhase === 'IDLE' ? t.swimStartBtn : t.swimStrokeBtn}</span>
            </button>

            <div className="sm:w-52 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 flex flex-col justify-center">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <span>{t.swimStrokesLabel}</span>
                <span className="font-mono font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                  {strokesCount}
                </span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-sky-400 to-amber-400 transition-all duration-100"
                  style={{ width: `${glideLevel}%` }}
                />
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.swimControlsHint}
          </p>
        </>
      )}
    </div>
  );
}
