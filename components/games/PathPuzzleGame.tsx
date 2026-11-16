'use client';

import React, { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Flag,
  Trophy,
  Star,
  Mountain,
  Undo2,
  RotateCcw,
  Lightbulb,
  Shuffle,
  ArrowRight,
  Compass,
  Grid3X3,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import {
  playCorrectSound,
  playWrongSound,
  playWinSound,
  playTickSound,
  triggerHaptic,
} from '@/lib/sound';
import { COPY } from '@/lib/i18n';

export type WaygroundMode = 'checkpoints' | 'cover_all';
export type GridSize = 5 | 6 | 7;

interface GridCoord {
  r: number;
  c: number;
}

interface WaygroundPuzzle {
  id: number;
  size: GridSize;
  mode: WaygroundMode;
  start: GridCoord;
  goal: GridCoord;
  obstacles: string[]; // "r,c"
  stars: GridCoord[];
  openCount: number;
  solutionPath: GridCoord[];
}

const STATS_STORAGE_KEY = 'pickerwel_wayground_stats_v1';

const DIRS: GridCoord[] = [
  { r: -1, c: 0 },
  { r: 1, c: 0 },
  { r: 0, c: -1 },
  { r: 0, c: 1 },
];

function coordKey(p: GridCoord): string {
  return `${p.r},${p.c}`;
}

function sameCoord(a: GridCoord, b: GridCoord): boolean {
  return a.r === b.r && a.c === b.c;
}

function isAdjacent(a: GridCoord, b: GridCoord): boolean {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
}

function inBounds(r: number, c: number, size: number): boolean {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function shuffleDirs(): GridCoord[] {
  const copy = [...DIRS];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildSerpentineFallback(size: GridSize): GridCoord[] {
  const path: GridCoord[] = [];
  for (let r = 0; r < size; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c++) path.push({ r, c });
    } else {
      for (let c = size - 1; c >= 0; c--) path.push({ r, c });
    }
  }
  return path;
}

function generateCheckpointsPuzzle(
  size: GridSize,
  puzzleId: number
): WaygroundPuzzle {
  const start: GridCoord = {
    r: Math.floor(Math.random() * Math.max(2, Math.floor(size / 2))),
    c: Math.floor(Math.random() * 2),
  };
  const goal: GridCoord = {
    r: size - 1 - Math.floor(Math.random() * 2),
    c: size - 1 - Math.floor(Math.random() * 2),
  };

  let bestPath: GridCoord[] | null = null;
  const minDesiredLen = size + 3;

  for (let attempt = 0; attempt < 60; attempt++) {
    const visited = new Set<string>([coordKey(start)]);
    const path: GridCoord[] = [start];

    const dfs = (curr: GridCoord): boolean => {
      if (sameCoord(curr, goal)) {
        return path.length >= minDesiredLen;
      }
      if (path.length > size * size - 3) return false;

      const neighbors = shuffleDirs()
        .map((d) => ({ r: curr.r + d.r, c: curr.c + d.c }))
        .filter((n) => inBounds(n.r, n.c, size) && !visited.has(coordKey(n)));

      for (const next of neighbors) {
        visited.add(coordKey(next));
        path.push(next);
        if (dfs(next)) return true;
        path.pop();
        visited.delete(coordKey(next));
      }
      return false;
    };

    if (dfs(start)) {
      bestPath = path;
      break;
    }
  }

  if (!bestPath) {
    // Deterministic guaranteed fallback path from (0,0) to (size-1, size-1)
    bestPath = [];
    for (let c = 0; c < size; c++) bestPath.push({ r: 0, c });
    for (let r = 1; r < size; r++) bestPath.push({ r, c: size - 1 });
  }

  const finalStart = bestPath[0];
  const finalGoal = bestPath[bestPath.length - 1];
  const pathSet = new Set(bestPath.map(coordKey));

  // Pick 2 or 3 evenly spaced stars along the verified path
  const starCount = size === 5 ? 2 : 3;
  const stars: GridCoord[] = [];
  for (let i = 1; i <= starCount; i++) {
    const idx = Math.min(
      bestPath.length - 2,
      Math.max(1, Math.round((i * (bestPath.length - 1)) / (starCount + 1)))
    );
    const candidate = bestPath[idx];
    if (!stars.some((s) => sameCoord(s, candidate))) {
      stars.push(candidate);
    }
  }

  // Place obstacle rocks on ~34% of off-path cells
  const obstacles: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const k = `${r},${c}`;
      if (!pathSet.has(k) && Math.random() < 0.34) {
        obstacles.push(k);
      }
    }
  }

  return {
    id: puzzleId,
    size,
    mode: 'checkpoints',
    start: finalStart,
    goal: finalGoal,
    obstacles,
    stars,
    openCount: size * size - obstacles.length,
    solutionPath: bestPath,
  };
}

function generateCoverAllPuzzle(
  size: GridSize,
  puzzleId: number
): WaygroundPuzzle {
  const minTarget = Math.floor(size * size * 0.74);
  let bestWalk: GridCoord[] = [];

  for (let attempt = 0; attempt < 45; attempt++) {
    const start: GridCoord = {
      r: Math.floor(Math.random() * size),
      c: Math.floor(Math.random() * size),
    };
    const visited = new Set<string>([coordKey(start)]);
    const walk: GridCoord[] = [start];

    let stuck = false;
    while (!stuck) {
      const curr = walk[walk.length - 1];
      const candidates = shuffleDirs()
        .map((d) => ({ r: curr.r + d.r, c: curr.c + d.c }))
        .filter((n) => inBounds(n.r, n.c, size) && !visited.has(coordKey(n)));

      if (candidates.length === 0) {
        stuck = true;
        break;
      }

      // Warnsdorff heuristic: prefer cells with fewer onward neighbors
      candidates.sort((a, b) => {
        const degA = DIRS.filter((d) => {
          const nr = a.r + d.r;
          const nc = a.c + d.c;
          return inBounds(nr, nc, size) && !visited.has(`${nr},${nc}`);
        }).length;
        const degB = DIRS.filter((d) => {
          const nr = b.r + d.r;
          const nc = b.c + d.c;
          return inBounds(nr, nc, size) && !visited.has(`${nr},${nc}`);
        }).length;
        return degA - degB;
      });

      const pick = candidates[0];
      visited.add(coordKey(pick));
      walk.push(pick);

      // Leave 2..5 rocks so shapes vary
      if (walk.length >= size * size - 3 && Math.random() < 0.35) {
        break;
      }
    }

    if (walk.length > bestWalk.length) {
      bestWalk = walk;
    }
    if (walk.length >= minTarget) break;
  }

  if (bestWalk.length < minTarget) {
    bestWalk = buildSerpentineFallback(size);
  }

  const walkSet = new Set(bestWalk.map(coordKey));
  const obstacles: string[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const k = `${r},${c}`;
      if (!walkSet.has(k)) obstacles.push(k);
    }
  }

  return {
    id: puzzleId,
    size,
    mode: 'cover_all',
    start: bestWalk[0],
    goal: bestWalk[bestWalk.length - 1],
    obstacles,
    stars: [],
    openCount: bestWalk.length,
    solutionPath: bestWalk,
  };
}

function createInitialStarterPuzzle(): WaygroundPuzzle {
  // Deterministic 5x5 starter puzzle for instant SSR render
  const solutionPath: GridCoord[] = [
    { r: 0, c: 0 },
    { r: 0, c: 1 },
    { r: 1, c: 1 },
    { r: 2, c: 1 },
    { r: 2, c: 2 },
    { r: 2, c: 3 },
    { r: 3, c: 3 },
    { r: 4, c: 3 },
    { r: 4, c: 4 },
  ];
  const obstacles = ['0,3', '1,0', '1,3', '3,1', '3,4', '4,1'];
  return {
    id: 1,
    size: 5,
    mode: 'checkpoints',
    start: { r: 0, c: 0 },
    goal: { r: 4, c: 4 },
    obstacles,
    stars: [
      { r: 1, c: 1 },
      { r: 2, c: 3 },
    ],
    openCount: 25 - obstacles.length,
    solutionPath,
  };
}

function loadSolvedCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    const raw = window.localStorage.getItem(STATS_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { solvedCount?: number };
    return typeof parsed.solvedCount === 'number' ? parsed.solvedCount : 0;
  } catch {
    return 0;
  }
}

function saveSolvedCount(count: number) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      STATS_STORAGE_KEY,
      JSON.stringify({ solvedCount: count })
    );
  } catch {
    // Ignore storage quota errors
  }
}

export function PathPuzzleGame() {
  const { settings } = usePickerwel();
  const t = COPY[settings.language];

  const [mode, setMode] = useState<WaygroundMode>('checkpoints');
  const [gridSize, setGridSize] = useState<GridSize>(5);
  const [puzzle, setPuzzle] = useState<WaygroundPuzzle>(() =>
    createInitialStarterPuzzle()
  );
  const [path, setPath] = useState<GridCoord[]>(() => [
    createInitialStarterPuzzle().start,
  ]);
  const [solved, setSolved] = useState(false);
  const [solvedCount, setSolvedCount] = useState(0);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [hintCell, setHintCell] = useState<GridCoord | null>(null);

  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setSolvedCount(loadSolvedCount());
    });
    const onPointerUp = () => {
      setIsDragging(false);
    };
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, []);

  useEffect(() => {
    if (!warningMsg) return;
    const timerId = setTimeout(() => {
      setWarningMsg(null);
    }, 2400);
    return () => clearTimeout(timerId);
  }, [warningMsg]);

  const showTempWarning = useCallback((msg: string) => {
    setWarningMsg(msg);
  }, []);

  const loadNewPuzzle = useCallback(
    (nextMode: WaygroundMode, nextSize: GridSize) => {
      const nextId = puzzle.id + 1;
      const nextPuzzle =
        nextMode === 'checkpoints'
          ? generateCheckpointsPuzzle(nextSize, nextId)
          : generateCoverAllPuzzle(nextSize, nextId);
      setPuzzle(nextPuzzle);
      setPath([nextPuzzle.start]);
      setSolved(false);
      setWarningMsg(null);
      setHintCell(null);
    },
    [puzzle.id]
  );

  const handleModeChange = (nextMode: WaygroundMode) => {
    setMode(nextMode);
    loadNewPuzzle(nextMode, gridSize);
  };

  const handleSizeChange = (nextSize: GridSize) => {
    setGridSize(nextSize);
    loadNewPuzzle(mode, nextSize);
  };

  const handleResetPath = useCallback(() => {
    setPath([puzzle.start]);
    setSolved(false);
    setWarningMsg(null);
    setHintCell(null);
  }, [puzzle.start]);

  const handleUndo = useCallback(() => {
    if (solved || path.length <= 1) return;
    setPath((prev) => prev.slice(0, -1));
    setWarningMsg(null);
    setHintCell(null);
    if (settings.soundEnabled) playTickSound();
  }, [path.length, settings.soundEnabled, solved]);

  const tryStepTo = useCallback(
    (target: GridCoord) => {
      if (solved) return;
      if (!inBounds(target.r, target.c, puzzle.size)) return;
      if (puzzle.obstacles.includes(coordKey(target))) return;

      const existingIdx = path.findIndex((p) => sameCoord(p, target));

      // Clicking/dragging back to an already-visited tile rewinds path cleanly
      if (existingIdx >= 0) {
        if (existingIdx < path.length - 1) {
          setPath(path.slice(0, existingIdx + 1));
          setWarningMsg(null);
          setHintCell(null);
          if (settings.soundEnabled) playTickSound();
        }
        return;
      }

      const head = path[path.length - 1];
      if (!isAdjacent(head, target)) return;

      const nextPath = [...path, target];

      // Check win condition if stepping onto Goal
      if (sameCoord(target, puzzle.goal)) {
        if (puzzle.mode === 'checkpoints') {
          const allStarsVisited = puzzle.stars.every((star) =>
            nextPath.some((p) => sameCoord(p, star))
          );
          if (!allStarsVisited) {
            if (settings.soundEnabled) playWrongSound();
            if (settings.hapticsEnabled) triggerHaptic(25);
            showTempWarning(t.wgNeedStarsMsg);
            return;
          }
        } else {
          if (nextPath.length < puzzle.openCount) {
            if (settings.soundEnabled) playWrongSound();
            if (settings.hapticsEnabled) triggerHaptic(25);
            showTempWarning(t.wgNeedAllTilesMsg(nextPath.length, puzzle.openCount));
            return;
          }
        }

        // Solved!
        setPath(nextPath);
        setSolved(true);
        setHintCell(null);
        setWarningMsg(null);
        const nextTotal = solvedCount + 1;
        setSolvedCount(nextTotal);
        saveSolvedCount(nextTotal);

        if (settings.soundEnabled) playWinSound();
        if (settings.hapticsEnabled) triggerHaptic([35, 25, 70]);
        if (
          settings.confettiEnabled &&
          typeof window !== 'undefined' &&
          !window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ) {
          confetti({ particleCount: 70, spread: 70, origin: { y: 0.58 } });
        }
        return;
      }

      setPath(nextPath);
      setWarningMsg(null);
      if (hintCell && sameCoord(hintCell, target)) {
        setHintCell(null);
      }

      const collectedStar = puzzle.stars.some((s) => sameCoord(s, target));
      if (settings.soundEnabled) {
        if (collectedStar) playCorrectSound();
        else playTickSound();
      }
      if (settings.hapticsEnabled) triggerHaptic(10);
    },
    [
      hintCell,
      path,
      puzzle,
      settings.confettiEnabled,
      settings.hapticsEnabled,
      settings.soundEnabled,
      showTempWarning,
      solved,
      solvedCount,
      t,
    ]
  );

  const handleHint = () => {
    if (solved) return;
    // Find longest matching prefix of solutionPath
    let prefixLen = 0;
    while (
      prefixLen < path.length &&
      prefixLen < puzzle.solutionPath.length &&
      sameCoord(path[prefixLen], puzzle.solutionPath[prefixLen])
    ) {
      prefixLen++;
    }

    if (prefixLen === path.length && prefixLen < puzzle.solutionPath.length) {
      setHintCell(puzzle.solutionPath[prefixLen]);
    } else {
      const safePrefix = Math.max(1, prefixLen);
      setPath(puzzle.solutionPath.slice(0, safePrefix));
      if (safePrefix < puzzle.solutionPath.length) {
        setHintCell(puzzle.solutionPath[safePrefix]);
      }
    }
    if (settings.soundEnabled) playTickSound();
  };

  // Keyboard navigation (Arrows, WASD, Backspace/Z for undo, R for reset)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      const head = path[path.length - 1];
      if (!head) return;

      let delta: GridCoord | null = null;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') delta = { r: -1, c: 0 };
      else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') delta = { r: 1, c: 0 };
      else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') delta = { r: 0, c: -1 };
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') delta = { r: 0, c: 1 };

      if (delta) {
        e.preventDefault();
        tryStepTo({ r: head.r + delta.r, c: head.c + delta.c });
      } else if (e.key === 'Backspace' || e.key === 'z' || e.key === 'Z') {
        e.preventDefault();
        handleUndo();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleResetPath();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleResetPath, handleUndo, path, tryStepTo]);

  const obstacleSet = new Set(puzzle.obstacles);
  const visitedStars = puzzle.stars.filter((s) =>
    path.some((p) => sameCoord(p, s))
  ).length;
  const head = path[path.length - 1];

  // SVG polyline points across grid cell centers (0..100 coordinate space)
  const svgPoints = path
    .map((p) => {
      const x = ((p.c + 0.5) / puzzle.size) * 100;
      const y = ((p.r + 0.5) / puzzle.size) * 100;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div className="space-y-5">
      {/* Header & Mode Switch */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            {t.pathPuzzleTitle}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {t.pathPuzzleDesc}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              type="button"
              onClick={() => handleModeChange('checkpoints')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'checkpoints'
                  ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span>{t.wgModeCheckpoints}</span>
            </button>
            <button
              type="button"
              onClick={() => handleModeChange('cover_all')}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                mode === 'cover_all'
                  ? 'bg-white dark:bg-slate-700 text-[#3B82F6] dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              <span>{t.wgModeCoverAll}</span>
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {([5, 6, 7] as const).map((sz) => (
              <button
                key={sz}
                type="button"
                onClick={() => handleSizeChange(sz)}
                className={`min-h-[38px] px-2.5 py-1.5 text-xs font-mono font-bold rounded-lg transition-colors cursor-pointer ${
                  gridSize === sz
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {sz}×{sz}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Puzzle Workspace Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 sm:p-6 space-y-5">
        {/* Rule Banner + Stats HUD */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
            {mode === 'checkpoints' ? t.wgModeCheckpointsRule : t.wgModeCoverAllRule}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-xs font-semibold tabular-nums shrink-0">
            <span className="text-slate-700 dark:text-slate-200">
              {t.wgStepsLabel}:{' '}
              <strong className="font-mono text-[#3B82F6] dark:text-blue-400">
                {Math.max(0, path.length - 1)}
              </strong>
            </span>
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            {mode === 'checkpoints' ? (
              <span className="text-amber-600 dark:text-amber-400">
                {t.wgStarsLabel}:{' '}
                <strong className="font-mono">
                  {visitedStars}/{puzzle.stars.length}
                </strong>
              </span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">
                {t.wgTilesLabel}:{' '}
                <strong className="font-mono">
                  {path.length}/{puzzle.openCount}
                </strong>
              </span>
            )}
            <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
              ·
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              {t.wgSolvedLabel}:{' '}
              <strong className="font-mono text-slate-900 dark:text-white">
                {solvedCount}
              </strong>
            </span>
          </div>
        </div>

        {/* Interactive Path Grid */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-full max-w-[440px] aspect-square select-none touch-none">
            {/* SVG Path Line Connector Overlay */}
            {path.length > 1 && (
              <svg
                viewBox="0 0 100 100"
                className="pointer-events-none absolute inset-0 w-full h-full z-10"
                aria-hidden="true"
              >
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke={solved ? '#10B981' : '#3B82F6'}
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.72"
                />
              </svg>
            )}

            <div
              className="grid gap-1.5 sm:gap-2 w-full h-full"
              style={{
                gridTemplateColumns: `repeat(${puzzle.size}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${puzzle.size}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({ length: puzzle.size }).map((_, r) =>
                Array.from({ length: puzzle.size }).map((__, c) => {
                  const cell: GridCoord = { r, c };
                  const key = coordKey(cell);
                  const isObstacle = obstacleSet.has(key);
                  const isStart = sameCoord(cell, puzzle.start);
                  const isGoal = sameCoord(cell, puzzle.goal);
                  const isStar = puzzle.stars.some((s) => sameCoord(s, cell));
                  const visitIndex = path.findIndex((p) => sameCoord(p, cell));
                  const isVisited = visitIndex >= 0;
                  const isHead = head ? sameCoord(cell, head) : false;
                  const canStepNext =
                    !solved && !isObstacle && !isVisited && head && isAdjacent(head, cell);
                  const isHint = hintCell ? sameCoord(hintCell, cell) : false;

                  let cellClass =
                    'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300';

                  if (isObstacle) {
                    cellClass =
                      'bg-slate-800 dark:bg-slate-950 border-slate-700 dark:border-slate-800 text-slate-500 cursor-not-allowed';
                  } else if (isStart) {
                    cellClass =
                      'bg-blue-600 border-blue-700 text-white shadow-sm';
                  } else if (isGoal) {
                    cellClass = solved
                      ? 'bg-emerald-600 border-emerald-700 text-white shadow-md'
                      : 'bg-amber-50 dark:bg-amber-950/50 border-amber-400 dark:border-amber-600 text-amber-600 dark:text-amber-400';
                  } else if (isHead) {
                    cellClass =
                      'bg-[#3B82F6] border-blue-700 text-white shadow-md scale-[1.03]';
                  } else if (isVisited) {
                    cellClass = solved
                      ? 'bg-emerald-100 dark:bg-emerald-950/60 border-emerald-400 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200'
                      : 'bg-blue-100 dark:bg-blue-950/60 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-200';
                  } else if (canStepNext) {
                    cellClass =
                      'bg-white dark:bg-slate-800 border-blue-300 dark:border-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer';
                  }

                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={isObstacle}
                      onPointerDown={(e) => {
                        e.preventDefault();
                        if (!isObstacle) {
                          setIsDragging(true);
                          tryStepTo(cell);
                        }
                      }}
                      onPointerEnter={() => {
                        if (isDragging && !isObstacle) {
                          tryStepTo(cell);
                        }
                      }}
                      aria-label={`Row ${r + 1} Column ${c + 1}${
                        isStart ? ' Start' : isGoal ? ' Goal' : isStar ? ' Star' : isObstacle ? ' Obstacle' : ''
                      }`}
                      className={`relative z-20 rounded-xl border-2 flex items-center justify-center transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${cellClass} ${
                        isHint ? 'ring-4 ring-amber-400 animate-pulse' : ''
                      }`}
                    >
                      {isObstacle ? (
                        <Mountain className="w-5 h-5 opacity-55" />
                      ) : isStart ? (
                        <Flag className="w-5 h-5" />
                      ) : isGoal ? (
                        <Trophy className="w-5 h-5" />
                      ) : isStar ? (
                        <Star
                          className={`w-5 h-5 ${
                            isVisited
                              ? 'fill-amber-400 text-amber-500'
                              : 'fill-amber-300/60 text-amber-500'
                          }`}
                        />
                      ) : isHead ? (
                        <span className="w-3.5 h-3.5 rounded-full bg-white shadow" />
                      ) : isVisited ? (
                        <span className="font-mono text-xs font-bold tabular-nums opacity-75">
                          {visitIndex}
                        </span>
                      ) : canStepNext ? (
                        <span className="w-2 h-2 rounded-full bg-blue-400/70" />
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Inline Validation / Solved Feedback */}
          {warningMsg && (
            <p className="text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 text-center">
              {warningMsg}
            </p>
          )}

          {solved && (
            <div className="w-full max-w-[440px] p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-center sm:text-left">
                <p className="font-display text-base font-bold text-emerald-800 dark:text-emerald-200">
                  {t.wgSolvedTitle}
                </p>
                <p className="text-xs text-emerald-700 dark:text-emerald-300 tabular-nums">
                  {t.wgStepsLabel}: {path.length - 1}
                </p>
              </div>
              <button
                type="button"
                onClick={() => loadNewPuzzle(mode, gridSize)}
                className="min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <span>{t.wgNextPuzzleBtn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleUndo}
              disabled={solved || path.length <= 1}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer"
            >
              <Undo2 className="w-4 h-4" />
              <span>{t.wgUndoBtn}</span>
            </button>

            <button
              type="button"
              onClick={handleResetPath}
              disabled={path.length <= 1 && !solved}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{t.reset}</span>
            </button>

            <button
              type="button"
              onClick={handleHint}
              disabled={solved}
              className="min-h-[42px] px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50 text-xs font-semibold text-amber-800 dark:text-amber-300 inline-flex items-center gap-1.5 disabled:opacity-45 cursor-pointer"
            >
              <Lightbulb className="w-4 h-4" />
              <span>{t.wgHintBtn}</span>
            </button>

            <button
              type="button"
              onClick={() => loadNewPuzzle(mode, gridSize)}
              className="min-h-[42px] px-4 py-2 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#4F46E5] hover:from-blue-600 hover:to-indigo-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Shuffle className="w-4 h-4" />
              <span>{t.wgNewPuzzleBtn}</span>
            </button>
          </div>

          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            {t.wgControlsHint}
          </p>
        </div>
      </div>
    </div>
  );
}
