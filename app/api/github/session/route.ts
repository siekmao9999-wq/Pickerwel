import { NextRequest, NextResponse } from 'next/server';
import {
  assertValidCsrfRequest,
  clearGitHubCookies,
  consumeOAuthHandoffCode,
  githubFetch,
  setGitHubTokenCookie,
  type GitHubUserSummary,
} from '@/lib/github-oauth';

export async function POST(req: NextRequest) {
  if (!assertValidCsrfRequest(req)) {
    return NextResponse.json({ error: 'FORBIDDEN_ORIGIN' }, { status: 403 });
  }

  try {
    const body = (await req.json()) as { handoffCode?: string };
    const handoffCode =
      typeof body?.handoffCode === 'string' ? body.handoffCode.trim() : '';

    const token = consumeOAuthHandoffCode(handoffCode);
    if (!token) {
      return NextResponse.json(
        { error: 'INVALID_OR_EXPIRED_HANDOFF' },
        { status: 401 }
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
      { error: 'GITHUB_SESSION_ERROR' },
      { status: 500 }
    );
  }
}
