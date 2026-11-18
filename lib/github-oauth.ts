import { NextResponse } from 'next/server';

export const GITHUB_TOKEN_COOKIE = 'pickerwel_gh_token';
export const GITHUB_STATE_COOKIE = 'pickerwel_gh_state';
export const GITHUB_OAUTH_SCOPES = 'read:user gist repo';

export interface GitHubUserSummary {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
}

export function getAppBaseUrl(): string {
  const raw = process.env.APP_URL?.trim();
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
    process.env.GITHUB_CLIENT_ID?.trim() ||
    process.env.CLIENT_ID?.trim() ||
    null;
  const clientSecret =
    process.env.GITHUB_CLIENT_SECRET?.trim() ||
    process.env.CLIENT_SECRET?.trim() ||
    null;

  return {
    clientId,
    clientSecret,
    configured: Boolean(clientId && clientSecret),
  };
}

export function setGitHubTokenCookie(res: NextResponse, token: string): void {
  res.cookies.set(GITHUB_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function setGitHubStateCookie(res: NextResponse, state: string): void {
  res.cookies.set(GITHUB_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 600,
  });
}

export function clearGitHubCookies(res: NextResponse): void {
  res.cookies.set(GITHUB_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 0,
  });
  res.cookies.set(GITHUB_STATE_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'none',
    path: '/',
    maxAge: 0,
  });
}

export async function githubFetch(
  path: string,
  token: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith('https://')
    ? path
    : `https://api.github.com${path.startsWith('/') ? path : `/${path}`}`;

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/vnd.github+json');
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('X-GitHub-Api-Version', '2022-11-28');
  headers.set('User-Agent', 'Pickerwel-App');
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  });
}
