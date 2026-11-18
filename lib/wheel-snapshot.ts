import {
  WHEEL_PALETTES,
  getContrastTextColor,
  getSegmentColors,
  type PaletteId,
} from './palettes';
import type { Language } from './i18n';

export interface WheelSnapshotOptions {
  title: string;
  entries: string[];
  paletteId: PaletteId;
  language: Language;
  theme?: 'light' | 'dark';
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
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function truncateTextToWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let end = text.length;
  while (end > 1 && ctx.measureText(`${text.slice(0, end)}…`).width > maxWidth) {
    end -= 1;
  }
  return `${text.slice(0, Math.max(1, end))}…`;
}

function sanitizeFilename(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return cleaned || 'pickerwel-wheel';
}

export async function exportWheelSnapshotPng({
  title,
  entries,
  paletteId,
  language,
  theme = 'light',
}: WheelSnapshotOptions): Promise<void> {
  if (typeof document === 'undefined' || entries.length === 0) return;

  // Wait briefly for web fonts (Kantumruy Pro / Siemreap / Poppins) to settle
  if ('fonts' in document && document.fonts?.ready) {
    await Promise.race([
      document.fonts.ready,
      new Promise<void>((resolve) => setTimeout(resolve, 350)),
    ]);
  }

  const width = 1600;
  const height = 1000;
  const exportScale = 2; // 3200x2000 high-resolution PNG for social media sharing
  const canvas = document.createElement('canvas');
  canvas.width = width * exportScale;
  canvas.height = height * exportScale;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.scale(exportScale, exportScale);

  const isDark = theme === 'dark';
  const bgCanvas = isDark ? '#0B1220' : '#F1F5F9';
  const cardBg = isDark ? '#0F172A' : '#FFFFFF';
  const cardBorder = isDark ? '#1E293B' : '#E2E8F0';
  const subtleSurface = isDark ? '#1E293B' : '#F8FAFC';
  const textPrimary = isDark ? '#F8FAFC' : '#0F172A';
  const textMuted = isDark ? '#94A3B8' : '#64748B';

  const displayFont =
    '"Kantumruy Pro", "Poppins", system-ui, -apple-system, sans-serif';
  const bodyFont =
    '"Siemreap", "Poppins", system-ui, -apple-system, sans-serif';

  // Outer canvas background
  ctx.fillStyle = bgCanvas;
  ctx.fillRect(0, 0, width, height);

  // Main rounded presentation card
  const pad = 44;
  drawRoundedRect(ctx, pad, pad, width - pad * 2, height - pad * 2, 36);
  ctx.fillStyle = cardBg;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = cardBorder;
  ctx.stroke();

  // Header bar
  const cleanTitle =
    title.trim() ||
    (language === 'km' ? 'កងវិលគ្មានចំណងជើង' : 'Untitled Wheel');
  const pal = WHEEL_PALETTES[paletteId] ?? WHEEL_PALETTES.vibrant;
  const palName = language === 'km' ? pal.nameKm : pal.nameEn;
  const itemsLabel =
    language === 'km' ? `${entries.length} ជម្រើស` : `${entries.length} segments`;

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = textPrimary;
  ctx.font = `700 40px ${displayFont}`;
  const headerTitle = truncateTextToWidth(ctx, cleanTitle, 1020);
  ctx.fillText(headerTitle, 96, 86);

  ctx.fillStyle = textMuted;
  ctx.font = `500 22px ${bodyFont}`;
  ctx.fillText(`${itemsLabel}  ·  ${palName}`, 96, 142);

  // Right-aligned brand mark & activity subtitle
  ctx.textAlign = 'right';
  ctx.fillStyle = '#3B82F6';
  ctx.font = `700 30px "Poppins", system-ui, sans-serif`;
  ctx.fillText('Pickerwel', width - 96, 88);

  ctx.fillStyle = textMuted;
  ctx.font = `500 16px ${bodyFont}`;
  ctx.fillText(
    language === 'km' ? 'សកម្មភាពថ្នាក់រៀន' : 'Classroom Activity',
    width - 96,
    130
  );

  // Hairline header divider
  ctx.strokeStyle = cardBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(96, 192);
  ctx.lineTo(width - 96, 192);
  ctx.stroke();

  // Wheel geometry (left side)
  const cx = 480;
  const cy = 574;
  const radius = 318;
  const colors = getSegmentColors(entries.length, paletteId);
  const count = entries.length;
  const sliceRad = (Math.PI * 2) / count;

  // Bezel drop shadow + rim
  ctx.save();
  ctx.shadowColor = isDark ? 'rgba(0, 0, 0, 0.55)' : 'rgba(15, 23, 42, 0.16)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 14;
  ctx.beginPath();
  ctx.arc(cx, cy, radius + 16, 0, Math.PI * 2);
  ctx.fillStyle = isDark ? '#1E293B' : '#FFFFFF';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius + 16, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = isDark ? '#334155' : '#E2E8F0';
  ctx.stroke();

  // Draw slices starting at 12 o'clock (-PI/2)
  const labelFontSize =
    count <= 8 ? 22 : count <= 14 ? 18 : count <= 24 ? 14 : count <= 36 ? 11 : 9;

  for (let i = 0; i < count; i++) {
    const startAngle = -Math.PI / 2 + i * sliceRad;
    const endAngle = startAngle + sliceRad;
    const midAngle = startAngle + sliceRad / 2;
    const fill = colors[i] || '#3B82F6';

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();

    if (count > 1) {
      ctx.lineWidth = count > 40 ? 1.2 : 3;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    if (count <= 48) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(midAngle);
      ctx.fillStyle = getContrastTextColor(fill);
      ctx.font = `600 ${labelFontSize}px ${displayFont}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = truncateTextToWidth(ctx, entries[i], radius * 0.52);
      ctx.fillText(label, radius * 0.62, 0);
      ctx.restore();
    }
  }

  // Rim pegs
  if (count >= 2 && count <= 60) {
    const pegRadius = count > 24 ? 3.5 : 5;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + i * sliceRad;
      const px = cx + (radius + 6) * Math.cos(a);
      const py = cy + (radius + 6) * Math.sin(a);
      ctx.beginPath();
      ctx.arc(px, py, pegRadius, 0, Math.PI * 2);
      ctx.fillStyle = isDark ? '#F1F5F9' : '#1E293B';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = isDark ? '#0F172A' : '#FFFFFF';
      ctx.stroke();
    }
  }

  // Center SPIN hub
  const hubRadius = 56;
  const hubGrad = ctx.createLinearGradient(
    cx - hubRadius,
    cy - hubRadius,
    cx + hubRadius,
    cy + hubRadius
  );
  hubGrad.addColorStop(0, '#3B82F6');
  hubGrad.addColorStop(1, '#4F46E5');

  ctx.beginPath();
  ctx.arc(cx, cy, hubRadius, 0, Math.PI * 2);
  ctx.fillStyle = hubGrad;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = isDark ? '#0F172A' : '#FFFFFF';
  ctx.stroke();

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 22px "Poppins", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPIN', cx, cy + 1);

  // Top 12-o'clock Clapper Pointer
  ctx.save();
  ctx.translate(cx, cy - radius - 26);
  ctx.beginPath();
  ctx.moveTo(0, 44);
  ctx.lineTo(-16, 4);
  ctx.quadraticCurveTo(-18, -6, -6, -6);
  ctx.lineTo(6, -6);
  ctx.quadraticCurveTo(18, -6, 16, 4);
  ctx.closePath();
  ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = isDark ? '#0F172A' : '#FFFFFF';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 8, 5.5, 0, Math.PI * 2);
  ctx.fillStyle = '#3B82F6';
  ctx.fill();
  ctx.restore();

  // Right Segments Legend Panel
  const panelX = 880;
  const panelY = 230;
  const panelW = 624;
  const panelH = 684;

  drawRoundedRect(ctx, panelX, panelY, panelW, panelH, 24);
  ctx.fillStyle = subtleSurface;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = cardBorder;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = textPrimary;
  ctx.font = `700 22px ${displayFont}`;
  ctx.fillText(
    language === 'km' ? 'បញ្ជីជម្រើសក្នុងកងវិល' : 'Wheel Segments',
    panelX + 28,
    panelY + 24
  );

  ctx.textAlign = 'right';
  ctx.fillStyle = textMuted;
  ctx.font = `600 18px "Poppins", system-ui, sans-serif`;
  ctx.fillText(`${count}`, panelX + panelW - 28, panelY + 27);

  // Divider inside legend panel
  ctx.strokeStyle = cardBorder;
  ctx.beginPath();
  ctx.moveTo(panelX + 24, panelY + 64);
  ctx.lineTo(panelX + panelW - 24, panelY + 64);
  ctx.stroke();

  const useTwoCols = count > 12;
  const maxVisible = useTwoCols ? 26 : 12;
  const visibleCount = Math.min(count, maxVisible);
  const colWidth = useTwoCols ? (panelW - 72) / 2 : panelW - 56;
  const rowHeight = useTwoCols ? 42 : 46;

  for (let i = 0; i < visibleCount; i++) {
    const colIdx = useTwoCols && i >= 13 ? 1 : 0;
    const rowIdx = useTwoCols ? i % 13 : i;
    const itemX = panelX + 28 + colIdx * (colWidth + 16);
    const itemY = panelY + 84 + rowIdx * rowHeight;

    // Color dot
    ctx.beginPath();
    ctx.arc(itemX + 8, itemY + 13, 6.5, 0, Math.PI * 2);
    ctx.fillStyle = colors[i] || '#3B82F6';
    ctx.fill();

    // Index
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = textMuted;
    ctx.font = `600 15px "Poppins", system-ui, sans-serif`;
    ctx.fillText(`${i + 1}.`, itemX + 24, itemY + 4);

    // Label text
    ctx.fillStyle = textPrimary;
    ctx.font = `500 18px ${bodyFont}`;
    const maxLabelWidth = colWidth - 62;
    const safeItem = truncateTextToWidth(ctx, entries[i], maxLabelWidth);
    ctx.fillText(safeItem, itemX + 54, itemY + 1);
  }

  if (count > maxVisible) {
    const remaining = count - maxVisible;
    ctx.textAlign = 'center';
    ctx.fillStyle = textMuted;
    ctx.font = `600 17px ${bodyFont}`;
    ctx.fillText(
      language === 'km'
        ? `+ ${remaining} ជម្រើសផ្សេងទៀត`
        : `+ ${remaining} more segments`,
      panelX + panelW / 2,
      panelY + panelH - 40
    );
  }

  // Trigger PNG download
  const fileName = `${sanitizeFilename(cleanTitle)}-wheel.png`;
  const triggerUrlDownload = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (typeof canvas.toBlob === 'function') {
    await new Promise<void>((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          triggerUrlDownload(url);
          setTimeout(() => URL.revokeObjectURL(url), 1500);
        } else {
          triggerUrlDownload(canvas.toDataURL('image/png'));
        }
        resolve();
      }, 'image/png');
    });
  } else {
    triggerUrlDownload(canvas.toDataURL('image/png'));
  }
}
