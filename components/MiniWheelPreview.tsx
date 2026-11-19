'use client';

import React from 'react';
import { getSegmentColors, type PaletteId } from '@/lib/palettes';

interface MiniWheelPreviewProps {
  entriesCount: number;
  paletteId: PaletteId;
  size?: number;
}

export function MiniWheelPreview({
  entriesCount,
  paletteId,
  size = 56,
}: MiniWheelPreviewProps) {
  const sliceCount = Math.min(Math.max(entriesCount, 4), 12);
  const colors = getSegmentColors(sliceCount, paletteId);
  const cx = 50;
  const cy = 50;
  const r = 44;
  const sliceAngle = 360 / sliceCount;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className="shrink-0 drop-shadow-sm"
      aria-hidden="true"
    >
      {colors.map((color, idx) => {
        const startDeg = idx * sliceAngle;
        const endDeg = (idx + 1) * sliceAngle;
        const startRad = ((startDeg - 90) * Math.PI) / 180;
        const endRad = ((endDeg - 90) * Math.PI) / 180;
        const round2 = (n: number) => {
          const rVal = Math.round(n * 100) / 100;
          return Object.is(rVal, -0) ? 0 : rVal;
        };
        const x1 = round2(cx + r * Math.cos(startRad));
        const y1 = round2(cy + r * Math.sin(startRad));
        const x2 = round2(cx + r * Math.cos(endRad));
        const y2 = round2(cy + r * Math.sin(endRad));
        const largeArc = sliceAngle > 180 ? 1 : 0;
        return (
          <path
            key={idx}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
            fill={color}
            stroke="#FFFFFF"
            strokeWidth="1.5"
          />
        );
      })}
      <circle cx={cx} cy={cy} r="44" fill="none" stroke="rgba(15,23,42,0.1)" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="11" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2.5" />
    </svg>
  );
}
