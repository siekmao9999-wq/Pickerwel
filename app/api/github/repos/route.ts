import { NextRequest, NextResponse } from 'next/server';
import {
  encodeGitHubPathSegments,
  getGitHubTokenFromRequest,
  githubFetch,
  isSafeGitHubSegment,
  type GitHubUserSummary,
} from '@/lib/github-oauth';

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  description: string | null;
  updated_at: string;
  owner: { login: string };
}

function mapRepo(r: RawGitHubRepo) {
  return {
    id: r.id,
    name: r.name,
    fullName: r.full_name,
    owner: r.owner.login,
    isPrivate: r.private,
    defaultBranch: r.default_branch,
    htmlUrl: r.html_url,
    description: r.description,
    updatedAt: r.updated_at,
  };
}

export async function GET(req: NextRequest) {
  const token = getGitHubTokenFromRequest(req);
  const sp = req.nextUrl.searchParams;
  const action = sp.get('action') || 'list';
  const owner = sp.get('owner')?.trim() || '';
  const repo = sp.get('repo')?.trim() || '';
  const username = sp.get('username')?.trim() || '';
  const path = sp.get('path')?.trim() || '';

  try {
    // Public GitHub username lookup (works immediately with zero OAuth/PAT setup)
    if (action === 'public-profile') {
      if (!isSafeGitHubSegment(username)) {
        return NextResponse.json({ error: 'INVALID_USERNAME' }, { status: 400 });
      }
      const [userRes, reposRes] = await Promise.all([
        githubFetch(`/users/${encodeURIComponent(username)}`, token),
        githubFetch(
          `/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=30&type=owner`,
          token
        ),
      ]);

      if (userRes.status === 404) {
        return NextResponse.json({ error: 'GITHUB_USER_NOT_FOUND' }, { status: 404 });
      }
      if (userRes.status === 403 && userRes.headers.get('x-ratelimit-remaining') === '0') {
        return NextResponse.json({ error: 'GITHUB_RATE_LIMITED' }, { status: 429 });
      }
      if (!userRes.ok) {
        return NextResponse.json(
          { error: 'GITHUB_USER_LOOKUP_FAILED' },
          { status: userRes.status }
        );
      }

      const rawUser = (await userRes.json()) as GitHubUserSummary;
      const rawRepos = reposRes.ok
        ? ((await reposRes.json()) as RawGitHubRepo[])
        : [];

      return NextResponse.json({
        user: {
          login: rawUser.login,
          name: rawUser.name,
          avatar_url: rawUser.avatar_url,
          html_url: rawUser.html_url,
          public_repos: rawUser.public_repos,
        },
        repos: Array.isArray(rawRepos) ? rawRepos.map(mapRepo) : [],
      });
    }

    // Public single repo lookup (owner/repo)
    if (action === 'public-repo') {
      if (!isSafeGitHubSegment(owner) || !isSafeGitHubSegment(repo)) {
        return NextResponse.json({ error: 'INVALID_REPO' }, { status: 400 });
      }
      const repoRes = await githubFetch(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
        token
      );
      if (repoRes.status === 404) {
        return NextResponse.json({ error: 'GITHUB_REPO_NOT_FOUND' }, { status: 404 });
      }
      if (repoRes.status === 403 && repoRes.headers.get('x-ratelimit-remaining') === '0') {
        return NextResponse.json({ error: 'GITHUB_RATE_LIMITED' }, { status: 429 });
      }
      if (!repoRes.ok) {
        return NextResponse.json(
          { error: 'GITHUB_REPO_LOOKUP_FAILED' },
          { status: repoRes.status }
        );
      }
      const rawRepo = (await repoRes.json()) as RawGitHubRepo;
      return NextResponse.json({ repo: mapRepo(rawRepo) });
    }

    // Authenticated user's own repositories list
    if (action === 'list') {
      if (!token) {
        return NextResponse.json({ error: 'NOT_CONNECTED' }, { status: 401 });
      }
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
      const data = (await res.json()) as RawGitHubRepo[];
      return NextResponse.json({
        repos: Array.isArray(data) ? data.map(mapRepo) : [],
      });
    }

    if (!isSafeGitHubSegment(owner) || !isSafeGitHubSegment(repo)) {
      return NextResponse.json({ error: 'INVALID_REPO' }, { status: 400 });
    }

    if (action === 'contributors') {
      const res = await githubFetch(
        `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contributors?per_page=100`,
        token
      );
      if (res.status === 204) {
        return NextResponse.json({ contributors: [] });
      }
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
      const encodedPath = encodeGitHubPathSegments(path);
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
