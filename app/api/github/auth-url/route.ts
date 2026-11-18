import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import {
  GITHUB_OAUTH_SCOPES,
  getGitHubCallbackUrl,
  getGitHubClientCredentials,
  setGitHubStateCookie,
} from '@/lib/github-oauth';

export async function GET() {
  const { clientId, configured } = getGitHubClientCredentials();
  const callbackUrl = getGitHubCallbackUrl();

  if (!configured || !clientId) {
    return NextResponse.json(
      {
        error: 'OAUTH_NOT_CONFIGURED',
        callbackUrl,
      },
      { status: 503 }
    );
  }

  const state = randomUUID();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: GITHUB_OAUTH_SCOPES,
    state,
    allow_signup: 'true',
  });

  const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
  const res = NextResponse.json({ url, callbackUrl });
  setGitHubStateCookie(res, state);
  return res;
}
