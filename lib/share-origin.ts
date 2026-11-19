const PUBLIC_ORIGIN_KEY = 'pickerwel_public_origin_v1';

const ASSIGNMENT_ID_REGEX = /^asgn_[a-zA-Z0-9_-]{11,123}$/;
const KNOWN_APP_PATHS = new Set([
  '/',
  '/tasks',
  '/games',
  '/wheels',
  '/templates',
  '/groups',
  '/stopwatch',
  '/scan',
  '/history',
]);

export type JoinTarget =
  | { kind: 'internal'; path: string; displayUrl: string }
  | { kind: 'external'; url: string; displayUrl: string };

export function normalizeOriginInput(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withProto);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

export function getCustomPublicOrigin(): string {
  if (typeof window === 'undefined') return '';
  try {
    const raw = window.localStorage.getItem(PUBLIC_ORIGIN_KEY) || '';
    return normalizeOriginInput(raw);
  } catch {
    return '';
  }
}

export function setCustomPublicOrigin(raw: string): string {
  const normalized = normalizeOriginInput(raw);
  if (typeof window === 'undefined') return normalized;
  try {
    if (normalized) {
      window.localStorage.setItem(PUBLIC_ORIGIN_KEY, normalized);
    } else {
      window.localStorage.removeItem(PUBLIC_ORIGIN_KEY);
    }
  } catch {
    // Ignore storage errors
  }
  return normalized;
}

export function isPrivatePreviewHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host.startsWith('ais-dev-') || host.startsWith('ais-pre-');
}

export function getShareOrigin(): string {
  if (typeof window === 'undefined') return '';
  const custom = getCustomPublicOrigin();
  if (custom) return custom;
  return window.location.origin || '';
}

/**
 * Resolves any scanned QR payload or pasted text into an instant join destination
 * (no email or login required):
 * - Direct assignment ID (`asgn_...`)
 * - Relative or full URL to `/task/asgn_...`
 * - Any Pickerwel page URL (`/`, `/games`, `/tasks`, etc.)
 * - Any valid external `https://` or `http://` link
 */
export function resolveJoinTarget(rawInput: string): JoinTarget | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;

  // 1. Direct assignment ID
  if (ASSIGNMENT_ID_REGEX.test(trimmed)) {
    return {
      kind: 'internal',
      path: `/task/${trimmed}`,
      displayUrl: `/task/${trimmed}`,
    };
  }

  // 2. Relative path containing /task/asgn_...
  const taskPathMatch = trimmed.match(/^\/?task\/(asgn_[a-zA-Z0-9_-]{11,123})(?:[/?#].*)?$/i);
  if (taskPathMatch && taskPathMatch[1]) {
    const path = `/task/${taskPathMatch[1]}`;
    return { kind: 'internal', path, displayUrl: path };
  }

  // 3. Known relative Pickerwel path
  if (trimmed.startsWith('/')) {
    const cleanPath = trimmed.split(/[?#]/)[0];
    if (KNOWN_APP_PATHS.has(cleanPath)) {
      return { kind: 'internal', path: trimmed, displayUrl: trimmed };
    }
  }

  // 4. Full URL
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return null;
      }

      // Check if it's a Pickerwel assignment URL from any host/origin -> open directly in-app!
      const segments = parsed.pathname.split('/').filter(Boolean);
      const taskIdx = segments.findIndex((seg) => seg === 'task');
      if (
        taskIdx >= 0 &&
        segments[taskIdx + 1] &&
        ASSIGNMENT_ID_REGEX.test(segments[taskIdx + 1])
      ) {
        const path = `/task/${segments[taskIdx + 1]}`;
        return { kind: 'internal', path, displayUrl: parsed.href };
      }

      // Same origin -> navigate smoothly inside the app without reloading
      if (
        typeof window !== 'undefined' &&
        parsed.origin === window.location.origin
      ) {
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
        return { kind: 'internal', path, displayUrl: parsed.href };
      }

      // Pickerwel preview/published mirror pointing to known app route
      const host = parsed.hostname.toLowerCase();
      if (
        (host.endsWith('.run.app') || host === 'localhost') &&
        KNOWN_APP_PATHS.has(parsed.pathname)
      ) {
        const path = `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
        return { kind: 'internal', path, displayUrl: parsed.href };
      }

      return { kind: 'external', url: parsed.href, displayUrl: parsed.href };
    } catch {
      return null;
    }
  }

  return null;
}
