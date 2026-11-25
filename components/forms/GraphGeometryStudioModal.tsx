'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Check,
  Download,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid,
  Tag,
  Compass,
  Box,
  TrendingUp,
  Shapes,
  Move,
} from 'lucide-react';
import type { Language } from '@/lib/i18n';
import { compileMathExpression } from '@/lib/math-expression';
import {
  draw2DGraph,
  draw3DSpaceGraph,
  drawGeometryFigure,
  GEOMETRY_FIGURES,
  type GeometryFigureId,
  type Graph2DConfig,
  type Graph3DConfig,
  type Plot2DItem,
  type Plot3DItem,
} from '@/lib/geometry-renderer';

export type StudioMode = '2d' | '3d' | 'geometry';

interface GraphGeometryStudioModalProps {
  open: boolean;
  language: Language;
  accentColor?: string;
  initialMode?: StudioMode;
  targetLabel?: string;
  onClose: () => void;
  onInsertImage: (dataUrl: string) => void;
}

const PLOT_COLORS = [
  '#4F46E5', // Indigo
  '#DC2626', // Crimson
  '#059669', // Emerald
  '#D97706', // Amber
  '#0284C7', // Sky
  '#9333EA', // Purple
  '#0F172A', // Classic Ink
];

function uid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
}

const PRESETS_2D: {
  id: string;
  nameKm: string;
  nameEn: string;
  items: () => Plot2DItem[];
  scale?: number;
}[] = [
  {
    id: 'parabola',
    nameKm: 'ប៉ារ៉ាបូល & បន្ទាត់',
    nameEn: 'Parabola & Line',
    scale: 44,
    items: () => [
      { id: uid('f'), kind: 'function', expr: 'x^2 - 2*x - 3', color: '#4F46E5', visible: true },
      { id: uid('f'), kind: 'function', expr: 'x + 1', color: '#DC2626', visible: true },
      { id: uid('p'), kind: 'point', x: 1, y: -4, name: 'I', color: '#059669', visible: true },
    ],
  },
  {
    id: 'rational',
    nameKm: 'អនុគមន៍សនិទាន',
    nameEn: 'Rational Function',
    scale: 42,
    items: () => [
      { id: uid('f'), kind: 'function', expr: '(2*x - 1)/(x - 1)', color: '#4F46E5', visible: true },
      { id: uid('f'), kind: 'function', expr: '2', color: '#94A3B8', visible: true, label: 'y = 2 (អាស៊ីមតូត)' },
    ],
  },
  {
    id: 'trig',
    nameKm: 'ត្រីកោណមាត្រ sin & cos',
    nameEn: 'Sine & Cosine',
    scale: 48,
    items: () => [
      { id: uid('f'), kind: 'function', expr: 'sin(x)', color: '#4F46E5', visible: true },
      { id: uid('f'), kind: 'function', expr: 'cos(x)', color: '#DC2626', visible: true },
    ],
  },
  {
    id: 'exp_log',
    nameKm: 'អ៊ិចស្ប៉ូណង់ស្យែល & ln',
    nameEn: 'Exp & Logarithm',
    scale: 46,
    items: () => [
      { id: uid('f'), kind: 'function', expr: 'e^x', color: '#4F46E5', visible: true },
      { id: uid('f'), kind: 'function', expr: 'ln(x)', color: '#059669', visible: true },
      { id: uid('f'), kind: 'function', expr: 'x', color: '#94A3B8', visible: true },
    ],
  },
  {
    id: 'circle',
    nameKm: 'រង្វង់',
    nameEn: 'Circle',
    scale: 44,
    items: () => [
      { id: uid('c'), kind: 'circle', h: 0, k: 0, r: 3, color: '#4F46E5', visible: true },
      { id: uid('p'), kind: 'point', x: 3, y: 0, name: 'A', color: '#DC2626', visible: true },
    ],
  },
  {
    id: 'ellipse',
    nameKm: 'អេលីប',
    nameEn: 'Ellipse',
    scale: 42,
    items: () => [
      { id: uid('e'), kind: 'ellipse', h: 0, k: 0, a: 4, b: 2.5, color: '#0284C7', visible: true },
      { id: uid('p'), kind: 'point', x: 3.12, y: 0, name: 'F', color: '#DC2626', visible: true },
    ],
  },
  {
    id: 'hyperbola',
    nameKm: 'អ៊ីពែបូល',
    nameEn: 'Hyperbola',
    scale: 40,
    items: () => [
      {
        id: uid('h'),
        kind: 'hyperbola',
        h: 0,
        k: 0,
        a: 2.5,
        b: 2,
        showAsymptotes: true,
        color: '#9333EA',
        visible: true,
      },
    ],
  },
  {
    id: 'vectors2d',
    nameKm: 'វ៉ិចទ័រក្នុងប្លង់',
    nameEn: '2D Vectors',
    scale: 46,
    items: () => [
      { id: uid('v'), kind: 'vector', x0: 0, y0: 0, dx: 3, dy: 2, name: 'u', color: '#4F46E5', visible: true },
      { id: uid('v'), kind: 'vector', x0: 0, y0: 0, dx: -2, dy: 3, name: 'v', color: '#DC2626', visible: true },
      { id: uid('v'), kind: 'vector', x0: 0, y0: 0, dx: 1, dy: 5, name: 'u+v', color: '#059669', visible: true },
    ],
  },
];

const PRESETS_3D: {
  id: string;
  nameKm: string;
  nameEn: string;
  items: () => Plot3DItem[];
}[] = [
  {
    id: 'plane_normal',
    nameKm: 'ប្លង់ & វ៉ិចទ័រណរម៉ាល់',
    nameEn: 'Plane & Normal Vector',
    items: () => [
      { id: uid('pl'), kind: 'plane', a: 1, b: 1, c: 1, d: -3, showNormal: true, color: '#4F46E5', visible: true },
      { id: uid('pt'), kind: 'point3d', x: 3, y: 0, z: 0, name: 'A', showProjection: false, color: '#DC2626', visible: true },
      { id: uid('pt'), kind: 'point3d', x: 0, y: 3, z: 0, name: 'B', showProjection: false, color: '#16A34A', visible: true },
      { id: uid('pt'), kind: 'point3d', x: 0, y: 0, z: 3, name: 'C', showProjection: false, color: '#2563EB', visible: true },
    ],
  },
  {
    id: 'line_plane',
    nameKm: 'បន្ទាត់កាត់ប្លង់ 3D',
    nameEn: 'Line & Plane in 3D',
    items: () => [
      { id: uid('pl'), kind: 'plane', a: 0, b: 0, c: 1, d: -1, showNormal: false, color: '#0284C7', visible: true },
      { id: uid('ln'), kind: 'line3d', x0: 0, y0: 0, z0: 1, a: 1, b: 1, c: 1.5, name: 'd', color: '#DC2626', visible: true },
      { id: uid('pt'), kind: 'point3d', x: 0, y: 0, z: 1, name: 'M', showProjection: false, color: '#0F172A', visible: true },
    ],
  },
  {
    id: 'sphere3d',
    nameKm: 'ស្វ៊ែរក្នុងលំហរ',
    nameEn: '3D Sphere',
    items: () => [
      { id: uid('sp'), kind: 'sphere', cx: 1, cy: 1, cz: 1, r: 2.2, color: '#4F46E5', visible: true },
      { id: uid('pt'), kind: 'point3d', x: 1, y: 1, z: 1, name: 'I', showProjection: true, color: '#DC2626', visible: true },
    ],
  },
  {
    id: 'paraboloid',
    nameKm: 'ផ្ទៃប៉ារ៉ាបូល៉ូអ៊ីត',
    nameEn: 'Paraboloid Surface',
    items: () => [
      { id: uid('sf'), kind: 'surface', expr: '0.25*(x^2 + y^2) - 1.5', range: 4, color: '#4F46E5', visible: true },
    ],
  },
  {
    id: 'saddle',
    nameKm: 'ផ្ទៃកែបសេះ (Saddle)',
    nameEn: 'Hyperbolic Paraboloid',
    items: () => [
      { id: uid('sf'), kind: 'surface', expr: '0.22*(x^2 - y^2)', range: 4, color: '#9333EA', visible: true },
    ],
  },
  {
    id: 'wave3d',
    nameKm: 'ផ្ទៃរលក sin(x)cos(y)',
    nameEn: '3D Wave Surface',
    items: () => [
      { id: uid('sf'), kind: 'surface', expr: '1.6*sin(x)*cos(y)', range: 4, color: '#0284C7', visible: true },
    ],
  },
  {
    id: 'vectors3d',
    nameKm: 'វ៉ិចទ័រ & ចំណុចក្នុងលំហរ',
    nameEn: '3D Vectors & Point',
    items: () => [
      { id: uid('v3'), kind: 'vector3d', x0: 0, y0: 0, z0: 0, dx: 3, dy: 1, dz: 2, name: 'u', color: '#4F46E5', visible: true },
      { id: uid('v3'), kind: 'vector3d', x0: 0, y0: 0, z0: 0, dx: 0, dy: 3, dz: 1, name: 'v', color: '#DC2626', visible: true },
      { id: uid('pt'), kind: 'point3d', x: 3, y: 1, z: 2, name: 'A', showProjection: true, color: '#059669', visible: true },
    ],
  },
];

const CANVAS_W = 720;
const CANVAS_H = 480;

export function GraphGeometryStudioModal(props: GraphGeometryStudioModalProps) {
  if (!props.open) return null;
  return <GraphGeometryStudioModalInner {...props} />;
}

function GraphGeometryStudioModalInner({
  language,
  accentColor = '#673AB7',
  initialMode = '2d',
  targetLabel,
  onClose,
  onInsertImage,
}: GraphGeometryStudioModalProps) {
  const km = language === 'km';
  const [mode, setMode] = useState<StudioMode>(initialMode);

  // 2D Plane Graph state
  const [graph2D, setGraph2D] = useState<Graph2DConfig>(() => ({
    centerX: 0,
    centerY: 0,
    scale: 44,
    showGrid: true,
    showNumbers: true,
    showLegend: true,
    items: PRESETS_2D[0].items(),
  }));

  // 3D Space Graph state
  const [graph3D, setGraph3D] = useState<Graph3DConfig>(() => ({
    yaw: 0.68,
    pitch: 0.42,
    zoom: 42,
    bound: 5,
    showGrid: true,
    showLabels: true,
    items: PRESETS_3D[0].items(),
  }));

  // Common Geometry Figures state
  const [geoGroupFilter, setGeoGroupFilter] = useState<'all' | '2d' | '3d'>('all');
  const [geoId, setGeoId] = useState<GeometryFigureId>('right_triangle');
  const [dimA, setDimA] = useState('a');
  const [dimB, setDimB] = useState('b');
  const [dimC, setDimC] = useState('c');
  const [geoShowLabels, setGeoShowLabels] = useState(true);
  const [geoShowMarks, setGeoShowMarks] = useState(true);
  const [geoShowFormula, setGeoShowFormula] = useState(true);
  const [geoAccent, setGeoAccent] = useState('#4F46E5');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });

  const activeGeoMeta = useMemo(
    () => GEOMETRY_FIGURES.find((f) => f.id === geoId) || GEOMETRY_FIGURES[0],
    [geoId]
  );

  const filteredGeoFigures = useMemo(
    () =>
      geoGroupFilter === 'all'
        ? GEOMETRY_FIGURES
        : GEOMETRY_FIGURES.filter((f) => f.group === geoGroupFilter),
    [geoGroupFilter]
  );

  const handleSelectGeoFigure = (id: GeometryFigureId) => {
    const meta = GEOMETRY_FIGURES.find((f) => f.id === id);
    setGeoId(id);
    if (meta) {
      setDimA(meta.defaultDimA);
      setDimB(meta.defaultDimB);
      setDimC(meta.defaultDimC);
    }
  };

  // Render active scene onto canvas
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== CANVAS_W * dpr || canvas.height !== CANVAS_H * dpr) {
      canvas.width = CANVAS_W * dpr;
      canvas.height = CANVAS_H * dpr;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.scale(dpr, dpr);

    if (mode === '2d') {
      draw2DGraph(ctx, CANVAS_W, CANVAS_H, graph2D);
    } else if (mode === '3d') {
      draw3DSpaceGraph(ctx, CANVAS_W, CANVAS_H, graph3D);
    } else {
      drawGeometryFigure(ctx, CANVAS_W, CANVAS_H, {
        figureId: geoId,
        dimA,
        dimB,
        dimC,
        showLabels: geoShowLabels,
        showMarks: geoShowMarks,
        showFormula: geoShowFormula,
        accentColor: geoAccent,
      });
    }
    ctx.restore();
  }, [
    dimA,
    dimB,
    dimC,
    geoAccent,
    geoId,
    geoShowFormula,
    geoShowLabels,
    geoShowMarks,
    graph2D,
    graph3D,
    mode,
  ]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(renderCanvas);
    return () => window.cancelAnimationFrame(raf);
  }, [renderCanvas]);

  // Pointer drag interactions (Pan 2D / Orbit 3D)
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (mode === 'geometry') return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { active: true, lastX: e.clientX, lastY: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;

    if (mode === '2d') {
      setGraph2D((prev) => ({
        ...prev,
        centerX: prev.centerX - dx / prev.scale,
        centerY: prev.centerY + dy / prev.scale,
      }));
    } else if (mode === '3d') {
      setGraph3D((prev) => ({
        ...prev,
        yaw: prev.yaw + dx * 0.012,
        pitch: Math.max(-1.35, Math.min(1.35, prev.pitch + dy * 0.01)),
      }));
    }
  };

  const handlePointerUp = () => {
    dragRef.current.active = false;
  };

  const handleCanvasWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (mode === 'geometry') return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.9;
    if (mode === '2d') {
      setGraph2D((prev) => ({
        ...prev,
        scale: Math.max(14, Math.min(180, prev.scale * factor)),
      }));
    } else if (mode === '3d') {
      setGraph3D((prev) => ({
        ...prev,
        zoom: Math.max(18, Math.min(110, prev.zoom * factor)),
      }));
    }
  };

  const exportCrispPng = (): string => {
    // Export at clean 720x480 standard size so PNG stays lightweight (~25-55 KB) for localStorage & Cloud sync
    const offscreen = document.createElement('canvas');
    offscreen.width = CANVAS_W;
    offscreen.height = CANVAS_H;
    const ctx = offscreen.getContext('2d');
    if (ctx) {
      if (mode === '2d') {
        draw2DGraph(ctx, CANVAS_W, CANVAS_H, graph2D);
      } else if (mode === '3d') {
        draw3DSpaceGraph(ctx, CANVAS_W, CANVAS_H, graph3D);
      } else {
        drawGeometryFigure(ctx, CANVAS_W, CANVAS_H, {
          figureId: geoId,
          dimA,
          dimB,
          dimC,
          showLabels: geoShowLabels,
          showMarks: geoShowMarks,
          showFormula: geoShowFormula,
          accentColor: geoAccent,
        });
      }
      return offscreen.toDataURL('image/png');
    }
    return canvasRef.current?.toDataURL('image/png') || '';
  };

  const handleDownloadPng = () => {
    const dataUrl = exportCrispPng();
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `pickerwel_${mode}_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleInsert = () => {
    const dataUrl = exportCrispPng();
    if (!dataUrl) return;
    onInsertImage(dataUrl);
    onClose();
  };

  // Helpers for 2D item updates
  const update2DItem = (id: string, patch: Partial<Plot2DItem>) => {
    setGraph2D((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? ({ ...it, ...patch } as Plot2DItem) : it)),
    }));
  };

  const add2DItem = (kind: Plot2DItem['kind']) => {
    const color = PLOT_COLORS[graph2D.items.length % PLOT_COLORS.length];
    let item: Plot2DItem;
    switch (kind) {
      case 'function':
        item = { id: uid('f'), kind: 'function', expr: '2*x - 1', color, visible: true };
        break;
      case 'circle':
        item = { id: uid('c'), kind: 'circle', h: 0, k: 0, r: 2.5, color, visible: true };
        break;
      case 'ellipse':
        item = { id: uid('e'), kind: 'ellipse', h: 0, k: 0, a: 4, b: 2, color, visible: true };
        break;
      case 'hyperbola':
        item = {
          id: uid('h'),
          kind: 'hyperbola',
          h: 0,
          k: 0,
          a: 2,
          b: 1.5,
          showAsymptotes: true,
          color,
          visible: true,
        };
        break;
      case 'point':
        item = { id: uid('p'), kind: 'point', x: 2, y: 3, name: 'M', color, visible: true };
        break;
      case 'vector':
        item = { id: uid('v'), kind: 'vector', x0: 0, y0: 0, dx: 3, dy: 2, name: 'u', color, visible: true };
        break;
    }
    setGraph2D((prev) => ({ ...prev, items: [...prev.items, item] }));
  };

  // Helpers for 3D item updates
  const update3DItem = (id: string, patch: Partial<Plot3DItem>) => {
    setGraph3D((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? ({ ...it, ...patch } as Plot3DItem) : it)),
    }));
  };

  const add3DItem = (kind: Plot3DItem['kind']) => {
    const color = PLOT_COLORS[graph3D.items.length % PLOT_COLORS.length];
    let item: Plot3DItem;
    switch (kind) {
      case 'surface':
        item = { id: uid('sf'), kind: 'surface', expr: '0.2*(x^2 + y^2)', range: 4, color, visible: true };
        break;
      case 'plane':
        item = { id: uid('pl'), kind: 'plane', a: 1, b: 1, c: 1, d: -2, showNormal: true, color, visible: true };
        break;
      case 'line3d':
        item = { id: uid('ln'), kind: 'line3d', x0: 0, y0: 0, z0: 0, a: 1, b: 2, c: 1, name: 'd', color, visible: true };
        break;
      case 'sphere':
        item = { id: uid('sp'), kind: 'sphere', cx: 0, cy: 0, cz: 0, r: 2.5, color, visible: true };
        break;
      case 'vector3d':
        item = { id: uid('v3'), kind: 'vector3d', x0: 0, y0: 0, z0: 0, dx: 2, dy: 3, dz: 2, name: 'u', color, visible: true };
        break;
      case 'point3d':
        item = { id: uid('pt'), kind: 'point3d', x: 2, y: 2, z: 3, name: 'A', showProjection: true, color, visible: true };
        break;
    }
    setGraph3D((prev) => ({ ...prev, items: [...prev.items, item] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[94vh] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Bar */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-9 h-9 rounded-xl text-white flex items-center justify-center shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              <Compass className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {km
                  ? 'សង់ក្រាបក្នុងប្លង់ (2D) · ក្នុងលំហរ (3D) & រូបធរណីមាត្រ'
                  : '2D Plane Graph · 3D Space Graph & Geometry Figures'}
              </h3>
              {targetLabel && (
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {km ? `ភ្ជាប់រូបទៅក្នុង៖ ${targetLabel}` : `Attach diagram to: ${targetLabel}`}
                </p>
              )}
            </div>
          </div>

          {/* Segmented Mode Switcher */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(
              [
                {
                  id: '2d' as const,
                  icon: TrendingUp,
                  labelKm: 'ក្រាបក្នុងប្លង់ 2D',
                  labelEn: '2D Plane',
                },
                {
                  id: '3d' as const,
                  icon: Box,
                  labelKm: 'ក្រាបក្នុងលំហរ 3D',
                  labelEn: '3D Space',
                },
                {
                  id: 'geometry' as const,
                  icon: Shapes,
                  labelKm: 'រូបធរណីមាត្រ',
                  labelEn: 'Geometry',
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMode(tab.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                  style={active ? { backgroundColor: accentColor } : undefined}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{km ? tab.labelKm : tab.labelEn}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Zone Sandbox Body */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT ZONE: Interactive High-DPI Stage (60%) */}
          <div className="lg:w-[58%] xl:w-[60%] bg-slate-50 dark:bg-slate-950/60 p-4 flex flex-col items-center justify-center gap-3 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-800 shrink-0 lg:shrink">
            <div className="w-full max-w-[720px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white overflow-hidden shadow-xs">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleCanvasWheel}
                className={`w-full aspect-[3/2] block touch-none ${
                  mode === 'geometry' ? 'cursor-default' : 'cursor-grab active:cursor-grabbing'
                }`}
              />
            </div>

            {/* Stage Controls Strip */}
            <div className="w-full max-w-[720px] flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-1.5">
                {mode !== 'geometry' && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        mode === '2d'
                          ? setGraph2D((p) => ({ ...p, scale: Math.min(180, p.scale * 1.2) }))
                          : setGraph3D((p) => ({ ...p, zoom: Math.min(110, p.zoom * 1.15) }))
                      }
                      title={km ? 'ពង្រីក' : 'Zoom in'}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mode === '2d'
                          ? setGraph2D((p) => ({ ...p, scale: Math.max(14, p.scale / 1.2) }))
                          : setGraph3D((p) => ({ ...p, zoom: Math.max(18, p.zoom / 1.15) }))
                      }
                      title={km ? 'បង្រួម' : 'Zoom out'}
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 text-xs font-medium cursor-pointer"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        mode === '2d'
                          ? setGraph2D((p) => ({ ...p, centerX: 0, centerY: 0, scale: 44 }))
                          : setGraph3D((p) => ({ ...p, yaw: 0.68, pitch: 0.42, zoom: 42 }))
                      }
                      className="min-h-[34px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>{km ? 'កំណត់ដើម' : 'Reset View'}</span>
                    </button>
                  </>
                )}

                {mode === '2d' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGraph2D((p) => ({ ...p, showGrid: !p.showGrid }))}
                      className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        graph2D.showGrid
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>{km ? 'ក្រឡាចត្រង្គ' : 'Grid'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraph2D((p) => ({ ...p, showLegend: !p.showLegend }))}
                      className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        graph2D.showLegend
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{km ? 'ស្លាកសមីការ' : 'Legend'}</span>
                    </button>
                  </>
                )}

                {mode === '3d' && (
                  <>
                    <button
                      type="button"
                      onClick={() => setGraph3D((p) => ({ ...p, showGrid: !p.showGrid }))}
                      className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        graph3D.showGrid
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Grid className="w-3.5 h-3.5" />
                      <span>{km ? 'ប្លង់ Oxy' : 'Oxy Grid'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraph3D((p) => ({ ...p, showLabels: !p.showLabels }))}
                      className={`min-h-[34px] px-2.5 rounded-lg border text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                        graph3D.showLabels
                          ? 'border-indigo-300 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      <Tag className="w-3.5 h-3.5" />
                      <span>{km ? 'ស្លាកសមីការ' : 'Labels'}</span>
                    </button>
                  </>
                )}
              </div>

              {mode !== 'geometry' && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                  <Move className="w-3 h-3" />
                  <span>
                    {mode === '2d'
                      ? km
                        ? 'អូសដើម្បីរំកិល · រមូរដើម្បីពង្រីក'
                        : 'Drag to pan · Scroll to zoom'
                      : km
                        ? 'អូសលើរូបដើម្បីបង្វិល 3D 360°'
                        : 'Drag canvas to orbit 3D 360°'}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* RIGHT ZONE: Control & Preset Deck (40%) */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 bg-white dark:bg-slate-900">
            {/* ==================== TAB 1: 2D PLANE GRAPH ==================== */}
            {mode === '2d' && (
              <>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km ? 'គំរូក្រាបពេញនិយម (ចុចជ្រើសភ្លាម)' : 'Quick 2D Graph Presets'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS_2D.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setGraph2D((prev) => ({
                            ...prev,
                            centerX: 0,
                            centerY: 0,
                            scale: preset.scale ?? 44,
                            items: preset.items(),
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        {km ? preset.nameKm : preset.nameEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add 2D Object Toolbar */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km ? 'បន្ថែមធាតុលើប្លង់ Oxy' : 'Add Object to 2D Plane'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { kind: 'function', labelKm: 'អនុគមន៍ y=f(x)', labelEn: 'y = f(x)' },
                        { kind: 'circle', labelKm: 'រង្វង់', labelEn: 'Circle' },
                        { kind: 'ellipse', labelKm: 'អេលីប', labelEn: 'Ellipse' },
                        { kind: 'hyperbola', labelKm: 'អ៊ីពែបូល', labelEn: 'Hyperbola' },
                        { kind: 'point', labelKm: 'ចំណុច', labelEn: 'Point' },
                        { kind: 'vector', labelKm: 'វ៉ិចទ័រ', labelEn: 'Vector' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.kind}
                        type="button"
                        onClick={() => add2DItem(btn.kind)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{km ? btn.labelKm : btn.labelEn}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active 2D Objects List */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km
                      ? `សមីការ និងធាតុកំពុងសង់ (${graph2D.items.length})`
                      : `Plotted Items (${graph2D.items.length})`}
                  </h4>

                  {graph2D.items.map((item) => {
                    const fnValid =
                      item.kind !== 'function' || compileMathExpression(item.expr).ok;
                    return (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={item.color}
                              onChange={(e) => update2DItem(item.id, { color: e.target.value })}
                              aria-label="Color"
                              className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                            />
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {item.kind === 'function'
                                ? 'y = f(x)'
                                : item.kind === 'circle'
                                  ? km
                                    ? 'រង្វង់ (x-h)²+(y-k)²=r²'
                                    : 'Circle'
                                  : item.kind === 'ellipse'
                                    ? km
                                      ? 'អេលីប (h,k,a,b)'
                                      : 'Ellipse'
                                    : item.kind === 'hyperbola'
                                      ? km
                                        ? 'អ៊ីពែបូល (h,k,a,b)'
                                        : 'Hyperbola'
                                      : item.kind === 'point'
                                        ? km
                                          ? 'ចំណុច (x, y)'
                                          : 'Point'
                                        : km
                                          ? 'វ៉ិចទ័រ 2D'
                                          : '2D Vector'}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => update2DItem(item.id, { visible: !item.visible })}
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                            >
                              {item.visible ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setGraph2D((p) => ({
                                  ...p,
                                  items: p.items.filter((x) => x.id !== item.id),
                                }))
                              }
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {item.kind === 'function' && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-500">y =</span>
                              <input
                                type="text"
                                value={item.expr}
                                onChange={(e) =>
                                  update2DItem(item.id, { expr: e.target.value, label: undefined })
                                }
                                placeholder="x^2 - 2*x - 3, sin(x), ln(x)..."
                                className={`flex-1 h-8 px-2.5 rounded-lg border bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white focus:outline-none ${
                                  fnValid
                                    ? 'border-slate-200 dark:border-slate-700 focus:border-indigo-500'
                                    : 'border-rose-400 focus:border-rose-500'
                                }`}
                              />
                            </div>
                            {!fnValid && (
                              <p className="text-[11px] text-rose-600">
                                {km
                                  ? 'ទម្រង់សមីការមិនត្រឹមត្រូវ (ឧ. x^2 - 1, sin(x), (2x+1)/(x-1))'
                                  : 'Invalid syntax (e.g. x^2 - 1, sin(x), (2x+1)/(x-1))'}
                              </p>
                            )}
                          </div>
                        )}

                        {item.kind === 'circle' && (
                          <div className="grid grid-cols-3 gap-2">
                            {(
                              [
                                ['h', item.h],
                                ['k', item.k],
                                ['r', item.r],
                              ] as const
                            ).map(([field, val]) => (
                              <label key={field} className="flex items-center gap-1 text-xs">
                                <span className="font-mono font-bold text-slate-500">{field}=</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={val}
                                  onChange={(e) =>
                                    update2DItem(item.id, {
                                      [field]: Number(e.target.value) || 0,
                                    } as Partial<Plot2DItem>)
                                  }
                                  className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                                />
                              </label>
                            ))}
                          </div>
                        )}

                        {(item.kind === 'ellipse' || item.kind === 'hyperbola') && (
                          <div className="grid grid-cols-4 gap-1.5">
                            {(
                              [
                                ['h', item.h],
                                ['k', item.k],
                                ['a', item.a],
                                ['b', item.b],
                              ] as const
                            ).map(([field, val]) => (
                              <label key={field} className="flex items-center gap-1 text-xs">
                                <span className="font-mono font-bold text-slate-500">{field}=</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={val}
                                  onChange={(e) =>
                                    update2DItem(item.id, {
                                      [field]: Number(e.target.value) || 0,
                                    } as Partial<Plot2DItem>)
                                  }
                                  className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                                />
                              </label>
                            ))}
                          </div>
                        )}

                        {item.kind === 'point' && (
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center gap-1 text-xs">
                              <span className="text-slate-500">{km ? 'ឈ្មោះ' : 'Name'}</span>
                              <input
                                type="text"
                                maxLength={4}
                                value={item.name}
                                onChange={(e) => update2DItem(item.id, { name: e.target.value })}
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <span className="font-mono font-bold text-slate-500">x=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={item.x}
                                onChange={(e) =>
                                  update2DItem(item.id, { x: Number(e.target.value) || 0 })
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <span className="font-mono font-bold text-slate-500">y=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={item.y}
                                onChange={(e) =>
                                  update2DItem(item.id, { y: Number(e.target.value) || 0 })
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                          </div>
                        )}

                        {item.kind === 'vector' && (
                          <div className="grid grid-cols-3 gap-2">
                            <label className="flex items-center gap-1 text-xs">
                              <span className="text-slate-500">{km ? 'ឈ្មោះ' : 'Name'}</span>
                              <input
                                type="text"
                                maxLength={6}
                                value={item.name}
                                onChange={(e) => update2DItem(item.id, { name: e.target.value })}
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <span className="font-mono font-bold text-slate-500">dx=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={item.dx}
                                onChange={(e) =>
                                  update2DItem(item.id, { dx: Number(e.target.value) || 0 })
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                            <label className="flex items-center gap-1 text-xs">
                              <span className="font-mono font-bold text-slate-500">dy=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={item.dy}
                                onChange={(e) =>
                                  update2DItem(item.id, { dy: Number(e.target.value) || 0 })
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* ==================== TAB 2: 3D SPACE GRAPH (Oxyz) ==================== */}
            {mode === '3d' && (
              <>
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km ? 'គំរូក្រាបក្នុងលំហរ Oxyz' : 'Quick 3D Space Presets'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESETS_3D.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() =>
                          setGraph3D((prev) => ({
                            ...prev,
                            items: preset.items(),
                          }))
                        }
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap"
                      >
                        {km ? preset.nameKm : preset.nameEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Camera Angle Sliders */}
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 grid grid-cols-2 gap-3">
                  <label className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <span>{km ? 'មុំបង្វិលផ្ដេក (Yaw)' : 'Horizontal Angle'}</span>
                      <span className="font-mono tabular-nums">
                        {Math.round((graph3D.yaw * 180) / Math.PI)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-3.14}
                      max={3.14}
                      step={0.05}
                      value={graph3D.yaw}
                      onChange={(e) =>
                        setGraph3D((p) => ({ ...p, yaw: Number(e.target.value) }))
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium text-slate-600 dark:text-slate-300">
                      <span>{km ? 'មុំផ្អៀងបញ្ឈរ (Pitch)' : 'Vertical Tilt'}</span>
                      <span className="font-mono tabular-nums">
                        {Math.round((graph3D.pitch * 180) / Math.PI)}°
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-1.2}
                      max={1.2}
                      step={0.04}
                      value={graph3D.pitch}
                      onChange={(e) =>
                        setGraph3D((p) => ({ ...p, pitch: Number(e.target.value) }))
                      }
                      className="w-full accent-indigo-600 cursor-pointer"
                    />
                  </label>
                </div>

                {/* Add 3D Object Toolbar */}
                <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km ? 'បន្ថែមធាតុក្នុងលំហរ Oxyz' : 'Add Object to 3D Space'}
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {(
                      [
                        { kind: 'plane', labelKm: 'ប្លង់ ax+by+cz+d=0', labelEn: 'Plane' },
                        { kind: 'line3d', labelKm: 'បន្ទាត់ 3D', labelEn: '3D Line' },
                        { kind: 'sphere', labelKm: 'ស្វ៊ែរ', labelEn: 'Sphere' },
                        { kind: 'surface', labelKm: 'ផ្ទៃ z=f(x,y)', labelEn: 'Surface' },
                        { kind: 'vector3d', labelKm: 'វ៉ិចទ័រ 3D', labelEn: '3D Vector' },
                        { kind: 'point3d', labelKm: 'ចំណុច 3D', labelEn: '3D Point' },
                      ] as const
                    ).map((btn) => (
                      <button
                        key={btn.kind}
                        type="button"
                        onClick={() => add3DItem(btn.kind)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-400 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>{km ? btn.labelKm : btn.labelEn}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active 3D Items List */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {graph3D.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="color"
                            value={item.color}
                            onChange={(e) => update3DItem(item.id, { color: e.target.value })}
                            aria-label="Color"
                            className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer shrink-0"
                          />
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                            {item.kind === 'surface'
                              ? 'z = f(x, y)'
                              : item.kind === 'plane'
                                ? km
                                  ? 'ប្លង់ ax + by + cz + d = 0'
                                  : '3D Plane'
                                : item.kind === 'line3d'
                                  ? km
                                    ? 'បន្ទាត់ 3D (M₀, →u)'
                                    : '3D Line'
                                  : item.kind === 'sphere'
                                    ? km
                                      ? 'ស្វ៊ែរ (I, R)'
                                      : 'Sphere'
                                    : item.kind === 'vector3d'
                                      ? km
                                        ? 'វ៉ិចទ័រ 3D'
                                        : '3D Vector'
                                      : km
                                        ? 'ចំណុច 3D'
                                        : '3D Point'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => update3DItem(item.id, { visible: !item.visible })}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                          >
                            {item.visible ? (
                              <Eye className="w-3.5 h-3.5" />
                            ) : (
                              <EyeOff className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setGraph3D((p) => ({
                                ...p,
                                items: p.items.filter((x) => x.id !== item.id),
                              }))
                            }
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {item.kind === 'surface' && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-slate-500">z =</span>
                          <input
                            type="text"
                            value={item.expr}
                            onChange={(e) => update3DItem(item.id, { expr: e.target.value })}
                            placeholder="0.25*(x^2 + y^2), sin(x)*cos(y)..."
                            className="flex-1 h-8 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      )}

                      {item.kind === 'plane' && (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-4 gap-1.5">
                            {(
                              [
                                ['a', item.a],
                                ['b', item.b],
                                ['c', item.c],
                                ['d', item.d],
                              ] as const
                            ).map(([field, val]) => (
                              <label key={field} className="flex items-center gap-1 text-xs">
                                <span className="font-mono font-bold text-slate-500">{field}=</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={val}
                                  onChange={(e) =>
                                    update3DItem(item.id, {
                                      [field]: Number(e.target.value) || 0,
                                    } as Partial<Plot3DItem>)
                                  }
                                  className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                                />
                              </label>
                            ))}
                          </div>
                          <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.showNormal}
                              onChange={(e) =>
                                update3DItem(item.id, { showNormal: e.target.checked })
                              }
                              className="rounded accent-indigo-600"
                            />
                            <span>{km ? 'បង្ហាញវ៉ិចទ័រណរម៉ាល់ →n' : 'Show normal vector →n'}</span>
                          </label>
                        </div>
                      )}

                      {item.kind === 'line3d' && (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                ['x0', item.x0],
                                ['y0', item.y0],
                                ['z0', item.z0],
                              ] as const
                            ).map(([field, val]) => (
                              <label key={field} className="flex items-center gap-1 text-xs">
                                <span className="font-mono text-slate-500">{field}=</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={val}
                                  onChange={(e) =>
                                    update3DItem(item.id, {
                                      [field]: Number(e.target.value) || 0,
                                    } as Partial<Plot3DItem>)
                                  }
                                  className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                                />
                              </label>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(
                              [
                                ['a', item.a],
                                ['b', item.b],
                                ['c', item.c],
                              ] as const
                            ).map(([field, val]) => (
                              <label key={field} className="flex items-center gap-1 text-xs">
                                <span className="font-mono text-slate-500">{field}=</span>
                                <input
                                  type="number"
                                  step={0.5}
                                  value={val}
                                  onChange={(e) =>
                                    update3DItem(item.id, {
                                      [field]: Number(e.target.value) || 0,
                                    } as Partial<Plot3DItem>)
                                  }
                                  className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.kind === 'sphere' && (
                        <div className="grid grid-cols-4 gap-1.5">
                          {(
                            [
                              ['cx', 'a', item.cx],
                              ['cy', 'b', item.cy],
                              ['cz', 'c', item.cz],
                              ['r', 'R', item.r],
                            ] as const
                          ).map(([field, lbl, val]) => (
                            <label key={field} className="flex items-center gap-1 text-xs">
                              <span className="font-mono font-bold text-slate-500">{lbl}=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={val}
                                onChange={(e) =>
                                  update3DItem(item.id, {
                                    [field]: Number(e.target.value) || 0,
                                  } as Partial<Plot3DItem>)
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                          ))}
                        </div>
                      )}

                      {item.kind === 'vector3d' && (
                        <div className="grid grid-cols-4 gap-1.5">
                          <input
                            type="text"
                            maxLength={4}
                            value={item.name}
                            onChange={(e) => update3DItem(item.id, { name: e.target.value })}
                            placeholder="u"
                            className="h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                          />
                          {(
                            [
                              ['dx', 'x', item.dx],
                              ['dy', 'y', item.dy],
                              ['dz', 'z', item.dz],
                            ] as const
                          ).map(([field, lbl, val]) => (
                            <label key={field} className="flex items-center gap-1 text-xs">
                              <span className="font-mono text-slate-500">{lbl}=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={val}
                                onChange={(e) =>
                                  update3DItem(item.id, {
                                    [field]: Number(e.target.value) || 0,
                                  } as Partial<Plot3DItem>)
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                          ))}
                        </div>
                      )}

                      {item.kind === 'point3d' && (
                        <div className="grid grid-cols-4 gap-1.5">
                          <input
                            type="text"
                            maxLength={4}
                            value={item.name}
                            onChange={(e) => update3DItem(item.id, { name: e.target.value })}
                            placeholder="A"
                            className="h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs"
                          />
                          {(
                            [
                              ['x', item.x],
                              ['y', item.y],
                              ['z', item.z],
                            ] as const
                          ).map(([field, val]) => (
                            <label key={field} className="flex items-center gap-1 text-xs">
                              <span className="font-mono text-slate-500">{field}=</span>
                              <input
                                type="number"
                                step={0.5}
                                value={val}
                                onChange={(e) =>
                                  update3DItem(item.id, {
                                    [field]: Number(e.target.value) || 0,
                                  } as Partial<Plot3DItem>)
                                }
                                className="w-full h-7 px-1.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-mono text-xs tabular-nums"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* ==================== TAB 3: COMMON GEOMETRY FIGURES ==================== */}
            {mode === 'geometry' && (
              <>
                {/* 2D vs 3D Figure Filter */}
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km ? 'ជ្រើសរូបធរណីមាត្រពេញនិយម (១៨ រូប)' : 'Common Geometry Figures (18)'}
                  </h4>
                  <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                    {(
                      [
                        { id: 'all', labelKm: 'ទាំងអស់', labelEn: 'All' },
                        { id: '2d', labelKm: 'ប្លង់ 2D', labelEn: '2D' },
                        { id: '3d', labelKm: 'លំហរ 3D', labelEn: '3D' },
                      ] as const
                    ).map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setGeoGroupFilter(f.id)}
                        className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                          geoGroupFilter === f.id
                            ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {km ? f.labelKm : f.labelEn}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Geometry Figure Grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {filteredGeoFigures.map((fig) => {
                    const selected = fig.id === geoId;
                    return (
                      <button
                        key={fig.id}
                        type="button"
                        onClick={() => handleSelectGeoFigure(fig.id)}
                        className={`px-2.5 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-100'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold truncate">
                          {km ? fig.nameKm : fig.nameEn}
                        </div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono truncate mt-0.5">
                          {fig.group.toUpperCase()} · {fig.formula.split('|')[0].trim()}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Dimension & Label Customizer */}
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {km
                      ? 'កែប្រែស្លាករង្វាស់លើរូប (ឧ. 6 cm, 8 cm, R = 5)'
                      : 'Customize Figure Labels (e.g. 6 cm, 8 cm, R = 5)'}
                  </h4>

                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {km ? activeGeoMeta.dimLabelsKm[0] : activeGeoMeta.dimLabelsEn[0]}
                      </span>
                      <input
                        type="text"
                        maxLength={14}
                        value={dimA}
                        onChange={(e) => setDimA(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {km ? activeGeoMeta.dimLabelsKm[1] : activeGeoMeta.dimLabelsEn[1]}
                      </span>
                      <input
                        type="text"
                        maxLength={14}
                        value={dimB}
                        onChange={(e) => setDimB(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {km ? activeGeoMeta.dimLabelsKm[2] : activeGeoMeta.dimLabelsEn[2]}
                      </span>
                      <input
                        type="text"
                        maxLength={14}
                        value={dimC}
                        onChange={(e) => setDimC(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-slate-900 dark:text-white"
                      />
                    </label>
                  </div>

                  {/* Display Toggles */}
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={geoShowLabels}
                        onChange={(e) => setGeoShowLabels(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>{km ? 'បង្ហាញអក្សរ/រង្វាស់' : 'Labels'}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={geoShowMarks}
                        onChange={(e) => setGeoShowMarks(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>{km ? 'សញ្ញាកែង/ស្មើជ្រុង' : 'Marks'}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={geoShowFormula}
                        onChange={(e) => setGeoShowFormula(e.target.checked)}
                        className="rounded accent-indigo-600"
                      />
                      <span>{km ? 'បង្ហាញរូបមន្តលើរូប' : 'Show Formula'}</span>
                    </label>
                  </div>

                  {/* Ink Color Picker */}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {km ? 'ពណ៌បន្ទាត់៖' : 'Line Color:'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {PLOT_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setGeoAccent(c)}
                          aria-label={`Select color ${c}`}
                          className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                            geoAccent === c
                              ? 'scale-110 ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900'
                              : 'hover:scale-105'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Bottom Footer Action Bar */}
        <div className="px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleDownloadPng}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            <span>{km ? 'ទាញយករូប (.png)' : 'Download PNG'}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
            >
              {km ? 'បោះបង់' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={handleInsert}
              className="min-h-[40px] px-5 rounded-xl text-white text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 shadow-sm hover:opacity-95 cursor-pointer whitespace-nowrap"
              style={{ backgroundColor: accentColor }}
            >
              <Check className="w-4 h-4" />
              <span>{km ? 'បញ្ចូលរូបទៅក្នុងសំណួរ' : 'Insert into Question'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
