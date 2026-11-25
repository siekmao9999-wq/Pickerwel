import { NextRequest, NextResponse } from 'next/server';
import {
  assertValidCsrfRequest,
  encodeGitHubPathSegments,
  getGitHubTokenFromRequest,
  githubFetch,
  isSafeGitHubBranch,
  isSafeGitHubSegment,
} from '@/lib/github-oauth';

function slugifyTitle(input: string): string {
  const ascii = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return ascii || 'pickerwel-wheel';
}

export async function POST(req: NextRequest) {
  if (!assertValidCsrfRequest(req)) {
    return NextResponse.json({ error: 'FORBIDDEN_ORIGIN' }, { status: 403 });
  }

  const token = getGitHubTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      branch?: string;
      title?: string;
      entries?: string[];
      paletteId?: string;
      filePath?: string;
    };

    const owner = body.owner?.trim() || '';
    const repo = body.repo?.trim() || '';
    if (!isSafeGitHubSegment(owner) || !isSafeGitHubSegment(repo)) {
      return NextResponse.json({ error: 'INVALID_REPO' }, { status: 400 });
    }

    const branch = body.branch?.trim() || '';
    if (branch && !isSafeGitHubBranch(branch)) {
      return NextResponse.json({ error: 'INVALID_BRANCH' }, { status: 400 });
    }

    const entries = Array.isArray(body.entries)
      ? body.entries.map((s) => String(s).trim()).filter(Boolean).slice(0, 200)
      : [];

    if (entries.length === 0) {
      return NextResponse.json({ error: 'EMPTY_ENTRIES' }, { status: 400 });
    }

    const title = (body.title?.trim() || 'Pickerwel Wheel').slice(0, 120);
    const defaultSlug = slugifyTitle(title);
    const cleanPath = (body.filePath?.trim() || `pickerwel-wheels/${defaultSlug}.json`)
      .replace(/^\/+/, '')
      .replace(/\.\./g, '');

    if (!cleanPath || cleanPath.length > 180 || /[\x00-\x1f\x7f]/.test(cleanPath)) {
      return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
    }

    const encodedPath = encodeGitHubPathSegments(cleanPath);
    if (!encodedPath) {
      return NextResponse.json({ error: 'INVALID_PATH' }, { status: 400 });
    }

    const apiPath = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`;

    // Check if file already exists to obtain its SHA for updates
    let existingSha: string | undefined;
    const existingRes = await githubFetch(
      branch ? `${apiPath}?ref=${encodeURIComponent(branch)}` : apiPath,
      token
    );
    if (existingRes.ok) {
      const existingData = (await existingRes.json()) as { sha?: string };
      if (typeof existingData.sha === 'string') {
        existingSha = existingData.sha;
      }
    }

    const jsonContent = JSON.stringify(
      {
        app: 'Pickerwel',
        version: 1,
        title,
        paletteId: body.paletteId || 'vibrant',
        entries,
        exportedAt: new Date().toISOString(),
      },
      null,
      2
    );

    const putRes = await githubFetch(apiPath, token, {
      method: 'PUT',
      body: JSON.stringify({
        message: existingSha
          ? `Update Pickerwel wheel: ${title}`
          : `Add Pickerwel wheel: ${title}`,
        content: Buffer.from(jsonContent, 'utf-8').toString('base64'),
        ...(branch ? { branch } : {}),
        ...(existingSha ? { sha: existingSha } : {}),
      }),
    });

    if (!putRes.ok) {
      const errData = (await putRes.json().catch(() => ({}))) as {
        message?: string;
      };
      return NextResponse.json(
        { error: 'GITHUB_PUSH_FAILED', detail: errData.message || null },
        { status: putRes.status }
      );
    }

    const putData = (await putRes.json()) as {
      content?: { html_url?: string; path?: string };
    };

    return NextResponse.json({
      ok: true,
      path: putData.content?.path || cleanPath,
      htmlUrl: putData.content?.html_url || `https://github.com/${owner}/${repo}`,
    });
  } catch {
    return NextResponse.json({ error: 'GITHUB_SYNC_ERROR' }, { status: 500 });
  }
}
