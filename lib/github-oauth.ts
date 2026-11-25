import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

export const GITHUB_TOKEN_COOKIE = 'pickerwel_gh_token';
export const GITHUB_STATE_COOKIE = 'pickerwel_gh_state';
export const GITHUB_OAUTH_SCOPES = 'read:user gist repo';

const PLACEHOLDER_VALUES = new Set([
  'MY_GITHUB_CLIENT_ID',
  'MY_GITHUB_CLIENT_SECRET',
  'MY_APP_URL',
  'YOUR_GITHUB_CLIENT_ID',
  'YOUR_GITHUB_CLIENT_SECRET',
]);

const SAFE_GITHUB_SEGMENT = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,98}[a-zA-Z0-9])?$|^[a-zA-Z0-9]$/;
const SAFE_GITHUB_BRANCH = /^[a-zA-Z0-9._/-]{1,120}$/;

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const HANDOFF_TTL_MS = 60 * 1000; // 60 seconds
const MAX_HANDOFF_ENTRIES = 100;

interface HandoffEntry {
  token: string;
  expiresAt: number;
}

const globalStore = globalThis as typeof globalThis & {
  __pickerwelGhHandoff?: Map<string, HandoffEntry>;
  __pickerwelGhFallbackSecret?: string;
};

function getHandoffStore(): Map<string, HandoffEntry> {
  if (!globalStore.__pickerwelGhHandoff) {
    globalStore.__pickerwelGhHandoff = new Map<string, HandoffEntry>();
  }
  return globalStore.__pickerwelGhHandoff;
}

function getStateSigningSecret(): string {
  const { clientSecret } = getGitHubClientCredentials();
  if (clientSecret) return clientSecret;
  if (!globalStore.__pickerwelGhFallbackSecret) {
    globalStore.__pickerwelGhFallbackSecret = randomBytes(32).toString('hex');
  }
  return globalStore.__pickerwelGhFallbackSecret;
}

function isNonPlaceholderEnv(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_VALUES.has(trimmed)) return null;
  return trimmed;
}

export interface GitHubUserSummary {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
}

export function getAppBaseUrl(): string {
  const raw = isNonPlaceholderEnv(process.env.APP_URL);
  if (raw && /^https?:\/\//i.test(raw)) {
    return raw.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

export function getGitHubCallbackUrl(): string {
  return `${getAppBaseUrl()}/api/github/callback`;
}

export function getGitHubClientCredentials(): {
  clientId: string | null;
  clientSecret: string | null;
  configured: boolean;
} {
  const clientId =
    isNonPlaceholderEnv(process.env.GITHUB_CLIENT_ID) ||
    isNonPlaceholderEnv(process.env.CLIENT_ID);
  const clientSecret =
    isNonPlaceholderEnv(process.env.GITHUB_CLIENT_SECRET) ||
    isNonPlaceholderEnv(process.env.CLIENT_SECRET);

  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  };
}

export function createSignedOAuthState(): string {
  const nonce = randomBytes(16).toString('hex');
  const issuedAt = String(Date.now());
  const payload = `${nonce}.${issuedAt}`;
  const sig = createHmac('sha256', getStateSigningSecret())
    .update(payload)
    .digest('hex');
  return `${payload}.${sig}`;
}

export function verifySignedOAuthState(state: string | null | undefined): boolean {
  if (!state) return false;
  const parts = state.split('.');
  if (parts.length !== 3) return false;
  const [nonce, issuedAtRaw, providedSig] = parts;
  if (!nonce || !issuedAtRaw || !providedSig) return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;
  const age = Date.now() - issuedAt;
  if (age < -30_000 || age > STATE_TTL_MS) return false;

  const payload = `${nonce}.${issuedAtRaw}`;
  const expectedSig = createHmac('sha256', getStateSigningSecret())
    .update(payload)
    .digest('hex');

  const a = Buffer.from(providedSig, 'utf8');
  const b = Buffer.from(expectedSig, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function createOAuthHandoffCode(token: string): string {
  const store = getHandoffStore();
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.expiresAt <= now) {
      store.delete(key);
    }
  }
  while (store.size >= MAX_HANDOFF_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
  const code = randomBytes(24).toString('hex');
  store.set(code, { token, expiresAt: now + HANDOFF_TTL_MS });
  return code;
}

export function consumeOAuthHandoffCode(code: string): string | null {
  if (!code || !/^[a-f0-9]{32,128}$/i.test(code)) return null;
  const store = getHandoffStore();
  const entry = store.get(code);
  store.delete(code);
  if (!entry || entry.expiresAt <= Date.now()) {
    return null;
  }
  return entry.token;
}

export function getGitHubTokenFromRequest(req: NextRequest): string | null {
  const cookieToken = req.cookies.get(GITHUB_TOKEN_COOKIE)?.value?.trim();
  if (cookieToken) return cookieToken;

  const authHeader = req.headers.get('authorization')?.trim();
  if (authHeader && /^Bearer\s+/i.test(authHeader)) {
    const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (bearer.length >= 10 && bearer.length <= 300) {
      return bearer;
    }
  }
  return null;
}

export function assertValidCsrfRequest(req: NextRequest): boolean {
  const xrw = req.headers.get('x-requested-with');
  if (xrw === 'XMLHttpRequest') return true;

  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  if (!origin || !host) return false;

  try {
    const originHost = new URL(origin).host;
    return originHost === host;
  } catch {
    return false;
  }
}

export function setGitHubTokenCookie(res: NextResponse, token: string): void {
  res.cookies.set(GITHUB_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function setGitHubStateCookie(res: NextResponse, state: string): void {
  res.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 600,
  });
}

export function clearGitHubCookies(res: NextResponse): void {
  res.cookies.set(GITHUB_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 0,
  });
  res.cookies.set(GITHUB_STATE_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    partitioned: true,
    path: '/',
    maxAge: 0,
  });
}

export function isSafeGitHubSegment(value: string): boolean {
  if (!value || value.includes('..') || value.includes('/')) return false;
  return SAFE_GITHUB_SEGMENT.test(value);
}

export function isSafeGitHubBranch(value: string): boolean {
  if (!value || value.includes('..') || value.startsWith('/') || value.endsWith('/')) {
    return false;
  }
  return SAFE_GITHUB_BRANCH.test(value);
}

export function encodeGitHubPathSegments(path: string): string {
  return path
    .split('/')
    .filter((seg) => Boolean(seg) && seg !== '.' && seg !== '..')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export async function githubFetch(
  path: string,
  token: string | null,
  init: RequestInit = {}
): Promise<Response> {
  if (!path.startsWith('/')) {
    throw new Error('GitHub API path must be relative to https://api.github.com');
  }
  const parsedUrl = new URL(path, 'https://api.github.com');
  if (parsedUrl.origin !== 'https://api.github.com') {
    throw new Error('Invalid GitHub API destination');
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/vnd.github+json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'Pickerwel-App');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(parsedUrl.toString(), {
    ...init,
    headers,
    cache: 'no-store',
  });
}
