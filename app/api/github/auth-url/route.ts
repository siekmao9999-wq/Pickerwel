import { NextResponse } from 'next/server';
import {
  GITHUB_OAUTH_SCOPES,
  createSignedOAuthState,
  getGitHubCallbackUrl,
  getGitHubClientCredentials,
  setGitHubStateCookie,
} from '@/lib/github-oauth';

export async function GET() {
  const { clientId, configured } = getGitHubClientCredentials();
  const callbackUrl = getGitHubCallbackUrl();

  if (!configured || !clientId) {
    // Return HTTP 200 with structured status so upstream proxies never intercept as a 503 HTML page
    return NextResponse.json({
      configured: false,
      error: 'OAUTH_NOT_CONFIGURED',
      callbackUrl,
    });
  }

  const state = createSignedOAuthState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: GITHUB_OAUTH_SCOPES,
    state,
    allow_signup: 'true',
  });

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const res = NextResponse.json({ configured: true, url, callbackUrl });
  setGitHubStateCookie(res, state);
  return res;
}
