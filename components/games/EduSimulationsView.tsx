'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Award,
  CheckCircle2,
  Compass,
  Droplets,
  FlaskConical,
  Pause,
  Play,
  Power,
  RotateCcw,
  StepForward,
  Target,
  Waves,
  Zap,
} from 'lucide-react';
import { usePickerwel } from '../PickerwelProvider';
import { MathText } from '../MathText';
import { playCardFlipSound, playCorrectSound, playTickSound, triggerHaptic } from '@/lib/sound';

type SimId = 'projectile' | 'circuit' | 'wave' | 'ph';

// ==================== SHARED SIMULATION CONTROLS ====================

function LabeledSlider({
  label,
  value,
  unit,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs sm:text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <span className="font-bold text-slate-900 dark:text-white tabular-nums">
          {Number.isInteger(step) ? value.toFixed(0) : value.toFixed(1)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 rounded-lg appearance-none bg-slate-200 dark:bg-slate-700 accent-blue-600 cursor-pointer"
      />
    </div>
  );
}

// ==================== 1. PROJECTILE MOTION LAB ====================

interface GhostShot {
  v0: number;
  angleDeg: number;
  h0: number;
  g: number;
  range: number;
}

const GRAVITY_PRESETS = [
  { id: 'earth', g: 9.8, km: 'ផែនដី (9.8)', en: 'Earth (9.8)' },
  { id: 'moon', g: 1.6, km: 'ព្រះច័ន្ទ (1.6)', en: 'Moon (1.6)' },
  { id: 'mars', g: 3.7, km: 'ភពអង្គារ (3.7)', en: 'Mars (3.7)' },
  { id: 'jupiter', g: 24.8, km: 'ភពព្រហស្បតិ៍ (24.8)', en: 'Jupiter (24.8)' },
] as const;

function ProjectileLab({ isKm, soundEnabled, hapticsEnabled }: { isKm: boolean; soundEnabled: boolean; hapticsEnabled: boolean }) {
  const [v0, setV0] = useState(22);
  const [angleDeg, setAngleDeg] = useState(45);
  const [h0, setH0] = useState(0);
  const [gravity, setGravity] = useState(9.8);
  const [targetX] = useState(40);

  const [simTime, setSimTime] = useState(0);
  const [running, setRunning] = useState(false);
  const [ghost, setGhost] = useState<GhostShot | null>(null);
  const [challengeSolved, setChallengeSolved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const physics = useMemo(() => {
    const rad = (angleDeg * Math.PI) / 180;
    const vx0 = v0 * Math.cos(rad);
    const vy0 = v0 * Math.sin(rad);
    const tApex = vy0 / gravity;
    const hMax = h0 + (vy0 * vy0) / (2 * gravity);
    const tFlight = (vy0 + Math.sqrt(vy0 * vy0 + 2 * gravity * h0)) / gravity;
    const range = vx0 * tFlight;
    return { rad, vx0, vy0, tApex, hMax, tFlight, range };
  }, [v0, angleDeg, h0, gravity]);

  const clampedTime = Math.min(simTime, physics.tFlight);
  const curX = physics.vx0 * clampedTime;
  const curY = Math.max(
    0,
    h0 + physics.vy0 * clampedTime - 0.5 * gravity * clampedTime * clampedTime
  );
  const curVy = physics.vy0 - gravity * clampedTime;
  const curSpeed = Math.hypot(physics.vx0, curVy);

  // Animation loop
  useEffect(() => {
    if (!running) return;
    let rafId = 0;
    let lastTs = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      setSimTime((prev) => {
        const next = prev + dt;
        if (next >= physics.tFlight) {
          setRunning(false);
          const hit = Math.abs(physics.range - targetX) <= 2.5;
          if (hit) {
            setChallengeSolved(true);
            if (soundEnabled) playCorrectSound();
            if (hapticsEnabled) triggerHaptic(30);
          }
          return physics.tFlight;
        }
        return next;
      });
      rafId = window.requestAnimationFrame(loop);
    };

    rafId = window.requestAnimationFrame(loop);
    return () => window.cancelAnimationFrame(rafId);
  }, [running, physics.tFlight, physics.range, targetX, soundEnabled, hapticsEnabled]);

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 640;
    const height = canvas.clientHeight || 360;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const padLeft = 48;
    const padRight = 24;
    const padTop = 28;
    const padBottom = 38;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const maxWorldX = Math.max(60, Math.ceil((Math.max(physics.range, targetX + 8) + 10) / 10) * 10);
    const maxWorldY = Math.max(30, Math.ceil((Math.max(physics.hMax, h0 + 10) + 5) / 10) * 10);

    const toPxX = (x: number) => padLeft + (x / maxWorldX) * plotW;
    const toPxY = (y: number) => padTop + plotH - (y / maxWorldY) * plotH;

    // Sky gradient background
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#0F172A');
    sky.addColorStop(1, '#1E293B');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    // Coordinate grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
    ctx.lineWidth = 1;
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#94A3B8';

    const xStep = maxWorldX > 120 ? 20 : 10;
    for (let x = 0; x <= maxWorldX; x += xStep) {
      const px = toPxX(x);
      ctx.beginPath();
      ctx.moveTo(px, padTop);
      ctx.lineTo(px, padTop + plotH);
      ctx.stroke();
      ctx.fillText(`${x}m`, px - 10, padTop + plotH + 18);
    }

    const yStep = maxWorldY > 60 ? 20 : 10;
    for (let y = 0; y <= maxWorldY; y += yStep) {
      const py = toPxY(y);
      ctx.beginPath();
      ctx.moveTo(padLeft, py);
      ctx.lineTo(padLeft + plotW, py);
      ctx.stroke();
      ctx.fillText(`${y}m`, 8, py + 4);
    }

    // Ground plane
    const groundY = toPxY(0);
    ctx.fillStyle = '#065F46';
    ctx.fillRect(padLeft, groundY, plotW, padBottom);
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(padLeft, groundY);
    ctx.lineTo(padLeft + plotW, groundY);
    ctx.stroke();

    // Target zone (40m +/- 2.5m)
    const targetPx = toPxX(targetX);
    const targetHalfW = (2.5 / maxWorldX) * plotW;
    ctx.fillStyle = 'rgba(245, 158, 11, 0.25)';
    ctx.fillRect(targetPx - targetHalfW, groundY - 6, targetHalfW * 2, 10);
    ctx.strokeStyle = '#F59E0B';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(targetPx, groundY);
    ctx.lineTo(targetPx, groundY - 26);
    ctx.stroke();
    ctx.fillStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(targetPx, groundY - 26);
    ctx.lineTo(targetPx + 14, groundY - 20);
    ctx.lineTo(targetPx, groundY - 14);
    ctx.closePath();
    ctx.fill();

    // Previous ghost trail
    if (ghost) {
      const gRad = (ghost.angleDeg * Math.PI) / 180;
      const gVx = ghost.v0 * Math.cos(gRad);
      const gVy = ghost.v0 * Math.sin(gRad);
      const gT = (gVy + Math.sqrt(gVy * gVy + 2 * ghost.g * ghost.h0)) / ghost.g;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = (gT * i) / 60;
        const gx = gVx * t;
        const gy = Math.max(0, ghost.h0 + gVy * t - 0.5 * ghost.g * t * t);
        if (i === 0) ctx.moveTo(toPxX(gx), toPxY(gy));
        else ctx.lineTo(toPxX(gx), toPxY(gy));
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Predicted full arc preview (faint)
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.28)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= 60; i++) {
      const t = (physics.tFlight * i) / 60;
      const px = physics.vx0 * t;
      const py = Math.max(0, h0 + physics.vy0 * t - 0.5 * gravity * t * t);
      if (i === 0) ctx.moveTo(toPxX(px), toPxY(py));
      else ctx.lineTo(toPxX(px), toPxY(py));
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Active traveled trajectory
    if (clampedTime > 0) {
      ctx.strokeStyle = '#38BDF8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const steps = 60;
      for (let i = 0; i <= steps; i++) {
        const t = (clampedTime * i) / steps;
        const tx = physics.vx0 * t;
        const ty = Math.max(0, h0 + physics.vy0 * t - 0.5 * gravity * t * t);
        if (i === 0) ctx.moveTo(toPxX(tx), toPxY(ty));
        else ctx.lineTo(toPxX(tx), toPxY(ty));
      }
      ctx.stroke();
    }

    // Apex marker
    const apexX = physics.vx0 * physics.tApex;
    const apexPx = toPxX(apexX);
    const apexPy = toPxY(physics.hMax);
    ctx.fillStyle = '#A78BFA';
    ctx.beginPath();
    ctx.arc(apexPx, apexPy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(`Hmax ${physics.hMax.toFixed(1)}m`, Math.min(apexPx + 6, width - 92), Math.max(padTop + 12, apexPy - 6));

    // Launch tower if h0 > 0
    const launchPxX = toPxX(0);
    const launchPxY = toPxY(h0);
    if (h0 > 0) {
      ctx.fillStyle = '#475569';
      ctx.fillRect(launchPxX - 8, launchPxY, 16, groundY - launchPxY);
    }

    // Launcher barrel
    ctx.save();
    ctx.translate(launchPxX, launchPxY);
    ctx.rotate(-physics.rad);
    ctx.fillStyle = '#94A3B8';
    ctx.fillRect(0, -5, 24, 10);
    ctx.restore();
    ctx.fillStyle = '#CBD5E1';
    ctx.beginPath();
    ctx.arc(launchPxX, launchPxY, 7, 0, Math.PI * 2);
    ctx.fill();

    // Projectile sphere & velocity vector arrows
    const ballX = toPxX(curX);
    const ballY = toPxY(curY);
    const vecScale = 1.6;
    // vx vector (emerald)
    ctx.strokeStyle = '#34D399';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ballX, ballY);
    ctx.lineTo(ballX + physics.vx0 * vecScale, ballY);
    ctx.stroke();
    // vy vector (amber)
    ctx.strokeStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(ballX, ballY);
    ctx.lineTo(ballX, ballY - curVy * vecScale);
    ctx.stroke();

    // Ball
    ctx.fillStyle = '#F8FAFC';
    ctx.beginPath();
    ctx.arc(ballX, ballY, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, [v0, angleDeg, h0, gravity, physics, clampedTime, curX, curY, curVy, ghost, targetX]);

  const handleFire = () => {
    if (running) {
      setRunning(false);
      return;
    }
    if (simTime >= physics.tFlight - 0.01) {
      setGhost({ v0, angleDeg, h0, g: gravity, range: physics.range });
      setSimTime(0);
    }
    setRunning(true);
    if (soundEnabled) playCardFlipSound();
  };

  const handleStep = () => {
    setRunning(false);
    setSimTime((prev) => Math.min(physics.tFlight, prev + 0.08));
    if (soundEnabled) playTickSound(0.14);
  };

  const handleReset = () => {
    setRunning(false);
    setSimTime(0);
    setGhost(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Zone 1: Visual Simulation Stage (65%) */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
            <span className="font-semibold text-white">
              {isKm ? 'ឆាកពិសោធន៍ចលនាបាញ់បញ្ឆិត' : 'Projectile Trajectory Stage'}
            </span>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="text-emerald-400">vx: {physics.vx0.toFixed(1)} m/s</span>
              <span className="text-amber-400">vy: {curVy.toFixed(1)} m/s</span>
              <span className="text-sky-300">t: {clampedTime.toFixed(2)} s</span>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            className="w-full h-[300px] sm:h-[360px] block"
          />

          {/* Playback Controls Bar */}
          <div className="px-4 py-3 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleFire}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>
                  {running
                    ? isKm
                      ? 'ផ្អាក'
                      : 'Pause'
                    : isKm
                    ? 'បាញ់សាកល្បង'
                    : 'Fire / Play'}
                </span>
              </button>
              <button
                type="button"
                onClick={handleStep}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <StepForward className="w-4 h-4" />
                <span>{isKm ? 'មួយជំហាន' : 'Step'}</span>
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isKm ? 'កំណត់ឡើងវិញ' : 'Reset'}</span>
              </button>
            </div>

            <div className="text-xs text-slate-400 tabular-nums">
              {isKm ? 'គោលដៅទង់ជាតិ៖' : 'Target Flag:'}{' '}
              <strong className="text-amber-400">{targetX}.0 m</strong>
            </div>
          </div>
        </div>

        {/* Live Telemetry Readouts */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: isKm ? 'ចម្ងាយបាញ់ (R)' : 'Range (R)', value: `${physics.range.toFixed(1)} m` },
            { label: isKm ? 'កម្ពស់អតិបរមា' : 'Max Height', value: `${physics.hMax.toFixed(1)} m` },
            { label: isKm ? 'រយៈពេលហោះ (T)' : 'Flight Time', value: `${physics.tFlight.toFixed(2)} s` },
            { label: isKm ? 'ល្បឿនបច្ចុប្បន្ន' : 'Speed |v|', value: `${curSpeed.toFixed(1)} m/s` },
          ].map((m) => (
            <div
              key={m.label}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Zone 2: Control & Concept Deck (35%) */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {isKm ? 'ប៉ារ៉ាម៉ែត្រពិសោធន៍' : 'Experiment Parameters'}
          </h3>

          <LabeledSlider
            label={isKm ? 'ល្បឿនដើម (v₀)' : 'Launch Speed (v₀)'}
            value={v0}
            unit="m/s"
            min={5}
            max={45}
            step={1}
            onChange={(val) => {
              setRunning(false);
              setSimTime(0);
              setV0(val);
            }}
          />

          <LabeledSlider
            label={isKm ? 'មុំបាញ់ (θ)' : 'Launch Angle (θ)'}
            value={angleDeg}
            unit="°"
            min={10}
            max={85}
            step={1}
            onChange={(val) => {
              setRunning(false);
              setSimTime(0);
              setAngleDeg(val);
            }}
          />

          <LabeledSlider
            label={isKm ? 'កម្ពស់ដើម (h₀)' : 'Initial Height (h₀)'}
            value={h0}
            unit="m"
            min={0}
            max={20}
            step={1}
            onChange={(val) => {
              setRunning(false);
              setSimTime(0);
              setH0(val);
            }}
          />

          <div className="space-y-1.5 pt-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isKm ? 'ទំនាញភព (g)' : 'Gravity Preset (g)'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {GRAVITY_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setSimTime(0);
                    setGravity(preset.g);
                  }}
                  className={`px-2.5 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                    gravity === preset.g
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isKm ? preset.km : preset.en}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Formula & Challenge Card */}
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {isKm ? 'រូបមន្តគោល' : 'Governing Equations'}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 space-y-1">
              <div>
                <MathText text="$x(t) = v_0 \cos(\theta)\, t$" />
              </div>
              <div>
                <MathText text="$y(t) = h_0 + v_0 \sin(\theta)\, t - \frac{1}{2}gt^2$" />
              </div>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              challengeSolved
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {challengeSolved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span
                className={
                  challengeSolved
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-amber-900 dark:text-amber-300'
                }
              >
                {challengeSolved
                  ? isKm
                    ? 'សម្រេចភារកិច្ចពិសោធន៍ហើយ!'
                    : 'Lab Challenge Completed!'
                  : isKm
                  ? 'ភារកិច្ច៖ បាញ់ឱ្យត្រូវទង់ជាតិ 40m (±2.5m)'
                  : 'Challenge: Hit the 40m target (±2.5m)'}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {isKm
                ? 'កែសម្រួលល្បឿន និងមុំ រួចចុច "បាញ់សាកល្បង"។'
                : 'Tune launch speed & angle, then press Fire to verify landing.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 2. OHM'S LAW & DC CIRCUIT LAB ====================

type CircuitTopology = 'single' | 'series' | 'parallel';

function CircuitLab({ isKm, soundEnabled, hapticsEnabled }: { isKm: boolean; soundEnabled: boolean; hapticsEnabled: boolean }) {
  const [voltage, setVoltage] = useState(12);
  const [r1, setR1] = useState(15);
  const [r2, setR2] = useState(15);
  const [topology, setTopology] = useState<CircuitTopology>('single');
  const [switchClosed, setSwitchClosed] = useState(true);
  const [challengeSolved, setChallengeSolved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseRef = useRef(0);

  const rEq = useMemo(() => {
    if (topology === 'single') return r1;
    if (topology === 'series') return r1 + r2;
    return (r1 * r2) / (r1 + r2);
  }, [topology, r1, r2]);

  const current = switchClosed ? voltage / rEq : 0;
  const power = voltage * current;

  const loadState = useMemo(() => {
    if (!switchClosed) {
      return {
        kind: 'open' as const,
        label: isKm ? 'សៀគ្វីបើក (គ្មានចរន្ត)' : 'Open Circuit (No Current)',
        color: 'text-slate-600 dark:text-slate-400',
      };
    }
    if (current > 3.0) {
      return {
        kind: 'overload' as const,
        label: isKm ? 'ចរន្តលើសកម្រិត (>3.0A)' : 'Overload Warning (>3.0A)',
        color: 'text-rose-600 dark:text-rose-400',
      };
    }
    if (current >= 1.5) {
      return {
        kind: 'high' as const,
        label: isKm ? 'ចរន្តខ្ពស់ (អំពូលភ្លឺខ្លាំង)' : 'High Load (Bright Bulb)',
        color: 'text-amber-600 dark:text-amber-400',
      };
    }
    return {
      kind: 'nominal' as const,
      label: isKm ? 'សៀគ្វីដំណើរការធម្មតា' : 'Nominal Load',
      color: 'text-emerald-600 dark:text-emerald-400',
    };
  }, [switchClosed, current, isKm]);

  // Challenge detector: current within 1.20A +/- 0.08A
  const isTargetCurrent = switchClosed && Math.abs(current - 1.2) <= 0.08;
  useEffect(() => {
    if (isTargetCurrent && !challengeSolved) {
      queueMicrotask(() => {
        setChallengeSolved(true);
        if (soundEnabled) playCorrectSound();
        if (hapticsEnabled) triggerHaptic(28);
      });
    }
  }, [isTargetCurrent, challengeSolved, soundEnabled, hapticsEnabled]);

  // Animated circuit canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;

      const speed = switchClosed ? Math.min(260, 28 + current * 65) : 0;
      phaseRef.current = (phaseRef.current + speed * dt) % 10000;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 640;
      const height = canvas.clientHeight || 340;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Dark blueprint canvas
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);

      // Subtle dot grid
      ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
      for (let gx = 20; gx < width; gx += 28) {
        for (let gy = 20; gy < height; gy += 28) {
          ctx.fillRect(gx, gy, 1.5, 1.5);
        }
      }

      const left = width * 0.16;
      const right = width * 0.84;
      const top = height * 0.22;
      const bottom = height * 0.78;
      const midX = (left + right) / 2;
      const midY = (top + bottom) / 2;

      // Wire loop
      ctx.strokeStyle = switchClosed
        ? current > 3
          ? '#F43F5E'
          : '#38BDF8'
        : '#64748B';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, bottom);
      ctx.lineTo(midX + 34, bottom);
      ctx.moveTo(midX - 34, bottom);
      ctx.lineTo(left, bottom);
      ctx.lineTo(left, top);
      ctx.stroke();

      // Parallel branch if parallel topology
      if (topology === 'parallel') {
        const branchTop = top + 54;
        ctx.beginPath();
        ctx.moveTo(midX - 90, top);
        ctx.lineTo(midX - 90, branchTop);
        ctx.lineTo(midX + 90, branchTop);
        ctx.lineTo(midX + 90, top);
        ctx.stroke();
      }

      // Animated electron/current dots along main loop
      if (switchClosed && current > 0.01) {
        const perimeter = 2 * (right - left) + 2 * (bottom - top);
        const dotCount = 16;
        ctx.fillStyle = current > 3 ? '#FDA4AF' : '#FDE047';
        for (let i = 0; i < dotCount; i++) {
          const dist = (phaseRef.current + (i * perimeter) / dotCount) % perimeter;
          let x = left;
          let y = top;
          const topLen = right - left;
          const sideLen = bottom - top;
          if (dist < topLen) {
            x = left + dist;
            y = top;
          } else if (dist < topLen + sideLen) {
            x = right;
            y = top + (dist - topLen);
          } else if (dist < 2 * topLen + sideLen) {
            x = right - (dist - topLen - sideLen);
            y = bottom;
          } else {
            x = left;
            y = bottom - (dist - 2 * topLen - sideLen);
          }
          ctx.beginPath();
          ctx.arc(x, y, 4.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Battery on left wire
      ctx.fillStyle = '#0F172A';
      ctx.fillRect(left - 24, midY - 34, 48, 68);
      // Long positive bar
      ctx.strokeStyle = '#F87171';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(left - 20, midY - 10);
      ctx.lineTo(left + 20, midY - 10);
      ctx.stroke();
      // Short negative bar
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(left - 11, midY + 10);
      ctx.lineTo(left + 11, midY + 10);
      ctx.stroke();
      ctx.fillStyle = '#F8FAFC';
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(`${voltage.toFixed(1)}V`, left + 26, midY + 4);

      // Resistor helper
      const drawResistor = (cx: number, cy: number, label: string) => {
        ctx.fillStyle = '#1E293B';
        ctx.strokeStyle = '#F59E0B';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.roundRect(cx - 34, cy - 13, 68, 26, 6);
        ctx.fill();
        ctx.stroke();
        // Color bands
        ctx.fillStyle = '#EF4444';
        ctx.fillRect(cx - 20, cy - 11, 5, 22);
        ctx.fillStyle = '#3B82F6';
        ctx.fillRect(cx - 8, cy - 11, 5, 22);
        ctx.fillStyle = '#FACC15';
        ctx.fillRect(cx + 12, cy - 11, 5, 22);
        ctx.fillStyle = '#F8FAFC';
        ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.fillText(label, cx - 22, cy - 19);
      };

      if (topology === 'single') {
        drawResistor(midX, top, `R1=${r1}Ω`);
      } else if (topology === 'series') {
        drawResistor(midX - 54, top, `R1=${r1}Ω`);
        drawResistor(midX + 54, top, `R2=${r2}Ω`);
      } else {
        drawResistor(midX, top, `R1=${r1}Ω`);
        drawResistor(midX, top + 54, `R2=${r2}Ω`);
      }

      // Glowing Lightbulb on right wire
      const glow = switchClosed ? Math.min(1, power / 24) : 0;
      if (glow > 0.02) {
        const radGrad = ctx.createRadialGradient(right, midY, 6, right, midY, 26 + glow * 44);
        radGrad.addColorStop(0, `rgba(253, 224, 71, ${0.4 + glow * 0.55})`);
        radGrad.addColorStop(1, 'rgba(253, 224, 71, 0)');
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(right, midY, 26 + glow * 44, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = switchClosed
        ? `rgba(254, 240, 138, ${0.25 + glow * 0.75})`
        : '#1E293B';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(right, midY, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Filament inside bulb
      ctx.strokeStyle = switchClosed ? '#F59E0B' : '#64748B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(right - 8, midY + 8);
      ctx.lineTo(right - 4, midY - 4);
      ctx.lineTo(right, midY + 2);
      ctx.lineTo(right + 4, midY - 4);
      ctx.lineTo(right + 8, midY + 8);
      ctx.stroke();

      // Switch on bottom wire
      ctx.fillStyle = '#E2E8F0';
      ctx.beginPath();
      ctx.arc(midX - 34, bottom, 5, 0, Math.PI * 2);
      ctx.arc(midX + 34, bottom, 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = switchClosed ? '#34D399' : '#FB7185';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(midX - 34, bottom);
      if (switchClosed) {
        ctx.lineTo(midX + 34, bottom);
      } else {
        ctx.lineTo(midX + 26, bottom - 26);
      }
      ctx.stroke();

      ctx.fillStyle = '#CBD5E1';
      ctx.font = 'bold 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.fillText(
        switchClosed ? 'SWITCH: ON' : 'SWITCH: OFF',
        midX - 42,
        bottom + 24
      );

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [voltage, r1, r2, topology, switchClosed, current, power]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      {/* Visual Stage */}
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">
              {isKm ? 'សៀគ្វីចរន្តជាប់ DC (Ohm’s Law)' : 'DC Circuit Sandbox'}
            </span>
            <span className={`font-semibold inline-flex items-center gap-1.5 ${loadState.color}`}>
              {loadState.kind === 'overload' ? (
                <AlertTriangle className="w-4 h-4" />
              ) : loadState.kind === 'open' ? (
                <Power className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{loadState.label}</span>
            </span>
          </div>

          <canvas ref={canvasRef} className="w-full h-[300px] sm:h-[340px] block" />

          <div className="px-4 py-3 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setSwitchClosed((v) => !v);
                if (soundEnabled) playTickSound(0.2);
              }}
              className={`min-h-[38px] px-4 py-1.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer ${
                switchClosed
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  : 'bg-rose-600 hover:bg-rose-500 text-white'
              }`}
            >
              <Power className="w-4 h-4" />
              <span>
                {switchClosed
                  ? isKm
                    ? 'កុងតាក់៖ បិទភ្ជាប់ (ON)'
                    : 'Switch: Closed (ON)'
                  : isKm
                  ? 'កុងតាក់៖ បើកផ្ដាច់ (OFF)'
                  : 'Switch: Open (OFF)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setVoltage(12);
                setR1(15);
                setR2(15);
                setTopology('single');
                setSwitchClosed(true);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isKm ? 'កំណត់ឡើងវិញ' : 'Reset'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isKm ? 'រេស៊ីស្តង់សមមូល (Req)' : 'Equivalent R', value: `${rEq.toFixed(1)} Ω` },
            { label: isKm ? 'អាំងតង់ស៊ីតេចរន្ត (I)' : 'Current (I)', value: `${current.toFixed(2)} A` },
            { label: isKm ? 'អានុភាពអគ្គិសនី (P)' : 'Power (P)', value: `${power.toFixed(1)} W` },
          ].map((m) => (
            <div
              key={m.label}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Control & Concept Deck */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isKm ? 'ប្រភេទតំណរេស៊ីស្តង់' : 'Circuit Topology'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(
                [
                  { id: 'single', km: 'ទោល', en: 'Single' },
                  { id: 'series', km: 'តជាស៊េរី', en: 'Series' },
                  { id: 'parallel', km: 'តជាខ្នែង', en: 'Parallel' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTopology(t.id)}
                  className={`py-2 px-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    topology === t.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-700 dark:text-blue-300'
                      : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isKm ? t.km : t.en}
                </button>
              ))}
            </div>
          </div>

          <LabeledSlider
            label={isKm ? 'តង់ស្យុងថ្មពិល (V)' : 'Battery Voltage (V)'}
            value={voltage}
            unit="V"
            min={1.5}
            max={24}
            step={0.5}
            onChange={setVoltage}
          />

          <LabeledSlider
            label={isKm ? 'រេស៊ីស្តង់ទី ១ (R₁)' : 'Resistor 1 (R₁)'}
            value={r1}
            unit="Ω"
            min={2}
            max={100}
            step={1}
            onChange={setR1}
          />

          {topology !== 'single' && (
            <LabeledSlider
              label={isKm ? 'រេស៊ីស្តង់ទី ២ (R₂)' : 'Resistor 2 (R₂)'}
              value={r2}
              unit="Ω"
              min={2}
              max={100}
              step={1}
              onChange={setR2}
            />
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {isKm ? 'រូបមន្តច្បាប់អូម' : 'Ohm’s Law Formulas'}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 space-y-1">
              <div>
                <MathText text="$I = \frac{V}{R_{\text{eq}}}, \quad P = V \cdot I$" />
              </div>
              {topology === 'series' && (
                <div>
                  <MathText text="$R_{\text{eq}} = R_1 + R_2$" />
                </div>
              )}
              {topology === 'parallel' && (
                <div>
                  <MathText text="$\frac{1}{R_{\text{eq}}} = \frac{1}{R_1} + \frac{1}{R_2}$" />
                </div>
              )}
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              challengeSolved
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {challengeSolved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span
                className={
                  challengeSolved
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-amber-900 dark:text-amber-300'
                }
              >
                {challengeSolved
                  ? isKm
                    ? 'សម្រេចភារកិច្ច 1.20A ហើយ!'
                    : '1.20 A Target Reached!'
                  : isKm
                  ? 'ភារកិច្ច៖ លៃតម្រូវចរន្តឱ្យបាន 1.20 A (±0.08 A)'
                  : 'Challenge: Tune current to 1.20 A (±0.08 A)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 3. WAVE & INTERFERENCE LAB ====================

function WaveLab({ isKm, soundEnabled, hapticsEnabled }: { isKm: boolean; soundEnabled: boolean; hapticsEnabled: boolean }) {
  const [amplitude, setAmplitude] = useState(1.6);
  const [frequency, setFrequency] = useState(1.5);
  const [wavelength, setWavelength] = useState(4.0);
  const [wave2Enabled, setWave2Enabled] = useState(true);
  const [phaseDeg, setPhaseDeg] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [challengeSolved, setChallengeSolved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const timeRef = useRef(0);

  const waveSpeed = frequency * wavelength;
  const period = 1 / frequency;
  const combinedPeak = wave2Enabled
    ? 2 * amplitude * Math.abs(Math.cos(((phaseDeg * Math.PI) / 180) / 2))
    : amplitude;

  const isDestructive =
    wave2Enabled && Math.abs(phaseDeg - 180) <= 10;

  useEffect(() => {
    if (isDestructive && !challengeSolved) {
      queueMicrotask(() => {
        setChallengeSolved(true);
        if (soundEnabled) playCorrectSound();
        if (hapticsEnabled) triggerHaptic(28);
      });
    }
  }, [isDestructive, challengeSolved, soundEnabled, hapticsEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let lastTs = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - lastTs) / 1000);
      lastTs = now;
      if (playing) {
        timeRef.current += dt;
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 640;
      const height = canvas.clientHeight || 330;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);

      const midY = height / 2;
      const padX = 24;
      const plotW = width - padX * 2;
      const scaleY = (height * 0.36) / 6; // fits up to +/- 6m combined amplitude
      const worldMeters = 12;

      // Grid lines
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)';
      ctx.lineWidth = 1;
      for (let m = 0; m <= worldMeters; m += 2) {
        const x = padX + (m / worldMeters) * plotW;
        ctx.beginPath();
        ctx.moveTo(x, 16);
        ctx.lineTo(x, height - 16);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.beginPath();
      ctx.moveTo(padX, midY);
      ctx.lineTo(padX + plotW, midY);
      ctx.stroke();

      const k = (2 * Math.PI) / wavelength;
      const omega = 2 * Math.PI * frequency;
      const phi = (phaseDeg * Math.PI) / 180;
      const t = timeRef.current;

      const plotCurve = (
        evalFn: (xMeters: number) => number,
        stroke: string,
        lineWidth: number,
        dashed = false
      ) => {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = lineWidth;
        ctx.setLineDash(dashed ? [6, 4] : []);
        ctx.beginPath();
        const samples = 180;
        for (let i = 0; i <= samples; i++) {
          const xMeters = (worldMeters * i) / samples;
          const px = padX + (i / samples) * plotW;
          const py = midY - evalFn(xMeters) * scaleY;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      };

      // Wave 1 (sky blue)
      plotCurve(
        (x) => amplitude * Math.sin(k * x - omega * t),
        '#38BDF8',
        wave2Enabled ? 2 : 3
      );

      if (wave2Enabled) {
        // Wave 2 (amber dashed)
        plotCurve(
          (x) => amplitude * Math.sin(k * x - omega * t + phi),
          '#F59E0B',
          2,
          true
        );

        // Superposition sum (emerald bold)
        plotCurve(
          (x) =>
            amplitude * Math.sin(k * x - omega * t) +
            amplitude * Math.sin(k * x - omega * t + phi),
          '#34D399',
          3.2
        );
      }

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [amplitude, frequency, wavelength, wave2Enabled, phaseDeg, playing]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">
              {isKm ? 'អូស៊ីឡូស្កុបរលក និងការជ្រៀតជ្រែក' : 'Wave Oscilloscope & Superposition'}
            </span>
            <div className="flex items-center gap-3">
              <span className="text-sky-400 font-semibold">y₁</span>
              {wave2Enabled && (
                <>
                  <span className="text-amber-400 font-semibold">y₂</span>
                  <span className="text-emerald-400 font-semibold">y₁ + y₂</span>
                </>
              )}
            </div>
          </div>

          <canvas ref={canvasRef} className="w-full h-[300px] sm:h-[330px] block" />

          <div className="px-4 py-3 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{playing ? (isKm ? 'ផ្អាក' : 'Pause') : isKm ? 'ដំណើរការ' : 'Play'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  timeRef.current += 0.06;
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <StepForward className="w-4 h-4" />
                <span>{isKm ? 'មួយជំហាន' : 'Step'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAmplitude(1.6);
                  setFrequency(1.5);
                  setWavelength(4.0);
                  setPhaseDeg(0);
                  setWave2Enabled(true);
                  timeRef.current = 0;
                }}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{isKm ? 'កំណត់ឡើងវិញ' : 'Reset'}</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setWave2Enabled((v) => !v)}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                wave2Enabled
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {wave2Enabled
                ? isKm
                  ? 'រលកទី ២៖ បើក'
                  : 'Wave 2: ON'
                : isKm
                ? 'រលកទី ២៖ បិទ'
                : 'Wave 2: OFF'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: isKm ? 'ល្បឿនរលក (v = fλ)' : 'Wave Speed (v)', value: `${waveSpeed.toFixed(1)} m/s` },
            { label: isKm ? 'ខួបរលក (T = 1/f)' : 'Period (T)', value: `${period.toFixed(2)} s` },
            { label: isKm ? 'អំភ្លីទុតសរុប' : 'Combined Peak', value: `${combinedPeak.toFixed(2)} m` },
          ].map((m) => (
            <div
              key={m.label}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Control & Concept Deck */}
      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isKm ? 'ដំណាក់កាលសិក្សា' : 'Learning Presets'}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setWave2Enabled(false);
                  setPhaseDeg(0);
                }}
                className="py-2 px-2 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 cursor-pointer"
              >
                {isKm ? 'រលកទោល' : 'Single'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setWave2Enabled(true);
                  setPhaseDeg(0);
                }}
                className="py-2 px-2 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 cursor-pointer"
              >
                {isKm ? 'ជ្រៀតបូក (0°)' : 'Constructive'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setWave2Enabled(true);
                  setPhaseDeg(180);
                }}
                className="py-2 px-2 rounded-lg text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-500 cursor-pointer"
              >
                {isKm ? 'ជ្រៀតដក (180°)' : 'Destructive'}
              </button>
            </div>
          </div>

          <LabeledSlider
            label={isKm ? 'អំភ្លីទុត (A)' : 'Amplitude (A)'}
            value={amplitude}
            unit="m"
            min={0.5}
            max={3.0}
            step={0.1}
            onChange={setAmplitude}
          />
          <LabeledSlider
            label={isKm ? 'ប្រេកង់ (f)' : 'Frequency (f)'}
            value={frequency}
            unit="Hz"
            min={0.5}
            max={4.0}
            step={0.1}
            onChange={setFrequency}
          />
          <LabeledSlider
            label={isKm ? 'ជំហានរលក (λ)' : 'Wavelength (λ)'}
            value={wavelength}
            unit="m"
            min={1.5}
            max={8.0}
            step={0.1}
            onChange={setWavelength}
          />
          {wave2Enabled && (
            <LabeledSlider
              label={isKm ? 'គម្លាតផាស (φ)' : 'Phase Shift (φ)'}
              value={phaseDeg}
              unit="°"
              min={0}
              max={360}
              step={5}
              onChange={setPhaseDeg}
            />
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {isKm ? 'សមីការរលក' : 'Wave Equation'}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 space-y-1">
              <div>
                <MathText text="$y(x,t) = A\sin(kx - \omega t + \phi)$" />
              </div>
              <div>
                <MathText text="$v = f \cdot \lambda$" />
              </div>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              challengeSolved
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {challengeSolved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span
                className={
                  challengeSolved
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-amber-900 dark:text-amber-300'
                }
              >
                {challengeSolved
                  ? isKm
                    ? 'រកឃើញការជ្រៀតជ្រែកបំបាត់គ្នាហើយ!'
                    : 'Destructive Interference Achieved!'
                  : isKm
                  ? 'ភារកិច្ច៖ បើករលកទី ២ រួចលៃផាសឱ្យរលកលុបគ្នា (0m)'
                  : 'Challenge: Cancel both waves (φ ≈ 180°)'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 4. pH SCALE & ACID-BASE LAB ====================

const PH_SAMPLES = [
  { id: 'lemon', ph: 2.2, km: 'ទឹកក្រូចឆ្មារ', en: 'Lemon Juice' },
  { id: 'vinegar', ph: 3.0, km: 'ទឹកខ្មេះ', en: 'Vinegar' },
  { id: 'coffee', ph: 5.0, km: 'កាហ្វេខ្មៅ', en: 'Coffee' },
  { id: 'water', ph: 7.0, km: 'ទឹកសុទ្ធ', en: 'Pure Water' },
  { id: 'baking_soda', ph: 8.3, km: 'ម្សៅដុតនំ', en: 'Baking Soda' },
  { id: 'soap', ph: 10.5, km: 'ទឹកសាប៊ូ', en: 'Hand Soap' },
  { id: 'naoh', ph: 13.0, km: 'សូដ្យូមអ៊ីដ្រុកស៊ីត', en: 'NaOH Solution' },
] as const;

function phToColor(ph: number): string {
  // Smooth universal indicator spectrum from pH 0 (crimson) -> 7 (emerald) -> 14 (violet)
  const stops: [number, [number, number, number]][] = [
    [0, [220, 38, 38]],
    [3, [249, 115, 22]],
    [5.5, [234, 179, 8]],
    [7, [16, 185, 129]],
    [9.5, [14, 165, 233]],
    [12, [79, 70, 229]],
    [14, [147, 51, 234]],
  ];
  const clamped = Math.max(0, Math.min(14, ph));
  for (let i = 0; i < stops.length - 1; i++) {
    const [p1, c1] = stops[i];
    const [p2, c2] = stops[i + 1];
    if (clamped >= p1 && clamped <= p2) {
      const f = (clamped - p1) / (p2 - p1);
      const r = Math.round(c1[0] + (c2[0] - c1[0]) * f);
      const g = Math.round(c1[1] + (c2[1] - c1[1]) * f);
      const b = Math.round(c1[2] + (c2[2] - c1[2]) * f);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  return 'rgb(16, 185, 129)';
}

function PhScaleLab({ isKm, soundEnabled, hapticsEnabled }: { isKm: boolean; soundEnabled: boolean; hapticsEnabled: boolean }) {
  const [ph, setPh] = useState(3.0); // Start with Vinegar so neutralization challenge is immediate
  const [sampleName, setSampleName] = useState<string>(isKm ? 'ទឹកខ្មេះ' : 'Vinegar');
  const [startedAcidic, setStartedAcidic] = useState(true);
  const [challengeSolved, setChallengeSolved] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const tickRef = useRef(0);

  const poh = 14 - ph;
  const hConcExp = -ph;
  const liquidColor = phToColor(ph);

  const classification = useMemo(() => {
    if (ph < 6.8) {
      return {
        kind: 'acid' as const,
        label: isKm ? 'សូលុយស្យុងអាស៊ីត (Acidic)' : 'Acidic Solution',
        color: 'text-rose-600 dark:text-rose-400',
      };
    }
    if (ph > 7.2) {
      return {
        kind: 'base' as const,
        label: isKm ? 'សូលុយស្យុងបាស (Basic / Alkaline)' : 'Basic / Alkaline Solution',
        color: 'text-indigo-600 dark:text-indigo-400',
      };
    }
    return {
      kind: 'neutral' as const,
      label: isKm ? 'ណឺត (Neutral)' : 'Neutral Solution',
      color: 'text-emerald-600 dark:text-emerald-400',
    };
  }, [ph, isKm]);

  const isNeutralized = startedAcidic && ph >= 6.8 && ph <= 7.2;
  useEffect(() => {
    if (isNeutralized && !challengeSolved) {
      queueMicrotask(() => {
        setChallengeSolved(true);
        if (soundEnabled) playCorrectSound();
        if (hapticsEnabled) triggerHaptic(28);
      });
    }
  }, [isNeutralized, challengeSolved, soundEnabled, hapticsEnabled]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    const draw = () => {
      tickRef.current += 0.025;
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth || 640;
      const height = canvas.clientHeight || 330;
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      ctx.fillStyle = '#0F172A';
      ctx.fillRect(0, 0, width, height);

      // Beaker geometry
      const bW = Math.min(250, width * 0.44);
      const bH = 195;
      const bX = (width - bW) / 2;
      const bY = 38;
      const fillTop = bY + 52;

      // Liquid body
      ctx.fillStyle = liquidColor;
      ctx.globalAlpha = 0.82;
      ctx.beginPath();
      ctx.roundRect(bX + 4, fillTop, bW - 8, bH - (fillTop - bY) - 4, [4, 4, 14, 14]);
      ctx.fill();
      ctx.globalAlpha = 1;

      // Liquid meniscus wave
      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = bX + 6; x <= bX + bW - 6; x += 4) {
        const y = fillTop + Math.sin(x * 0.05 + tickRef.current * 2) * 2.5;
        if (x === bX + 6) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Floating H+ and OH- ions proportional to pH
      const totalIons = 18;
      const hCount = Math.round(((14 - ph) / 14) * totalIons);
      for (let i = 0; i < totalIons; i++) {
        const isH = i < hCount;
        const seedX = ((i * 53 + 19) % 100) / 100;
        const seedY = ((i * 37 + 11) % 100) / 100;
        const ix =
          bX +
          22 +
          seedX * (bW - 44) +
          Math.sin(tickRef.current + i * 1.3) * 8;
        const iy =
          fillTop +
          22 +
          seedY * (bH - (fillTop - bY) - 44) +
          Math.cos(tickRef.current * 1.1 + i) * 6;

        ctx.fillStyle = isH ? '#FEE2E2' : '#DBEAFE';
        ctx.strokeStyle = isH ? '#EF4444' : '#3B82F6';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(ix, iy, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = isH ? '#991B1B' : '#1E3A8A';
        ctx.font = 'bold 9px ui-monospace, SFMono-Regular, Menlo, monospace';
        ctx.textAlign = 'center';
        ctx.fillText(isH ? 'H+' : 'OH-', ix, iy + 3);
      }
      ctx.textAlign = 'left';

      // Glass beaker outline & volume ticks
      ctx.strokeStyle = '#CBD5E1';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(bX, bY);
      ctx.lineTo(bX, bY + bH - 16);
      ctx.quadraticCurveTo(bX, bY + bH, bX + 16, bY + bH);
      ctx.lineTo(bX + bW - 16, bY + bH);
      ctx.quadraticCurveTo(bX + bW, bY + bH, bX + bW, bY + bH - 16);
      ctx.lineTo(bX + bW, bY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.lineWidth = 1.5;
      for (let t = 1; t <= 4; t++) {
        const ty = bY + bH - t * 36;
        ctx.beginPath();
        ctx.moveTo(bX + 6, ty);
        ctx.lineTo(bX + 22, ty);
        ctx.stroke();
      }

      // Calibrated pH Spectrum Bar at bottom
      const barX = 36;
      const barW = width - 72;
      const barY = height - 48;
      const barH = 16;
      const grad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
      grad.addColorStop(0, '#DC2626');
      grad.addColorStop(0.25, '#F97316');
      grad.addColorStop(0.4, '#EAB308');
      grad.addColorStop(0.5, '#10B981');
      grad.addColorStop(0.7, '#0EA5E9');
      grad.addColorStop(0.86, '#4F46E5');
      grad.addColorStop(1, '#9333EA');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(barX, barY, barW, barH, 8);
      ctx.fill();

      // Pointer triangle on pH bar
      const pointerX = barX + (ph / 14) * barW;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(pointerX, barY - 2);
      ctx.lineTo(pointerX - 7, barY - 12);
      ctx.lineTo(pointerX + 7, barY - 12);
      ctx.closePath();
      ctx.fill();

      // Numeric scale markers
      ctx.fillStyle = '#94A3B8';
      ctx.font = '11px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textAlign = 'center';
      [0, 2, 4, 7, 10, 12, 14].forEach((mark) => {
        ctx.fillText(String(mark), barX + (mark / 14) * barW, barY + barH + 16);
      });
      ctx.textAlign = 'left';

      rafId = window.requestAnimationFrame(draw);
    };

    rafId = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(rafId);
  }, [ph, liquidColor]);

  const adjustPh = (delta: number) => {
    setPh((prev) => Math.max(0, Math.min(14, Number((prev + delta).toFixed(1)))));
    setSampleName(isKm ? 'សូលុយស្យុងលាយ' : 'Custom Mix');
    if (soundEnabled) playTickSound(0.16);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
      <div className="lg:col-span-8 flex flex-col gap-4">
        <div className="rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-white">
              {isKm ? 'កែវពិសោធន៍ pH អាស៊ីត-បាស' : 'Acid-Base Indicator Beaker'} ·{' '}
              <span className="text-slate-300">{sampleName}</span>
            </span>
            <span className={`font-semibold inline-flex items-center gap-1.5 ${classification.color}`}>
              <Droplets className="w-4 h-4" />
              <span>{classification.label}</span>
            </span>
          </div>

          <canvas ref={canvasRef} className="w-full h-[300px] sm:h-[330px] block" />

          <div className="px-4 py-3 bg-slate-950/70 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => adjustPh(-0.5)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {isKm ? '+ បន្ថែមអាស៊ីត (-0.5)' : '+ Add Acid (-0.5)'}
              </button>
              <button
                type="button"
                onClick={() => adjustPh(0.5)}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {isKm ? '+ បន្ថែមបាស (+0.5)' : '+ Add Base (+0.5)'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPh((prev) => Number((prev + (7 - prev) * 0.45).toFixed(1)));
                  setSampleName(isKm ? 'ពង្រាវដោយទឹក' : 'Diluted Solution');
                  if (soundEnabled) playTickSound(0.14);
                }}
                className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold cursor-pointer"
              >
                {isKm ? 'ពង្រាវទឹក (H₂O)' : 'Dilute (H₂O)'}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                setPh(3.0);
                setSampleName(isKm ? 'ទឹកខ្មេះ' : 'Vinegar');
                setStartedAcidic(true);
              }}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>{isKm ? 'កំណត់ឡើងវិញ' : 'Reset'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'pH', value: ph.toFixed(1) },
            { label: 'pOH', value: poh.toFixed(1) },
            { label: '[H⁺] (mol/L)', value: `10^(${hConcExp.toFixed(1)})` },
          ].map((m) => (
            <div
              key={m.label}
              className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
            >
              <div className="text-xs text-slate-500 dark:text-slate-400">{m.label}</div>
              <div className="mt-1 text-lg font-bold text-slate-900 dark:text-white tabular-nums">
                {m.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="lg:col-span-4 space-y-4">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <LabeledSlider
            label={isKm ? 'កម្រិត pH ផ្ទាល់' : 'Direct pH Control'}
            value={ph}
            unit="pH"
            min={0}
            max={14}
            step={0.1}
            onChange={(val) => {
              setPh(val);
              if (val < 6.0) setStartedAcidic(true);
              setSampleName(isKm ? 'កំណត់ផ្ទាល់' : 'Custom pH');
            }}
          />

          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isKm ? 'សារធាតុគំរូក្នុងជីវភាព' : 'Everyday Lab Samples'}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {PH_SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setPh(s.ph);
                    setSampleName(isKm ? s.km : s.en);
                    if (s.ph < 6.0) setStartedAcidic(true);
                    if (soundEnabled) playTickSound(0.14);
                  }}
                  className="px-2.5 py-2 rounded-lg text-left text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-blue-500 text-slate-700 dark:text-slate-200 flex items-center justify-between gap-1 cursor-pointer"
                >
                  <span className="truncate">{isKm ? s.km : s.en}</span>
                  <span className="tabular-nums text-slate-400">{s.ph}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4 shadow-sm">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              {isKm ? 'រូបមន្តគីមី pH' : 'pH Definitions'}
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs sm:text-sm text-slate-800 dark:text-slate-200 space-y-1">
              <div>
                <MathText text="$\text{pH} = -\log_{10}[\text{H}^+]$" />
              </div>
              <div>
                <MathText text="$\text{pH} + \text{pOH} = 14$" />
              </div>
            </div>
          </div>

          <div
            className={`p-3.5 rounded-xl border ${
              challengeSolved
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              {challengeSolved ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <Target className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              )}
              <span
                className={
                  challengeSolved
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-amber-900 dark:text-amber-300'
                }
              >
                {challengeSolved
                  ? isKm
                    ? 'ធ្វើណឺតកម្មជោគជ័យ (pH ≈ 7.0)!'
                    : 'Neutralization Complete (pH ≈ 7.0)!'
                  : isKm
                  ? 'ភារកិច្ច៖ បន្ថែមបាសដើម្បីធ្វើណឺតកម្មទឹកខ្មេះឱ្យដល់ pH 6.8–7.2'
                  : 'Challenge: Neutralize Vinegar (pH 3.0) to pH 6.8–7.2'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN CONTAINER ====================

export function EduSimulationsView() {
  const { settings } = usePickerwel();
  const isKm = settings.language === 'km';
  const [activeSim, setActiveSim] = useState<SimId>('projectile');

  const sims: {
    id: SimId;
    title: string;
    subject: string;
    icon: React.ComponentType<{ className?: string }>;
  }[] = [
    {
      id: 'projectile',
      title: isKm ? 'ចលនាបាញ់បញ្ឆិត' : 'Projectile Motion',
      subject: isKm ? 'រូបវិទ្យា' : 'Physics',
      icon: Compass,
    },
    {
      id: 'circuit',
      title: isKm ? 'ច្បាប់អូម & សៀគ្វី DC' : "Ohm's Law & Circuit",
      subject: isKm ? 'អគ្គិសនី' : 'Electricity',
      icon: Zap,
    },
    {
      id: 'wave',
      title: isKm ? 'រលក & ការជ្រៀតជ្រែក' : 'Wave Interference',
      subject: isKm ? 'សូរ & រលក' : 'Waves',
      icon: Waves,
    },
    {
      id: 'ph',
      title: isKm ? 'មាត្រដ្ឋាន pH អាស៊ីត-បាស' : 'pH Acid-Base Lab',
      subject: isKm ? 'គីមីវិទ្យា' : 'Chemistry',
      icon: FlaskConical,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Header & Simulation Switcher */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                {isKm
                  ? 'មន្ទីរពិសោធន៍អប់រំក្រៅបណ្ដាញ (Educational Simulations)'
                  : 'Educational Simulations Lab (Offline)'}
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {isKm
                  ? 'ពិសោធន៍វិទ្យាសាស្ត្រ STEM ផ្ទាល់លើអេក្រង់ កែសម្រួលប៉ារ៉ាម៉ែត្រ និងមើលលទ្ធផលភ្លាមៗ ដោយគ្មានអ៊ីនធឺណិត។'
                  : 'Interactive offline STEM sandboxes — manipulate variables, inspect live formulas, and complete lab challenges.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 self-start sm:self-center">
            <Award className="w-4 h-4" />
            <span>{isKm ? '4 ពិសោធន៍ · ប្រើ Offline 100%' : '4 Interactive Labs · 100% Offline'}</span>
          </div>
        </div>

        {/* 4 Simulation Selector Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {sims.map((sim) => {
            const Icon = sim.icon;
            const active = activeSim === sim.id;
            return (
              <button
                key={sim.id}
                type="button"
                onClick={() => setActiveSim(sim.id)}
                className={`p-3 rounded-xl border text-left transition-colors flex items-center gap-3 cursor-pointer ${
                  active
                    ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-900 dark:text-blue-200'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {sim.subject}
                  </div>
                  <div className="text-xs sm:text-sm font-bold truncate">
                    {sim.title}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Sandbox Viewport */}
      {activeSim === 'projectile' ? (
        <ProjectileLab
          isKm={isKm}
          soundEnabled={settings.soundEnabled}
          hapticsEnabled={settings.hapticsEnabled}
        />
      ) : activeSim === 'circuit' ? (
        <CircuitLab
          isKm={isKm}
          soundEnabled={settings.soundEnabled}
          hapticsEnabled={settings.hapticsEnabled}
        />
      ) : activeSim === 'wave' ? (
        <WaveLab
          isKm={isKm}
          soundEnabled={settings.soundEnabled}
          hapticsEnabled={settings.hapticsEnabled}
        />
      ) : (
        <PhScaleLab
          isKm={isKm}
          soundEnabled={settings.soundEnabled}
          hapticsEnabled={settings.hapticsEnabled}
        />
      )}
    </div>
  );
}
