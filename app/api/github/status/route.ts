import { NextRequest, NextResponse } from 'next/server';
import {
  GITHUB_TOKEN_COOKIE,
  clearGitHubCookies,
  getGitHubCallbackUrl,
  getGitHubClientCredentials,
  githubFetch,
  type GitHubUserSummary,
} from '@/lib/github-oauth';

export async function GET(req: NextRequest) {
  const { configured: oauthConfigured } = getGitHubClientCredentials();
  const callbackUrl = getGitHubCallbackUrl();
  const token = req.cookies.get(GITHUB_TOKEN_COOKIE)?.value;

  if (!token) {
    return NextResponse.json({
      oauthConfigured,
      callbackUrl,
      connected: false,
      scopes: [],
      user: null,
    });
  }

  try {
    const userRes = await githubFetch('/user', token);
    if (!userRes.ok) {
      const res = NextResponse.json({
        oauthConfigured,
        callbackUrl,
        connected: false,
        scopes: [],
        user: null,
      });
      if (userRes.status === 401) {
        clearGitHubCookies(res);
      }
      return res;
    }

    const rawUser = (await userRes.json()) as GitHubUserSummary;
    const scopesHeader = userRes.headers.get('x-oauth-scopes') || '';
    const scopes = scopesHeader
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    return NextResponse.json({
      oauthConfigured,
      callbackUrl,
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
  } catch {
    return NextResponse.json({
      oauthConfigured,
      callbackUrl,
      connected: false,
      scopes: [],
      user: null,
    });
  }
}
