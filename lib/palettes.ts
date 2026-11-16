export type PaletteId = 'vibrant' | 'classroom' | 'sunset' | 'ocean';

export interface WheelPalette {
  id: PaletteId;
  nameKm: string;
  nameEn: string;
  colors: string[];
}

export const WHEEL_PALETTES: Record<PaletteId, WheelPalette> = {
  vibrant: {
    id: 'vibrant',
    nameKm: 'ពណ៌ស្រស់ឆើត',
    nameEn: 'Vibrant Play',
    colors: [
      '#FF5A5F', // Coral Red
      '#FBBF24', // Sunflower Yellow
      '#10B981', // Mint Green
      '#8B5CF6', // Amethyst Purple
      '#3B82F6', // Electric Blue
      '#FB923C', // Warm Tangerine
    ],
  },
  classroom: {
    id: 'classroom',
    nameKm: 'ថ្នាក់រៀន',
    nameEn: 'Classroom Crisp',
    colors: [
      '#4F46E5', // Indigo
      '#10B981', // Mint Green
      '#FBBF24', // Sunflower Yellow
      '#F43F5E', // Coral Rose
      '#0EA5E9', // Sky Blue
      '#A855F7', // Amethyst
    ],
  },
  sunset: {
    id: 'sunset',
    nameKm: 'ថ្ងៃលិចកក់ក្តៅ',
    nameEn: 'Warm Sunset',
    colors: [
      '#F43F5E',
      '#F59E0B',
      '#FB7185',
      '#8B5CF6',
      '#F97316',
      '#EC4899',
    ],
  },
  ocean: {
    id: 'ocean',
    nameKm: 'មហាសមុទ្រ',
    nameEn: 'Ocean Breeze',
    colors: [
      '#3B82F6',
      '#10B981',
      '#06B6D4',
      '#4F46E5',
      '#14B8A6',
      '#6366F1',
    ],
  },
};

export function getSegmentColors(count: number, paletteId: PaletteId): string[] {
  const palette = WHEEL_PALETTES[paletteId]?.colors ?? WHEEL_PALETTES.vibrant.colors;
  if (count <= 0) return [];
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    let color = palette[i % palette.length];
    // Prevent last segment from matching first segment when count % palette.length === 1
    if (i === count - 1 && count > 1 && color === result[0]) {
      color = palette[(i + 1) % palette.length];
    }
    result.push(color);
  }
  return result;
}

export function getContrastTextColor(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return '#FFFFFF';
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  // Relative luminance (WCAG)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.68 ? '#0F172A' : '#FFFFFF';
}
