import { compileMathExpression } from './math-expression';

// ============================================================================
// 1. 2D PLANE GRAPH TYPES & RENDERER
// ============================================================================

export type Plot2DItem =
  | {
      id: string;
      kind: 'function';
      expr: string;
      color: string;
      visible: boolean;
      label?: string;
    }
  | {
      id: string;
      kind: 'circle';
      h: number;
      k: number;
      r: number;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'ellipse';
      h: number;
      k: number;
      a: number;
      b: number;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'hyperbola';
      h: number;
      k: number;
      a: number;
      b: number;
      showAsymptotes: boolean;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'point';
      x: number;
      y: number;
      name: string;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'vector';
      x0: number;
      y0: number;
      dx: number;
      dy: number;
      name: string;
      color: string;
      visible: boolean;
    };

export interface Graph2DConfig {
  centerX: number;
  centerY: number;
  scale: number; // pixels per math unit
  showGrid: boolean;
  showNumbers: boolean;
  showLegend: boolean;
  items: Plot2DItem[];
}

function niceStep(rawStep: number): number {
  const pow = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const frac = rawStep / pow;
  if (frac <= 1.2) return pow;
  if (frac <= 2.5) return 2 * pow;
  if (frac <= 6) return 5 * pow;
  return 10 * pow;
}

function fmtNum(n: number): string {
  if (Math.abs(n) < 1e-9) return '0';
  if (Number.isInteger(n)) return String(n);
  return Number(n.toFixed(2)).toString();
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 9
) {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - size * Math.cos(angle - Math.PI / 6), y2 - size * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - size * Math.cos(angle + Math.PI / 6), y2 - size * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}

export function describePlot2DItem(item: Plot2DItem): string {
  switch (item.kind) {
    case 'function':
      return item.label || `y = ${item.expr}`;
    case 'circle': {
      const hx = item.h === 0 ? 'x²' : `(x ${item.h > 0 ? '-' : '+'} ${Math.abs(item.h)})²`;
      const ky = item.k === 0 ? 'y²' : `(y ${item.k > 0 ? '-' : '+'} ${Math.abs(item.k)})²`;
      return `${hx} + ${ky} = ${fmtNum(item.r * item.r)}`;
    }
    case 'ellipse': {
      const hx = item.h === 0 ? 'x²' : `(x ${item.h > 0 ? '-' : '+'} ${Math.abs(item.h)})²`;
      const ky = item.k === 0 ? 'y²' : `(y ${item.k > 0 ? '-' : '+'} ${Math.abs(item.k)})²`;
      return `${hx}/${fmtNum(item.a * item.a)} + ${ky}/${fmtNum(item.b * item.b)} = 1`;
    }
    case 'hyperbola': {
      const hx = item.h === 0 ? 'x²' : `(x ${item.h > 0 ? '-' : '+'} ${Math.abs(item.h)})²`;
      const ky = item.k === 0 ? 'y²' : `(y ${item.k > 0 ? '-' : '+'} ${Math.abs(item.k)})²`;
      return `${hx}/${fmtNum(item.a * item.a)} - ${ky}/${fmtNum(item.b * item.b)} = 1`;
    }
    case 'point':
      return `${item.name || 'P'}(${fmtNum(item.x)}, ${fmtNum(item.y)})`;
    case 'vector':
      return `→${item.name || 'u'} = (${fmtNum(item.dx)}, ${fmtNum(item.dy)})`;
  }
}

export function draw2DGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: Graph2DConfig
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const toPxX = (x: number) => width / 2 + (x - config.centerX) * config.scale;
  const toPxY = (y: number) => height / 2 - (y - config.centerY) * config.scale;
  const toMathX = (px: number) => (px - width / 2) / config.scale + config.centerX;
  const toMathY = (py: number) => (height / 2 - py) / config.scale + config.centerY;

  const xMin = toMathX(0);
  const xMax = toMathX(width);
  const yMin = toMathY(height);
  const yMax = toMathY(0);

  const step = niceStep(60 / config.scale);

  // Subtle grid
  if (config.showGrid) {
    // Minor grid
    const minorStep = step / 2;
    ctx.strokeStyle = '#F1F5F9';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startXm = Math.floor(xMin / minorStep) * minorStep;
    for (let x = startXm; x <= xMax; x += minorStep) {
      const px = Math.round(toPxX(x)) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    const startYm = Math.floor(yMin / minorStep) * minorStep;
    for (let y = startYm; y <= yMax; y += minorStep) {
      const py = Math.round(toPxY(y)) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();

    // Major grid
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const startX = Math.floor(xMin / step) * step;
    for (let x = startX; x <= xMax; x += step) {
      const px = Math.round(toPxX(x)) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    const startY = Math.floor(yMin / step) * step;
    for (let y = startY; y <= yMax; y += step) {
      const py = Math.round(toPxY(y)) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();
  }

  // Coordinate Axes
  const originX = toPxX(0);
  const originY = toPxY(0);
  ctx.strokeStyle = '#334155';
  ctx.fillStyle = '#334155';
  ctx.lineWidth = 1.8;

  if (originY >= 0 && originY <= height) {
    ctx.beginPath();
    ctx.moveTo(10, originY);
    ctx.lineTo(width - 10, originY);
    ctx.stroke();
    drawArrowhead(ctx, width - 24, originY, width - 8, originY, 8);
    ctx.font = 'italic 700 15px Georgia, serif';
    ctx.fillText('x', width - 20, originY - 10);
  }
  if (originX >= 0 && originX <= width) {
    ctx.beginPath();
    ctx.moveTo(originX, height - 10);
    ctx.lineTo(originX, 10);
    ctx.stroke();
    drawArrowhead(ctx, originX, 24, originX, 8, 8);
    ctx.font = 'italic 700 15px Georgia, serif';
    ctx.fillText('y', originX + 10, 22);
  }

  // Axis numbers & tick marks
  if (config.showNumbers) {
    ctx.font = '500 11px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillStyle = '#64748B';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.2;

    const clampedY = Math.min(Math.max(originY, 14), height - 22);
    const clampedX = Math.min(Math.max(originX, 24), width - 14);

    const startX = Math.floor(xMin / step) * step;
    for (let x = startX; x <= xMax; x += step) {
      if (Math.abs(x) < step * 0.05) continue;
      const px = toPxX(x);
      if (px < 18 || px > width - 24) continue;
      ctx.beginPath();
      ctx.moveTo(px, clampedY - 3.5);
      ctx.lineTo(px, clampedY + 3.5);
      ctx.stroke();
      ctx.textAlign = 'center';
      ctx.fillText(fmtNum(x), px, clampedY + 15);
    }

    const startY = Math.floor(yMin / step) * step;
    for (let y = startY; y <= yMax; y += step) {
      if (Math.abs(y) < step * 0.05) continue;
      const py = toPxY(y);
      if (py < 22 || py > height - 14) continue;
      ctx.beginPath();
      ctx.moveTo(clampedX - 3.5, py);
      ctx.lineTo(clampedX + 3.5, py);
      ctx.stroke();
      ctx.textAlign = 'right';
      ctx.fillText(fmtNum(y), clampedX - 7, py + 4);
    }

    if (originX > 16 && originX < width - 16 && originY > 16 && originY < height - 16) {
      ctx.textAlign = 'right';
      ctx.font = 'italic 600 13px Georgia, serif';
      ctx.fillStyle = '#334155';
      ctx.fillText('O', originX - 7, originY + 15);
    }
    ctx.textAlign = 'left';
  }

  // Plot all visible items
  for (const item of config.items) {
    if (!item.visible) continue;
    ctx.save();
    ctx.strokeStyle = item.color;
    ctx.fillStyle = item.color;

    if (item.kind === 'function') {
      const compiled = compileMathExpression(item.expr);
      if (compiled.ok) {
        ctx.lineWidth = 2.6;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        const samples = Math.max(480, Math.round(width * 1.5));
        let drawing = false;
        let prevPy = 0;

        ctx.beginPath();
        for (let i = 0; i <= samples; i++) {
          const px = (i / samples) * width;
          const mx = toMathX(px);
          const my = compiled.evaluate({ x: mx });
          if (!Number.isFinite(my) || Math.abs(my) > 1e5) {
            drawing = false;
            continue;
          }
          const py = toPxY(my);
          const jumpTooBig = drawing && Math.abs(py - prevPy) > height * 0.85;
          if (!drawing || jumpTooBig) {
            ctx.moveTo(px, py);
            drawing = true;
          } else {
            ctx.lineTo(px, py);
          }
          prevPy = py;
        }
        ctx.stroke();
      }
    } else if (item.kind === 'circle') {
      if (item.r > 0) {
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.arc(toPxX(item.h), toPxY(item.k), item.r * config.scale, 0, Math.PI * 2);
        ctx.stroke();
        // Center dot
        ctx.beginPath();
        ctx.arc(toPxX(item.h), toPxY(item.k), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.kind === 'ellipse') {
      if (item.a > 0 && item.b > 0) {
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.ellipse(
          toPxX(item.h),
          toPxY(item.k),
          item.a * config.scale,
          item.b * config.scale,
          0,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(toPxX(item.h), toPxY(item.k), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (item.kind === 'hyperbola') {
      if (item.a > 0 && item.b > 0) {
        if (item.showAsymptotes) {
          ctx.save();
          ctx.setLineDash([6, 5]);
          ctx.lineWidth = 1.4;
          ctx.globalAlpha = 0.55;
          const slope = item.b / item.a;
          for (const s of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(toPxX(xMin), toPxY(item.k + s * slope * (xMin - item.h)));
            ctx.lineTo(toPxX(xMax), toPxY(item.k + s * slope * (xMax - item.h)));
            ctx.stroke();
          }
          ctx.restore();
        }
        ctx.lineWidth = 2.6;
        // Right & Left branches via parametric (h ± a*cosh(t), k + b*sinh(t))
        for (const sign of [-1, 1]) {
          ctx.beginPath();
          let started = false;
          for (let t = -3.2; t <= 3.2; t += 0.04) {
            const mx = item.h + sign * item.a * Math.cosh(t);
            const my = item.k + item.b * Math.sinh(t);
            const px = toPxX(mx);
            const py = toPxY(my);
            if (!started) {
              ctx.moveTo(px, py);
              started = true;
            } else {
              ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
        }
      }
    } else if (item.kind === 'point') {
      const px = toPxX(item.x);
      const py = toPxY(item.y);
      // Dashed projections to axes
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, originY);
      ctx.moveTo(px, py);
      ctx.lineTo(originX, py);
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.font = '700 13px system-ui, sans-serif';
      ctx.fillStyle = item.color;
      ctx.fillText(
        `${item.name || 'P'}(${fmtNum(item.x)}, ${fmtNum(item.y)})`,
        px + 8,
        py - 8
      );
    } else if (item.kind === 'vector') {
      const p1x = toPxX(item.x0);
      const p1y = toPxY(item.y0);
      const p2x = toPxX(item.x0 + item.dx);
      const p2y = toPxY(item.y0 + item.dy);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(p1x, p1y);
      ctx.lineTo(p2x, p2y);
      ctx.stroke();
      drawArrowhead(ctx, p1x, p1y, p2x, p2y, 11);
      ctx.font = 'italic 700 14px Georgia, serif';
      ctx.fillText(
        `→${item.name || 'u'}`,
        (p1x + p2x) / 2 + 8,
        (p1y + p2y) / 2 - 8
      );
    }
    ctx.restore();
  }

  // On-canvas Legend
  if (config.showLegend) {
    const visibleItems = config.items.filter((it) => it.visible);
    if (visibleItems.length > 0) {
      const padX = 12;
      const lineH = 20;
      const boxH = visibleItems.length * lineH + 14;
      ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      const maxTextW = Math.max(
        ...visibleItems.map((it) => ctx.measureText(describePlot2DItem(it)).width)
      );
      const boxW = Math.min(width - 24, maxTextW + 42);
      const bx = 12;
      const by = 12;

      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(bx, by, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();

      visibleItems.forEach((it, idx) => {
        const ly = by + 18 + idx * lineH;
        ctx.fillStyle = it.color;
        ctx.fillRect(bx + padX, ly - 6, 12, 3.5);
        ctx.fillStyle = '#0F172A';
        ctx.fillText(describePlot2DItem(it), bx + padX + 18, ly);
      });
    }
  }

  ctx.restore();
}

// ============================================================================
// 2. 3D SPACE GRAPH (Oxyz) TYPES & RENDERER
// ============================================================================

export type Plot3DItem =
  | {
      id: string;
      kind: 'surface';
      expr: string; // z = f(x, y)
      range: number;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'plane';
      a: number;
      b: number;
      c: number;
      d: number; // ax + by + cz + d = 0
      showNormal: boolean;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'line3d';
      x0: number;
      y0: number;
      z0: number;
      a: number;
      b: number;
      c: number;
      name: string;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'sphere';
      cx: number;
      cy: number;
      cz: number;
      r: number;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'vector3d';
      x0: number;
      y0: number;
      z0: number;
      dx: number;
      dy: number;
      dz: number;
      name: string;
      color: string;
      visible: boolean;
    }
  | {
      id: string;
      kind: 'point3d';
      x: number;
      y: number;
      z: number;
      name: string;
      showProjection: boolean;
      color: string;
      visible: boolean;
    };

export interface Graph3DConfig {
  yaw: number; // radians
  pitch: number; // radians
  zoom: number; // pixels per unit
  bound: number; // half-axis length (e.g. 5)
  showGrid: boolean;
  showLabels: boolean;
  items: Plot3DItem[];
}

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

function project3D(
  p: Vec3,
  width: number,
  height: number,
  yaw: number,
  pitch: number,
  zoom: number
): { sx: number; sy: number; depth: number } {
  // Textbook Oxyz: z is up, x & y horizontal
  const cosY = Math.cos(yaw);
  const sinY = Math.sin(yaw);
  const cosP = Math.cos(pitch);
  const sinP = Math.sin(pitch);

  // Rotate around Z axis by yaw
  const x1 = p.x * cosY - p.y * sinY;
  const y1 = p.x * sinY + p.y * cosY;
  const z1 = p.z;

  // Tilt by pitch (screen right = y1, screen up = z2, depth = x2)
  const depth = x1 * cosP + z1 * sinP;
  const z2 = -x1 * sinP + z1 * cosP;

  const persp = 1 / (1 - depth * 0.022);
  return {
    sx: width / 2 + y1 * zoom * persp,
    sy: height / 2 - z2 * zoom * persp,
    depth,
  };
}

// Compute polygon of plane ax + by + cz + d = 0 clipped against cube [-B, B]^3
function intersectPlaneWithBox(
  a: number,
  b: number,
  c: number,
  d: number,
  B: number
): Vec3[] {
  const edges: [Vec3, Vec3][] = [
    [{ x: -B, y: -B, z: -B }, { x: B, y: -B, z: -B }],
    [{ x: B, y: -B, z: -B }, { x: B, y: B, z: -B }],
    [{ x: B, y: B, z: -B }, { x: -B, y: B, z: -B }],
    [{ x: -B, y: B, z: -B }, { x: -B, y: -B, z: -B }],
    [{ x: -B, y: -B, z: B }, { x: B, y: -B, z: B }],
    [{ x: B, y: -B, z: B }, { x: B, y: B, z: B }],
    [{ x: B, y: B, z: B }, { x: -B, y: B, z: B }],
    [{ x: -B, y: B, z: B }, { x: -B, y: -B, z: B }],
    [{ x: -B, y: -B, z: -B }, { x: -B, y: -B, z: B }],
    [{ x: B, y: -B, z: -B }, { x: B, y: -B, z: B }],
    [{ x: B, y: B, z: -B }, { x: B, y: B, z: B }],
    [{ x: -B, y: B, z: -B }, { x: -B, y: B, z: B }],
  ];

  const f = (p: Vec3) => a * p.x + b * p.y + c * p.z + d;
  const pts: Vec3[] = [];
  for (const [p1, p2] of edges) {
    const v1 = f(p1);
    const v2 = f(p2);
    if (Math.abs(v1) < 1e-6) {
      pts.push(p1);
    } else if (v1 * v2 < 0) {
      const t = v1 / (v1 - v2);
      pts.push({
        x: p1.x + t * (p2.x - p1.x),
        y: p1.y + t * (p2.y - p1.y),
        z: p1.z + t * (p2.z - p1.z),
      });
    }
  }
  // Deduplicate close points
  const unique: Vec3[] = [];
  for (const p of pts) {
    if (!unique.some((u) => Math.hypot(u.x - p.x, u.y - p.y, u.z - p.z) < 1e-3)) {
      unique.push(p);
    }
  }
  if (unique.length < 3) return [];

  // Sort cyclically around centroid in the plane's local 2D basis
  const cx = unique.reduce((s, p) => s + p.x, 0) / unique.length;
  const cy = unique.reduce((s, p) => s + p.y, 0) / unique.length;
  const cz = unique.reduce((s, p) => s + p.z, 0) / unique.length;
  const nLen = Math.hypot(a, b, c) || 1;
  const nx = a / nLen;
  const ny = b / nLen;
  const nz = c / nLen;
  const ref: Vec3 = Math.abs(nx) < 0.8 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  // u = normalize(n × ref)
  const ux0 = ny * ref.z - nz * ref.y;
  const uy0 = nz * ref.x - nx * ref.z;
  const uz0 = nx * ref.y - ny * ref.x;
  const uLen = Math.hypot(ux0, uy0, uz0) || 1;
  const u = { x: ux0 / uLen, y: uy0 / uLen, z: uz0 / uLen };
  // v = n × u
  const v = {
    x: ny * u.z - nz * u.y,
    y: nz * u.x - nx * u.z,
    z: nx * u.y - ny * u.x,
  };

  unique.sort((p1, p2) => {
    const a1 = Math.atan2(
      (p1.x - cx) * v.x + (p1.y - cy) * v.y + (p1.z - cz) * v.z,
      (p1.x - cx) * u.x + (p1.y - cy) * u.y + (p1.z - cz) * u.z
    );
    const a2 = Math.atan2(
      (p2.x - cx) * v.x + (p2.y - cy) * v.y + (p2.z - cz) * v.z,
      (p2.x - cx) * u.x + (p2.y - cy) * u.y + (p2.z - cz) * u.z
    );
    return a1 - a2;
  });
  return unique;
}

export function describePlot3DItem(item: Plot3DItem): string {
  switch (item.kind) {
    case 'surface':
      return `z = ${item.expr}`;
    case 'plane': {
      const terms: string[] = [];
      if (item.a !== 0) terms.push(`${item.a === 1 ? '' : item.a === -1 ? '-' : fmtNum(item.a)}x`);
      if (item.b !== 0)
        terms.push(
          `${terms.length && item.b > 0 ? '+ ' : item.b < 0 ? '- ' : ''}${Math.abs(item.b) === 1 ? '' : fmtNum(Math.abs(item.b))}y`
        );
      if (item.c !== 0)
        terms.push(
          `${terms.length && item.c > 0 ? '+ ' : item.c < 0 ? '- ' : ''}${Math.abs(item.c) === 1 ? '' : fmtNum(Math.abs(item.c))}z`
        );
      if (item.d !== 0)
        terms.push(`${terms.length && item.d > 0 ? '+ ' : item.d < 0 ? '- ' : ''}${fmtNum(Math.abs(item.d))}`);
      return `(P): ${terms.join(' ') || '0'} = 0`;
    }
    case 'line3d':
      return `${item.name || 'd'}: M(${fmtNum(item.x0)},${fmtNum(item.y0)},${fmtNum(item.z0)}), u(${fmtNum(item.a)},${fmtNum(item.b)},${fmtNum(item.c)})`;
    case 'sphere':
      return `(S): I(${fmtNum(item.cx)},${fmtNum(item.cy)},${fmtNum(item.cz)}), R = ${fmtNum(item.r)}`;
    case 'vector3d':
      return `→${item.name || 'u'}(${fmtNum(item.dx)}, ${fmtNum(item.dy)}, ${fmtNum(item.dz)})`;
    case 'point3d':
      return `${item.name || 'A'}(${fmtNum(item.x)}, ${fmtNum(item.y)}, ${fmtNum(item.z)})`;
  }
}

export function draw3DSpaceGraph(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: Graph3DConfig
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  const P = (v: Vec3) => project3D(v, width, height, config.yaw, config.pitch, config.zoom);
  const B = config.bound;

  // 1. Base Oxy Grid Plane
  if (config.showGrid) {
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    for (let i = -B; i <= B; i++) {
      const a1 = P({ x: i, y: -B, z: 0 });
      const a2 = P({ x: i, y: B, z: 0 });
      ctx.beginPath();
      ctx.moveTo(a1.sx, a1.sy);
      ctx.lineTo(a2.sx, a2.sy);
      ctx.stroke();

      const b1 = P({ x: -B, y: i, z: 0 });
      const b2 = P({ x: B, y: i, z: 0 });
      ctx.beginPath();
      ctx.moveTo(b1.sx, b1.sy);
      ctx.lineTo(b2.sx, b2.sy);
      ctx.stroke();
    }
  }

  // 2. Axes Ox, Oy, Oz
  const axes: { from: Vec3; to: Vec3; label: string; color: string }[] = [
    { from: { x: -B, y: 0, z: 0 }, to: { x: B + 0.6, y: 0, z: 0 }, label: 'x', color: '#DC2626' },
    { from: { x: 0, y: -B, z: 0 }, to: { x: 0, y: B + 0.6, z: 0 }, label: 'y', color: '#16A34A' },
    { from: { x: 0, y: 0, z: -B }, to: { x: 0, y: 0, z: B + 0.6 }, label: 'z', color: '#2563EB' },
  ];

  for (const ax of axes) {
    const p0 = P(ax.from);
    const pMid = P({ x: 0, y: 0, z: 0 });
    const p1 = P(ax.to);

    // Negative half dashed
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(p0.sx, p0.sy);
    ctx.lineTo(pMid.sx, pMid.sy);
    ctx.stroke();
    ctx.restore();

    // Positive half solid + arrow
    ctx.strokeStyle = ax.color;
    ctx.fillStyle = ax.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pMid.sx, pMid.sy);
    ctx.lineTo(p1.sx, p1.sy);
    ctx.stroke();
    drawArrowhead(ctx, pMid.sx, pMid.sy, p1.sx, p1.sy, 8);

    ctx.font = 'italic 700 15px Georgia, serif';
    ctx.fillText(ax.label, p1.sx + 7, p1.sy + 5);
  }

  // Origin label
  const oPt = P({ x: 0, y: 0, z: 0 });
  ctx.fillStyle = '#334155';
  ctx.font = 'italic 700 13px Georgia, serif';
  ctx.fillText('O', oPt.sx - 14, oPt.sy + 14);

  // 3. Draw 3D Items
  for (const item of config.items) {
    if (!item.visible) continue;
    ctx.save();

    if (item.kind === 'surface') {
      const compiled = compileMathExpression(item.expr);
      if (compiled.ok) {
        const R = Math.min(item.range || B, B);
        const steps = 18;
        const grid: { p: Vec3; proj: { sx: number; sy: number; depth: number }; ok: boolean }[][] =
          [];
        for (let i = 0; i <= steps; i++) {
          const row = [];
          const x = -R + (2 * R * i) / steps;
          for (let j = 0; j <= steps; j++) {
            const y = -R + (2 * R * j) / steps;
            const z = compiled.evaluate({ x, y });
            const ok = Number.isFinite(z) && Math.abs(z) <= B * 1.5;
            const clampedZ = ok ? Math.max(-B, Math.min(B, z)) : 0;
            const p = { x, y, z: clampedZ };
            row.push({ p, proj: P(p), ok });
          }
          grid.push(row);
        }

        // Collect quads and depth-sort (painter's algorithm)
        const quads: {
          pts: { sx: number; sy: number }[];
          depth: number;
          avgZ: number;
        }[] = [];
        for (let i = 0; i < steps; i++) {
          for (let j = 0; j < steps; j++) {
            const a = grid[i][j];
            const b = grid[i + 1][j];
            const c = grid[i + 1][j + 1];
            const d = grid[i][j + 1];
            if (!a.ok || !b.ok || !c.ok || !d.ok) continue;
            quads.push({
              pts: [a.proj, b.proj, c.proj, d.proj],
              depth: (a.proj.depth + b.proj.depth + c.proj.depth + d.proj.depth) / 4,
              avgZ: (a.p.z + b.p.z + c.p.z + d.p.z) / 4,
            });
          }
        }
        quads.sort((q1, q2) => q1.depth - q2.depth);

        for (const q of quads) {
          const t = Math.max(0, Math.min(1, (q.avgZ + B * 0.7) / (B * 1.4)));
          const rCol = Math.round(79 + t * 155);
          const gCol = Math.round(70 + (1 - Math.abs(t - 0.5) * 1.4) * 140);
          const bCol = Math.round(229 - t * 140);
          ctx.fillStyle = `rgba(${rCol}, ${gCol}, ${bCol}, 0.52)`;
          ctx.strokeStyle = 'rgba(30, 41, 59, 0.25)';
          ctx.lineWidth = 0.7;
          ctx.beginPath();
          ctx.moveTo(q.pts[0].sx, q.pts[0].sy);
          ctx.lineTo(q.pts[1].sx, q.pts[1].sy);
          ctx.lineTo(q.pts[2].sx, q.pts[2].sy);
          ctx.lineTo(q.pts[3].sx, q.pts[3].sy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        }
      }
    } else if (item.kind === 'plane') {
      const poly = intersectPlaneWithBox(item.a, item.b, item.c, item.d, B);
      if (poly.length >= 3) {
        const projPts = poly.map((pt) => P(pt));
        ctx.fillStyle = item.color;
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.moveTo(projPts[0].sx, projPts[0].sy);
        for (let i = 1; i < projPts.length; i++) ctx.lineTo(projPts[i].sx, projPts[i].sy);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Optional normal vector from centroid
        if (item.showNormal) {
          const cx = poly.reduce((s, p) => s + p.x, 0) / poly.length;
          const cy = poly.reduce((s, p) => s + p.y, 0) / poly.length;
          const cz = poly.reduce((s, p) => s + p.z, 0) / poly.length;
          const nLen = Math.hypot(item.a, item.b, item.c) || 1;
          const scaleN = 2.0 / nLen;
          const p0 = P({ x: cx, y: cy, z: cz });
          const p1 = P({
            x: cx + item.a * scaleN,
            y: cy + item.b * scaleN,
            z: cz + item.c * scaleN,
          });
          ctx.globalAlpha = 1;
          ctx.strokeStyle = '#0F172A';
          ctx.fillStyle = '#0F172A';
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.moveTo(p0.sx, p0.sy);
          ctx.lineTo(p1.sx, p1.sy);
          ctx.stroke();
          drawArrowhead(ctx, p0.sx, p0.sy, p1.sx, p1.sy, 9);
          ctx.font = 'italic 700 13px Georgia, serif';
          ctx.fillText('→n', p1.sx + 6, p1.sy - 4);
        }
      }
    } else if (item.kind === 'line3d') {
      const len = Math.hypot(item.a, item.b, item.c) || 1;
      const tSpan = (B * 1.15) / len;
      const pStart = P({
        x: item.x0 - item.a * tSpan,
        y: item.y0 - item.b * tSpan,
        z: item.z0 - item.c * tSpan,
      });
      const pEnd = P({
        x: item.x0 + item.a * tSpan,
        y: item.y0 + item.b * tSpan,
        z: item.z0 + item.c * tSpan,
      });
      ctx.strokeStyle = item.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(pStart.sx, pStart.sy);
      ctx.lineTo(pEnd.sx, pEnd.sy);
      ctx.stroke();

      // Anchor point M0 + direction vector arrow
      const pM = P({ x: item.x0, y: item.y0, z: item.z0 });
      const pDir = P({
        x: item.x0 + (item.a / len) * 1.8,
        y: item.y0 + (item.b / len) * 1.8,
        z: item.z0 + (item.c / len) * 1.8,
      });
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(pM.sx, pM.sy, 4.5, 0, Math.PI * 2);
      ctx.fill();
      drawArrowhead(ctx, pM.sx, pM.sy, pDir.sx, pDir.sy, 9);
      ctx.font = 'italic 700 13px Georgia, serif';
      ctx.fillText(item.name || 'd', pEnd.sx + 6, pEnd.sy - 4);
    } else if (item.kind === 'sphere') {
      if (item.r > 0) {
        const center = { x: item.cx, y: item.cy, z: item.cz };
        const pC = P(center);
        // Subtle translucent fill disk approximated via projected radius
        const pEdge = P({ x: item.cx, y: item.cy + item.r, z: item.cz });
        const approxR = Math.hypot(pEdge.sx - pC.sx, pEdge.sy - pC.sy);
        ctx.fillStyle = item.color;
        ctx.globalAlpha = 0.1;
        ctx.beginPath();
        ctx.arc(pC.sx, pC.sy, approxR, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 0.78;
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1.3;
        // Latitude circles
        const lats = [-0.6, 0, 0.6];
        for (const lat of lats) {
          const z = item.cz + item.r * Math.sin(lat);
          const rr = item.r * Math.cos(lat);
          ctx.beginPath();
          for (let i = 0; i <= 48; i++) {
            const ang = (i / 48) * Math.PI * 2;
            const pt = P({
              x: item.cx + rr * Math.cos(ang),
              y: item.cy + rr * Math.sin(ang),
              z,
            });
            if (i === 0) ctx.moveTo(pt.sx, pt.sy);
            else ctx.lineTo(pt.sx, pt.sy);
          }
          ctx.stroke();
        }
        // Longitude circles
        for (let m = 0; m < 4; m++) {
          const phi = (m / 4) * Math.PI;
          ctx.beginPath();
          for (let i = 0; i <= 48; i++) {
            const theta = (i / 48) * Math.PI * 2;
            const pt = P({
              x: item.cx + item.r * Math.sin(theta) * Math.cos(phi),
              y: item.cy + item.r * Math.sin(theta) * Math.sin(phi),
              z: item.cz + item.r * Math.cos(theta),
            });
            if (i === 0) ctx.moveTo(pt.sx, pt.sy);
            else ctx.lineTo(pt.sx, pt.sy);
          }
          ctx.stroke();
        }
        // Center I + Radius segment
        ctx.globalAlpha = 1;
        ctx.fillStyle = item.color;
        ctx.beginPath();
        ctx.arc(pC.sx, pC.sy, 4, 0, Math.PI * 2);
        ctx.fill();
        const pR = P({ x: item.cx, y: item.cy + item.r, z: item.cz });
        ctx.setLineDash([4, 3]);
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(pC.sx, pC.sy);
        ctx.lineTo(pR.sx, pR.sy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = 'italic 700 13px Georgia, serif';
        ctx.fillText('I', pC.sx - 13, pC.sy - 6);
        ctx.fillText(`R=${fmtNum(item.r)}`, (pC.sx + pR.sx) / 2, (pC.sy + pR.sy) / 2 - 6);
      }
    } else if (item.kind === 'vector3d') {
      const p0 = P({ x: item.x0, y: item.y0, z: item.z0 });
      const p1 = P({
        x: item.x0 + item.dx,
        y: item.y0 + item.dy,
        z: item.z0 + item.dz,
      });
      ctx.strokeStyle = item.color;
      ctx.fillStyle = item.color;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(p0.sx, p0.sy);
      ctx.lineTo(p1.sx, p1.sy);
      ctx.stroke();
      drawArrowhead(ctx, p0.sx, p0.sy, p1.sx, p1.sy, 10);
      ctx.font = 'italic 700 14px Georgia, serif';
      ctx.fillText(`→${item.name || 'u'}`, p1.sx + 7, p1.sy - 6);
    } else if (item.kind === 'point3d') {
      const p = P({ x: item.x, y: item.y, z: item.z });
      if (item.showProjection) {
        const pXY = P({ x: item.x, y: item.y, z: 0 });
        const pX = P({ x: item.x, y: 0, z: 0 });
        const pY = P({ x: 0, y: item.y, z: 0 });
        ctx.save();
        ctx.strokeStyle = item.color;
        ctx.globalAlpha = 0.55;
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(p.sx, p.sy);
        ctx.lineTo(pXY.sx, pXY.sy);
        ctx.moveTo(pXY.sx, pXY.sy);
        ctx.lineTo(pX.sx, pX.sy);
        ctx.moveTo(pXY.sx, pXY.sy);
        ctx.lineTo(pY.sx, pY.sy);
        ctx.stroke();
        ctx.restore();
      }
      ctx.fillStyle = item.color;
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = '700 12px system-ui, sans-serif';
      ctx.fillStyle = item.color;
      ctx.fillText(
        `${item.name || 'A'}(${fmtNum(item.x)},${fmtNum(item.y)},${fmtNum(item.z)})`,
        p.sx + 8,
        p.sy - 7
      );
    }

    ctx.restore();
  }

  // On-canvas Legend
  if (config.showLabels) {
    const visibleItems = config.items.filter((it) => it.visible);
    if (visibleItems.length > 0) {
      const lineH = 20;
      const boxH = visibleItems.length * lineH + 14;
      ctx.font = '600 12px ui-monospace, SFMono-Regular, Menlo, monospace';
      const maxTextW = Math.max(
        ...visibleItems.map((it) => ctx.measureText(describePlot3DItem(it)).width)
      );
      const boxW = Math.min(width - 24, maxTextW + 40);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.strokeStyle = '#E2E8F0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(12, 12, boxW, boxH, 8);
      ctx.fill();
      ctx.stroke();
      visibleItems.forEach((it, idx) => {
        const ly = 30 + idx * lineH;
        ctx.fillStyle = it.color;
        ctx.fillRect(22, ly - 6, 12, 3.5);
        ctx.fillStyle = '#0F172A';
        ctx.fillText(describePlot3DItem(it), 40, ly);
      });
    }
  }

  ctx.restore();
}

// ============================================================================
// 3. COMMON GEOMETRY FIGURES (2D & 3D) LIBRARY & RENDERER
// ============================================================================

export type GeometryFigureId =
  // 2D Plane Geometry (10)
  | 'right_triangle'
  | 'isosceles_triangle'
  | 'equilateral_triangle'
  | 'triangle_altitude'
  | 'rectangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'rhombus'
  | 'circle_parts'
  | 'unit_circle'
  // 3D Solid Geometry (8)
  | 'cube'
  | 'rectangular_prism'
  | 'triangular_prism'
  | 'cylinder'
  | 'cone'
  | 'square_pyramid'
  | 'tetrahedron'
  | 'sphere_solid';

export interface GeometryFigureMeta {
  id: GeometryFigureId;
  group: '2d' | '3d';
  nameKm: string;
  nameEn: string;
  formula: string;
  defaultDimA: string;
  defaultDimB: string;
  defaultDimC: string;
  dimLabelsKm: [string, string, string];
  dimLabelsEn: [string, string, string];
}

export const GEOMETRY_FIGURES: GeometryFigureMeta[] = [
  // 2D Figures
  {
    id: 'right_triangle',
    group: '2d',
    nameKm: 'ត្រីកោណកែង',
    nameEn: 'Right Triangle',
    formula: 'c² = a² + b²  |  S = ½ab',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'c',
    dimLabelsKm: ['ជ្រុងឈរ (a)', 'ជ្រុងដេក (b)', 'អ៊ីប៉ូតេនុស (c)'],
    dimLabelsEn: ['Height (a)', 'Base (b)', 'Hypotenuse (c)'],
  },
  {
    id: 'isosceles_triangle',
    group: '2d',
    nameKm: 'ត្រីកោណសមបាត',
    nameEn: 'Isosceles Triangle',
    formula: 'S = ½bh  |  AB = AC = a',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'h',
    dimLabelsKm: ['ជ្រុងស្មើ (a)', 'បាត (b)', 'កម្ពស់ (h)'],
    dimLabelsEn: ['Equal side (a)', 'Base (b)', 'Height (h)'],
  },
  {
    id: 'equilateral_triangle',
    group: '2d',
    nameKm: 'ត្រីកោណសម័ង្ស',
    nameEn: 'Equilateral Triangle',
    formula: 'h = (a√3)/2  |  S = (a²√3)/4',
    defaultDimA: 'a',
    defaultDimB: 'h',
    defaultDimC: '60°',
    dimLabelsKm: ['ជ្រុង (a)', 'កម្ពស់ (h)', 'មុំ'],
    dimLabelsEn: ['Side (a)', 'Altitude (h)', 'Angle'],
  },
  {
    id: 'triangle_altitude',
    group: '2d',
    nameKm: 'ត្រីកោណទូទៅ & កម្ពស់',
    nameEn: 'Triangle & Altitude',
    formula: 'S = ½·b·h  |  P = a + b + c',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'h',
    dimLabelsKm: ['ជ្រុងឆ្វេង (a)', 'បាត (b)', 'កម្ពស់ (h)'],
    dimLabelsEn: ['Left side (a)', 'Base (b)', 'Height (h)'],
  },
  {
    id: 'rectangle',
    group: '2d',
    nameKm: 'ចតុកោណកែង / ការេ',
    nameEn: 'Rectangle / Square',
    formula: 'S = a·b  |  P = 2(a + b)  |  d = √(a²+b²)',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'd',
    dimLabelsKm: ['បណ្តោយ (a)', 'ទទឹង (b)', 'អង្កត់ទ្រូង (d)'],
    dimLabelsEn: ['Length (a)', 'Width (b)', 'Diagonal (d)'],
  },
  {
    id: 'parallelogram',
    group: '2d',
    nameKm: 'ប្រលេឡូក្រាម',
    nameEn: 'Parallelogram',
    formula: 'S = b·h  |  P = 2(a + b)',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'h',
    dimLabelsKm: ['ជ្រុងទ្រេត (a)', 'បាត (b)', 'កម្ពស់ (h)'],
    dimLabelsEn: ['Slant side (a)', 'Base (b)', 'Height (h)'],
  },
  {
    id: 'trapezoid',
    group: '2d',
    nameKm: 'ចតុកោណព្នាយ',
    nameEn: 'Trapezoid',
    formula: 'S = ½(a + b)·h',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'h',
    dimLabelsKm: ['បាតតូច (a)', 'បាតធំ (b)', 'កម្ពស់ (h)'],
    dimLabelsEn: ['Top base (a)', 'Bottom base (b)', 'Height (h)'],
  },
  {
    id: 'rhombus',
    group: '2d',
    nameKm: 'ចតុកោណស្មើ',
    nameEn: 'Rhombus',
    formula: 'S = ½(d₁·d₂)  |  P = 4a',
    defaultDimA: 'a',
    defaultDimB: 'd₁',
    defaultDimC: 'd₂',
    dimLabelsKm: ['ជ្រុង (a)', 'អង្កត់ទ្រូង d₁', 'អង្កត់ទ្រូង d₂'],
    dimLabelsEn: ['Side (a)', 'Diagonal d₁', 'Diagonal d₂'],
  },
  {
    id: 'circle_parts',
    group: '2d',
    nameKm: 'រង្វង់ (កាំ អង្កត់ផ្ចិត បន្ទាត់ប៉ះ)',
    nameEn: 'Circle (Radius, Chord, Tangent)',
    formula: 'C = 2πR  |  S = πR²  |  OT ⊥ d',
    defaultDimA: 'R',
    defaultDimB: 'O',
    defaultDimC: 'T',
    dimLabelsKm: ['កាំ (R)', 'ផ្ចិត (O)', 'ចំណុចប៉ះ (T)'],
    dimLabelsEn: ['Radius (R)', 'Center (O)', 'Tangent Pt (T)'],
  },
  {
    id: 'unit_circle',
    group: '2d',
    nameKm: 'រង្វង់ត្រីកោណមាត្រ',
    nameEn: 'Trigonometric Unit Circle',
    formula: 'cos²θ + sin²θ = 1  |  M(cos θ, sin θ)',
    defaultDimA: 'θ',
    defaultDimB: 'cos θ',
    defaultDimC: 'sin θ',
    dimLabelsKm: ['មុំ (θ)', 'កូស៊ីនុស', 'ស៊ីនុស'],
    dimLabelsEn: ['Angle (θ)', 'Cosine', 'Sine'],
  },

  // 3D Solid Figures
  {
    id: 'cube',
    group: '3d',
    nameKm: 'គូប (Cube)',
    nameEn: 'Cube',
    formula: 'V = a³  |  S = 6a²  |  d = a√3',
    defaultDimA: 'a',
    defaultDimB: 'a',
    defaultDimC: 'a',
    dimLabelsKm: ['ទ្រនុង (a)', 'ទទឹង', 'កម្ពស់'],
    dimLabelsEn: ['Edge (a)', 'Width', 'Height'],
  },
  {
    id: 'rectangular_prism',
    group: '3d',
    nameKm: 'ប្រលេពីប៉ែតកែង (Cuboid)',
    nameEn: 'Rectangular Prism',
    formula: 'V = a·b·c  |  S = 2(ab + bc + ca)',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'c',
    dimLabelsKm: ['បណ្តោយ (a)', 'ទទឹង (b)', 'កម្ពស់ (c)'],
    dimLabelsEn: ['Length (a)', 'Width (b)', 'Height (c)'],
  },
  {
    id: 'triangular_prism',
    group: '3d',
    nameKm: 'ព្រីសត្រីកោណ',
    nameEn: 'Triangular Prism',
    formula: 'V = S_បាត · h',
    defaultDimA: 'a',
    defaultDimB: 'b',
    defaultDimC: 'h',
    dimLabelsKm: ['ជ្រុងបាត (a)', 'បាត (b)', 'កម្ពស់ (h)'],
    dimLabelsEn: ['Base side (a)', 'Base (b)', 'Height (h)'],
  },
  {
    id: 'cylinder',
    group: '3d',
    nameKm: 'ស៊ីឡាំង (Cylinder)',
    nameEn: 'Cylinder',
    formula: 'V = πr²h  |  S_xq = 2πrh',
    defaultDimA: 'r',
    defaultDimB: 'h',
    defaultDimC: 'O',
    dimLabelsKm: ['កាំបាត (r)', 'កម្ពស់ (h)', 'ផ្ចិត (O)'],
    dimLabelsEn: ['Radius (r)', 'Height (h)', 'Center (O)'],
  },
  {
    id: 'cone',
    group: '3d',
    nameKm: 'កោណ (Cone)',
    nameEn: 'Cone',
    formula: 'V = ⅓πr²h  |  l² = r² + h²',
    defaultDimA: 'r',
    defaultDimB: 'h',
    defaultDimC: 'l',
    dimLabelsKm: ['កាំបាត (r)', 'កម្ពស់ (h)', 'ទ្រនុងទ្រេត (l)'],
    dimLabelsEn: ['Radius (r)', 'Height (h)', 'Slant (l)'],
  },
  {
    id: 'square_pyramid',
    group: '3d',
    nameKm: 'ពីរ៉ាមីតបាតការេ (S.ABCD)',
    nameEn: 'Square Pyramid',
    formula: 'V = ⅓a²h  |  S_បាត = a²',
    defaultDimA: 'a',
    defaultDimB: 'h',
    defaultDimC: 'S',
    dimLabelsKm: ['ជ្រុងបាត (a)', 'កម្ពស់ (h)', 'កំពូល (S)'],
    dimLabelsEn: ['Base (a)', 'Height (h)', 'Apex (S)'],
  },
  {
    id: 'tetrahedron',
    group: '3d',
    nameKm: 'តេត្រាអែត / ពីរ៉ាមីតត្រីកោណ',
    nameEn: 'Tetrahedron (S.ABC)',
    formula: 'V = ⅓·S_ABC·h',
    defaultDimA: 'a',
    defaultDimB: 'h',
    defaultDimC: 'S',
    dimLabelsKm: ['ជ្រុង (a)', 'កម្ពស់ (h)', 'កំពូល (S)'],
    dimLabelsEn: ['Edge (a)', 'Height (h)', 'Apex (S)'],
  },
  {
    id: 'sphere_solid',
    group: '3d',
    nameKm: 'ស្វ៊ែរ (Sphere)',
    nameEn: 'Sphere',
    formula: 'V = ⁴⁄₃πR³  |  S = 4πR²',
    defaultDimA: 'R',
    defaultDimB: 'O',
    defaultDimC: 'd = 2R',
    dimLabelsKm: ['កាំ (R)', 'ផ្ចិត (O)', 'អង្កត់ផ្ចិត'],
    dimLabelsEn: ['Radius (R)', 'Center (O)', 'Diameter'],
  },
];

export interface GeometryRenderConfig {
  figureId: GeometryFigureId;
  dimA: string;
  dimB: string;
  dimC: string;
  showLabels: boolean;
  showMarks: boolean;
  showFormula: boolean;
  accentColor: string;
}

function drawRightAngleBox(
  ctx: CanvasRenderingContext2D,
  vx: number,
  vy: number,
  ux: number,
  uy: number,
  wx: number,
  wy: number,
  size = 14
) {
  const uLen = Math.hypot(ux, uy) || 1;
  const wLen = Math.hypot(wx, wy) || 1;
  const dx1 = (ux / uLen) * size;
  const dy1 = (uy / uLen) * size;
  const dx2 = (wx / wLen) * size;
  const dy2 = (wy / wLen) * size;
  ctx.save();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(vx + dx1, vy + dy1);
  ctx.lineTo(vx + dx1 + dx2, vy + dy1 + dy2);
  ctx.lineTo(vx + dx2, vy + dy2);
  ctx.stroke();
  ctx.restore();
}

function drawTickMark(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  count = 1
) {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const ux = dx / len;
  const uy = dy / len;

  ctx.save();
  ctx.lineWidth = 1.6;
  const offsetStart = count === 2 ? -3 : 0;
  for (let i = 0; i < count; i++) {
    const off = offsetStart + i * 6;
    const cx = mx + ux * off;
    const cy = my + uy * off;
    ctx.beginPath();
    ctx.moveTo(cx - nx * 6, cy - ny * 6);
    ctx.lineTo(cx + nx * 6, cy + ny * 6);
    ctx.stroke();
  }
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(79, 70, 229, ${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function drawGeometryFigure(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: GeometryRenderConfig
) {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Subtle engineering dot background
  ctx.fillStyle = '#E2E8F0';
  for (let x = 20; x < width; x += 24) {
    for (let y = 20; y < height; y += 24) {
      ctx.fillRect(x, y, 1.5, 1.5);
    }
  }

  const meta =
    GEOMETRY_FIGURES.find((f) => f.id === config.figureId) || GEOMETRY_FIGURES[0];
  const stroke = config.accentColor || '#1E293B';
  const fillSoft = hexToRgba(stroke, 0.08);
  const fillMid = hexToRgba(stroke, 0.14);
  const cx = width / 2;
  const cy = config.showFormula ? height * 0.45 : height * 0.5;
  const S = Math.min(width, height) * 0.34;

  const drawLabel = (text: string, x: number, y: number, color = '#0F172A', italic = true) => {
    if (!config.showLabels || !text) return;
    ctx.save();
    ctx.font = `${italic ? 'italic ' : ''}700 16px Georgia, serif`;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  switch (config.figureId) {
    case 'right_triangle': {
      const A = { x: cx - S * 0.85, y: cy + S * 0.7 };
      const B = { x: cx - S * 0.85, y: cy - S * 0.75 };
      const C = { x: cx + S * 0.95, y: cy + S * 0.7 };
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      if (config.showMarks) {
        drawRightAngleBox(ctx, A.x, A.y, B.x - A.x, B.y - A.y, C.x - A.x, C.y - A.y, 16);
        // Angle arc at C
        ctx.save();
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        const angBC = Math.atan2(B.y - C.y, B.x - C.x);
        ctx.arc(C.x, C.y, 32, Math.PI, angBC, false);
        ctx.stroke();
        ctx.restore();
      }
      drawLabel('A', A.x - 16, A.y + 14, '#0F172A', false);
      drawLabel('B', B.x - 16, B.y - 12, '#0F172A', false);
      drawLabel('C', C.x + 16, C.y + 14, '#0F172A', false);
      drawLabel(config.dimA, A.x - 22, (A.y + B.y) / 2, stroke);
      drawLabel(config.dimB, (A.x + C.x) / 2, A.y + 22, stroke);
      drawLabel(config.dimC, (B.x + C.x) / 2 + 16, (B.y + C.y) / 2 - 14, stroke);
      break;
    }

    case 'isosceles_triangle': {
      const A = { x: cx, y: cy - S * 0.85 };
      const B = { x: cx - S * 0.85, y: cy + S * 0.72 };
      const C = { x: cx + S * 0.85, y: cy + S * 0.72 };
      const H = { x: cx, y: cy + S * 0.72 };
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Altitude dashed
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawTickMark(ctx, A.x, A.y, B.x, B.y, 1);
        drawTickMark(ctx, A.x, A.y, C.x, C.y, 1);
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 14);
      }
      drawLabel('A', A.x, A.y - 18, '#0F172A', false);
      drawLabel('B', B.x - 16, B.y + 12, '#0F172A', false);
      drawLabel('C', C.x + 16, C.y + 12, '#0F172A', false);
      drawLabel('H', H.x, H.y + 18, '#DC2626', false);
      drawLabel(config.dimA, (A.x + B.x) / 2 - 20, (A.y + B.y) / 2, stroke);
      drawLabel(config.dimA, (A.x + C.x) / 2 + 20, (A.y + C.y) / 2, stroke);
      drawLabel(config.dimB, (B.x + H.x) / 2, B.y + 22, stroke);
      drawLabel(config.dimC, H.x + 16, (A.y + H.y) / 2, '#DC2626');
      break;
    }

    case 'equilateral_triangle': {
      const side = S * 1.65;
      const h = (side * Math.sqrt(3)) / 2;
      const A = { x: cx, y: cy - h * 0.52 };
      const B = { x: cx - side / 2, y: cy + h * 0.48 };
      const C = { x: cx + side / 2, y: cy + h * 0.48 };
      const H = { x: cx, y: C.y };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawTickMark(ctx, A.x, A.y, B.x, B.y, 1);
        drawTickMark(ctx, A.x, A.y, C.x, C.y, 1);
        drawTickMark(ctx, B.x, B.y, C.x, C.y, 1);
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 13);
        ctx.save();
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(B.x, B.y, 26, -Math.PI / 3, 0);
        ctx.stroke();
        ctx.restore();
      }
      drawLabel('A', A.x, A.y - 18, '#0F172A', false);
      drawLabel('B', B.x - 16, B.y + 12, '#0F172A', false);
      drawLabel('C', C.x + 16, C.y + 12, '#0F172A', false);
      drawLabel(config.dimA, (A.x + B.x) / 2 - 20, (A.y + B.y) / 2, stroke);
      drawLabel(config.dimB, H.x + 16, (A.y + H.y) / 2, '#DC2626');
      drawLabel(config.dimC, B.x + 42, B.y - 14, '#059669', false);
      break;
    }

    case 'triangle_altitude': {
      const A = { x: cx - S * 0.25, y: cy - S * 0.82 };
      const B = { x: cx - S * 0.95, y: cy + S * 0.7 };
      const C = { x: cx + S * 1.0, y: cy + S * 0.7 };
      const H = { x: A.x, y: B.y };
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.9;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 14);
      }
      drawLabel('A', A.x, A.y - 18, '#0F172A', false);
      drawLabel('B', B.x - 16, B.y + 12, '#0F172A', false);
      drawLabel('C', C.x + 16, C.y + 12, '#0F172A', false);
      drawLabel('H', H.x, H.y + 18, '#DC2626', false);
      drawLabel(config.dimA, (A.x + B.x) / 2 - 18, (A.y + B.y) / 2, stroke);
      drawLabel(config.dimB, (H.x + C.x) / 2, C.y + 22, stroke);
      drawLabel(config.dimC, H.x + 16, (A.y + H.y) / 2, '#DC2626');
      break;
    }

    case 'rectangle': {
      const w = S * 1.95;
      const h = S * 1.2;
      const x0 = cx - w / 2;
      const y0 = cy - h / 2;
      ctx.fillStyle = fillSoft;
      ctx.fillRect(x0, y0, w, h);
      ctx.strokeRect(x0, y0, w, h);

      // Diagonal
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(x0, y0 + h);
      ctx.lineTo(x0 + w, y0);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, x0, y0, 1, 0, 0, 1, 14);
        drawRightAngleBox(ctx, x0 + w, y0 + h, -1, 0, 0, -1, 14);
        drawTickMark(ctx, x0, y0, x0 + w, y0, 2);
        drawTickMark(ctx, x0, y0 + h, x0 + w, y0 + h, 2);
        drawTickMark(ctx, x0, y0, x0, y0 + h, 1);
        drawTickMark(ctx, x0 + w, y0, x0 + w, y0 + h, 1);
      }
      drawLabel('A', x0 - 15, y0 - 12, '#0F172A', false);
      drawLabel('B', x0 + w + 15, y0 - 12, '#0F172A', false);
      drawLabel('C', x0 + w + 15, y0 + h + 14, '#0F172A', false);
      drawLabel('D', x0 - 15, y0 + h + 14, '#0F172A', false);
      drawLabel(config.dimA, cx, y0 + h + 22, stroke);
      drawLabel(config.dimB, x0 - 22, cy, stroke);
      drawLabel(config.dimC, cx - 10, cy - 12, '#DC2626');
      break;
    }

    case 'parallelogram': {
      const skew = S * 0.42;
      const w = S * 1.65;
      const h = S * 1.15;
      const A = { x: cx - w / 2 + skew / 2, y: cy - h / 2 };
      const B = { x: cx + w / 2 + skew / 2, y: cy - h / 2 };
      const C = { x: cx + w / 2 - skew / 2, y: cy + h / 2 };
      const D = { x: cx - w / 2 - skew / 2, y: cy + h / 2 };
      const H = { x: A.x, y: D.y };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.lineTo(D.x, D.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 14);
        drawTickMark(ctx, A.x, A.y, B.x, B.y, 2);
        drawTickMark(ctx, D.x, D.y, C.x, C.y, 2);
        drawTickMark(ctx, A.x, A.y, D.x, D.y, 1);
        drawTickMark(ctx, B.x, B.y, C.x, C.y, 1);
      }
      drawLabel('A', A.x - 10, A.y - 16, '#0F172A', false);
      drawLabel('B', B.x + 14, B.y - 14, '#0F172A', false);
      drawLabel('C', C.x + 14, C.y + 14, '#0F172A', false);
      drawLabel('D', D.x - 16, D.y + 14, '#0F172A', false);
      drawLabel('H', H.x, H.y + 18, '#DC2626', false);
      drawLabel(config.dimA, (A.x + D.x) / 2 - 20, (A.y + D.y) / 2, stroke);
      drawLabel(config.dimB, (H.x + C.x) / 2, D.y + 22, stroke);
      drawLabel(config.dimC, H.x + 15, (A.y + H.y) / 2, '#DC2626');
      break;
    }

    case 'trapezoid': {
      const topW = S * 1.1;
      const botW = S * 2.0;
      const h = S * 1.18;
      const A = { x: cx - topW / 2 - S * 0.08, y: cy - h / 2 };
      const B = { x: cx + topW / 2 - S * 0.08, y: cy - h / 2 };
      const C = { x: cx + botW / 2, y: cy + h / 2 };
      const D = { x: cx - botW / 2, y: cy + h / 2 };
      const H = { x: A.x, y: D.y };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.lineTo(D.x, D.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 14);
      }
      drawLabel('A', A.x - 14, A.y - 12, '#0F172A', false);
      drawLabel('B', B.x + 14, B.y - 12, '#0F172A', false);
      drawLabel('C', C.x + 16, C.y + 12, '#0F172A', false);
      drawLabel('D', D.x - 16, D.y + 12, '#0F172A', false);
      drawLabel('H', H.x, H.y + 18, '#DC2626', false);
      drawLabel(config.dimA, (A.x + B.x) / 2, A.y - 18, stroke);
      drawLabel(config.dimB, (H.x + C.x) / 2, D.y + 22, stroke);
      drawLabel(config.dimC, H.x + 15, (A.y + H.y) / 2, '#DC2626');
      break;
    }

    case 'rhombus': {
      const rx = S * 1.1;
      const ry = S * 0.78;
      const A = { x: cx, y: cy - ry };
      const B = { x: cx + rx, y: cy };
      const C = { x: cx, y: cy + ry };
      const D = { x: cx - rx, y: cy };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(B.x, B.y);
      ctx.lineTo(C.x, C.y);
      ctx.lineTo(D.x, D.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Diagonals
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y);
      ctx.lineTo(C.x, C.y);
      ctx.moveTo(D.x, D.y);
      ctx.lineTo(B.x, B.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, cx, cy, 0, -1, 1, 0, 13);
        drawTickMark(ctx, A.x, A.y, B.x, B.y, 1);
        drawTickMark(ctx, B.x, B.y, C.x, C.y, 1);
        drawTickMark(ctx, C.x, C.y, D.x, D.y, 1);
        drawTickMark(ctx, D.x, D.y, A.x, A.y, 1);
      }
      drawLabel('A', A.x, A.y - 18, '#0F172A', false);
      drawLabel('B', B.x + 18, B.y, '#0F172A', false);
      drawLabel('C', C.x, C.y + 18, '#0F172A', false);
      drawLabel('D', D.x - 18, D.y, '#0F172A', false);
      drawLabel('O', cx - 14, cy + 14, '#DC2626', false);
      drawLabel(config.dimA, (A.x + D.x) / 2 - 18, (A.y + D.y) / 2 - 10, stroke);
      drawLabel(config.dimB, cx + rx * 0.5, cy - 14, '#DC2626');
      drawLabel(config.dimC, cx + 18, cy + ry * 0.45, '#DC2626');
      break;
    }

    case 'circle_parts': {
      const r = S * 0.92;
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Diameter horizontal dashed
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy);
      ctx.lineTo(cx + r, cy);
      ctx.stroke();
      ctx.restore();

      // Radius to tangent point T at -35 deg
      const angT = -Math.PI * 0.22;
      const tx = cx + r * Math.cos(angT);
      const ty = cy + r * Math.sin(angT);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Tangent line perpendicular to OT
      const tanX = -Math.sin(angT);
      const tanY = Math.cos(angT);
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2.1;
      ctx.beginPath();
      ctx.moveTo(tx - tanX * r * 0.72, ty - tanY * r * 0.72);
      ctx.lineTo(tx + tanX * r * 0.72, ty + tanY * r * 0.72);
      ctx.stroke();

      // Chord AB on lower half
      const a1 = Math.PI * 0.72;
      const a2 = Math.PI * 0.22;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx + r * Math.cos(a1), cy + r * Math.sin(a1));
      ctx.lineTo(cx + r * Math.cos(a2), cy + r * Math.sin(a2));
      ctx.stroke();

      if (config.showMarks) {
        drawRightAngleBox(ctx, tx, ty, cx - tx, cy - ty, tanX, tanY, 13);
      }

      // Center & Tangent dots
      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(tx, ty, 4, 0, Math.PI * 2);
      ctx.fill();

      drawLabel(config.dimB, cx - 14, cy + 16, '#0F172A', false);
      drawLabel(config.dimA, (cx + tx) / 2 - 12, (cy + ty) / 2 - 12, '#DC2626');
      drawLabel(config.dimC, tx + 16, ty - 12, '#059669', false);
      drawLabel('A', cx + r * Math.cos(a1) - 14, cy + r * Math.sin(a1) + 12, '#0F172A', false);
      drawLabel('B', cx + r * Math.cos(a2) + 14, cy + r * Math.sin(a2) + 12, '#0F172A', false);
      break;
    }

    case 'unit_circle': {
      const r = S * 0.92;
      // Axes
      ctx.strokeStyle = '#475569';
      ctx.fillStyle = '#475569';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(cx - r * 1.32, cy);
      ctx.lineTo(cx + r * 1.32, cy);
      ctx.moveTo(cx, cy + r * 1.25);
      ctx.lineTo(cx, cy - r * 1.25);
      ctx.stroke();
      drawArrowhead(ctx, cx + r, cy, cx + r * 1.34, cy, 8);
      drawArrowhead(ctx, cx, cy - r, cx, cy - r * 1.27, 8);

      // Circle
      ctx.strokeStyle = stroke;
      ctx.fillStyle = fillSoft;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Angle theta = 40 deg
      const theta = -Math.PI * 0.23;
      const mx = cx + r * Math.cos(theta);
      const my = cy + r * Math.sin(theta);

      // Projections
      ctx.save();
      ctx.setLineDash([5, 4]);
      ctx.strokeStyle = '#64748B';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx, cy);
      ctx.moveTo(mx, my);
      ctx.lineTo(cx, my);
      ctx.stroke();
      ctx.restore();

      // cos & sin highlight bars
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx, cy);
      ctx.stroke();

      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, my);
      ctx.stroke();

      // Radius OM
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(mx, my);
      ctx.stroke();

      if (config.showMarks) {
        ctx.strokeStyle = '#059669';
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.arc(cx, cy, 32, theta, 0);
        ctx.stroke();
      }

      ctx.fillStyle = stroke;
      ctx.beginPath();
      ctx.arc(mx, my, 4.5, 0, Math.PI * 2);
      ctx.fill();

      drawLabel('M', mx + 14, my - 12, stroke, false);
      drawLabel(config.dimA, cx + 44, cy - 15, '#059669');
      drawLabel(config.dimB, (cx + mx) / 2, cy + 18, '#2563EB');
      drawLabel(config.dimC, cx - 28, (cy + my) / 2, '#DC2626');
      drawLabel('1', cx + r + 14, cy + 16, '#475569', false);
      drawLabel('π/2', cx + 22, cy - r - 14, '#475569', false);
      drawLabel('π', cx - r - 16, cy + 16, '#475569', false);
      break;
    }

    // ==================== 3D SOLID GEOMETRY FIGURES ====================
    case 'cube': {
      const a = S * 1.1;
      const dx = a * 0.42;
      const dy = -a * 0.34;
      const x0 = cx - a * 0.65;
      const y0 = cy - a * 0.35;
      // Front face: A(tl), B(tr), C(br), D(bl)
      const A = { x: x0, y: y0 };
      const B = { x: x0 + a, y: y0 };
      const C = { x: x0 + a, y: y0 + a };
      const D = { x: x0, y: y0 + a };
      const A1 = { x: A.x + dx, y: A.y + dy };
      const B1 = { x: B.x + dx, y: B.y + dy };
      const C1 = { x: C.x + dx, y: C.y + dy };
      const D1 = { x: D.x + dx, y: D.y + dy };

      // Fill visible faces
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y);
      ctx.closePath(); ctx.fill();

      ctx.fillStyle = fillMid;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(B.x, B.y);
      ctx.closePath(); ctx.fill();

      ctx.beginPath();
      ctx.moveTo(B.x, B.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.lineTo(C.x, C.y);
      ctx.closePath(); ctx.fill();

      // Hidden back edges (dashed)
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(D1.x, D1.y); ctx.lineTo(A1.x, A1.y);
      ctx.moveTo(D1.x, D1.y); ctx.lineTo(C1.x, C1.y);
      ctx.moveTo(D1.x, D1.y); ctx.lineTo(D.x, D.y);
      ctx.stroke();
      ctx.restore();

      // Visible edges (solid)
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y); ctx.closePath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(B.x, B.y);
      ctx.moveTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.lineTo(C.x, C.y);
      ctx.stroke();

      drawLabel("A'", A.x - 14, A.y - 6, '#0F172A', false);
      drawLabel("B'", B.x + 12, B.y - 8, '#0F172A', false);
      drawLabel("C'", B1.x + 14, B1.y - 8, '#0F172A', false);
      drawLabel("D'", A1.x - 14, A1.y - 8, '#0F172A', false);
      drawLabel('A', D.x - 14, D.y + 12, '#0F172A', false);
      drawLabel('B', C.x + 12, C.y + 14, '#0F172A', false);
      drawLabel('C', C1.x + 14, C1.y + 8, '#0F172A', false);
      drawLabel('D', D1.x - 14, D1.y - 6, '#64748B', false);
      drawLabel(config.dimA, (D.x + C.x) / 2, D.y + 20, stroke);
      drawLabel(config.dimA, D.x - 18, (A.y + D.y) / 2, stroke);
      drawLabel(config.dimA, (C.x + C1.x) / 2 + 16, (C.y + C1.y) / 2 + 10, stroke);
      break;
    }

    case 'rectangular_prism': {
      const w = S * 1.45;
      const h = S * 0.92;
      const dx = S * 0.56;
      const dy = -S * 0.36;
      const x0 = cx - w * 0.62;
      const y0 = cy - h * 0.32;
      const A = { x: x0, y: y0 };
      const B = { x: x0 + w, y: y0 };
      const C = { x: x0 + w, y: y0 + h };
      const D = { x: x0, y: y0 + h };
      const A1 = { x: A.x + dx, y: A.y + dy };
      const B1 = { x: B.x + dx, y: B.y + dy };
      const C1 = { x: C.x + dx, y: C.y + dy };
      const D1 = { x: D.x + dx, y: D.y + dy };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fillMid;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(B.x, B.y);
      ctx.closePath(); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(B.x, B.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.lineTo(C.x, C.y);
      ctx.closePath(); ctx.fill();

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(D1.x, D1.y); ctx.lineTo(A1.x, A1.y);
      ctx.moveTo(D1.x, D1.y); ctx.lineTo(C1.x, C1.y);
      ctx.moveTo(D1.x, D1.y); ctx.lineTo(D.x, D.y);
      ctx.stroke();
      ctx.restore();

      // Space diagonal
      if (config.showMarks) {
        ctx.save();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#DC2626';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(D.x, D.y);
        ctx.lineTo(B1.x, B1.y);
        ctx.stroke();
        ctx.restore();
      }

      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y); ctx.lineTo(D.x, D.y); ctx.closePath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(B.x, B.y);
      ctx.moveTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.lineTo(C.x, C.y);
      ctx.stroke();

      drawLabel(config.dimA, (D.x + C.x) / 2, D.y + 20, stroke);
      drawLabel(config.dimB, (C.x + C1.x) / 2 + 16, (C.y + C1.y) / 2 + 12, stroke);
      drawLabel(config.dimC, D.x - 18, (A.y + D.y) / 2, stroke);
      break;
    }

    case 'triangular_prism': {
      const h = S * 1.15;
      const A = { x: cx - S * 0.78, y: cy + S * 0.6 };
      const B = { x: cx + S * 0.85, y: cy + S * 0.6 };
      const C = { x: cx + S * 0.15, y: cy + S * 0.15 };
      const A1 = { x: A.x, y: A.y - h };
      const B1 = { x: B.x, y: B.y - h };
      const C1 = { x: C.x, y: C.y - h };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(A1.x, A1.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fillMid;
      ctx.beginPath();
      ctx.moveTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y);
      ctx.closePath(); ctx.fill();

      // Hidden back edges
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y);
      ctx.moveTo(B.x, B.y); ctx.lineTo(C.x, C.y);
      ctx.moveTo(C.x, C.y); ctx.lineTo(C1.x, C1.y);
      ctx.stroke();
      ctx.restore();

      // Solid visible edges
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      ctx.moveTo(A.x, A.y); ctx.lineTo(A1.x, A1.y);
      ctx.moveTo(B.x, B.y); ctx.lineTo(B1.x, B1.y);
      ctx.moveTo(A1.x, A1.y); ctx.lineTo(B1.x, B1.y); ctx.lineTo(C1.x, C1.y); ctx.closePath();
      ctx.stroke();

      drawLabel('A', A.x - 16, A.y + 10, '#0F172A', false);
      drawLabel('B', B.x + 16, B.y + 10, '#0F172A', false);
      drawLabel('C', C.x + 14, C.y - 6, '#64748B', false);
      drawLabel("A'", A1.x - 16, A1.y - 6, '#0F172A', false);
      drawLabel("B'", B1.x + 16, B1.y - 6, '#0F172A', false);
      drawLabel("C'", C1.x, C1.y - 16, '#0F172A', false);
      drawLabel(config.dimB, (A.x + B.x) / 2, A.y + 20, stroke);
      drawLabel(config.dimC, A.x - 20, (A.y + A1.y) / 2, '#DC2626');
      break;
    }

    case 'cylinder': {
      const rx = S * 0.78;
      const ry = S * 0.25;
      const h = S * 1.28;
      const topY = cy - h / 2;
      const botY = cy + h / 2;

      // Body fill
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY);
      ctx.lineTo(cx - rx, botY);
      ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, 0, true);
      ctx.lineTo(cx + rx, topY);
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI, true);
      ctx.closePath();
      ctx.fill();

      // Top ellipse
      ctx.fillStyle = fillMid;
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Side walls
      ctx.beginPath();
      ctx.moveTo(cx - rx, topY); ctx.lineTo(cx - rx, botY);
      ctx.moveTo(cx + rx, topY); ctx.lineTo(cx + rx, botY);
      ctx.stroke();

      // Bottom front arc (solid)
      ctx.beginPath();
      ctx.ellipse(cx, botY, rx, ry, 0, 0, Math.PI, false);
      ctx.stroke();

      // Bottom back arc (dashed)
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(cx, botY, rx, ry, 0, Math.PI, Math.PI * 2, false);
      ctx.stroke();

      // Axis & radius
      ctx.strokeStyle = '#DC2626';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(cx, topY); ctx.lineTo(cx, botY);
      ctx.moveTo(cx, botY); ctx.lineTo(cx + rx, botY);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, cx, botY, 0, -1, 1, 0, 12);
      }

      drawLabel(config.dimC, cx - 14, botY + 8, '#0F172A', false);
      drawLabel("O'", cx - 16, topY - 4, '#0F172A', false);
      drawLabel(config.dimA, cx + rx * 0.5, botY - 12, '#DC2626');
      drawLabel(config.dimB, cx - 16, cy, '#DC2626');
      break;
    }

    case 'cone': {
      const rx = S * 0.82;
      const ry = S * 0.25;
      const apex = { x: cx, y: cy - S * 0.85 };
      const baseY = cy + S * 0.62;

      // Body fill
      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y);
      ctx.lineTo(cx - rx, baseY);
      ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, 0, true);
      ctx.closePath();
      ctx.fill();

      // Slant edges
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y); ctx.lineTo(cx - rx, baseY);
      ctx.moveTo(apex.x, apex.y); ctx.lineTo(cx + rx, baseY);
      ctx.stroke();

      // Base front arc
      ctx.beginPath();
      ctx.ellipse(cx, baseY, rx, ry, 0, 0, Math.PI, false);
      ctx.stroke();

      // Base back arc + height + radius (dashed)
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.ellipse(cx, baseY, rx, ry, 0, Math.PI, Math.PI * 2, false);
      ctx.stroke();

      ctx.strokeStyle = '#DC2626';
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(apex.x, apex.y); ctx.lineTo(cx, baseY);
      ctx.moveTo(cx, baseY); ctx.lineTo(cx + rx, baseY);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, cx, baseY, 0, -1, 1, 0, 12);
      }

      drawLabel('S', apex.x, apex.y - 16, '#0F172A', false);
      drawLabel('O', cx - 14, baseY + 10, '#0F172A', false);
      drawLabel(config.dimB, cx - 16, (apex.y + baseY) / 2, '#DC2626');
      drawLabel(config.dimA, cx + rx * 0.5, baseY - 12, '#DC2626');
      drawLabel(config.dimC, (apex.x + cx + rx) / 2 + 16, (apex.y + baseY) / 2 - 4, stroke);
      break;
    }

    case 'square_pyramid': {
      const Spt = { x: cx, y: cy - S * 0.88 };
      const A = { x: cx - S * 0.45, y: cy + S * 0.25 };
      const B = { x: cx + S * 0.92, y: cy + S * 0.25 };
      const C = { x: cx + S * 0.48, y: cy + S * 0.72 };
      const D = { x: cx - S * 0.9, y: cy + S * 0.72 };
      const H = { x: (A.x + C.x) / 2, y: (A.y + C.y) / 2 };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(D.x, D.y); ctx.lineTo(C.x, C.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fillMid;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(C.x, C.y); ctx.lineTo(B.x, B.y);
      ctx.closePath(); ctx.fill();

      // Hidden back edges + base diagonals + height
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(A.x, A.y);
      ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      ctx.moveTo(A.x, A.y); ctx.lineTo(D.x, D.y);
      ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y);
      ctx.moveTo(B.x, B.y); ctx.lineTo(D.x, D.y);
      ctx.stroke();

      ctx.strokeStyle = '#DC2626';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 12);
      }

      // Visible edges
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(D.x, D.y); ctx.lineTo(C.x, C.y); ctx.lineTo(B.x, B.y);
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(C.x, C.y);
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(B.x, B.y);
      ctx.stroke();

      drawLabel(config.dimC, Spt.x, Spt.y - 16, '#0F172A', false);
      drawLabel('A', A.x - 14, A.y - 8, '#64748B', false);
      drawLabel('B', B.x + 16, B.y + 4, '#0F172A', false);
      drawLabel('C', C.x + 14, C.y + 14, '#0F172A', false);
      drawLabel('D', D.x - 16, D.y + 12, '#0F172A', false);
      drawLabel('O', H.x + 14, H.y + 10, '#DC2626', false);
      drawLabel(config.dimA, (D.x + C.x) / 2, D.y + 20, stroke);
      drawLabel(config.dimB, H.x - 16, (Spt.y + H.y) / 2, '#DC2626');
      break;
    }

    case 'tetrahedron': {
      const Spt = { x: cx - S * 0.05, y: cy - S * 0.88 };
      const A = { x: cx - S * 0.92, y: cy + S * 0.45 };
      const B = { x: cx + S * 0.12, y: cy + S * 0.78 };
      const C = { x: cx + S * 0.95, y: cy + S * 0.3 };
      const H = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 };

      ctx.fillStyle = fillSoft;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(A.x, A.y); ctx.lineTo(B.x, B.y);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = fillMid;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y);
      ctx.closePath(); ctx.fill();

      // Back edge AC + height SH
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.6;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(A.x, A.y); ctx.lineTo(C.x, C.y);
      ctx.stroke();

      ctx.strokeStyle = '#DC2626';
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(H.x, H.y);
      ctx.stroke();
      ctx.restore();

      if (config.showMarks) {
        drawRightAngleBox(ctx, H.x, H.y, 0, -1, 1, 0, 12);
      }

      // Visible edges
      ctx.beginPath();
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.lineTo(C.x, C.y);
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(B.x, B.y);
      ctx.moveTo(Spt.x, Spt.y); ctx.lineTo(C.x, C.y);
      ctx.stroke();

      drawLabel(config.dimC, Spt.x, Spt.y - 16, '#0F172A', false);
      drawLabel('A', A.x - 16, A.y + 8, '#0F172A', false);
      drawLabel('B', B.x, B.y + 18, '#0F172A', false);
      drawLabel('C', C.x + 16, C.y + 6, '#0F172A', false);
      drawLabel('H', H.x + 14, H.y + 10, '#DC2626', false);
      drawLabel(config.dimA, (A.x + B.x) / 2 - 14, (A.y + B.y) / 2 + 14, stroke);
      drawLabel(config.dimB, H.x - 16, (Spt.y + H.y) / 2, '#DC2626');
      break;
    }

    case 'sphere_solid': {
      const r = S * 0.95;
      // Subtle radial 3D shading
      const grad = ctx.createRadialGradient(cx - r * 0.32, cy - r * 0.32, r * 0.08, cx, cy, r);
      grad.addColorStop(0, '#FFFFFF');
      grad.addColorStop(0.55, hexToRgba(stroke, 0.1));
      grad.addColorStop(1, hexToRgba(stroke, 0.24));
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Equator front solid + back dashed
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.28, 0, 0, Math.PI, false);
      ctx.stroke();

      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 1.7;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r, r * 0.28, 0, Math.PI, Math.PI * 2, false);
      ctx.stroke();
      ctx.restore();

      // Radius vector
      const ang = -Math.PI * 0.22;
      const rx = cx + r * Math.cos(ang);
      const ry = cy + r * Math.sin(ang);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(rx, ry);
      ctx.stroke();

      ctx.fillStyle = '#0F172A';
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      drawLabel(config.dimB, cx - 14, cy + 12, '#0F172A', false);
      drawLabel(config.dimA, (cx + rx) / 2 - 12, (cy + ry) / 2 - 12, '#DC2626');
      break;
    }
  }

  // Optional Formula Banner at bottom
  if (config.showFormula) {
    ctx.save();
    ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace';
    const text = meta.formula;
    const tw = ctx.measureText(text).width;
    const bx = Math.max(16, (width - tw - 28) / 2);
    const by = height - 42;
    ctx.fillStyle = '#F8FAFC';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(bx, by, tw + 28, 28, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, by + 14);
    ctx.restore();
  }

  ctx.restore();
}
