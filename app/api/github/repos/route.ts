import { NextRequest, NextResponse } from 'next/server';
import { GITHUB_TOKEN_COOKIE, githubFetch } from '@/lib/github-oauth';

const SAFE_SEGMENT = /^[a-zA-Z0-9._-]+$/;

function encodePathSegments(path: string): string {
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get(GITHUB_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const action = sp.get('action') || 'list';
  const owner = sp.get('owner')?.trim() || '';
  const repo = sp.get('repo')?.trim() || '';
  const path = sp.get('path')?.trim() || '';

  try {
    if (action === 'list') {
      const res = await githubFetch(
        '/user/repos?sort=updated&per_page=30&affiliation=owner,collaborator',
        token
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'GITHUB_REPOS_FAILED' },
          { status: res.status }
        );
      }
      const data = (await res.json()) as Array<{
        id: number;
        name: string;
        full_name: string;
        private: boolean;
        default_branch: string;
        html_url: string;
        description: string | null;
        updated_at: string;
        owner: { login: string };
      }>;

      return NextResponse.json({
        repos: data.map((r) => ({
          id: r.id,
          name: r.name,
          fullName: r.full_name,
          owner: r.owner.login,
          isPrivate: r.private,
          defaultBranch: r.default_branch,
          htmlUrl: r.html_url,
          description: r.description,
          updatedAt: r.updated_at,
        })),
      });
    }

    if (!SAFE_SEGMENT.test(owner) || !SAFE_SEGMENT.test(repo)) {
      return NextResponse.json({ error: 'INVALID_REPO' }, { status: 400 });
    }

    if (action === 'contributors') {
      const res = await githubFetch(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=100`,
        token
      );
      if (!res.ok) {
        return NextResponse.json(
          { error: 'GITHUB_CONTRIBUTORS_FAILED' },
          { status: res.status }
        );
      }
      const raw = (await res.json()) as Array<{ login?: string; type?: string }>;
      const contributors = Array.isArray(raw)
        ? raw
            .filter((c) => c.login && c.type !== 'Bot')
            .map((c) => c.login as string)
        : [];
      return NextResponse.json({ contributors });
    }

    if (action === 'contents' || action === 'file') {
      const encodedPath = encodePathSegments(path);
      const apiPath = encodedPath
        ? `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${encodedPath}`
        : `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents`;

      const res = await githubFetch(apiPath, token);
      if (!res.ok) {
        return NextResponse.json(
          { error: 'GITHUB_CONTENTS_FAILED' },
          { status: res.status }
        );
      }

      const payload = (await res.json()) as
        | Array<{
            name: string;
            path: string;
            type: 'file' | 'dir' | 'symlink' | 'submodule';
            size: number;
            html_url: string;
          }>
        | {
            name: string;
            path: string;
            type: string;
            content?: string;
            encoding?: string;
          };

      if (Array.isArray(payload)) {
        const items = [...payload]
          .sort((a, b) => {
            if (a.type === 'dir' && b.type !== 'dir') return -1;
            if (a.type !== 'dir' && b.type === 'dir') return 1;
            return a.name.localeCompare(b.name);
          })
          .map((item) => ({
            name: item.name,
            path: item.path,
            type: item.type,
            size: item.size,
            htmlUrl: item.html_url,
          }));
        return NextResponse.json({ items });
      }

      if (payload.encoding === 'base64' && typeof payload.content === 'string') {
        const text = Buffer.from(
          payload.content.replace(/\n/g, ''),
          'base64'
        ).toString('utf-8');
        return NextResponse.json({
          file: {
            name: payload.name,
            path: payload.path,
            content: text,
          },
        });
      }

      return NextResponse.json({ error: 'UNSUPPORTED_FILE' }, { status: 400 });
    }

    return NextResponse.json({ error: 'UNKNOWN_ACTION' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'GITHUB_API_ERROR' }, { status: 500 });
  }
}
