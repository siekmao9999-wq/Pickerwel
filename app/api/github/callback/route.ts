import { NextRequest, NextResponse } from 'next/server';
import {
  GITHUB_STATE_COOKIE,
  clearGitHubCookies,
  getGitHubCallbackUrl,
  getGitHubClientCredentials,
  setGitHubTokenCookie,
} from '@/lib/github-oauth';

function renderPopupResultHtml(opts: {
  ok: boolean;
  errorMessage?: string;
  login?: string;
}): NextResponse {
  const payload = opts.ok
    ? JSON.stringify({
        type: 'OAUTH_AUTH_SUCCESS',
        provider: 'github',
        login: opts.login ?? null,
      })
    : JSON.stringify({
        type: 'OAUTH_AUTH_ERROR',
        provider: 'github',
        error: opts.errorMessage || 'GitHub authentication failed',
      });

  const safeText = opts.ok
    ? 'GitHub connected successfully. This window will close automatically.'
    : opts.errorMessage || 'GitHub authentication failed. You can close this window and try again.';

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pickerwel — GitHub</title>
    <style>
      body { font-family: system-ui, -apple-system, sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; padding: 24px; }
      .card { max-width: 400px; width: 100%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 24px; text-align: center; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.06); }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { font-size: 14px; color: #475569; margin: 0 0 16px; line-height: 1.5; }
      button { border: 0; background: #3b82f6; color: #fff; font-weight: 600; font-size: 13px; padding: 10px 18px; border-radius: 10px; cursor: pointer; }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>${opts.ok ? 'GitHub Connected' : 'GitHub Connection Error'}</h1>
      <p id="status-msg"></p>
      <button type="button" onclick="window.close()">Close</button>
    </div>
    <script>
      document.getElementById('status-msg').textContent = ${JSON.stringify(safeText)};
      try {
        if (window.opener) {
          window.opener.postMessage(${payload}, '*');
          window.close();
        } else {
          window.location.href = '/github';
        }
      } catch (e) {
        // User can close manually
      }
    </script>
  </body>
</html>`;

  return new NextResponse(html, {
    status: opts.ok ? 200 : 400,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const oauthError = req.nextUrl.searchParams.get('error');
  const oauthErrorDesc = req.nextUrl.searchParams.get('error_description');

  if (oauthError) {
    return renderPopupResultHtml({
      ok: false,
      errorMessage: oauthErrorDesc || oauthError,
    });
  }

  const storedState = req.cookies.get(GITHUB_STATE_COOKIE)?.value;
  if (storedState && state !== storedState) {
    return renderPopupResultHtml({
      ok: false,
      errorMessage: 'Invalid OAuth state. Please try connecting again.',
    });
  }

  const { clientId, clientSecret, configured } = getGitHubClientCredentials();
  if (!configured || !clientId || !clientSecret || !code) {
    return renderPopupResultHtml({
      ok: false,
      errorMessage: 'Missing GitHub OAuth credentials or authorization code.',
    });
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: getGitHubCallbackUrl(),
      }),
      cache: 'no-store',
    });

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok || !tokenJson.access_token) {
      return renderPopupResultHtml({
        ok: false,
        errorMessage:
          tokenJson.error_description ||
          tokenJson.error ||
          'Failed to exchange authorization code.',
      });
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenJson.access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Pickerwel-App',
      },
      cache: 'no-store',
    });

    const userJson = userRes.ok
      ? ((await userRes.json()) as { login?: string })
      : null;

    const response = renderPopupResultHtml({
      ok: true,
      login: userJson?.login,
    });
    clearGitHubCookies(response);
    setGitHubTokenCookie(response, tokenJson.access_token);
    return response;
  } catch {
    return renderPopupResultHtml({
      ok: false,
      errorMessage: 'Network error while completing GitHub sign-in.',
    });
  }
}
