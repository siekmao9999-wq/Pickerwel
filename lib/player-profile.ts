export type PresetAvatarIconKey =
  | 'smile'
  | 'cat'
  | 'dog'
  | 'bird'
  | 'fish'
  | 'rocket'
  | 'crown'
  | 'star'
  | 'flame'
  | 'heart'
  | 'gamepad'
  | 'sparkles';

export interface PresetAvatar {
  id: string;
  labelKm: string;
  labelEn: string;
  gradientClass: string;
  iconKey: PresetAvatarIconKey;
}

export interface GuestPlayerProfile {
  name: string;
  avatarId: string;
  customPhotoDataUrl?: string;
  updatedAtMs: number;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  {
    id: 'smile',
    labelKm: 'ញញឹម',
    labelEn: 'Smile',
    gradientClass: 'from-blue-500 to-indigo-600',
    iconKey: 'smile',
  },
  {
    id: 'cat',
    labelKm: 'ឆ្មា',
    labelEn: 'Cat',
    gradientClass: 'from-amber-400 to-orange-500',
    iconKey: 'cat',
  },
  {
    id: 'dog',
    labelKm: 'ឆ្កែ',
    labelEn: 'Dog',
    gradientClass: 'from-orange-500 to-rose-500',
    iconKey: 'dog',
  },
  {
    id: 'bird',
    labelKm: 'បក្សី',
    labelEn: 'Bird',
    gradientClass: 'from-sky-400 to-cyan-600',
    iconKey: 'bird',
  },
  {
    id: 'fish',
    labelKm: 'ត្រី',
    labelEn: 'Fish',
    gradientClass: 'from-teal-400 to-emerald-600',
    iconKey: 'fish',
  },
  {
    id: 'rocket',
    labelKm: 'រ៉ុក្កែត',
    labelEn: 'Rocket',
    gradientClass: 'from-violet-500 to-purple-600',
    iconKey: 'rocket',
  },
  {
    id: 'crown',
    labelKm: 'ម្កុដ',
    labelEn: 'Crown',
    gradientClass: 'from-yellow-400 to-amber-500',
    iconKey: 'crown',
  },
  {
    id: 'star',
    labelKm: 'ផ្កាយ',
    labelEn: 'Star',
    gradientClass: 'from-indigo-500 to-blue-600',
    iconKey: 'star',
  },
  {
    id: 'flame',
    labelKm: 'ភ្លើង',
    labelEn: 'Flame',
    gradientClass: 'from-rose-500 to-red-600',
    iconKey: 'flame',
  },
  {
    id: 'heart',
    labelKm: 'បេះដូង',
    labelEn: 'Heart',
    gradientClass: 'from-pink-500 to-rose-500',
    iconKey: 'heart',
  },
  {
    id: 'gamepad',
    labelKm: 'ហ្គេម',
    labelEn: 'Gamer',
    gradientClass: 'from-emerald-500 to-teal-600',
    iconKey: 'gamepad',
  },
  {
    id: 'sparkles',
    labelKm: 'ពន្លឺ',
    labelEn: 'Spark',
    gradientClass: 'from-fuchsia-500 to-purple-600',
    iconKey: 'sparkles',
  },
];

const PLAYER_PROFILE_STORAGE_KEY = 'pickerwel_guest_player_v1';
const PLAYER_PROFILE_EVENT = 'pickerwel-guest-player-updated';

let cachedRaw: string | null = null;
let cachedProfile: GuestPlayerProfile | null = null;

export function findPresetAvatar(avatarId?: string): PresetAvatar {
  return (
    PRESET_AVATARS.find((a) => a.id === avatarId) || PRESET_AVATARS[0]
  );
}

export function isValidPlayerProfile(
  profile: GuestPlayerProfile | null
): profile is GuestPlayerProfile {
  if (!profile) return false;
  const hasName = typeof profile.name === 'string' && profile.name.trim().length > 0;
  const hasAvatar =
    (typeof profile.avatarId === 'string' &&
      profile.avatarId.trim().length > 0 &&
      PRESET_AVATARS.some((a) => a.id === profile.avatarId)) ||
    (typeof profile.customPhotoDataUrl === 'string' &&
      profile.customPhotoDataUrl.startsWith('data:image/'));
  return hasName && hasAvatar;
}

export function loadGuestPlayerProfile(): GuestPlayerProfile | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PLAYER_PROFILE_STORAGE_KEY);
    if (raw === cachedRaw) {
      return cachedProfile;
    }
    cachedRaw = raw;
    if (!raw) {
      cachedProfile = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<GuestPlayerProfile>;
    if (
      typeof parsed?.name === 'string' &&
      parsed.name.trim().length > 0 &&
      (typeof parsed.avatarId === 'string' ||
        typeof parsed.customPhotoDataUrl === 'string')
    ) {
      cachedProfile = {
        name: parsed.name.trim().slice(0, 60),
        avatarId: typeof parsed.avatarId === 'string' ? parsed.avatarId : '',
        customPhotoDataUrl:
          typeof parsed.customPhotoDataUrl === 'string' &&
          parsed.customPhotoDataUrl.startsWith('data:image/')
            ? parsed.customPhotoDataUrl
            : undefined,
        updatedAtMs:
          typeof parsed.updatedAtMs === 'number' ? parsed.updatedAtMs : 0,
      };
      return cachedProfile;
    }
    cachedProfile = null;
    return null;
  } catch {
    cachedRaw = null;
    cachedProfile = null;
    return null;
  }
}

export function saveGuestPlayerProfile(input: {
  name: string;
  avatarId: string;
  customPhotoDataUrl?: string;
}): GuestPlayerProfile {
  const next: GuestPlayerProfile = {
    name: input.name.trim().slice(0, 60),
    avatarId: input.avatarId.trim(),
    customPhotoDataUrl:
      input.customPhotoDataUrl && input.customPhotoDataUrl.startsWith('data:image/')
        ? input.customPhotoDataUrl
        : undefined,
    updatedAtMs: Date.now(),
  };

  if (typeof window !== 'undefined') {
    try {
      const serialized = JSON.stringify(next);
      window.localStorage.setItem(PLAYER_PROFILE_STORAGE_KEY, serialized);
      cachedRaw = serialized;
      cachedProfile = next;
      window.dispatchEvent(new Event(PLAYER_PROFILE_EVENT));
    } catch {
      cachedProfile = next;
    }
  }
  return next;
}

export function subscribeGuestPlayerProfile(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback();
  window.addEventListener(PLAYER_PROFILE_EVENT, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(PLAYER_PROFILE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}

export function getGuestPlayerProfileServerSnapshot(): GuestPlayerProfile | null {
  return null;
}

/**
 * Center-crops and compresses an uploaded image file to a lightweight 160x160 JPEG data URL.
 */
export async function resizeAvatarImageFile(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image load failed'));
      el.src = objectUrl;
    });

    const size = 160;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');

    const minSide = Math.min(img.width, img.height);
    const sx = (img.width - minSide) / 2;
    const sy = (img.height - minSide) / 2;
    ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
