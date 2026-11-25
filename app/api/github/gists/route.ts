import { NextRequest, NextResponse } from 'next/server';
import {
  assertValidCsrfRequest,
  getGitHubTokenFromRequest,
  githubFetch,
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

export async function GET(req: NextRequest) {
  const token = getGitHubTokenFromRequest(req);
  if (!token) {
    return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
  }

  const gistId = req.nextUrl.searchParams.get('gistId')?.trim();

  try {
    if (gistId) {
      if (!/^[a-zA-Z0-9]{1,64}$/.test(gistId)) {
        return NextResponse.json({ error: 'INVALID_GIST_ID' }, { status: 400 });
      }
      const res = await githubFetch(`/gists/${gistId}`, token);
      if (!res.ok) {
        return NextResponse.json(
          { error: 'GITHUB_GIST_READ_FAILED' },
          { status: res.status }
        );
      }
      const gist = (await res.json()) as {
        id: string;
        description: string | null;
        html_url: string;
        files: Record<
          string,
          { filename: string; content?: string; language?: string | null }
        >;
      };

      const files = Object.values(gist.files || {}).map((f) => ({
        filename: f.filename,
        content: f.content || '',
      }));

      return NextResponse.json({
        gist: {
          id: gist.id,
          description: gist.description,
          htmlUrl: gist.html_url,
          files,
        },
      });
    }

    const res = await githubFetch('/gists?per_page=20', token);
    if (!res.ok) {
      return NextResponse.json(
        { error: 'GITHUB_GISTS_FAILED' },
        { status: res.status }
      );
    }

    const raw = (await res.json()) as Array<{
      id: string;
      description: string | null;
      html_url: string;
      public: boolean;
      updated_at: string;
      files: Record<string, { filename: string }>;
    }>;

    const gists = raw.map((g) => ({
      id: g.id,
      description: g.description || Object.keys(g.files || {})[0] || 'Untitled Gist',
      htmlUrl: g.html_url,
      isPublic: g.public,
      updatedAt: g.updated_at,
      filenames: Object.keys(g.files || {}),
    }));

    return NextResponse.json({ gists });
  } catch {
    return NextResponse.json({ error: 'GITHUB_GIST_ERROR' }, { status: 500 });
  }
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
      title?: string;
      entries?: string[];
      paletteId?: string;
      isPublic?: boolean;
    };

    const entries = Array.isArray(body.entries)
      ? body.entries.map((s) => String(s).trim()).filter(Boolean).slice(0, 200)
      : [];

    if (entries.length === 0) {
      return NextResponse.json({ error: 'EMPTY_ENTRIES' }, { status: 400 });
    }

    const title = (body.title?.trim() || 'Pickerwel Wheel').slice(0, 120);
    const slug = slugifyTitle(title);

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

    const csvContent = entries
      .map((item) => `"${item.replace(/"/g, '""')}"`)
      .join('\n');

    const res = await githubFetch('/gists', token, {
      method: 'POST',
      body: JSON.stringify({
        description: `Pickerwel Wheel: ${title} (${entries.length} entries)`,
        public: Boolean(body.isPublic),
        files: {
          [`pickerwel-${slug}.json`]: { content: jsonContent },
          [`pickerwel-${slug}.csv`]: { content: csvContent },
        },
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as {
        message?: string;
      };
      return NextResponse.json(
        { error: 'GITHUB_GIST_CREATE_FAILED', detail: errData.message || null },
        { status: res.status }
      );
    }

    const created = (await res.json()) as {
      id: string;
      html_url: string;
      description: string | null;
      public: boolean;
      updated_at: string;
      files: Record<string, { filename: string }>;
    };

    return NextResponse.json({
      gist: {
        id: created.id,
        description: created.description || title,
        htmlUrl: created.html_url,
        isPublic: created.public,
        updatedAt: created.updated_at,
        filenames: Object.keys(created.files || {}),
      },
    });
  } catch {
    return NextResponse.json({ error: 'GITHUB_GIST_ERROR' }, { status: 500 });
  }
}
