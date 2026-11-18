import { NextRequest, NextResponse } from 'next/server';
import {
  clearGitHubCookies,
  githubFetch,
  setGitHubTokenCookie,
  type GitHubUserSummary,
} from '@/lib/github-oauth';

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token?: string };
    const token = typeof body?.token === 'string' ? body.token.trim() : '';

    if (!token || token.length < 10 || token.length > 300) {
      return NextResponse.json(
        { error: 'INVALID_TOKEN_FORMAT' },
        { status: 400 }
      );
    }

    const userRes = await githubFetch('/user', token);
    if (!userRes.ok) {
      const res = NextResponse.json(
        { error: 'GITHUB_TOKEN_REJECTED' },
        { status: 401 }
      );
      clearGitHubCookies(res);
      return res;
    }

    const rawUser = (await userRes.json()) as GitHubUserSummary;
    const scopesHeader = userRes.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const res = NextResponse.json({
      connected: true,
      scopes,
      user: {
        login: rawUser.login,
        name: rawUser.name,
        avatar_url: rawUser.avatar_url,
        html_url: rawUser.html_url,
        public_repos: rawUser.public_repos,
      },
    });
    setGitHubTokenCookie(res, token);
    return res;
  } catch {
    return NextResponse.json(
      { error: 'GITHUB_TOKEN_ERROR' },
      { status: 500 }
    );
  }
}
