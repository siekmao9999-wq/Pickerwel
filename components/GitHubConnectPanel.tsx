'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Github,
  Link2,
  KeyRound,
  Copy,
  Check,
  LogOut,
  ExternalLink,
  FolderGit2,
  FileCode2,
  Users,
  UploadCloud,
  DownloadCloud,
  Folder,
  FileText,
  ArrowLeft,
  Search,
  AlertCircle,
  Info,
  Globe,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { usePickerwel } from './PickerwelProvider';
import { COPY } from '@/lib/i18n';
import { parseUserEntriesInput, MAX_WHEEL_ENTRIES } from '@/lib/entries-io';

interface GitHubUser {
  login: string;
  name: string | null;
  avatar_url: string;
  html_url: string;
  public_repos: number;
}

interface GitHubStatusResponse {
  oauthConfigured: boolean;
  callbackUrl: string;
  connected: boolean;
  scopes: string[];
  user: GitHubUser | null;
}

interface RepoSummary {
  id: number;
  name: string;
  fullName: string;
  owner: string;
  isPrivate: boolean;
  defaultBranch: string;
  htmlUrl: string;
  description: string | null;
  updatedAt: string;
}

interface RepoContentItem {
  name: string;
  path: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  size: number;
  htmlUrl: string;
}

interface GistSummary {
  id: string;
  description: string;
  htmlUrl: string;
  isPublic: boolean;
  updatedAt: string;
  filenames: string[];
}

function parseEntriesFromGitHubText(filename: string, content: string): {
  title?: string;
  entries: string[];
} {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.json')) {
    try {
      const parsed = JSON.parse(content) as unknown;
      if (Array.isArray(parsed)) {
        return {
          entries: parsed
            .map((v) => String(v).trim())
            .filter(Boolean)
            .slice(0, MAX_WHEEL_ENTRIES),
        };
      }
      if (parsed && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        if (Array.isArray(obj.entries)) {
          return {
            title: typeof obj.title === 'string' ? obj.title : undefined,
            entries: obj.entries
              .map((v) => String(v).trim())
              .filter(Boolean)
              .slice(0, MAX_WHEEL_ENTRIES),
          };
        }
      }
    } catch {
      // Fall back to line-based parser
    }
  }
  const delimiter = lower.endsWith('.csv') ? 'csv' : 'auto';
  return { entries: parseUserEntriesInput(content, delimiter).entries };
}

function parsePublicGitHubTarget(raw: string):
  | { kind: 'repo'; owner: string; repo: string }
  | { kind: 'user'; username: string }
  | null {
  const trimmed = raw.trim().replace(/^@/, '').replace(/\.git$/i, '');
  if (!trimmed) return null;

  let normalized = trimmed;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const parsed = new URL(normalized);
      if (!/^(www\.)?github\.com$/i.test(parsed.hostname)) {
        return null;
      }
      normalized = parsed.pathname.replace(/^\/+|\/+$/g, '');
    } catch {
      return null;
    }
  } else {
    normalized = normalized.replace(/^github\.com\//i, '').replace(/^\/+|\/+$/g, '');
  }

  const parts = normalized.split('/').filter(Boolean);
  if (parts.length >= 2) {
    return { kind: 'repo', owner: parts[0], repo: parts[1] };
  }
  if (parts.length === 1) {
    return { kind: 'user', username: parts[0] };
  }
  return null;
}

async function safeReadJson<T>(res: Response): Promise<T | null> {
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

export function GitHubConnectPanel() {
  const { settings, activeWheel, updateActiveWheel, setActiveNav } = usePickerwel();
  const t = COPY[settings.language];
  const isKm = settings.language === 'km';

  // In-memory only fallback token for cross-origin iframes where browser blocks all cookies.
  // Never written to localStorage or sessionStorage.
  const sessionTokenRef = useRef<string | null>(null);

  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<GitHubStatusResponse | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [blockedAuthUrl, setBlockedAuthUrl] = useState<string | null>(null);

  const [connectMethod, setConnectMethod] = useState<'pat' | 'public'>('pat');
  const [patInput, setPatInput] = useState('');
  const [patSubmitting, setPatSubmitting] = useState(false);

  // Public read-only GitHub connection (no token required)
  const [publicInput, setPublicInput] = useState('');
  const [publicSubmitting, setPublicSubmitting] = useState(false);
  const [publicUser, setPublicUser] = useState<GitHubUser | null>(null);

  const [copiedCallback, setCopiedCallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [successLink, setSuccessLink] = useState<string | null>(null);

  // Connected workspace state
  const [activeTab, setActiveTab] = useState<'repos' | 'gists'>('repos');
  const [repos, setRepos] = useState<RepoSummary[]>([]);
  const [reposLoading, setReposLoading] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<RepoSummary | null>(null);
  const [repoPath, setRepoPath] = useState('');
  const [repoItems, setRepoItems] = useState<RepoContentItem[]>([]);
  const [repoActionLoading, setRepoActionLoading] = useState(false);
  const [pushingRepoId, setPushingRepoId] = useState<number | null>(null);

  const [gists, setGists] = useState<GistSummary[]>([]);
  const [gistsLoading, setGistsLoading] = useState(false);
  const [gistPublic, setGistPublic] = useState(false);
  const [savingGist, setSavingGist] = useState(false);
  const [loadingGistId, setLoadingGistId] = useState<string | null>(null);

  const isAuthConnected = Boolean(status?.connected && status.user);
  const activeUser = isAuthConnected ? status?.user ?? null : publicUser;
  const isWorkspaceConnected = Boolean(activeUser);

  const apiFetch = useCallback((input: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    headers.set('X-Requested-With', 'XMLHttpRequest');
    if (sessionTokenRef.current && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${sessionTokenRef.current}`);
    }
    return fetch(input, {
      ...init,
      headers,
      credentials: 'include',
      cache: 'no-store',
    });
  }, []);

  const fetchRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await apiFetch('/api/github/repos');
      if (!res.ok) return;
      const data = await safeReadJson<{ repos?: RepoSummary[] }>(res);
      setRepos(Array.isArray(data?.repos) ? data.repos : []);
    } finally {
      setReposLoading(false);
    }
  }, [apiFetch]);

  const fetchGists = useCallback(async () => {
    setGistsLoading(true);
    try {
      const res = await apiFetch('/api/github/gists');
      if (!res.ok) return;
      const data = await safeReadJson<{ gists?: GistSummary[] }>(res);
      setGists(Array.isArray(data?.gists) ? data.gists : []);
    } finally {
      setGistsLoading(false);
    }
  }, [apiFetch]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await apiFetch('/api/github/status');
      if (!res.ok) return;
      const data = await safeReadJson<GitHubStatusResponse>(res);
      if (!data) return;
      setStatus(data);
      if (data.connected) {
        setPublicUser(null);
        await Promise.all([fetchRepos(), fetchGists()]);
      } else {
        setGists([]);
      }
    } finally {
      setStatusLoading(false);
    }
  }, [apiFetch, fetchRepos, fetchGists]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Listen for OAuth popup postMessage completion and exchange one-time handoff code
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      const validOrigin =
        origin.endsWith('.run.app') ||
        origin.includes('localhost') ||
        origin === window.location.origin;
      if (!validOrigin) return;

      if (
        event.data?.type === 'OAUTH_AUTH_SUCCESS' &&
        event.data?.provider === 'github'
      ) {
        setConnectingOAuth(false);
        setBlockedAuthUrl(null);
        setErrorMsg(null);
        setInfoMsg(null);
        setSuccessLink(null);

        const handoffCode =
          typeof event.data?.handoffCode === 'string'
            ? event.data.handoffCode
            : null;

        void (async () => {
          if (handoffCode) {
            const sessionRes = await apiFetch('/api/github/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ handoffCode }),
            });
            const sessionData = await safeReadJson<{
              connected?: boolean;
              scopes?: string[];
              user?: GitHubUser;
            }>(sessionRes);
            if (sessionRes.ok && sessionData?.connected && sessionData.user) {
              setPublicUser(null);
              setStatus((prev) => ({
                oauthConfigured: prev?.oauthConfigured ?? true,
                callbackUrl: prev?.callbackUrl ?? '',
                connected: true,
                scopes: sessionData.scopes ?? [],
                user: sessionData.user ?? null,
              }));
              setSuccessMsg(t.ghConnectedBadge);
              await Promise.all([fetchRepos(), fetchGists()]);
              return;
            }
          }
          setSuccessMsg(t.ghConnectedBadge);
          await fetchStatus();
        })();
      } else if (
        event.data?.type === 'OAUTH_AUTH_ERROR' &&
        event.data?.provider === 'github'
      ) {
        setConnectingOAuth(false);
        setErrorMsg(
          typeof event.data?.error === 'string' ? event.data.error : t.ghApiError
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [apiFetch, fetchGists, fetchRepos, fetchStatus, t.ghConnectedBadge, t.ghApiError]);

  const handleConnectOAuth = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setBlockedAuthUrl(null);
    setConnectingOAuth(true);

    try {
      const res = await apiFetch('/api/github/auth-url');
      const data = await safeReadJson<{
        configured?: boolean;
        url?: string;
        error?: string;
        callbackUrl?: string;
      }>(res);

      if (
        !data ||
        data.configured === false ||
        data.error === 'OAUTH_NOT_CONFIGURED' ||
        !data.url
      ) {
        setConnectingOAuth(false);
        if (data?.error === 'OAUTH_NOT_CONFIGURED' || data?.configured === false) {
          setInfoMsg(t.ghOAuthMissingHint);
        } else {
          setErrorMsg(t.ghApiError);
        }
        return;
      }

      const authWindow = window.open(
        data.url,
        'github_oauth_popup',
        'width=600,height=720'
      );

      if (!authWindow) {
        setConnectingOAuth(false);
        setBlockedAuthUrl(data.url);
        setInfoMsg(t.ghPopupBlockedHint);
      }
    } catch {
      setConnectingOAuth(false);
      setErrorMsg(t.ghApiError);
    }
  };

  const handleConnectPat = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedToken = patInput.trim();
    if (!cleanedToken || patSubmitting) return;
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setPatSubmitting(true);

    try {
      const res = await apiFetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanedToken }),
      });
      const data = await safeReadJson<{
        connected?: boolean;
        scopes?: string[];
        user?: GitHubUser;
        error?: string;
      }>(res);

      if (!res.ok || !data?.connected || !data.user) {
        if (data?.error === 'GITHUB_RATE_LIMITED') {
          setErrorMsg(t.ghRateLimitError);
        } else if (
          data?.error === 'INVALID_TOKEN_FORMAT' ||
          data?.error === 'GITHUB_TOKEN_REJECTED' ||
          res.status === 400 ||
          res.status === 401
        ) {
          setErrorMsg(t.ghTokenError);
        } else {
          setErrorMsg(t.ghApiError);
        }
        return;
      }

      // Hold in React memory only as fallback if the browser strips iframe cookies
      sessionTokenRef.current = cleanedToken;
      setPatInput('');
      setPublicUser(null);
      setSelectedRepo(null);
      setStatus((prev) => ({
        oauthConfigured: prev?.oauthConfigured ?? false,
        callbackUrl: prev?.callbackUrl ?? '',
        connected: true,
        scopes: data.scopes ?? [],
        user: data.user ?? null,
      }));
      setSuccessMsg(t.ghConnectedBadge);
      await Promise.all([fetchRepos(), fetchGists()]);
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setPatSubmitting(false);
    }
  };

  const handleConnectPublic = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parsePublicGitHubTarget(publicInput);
    if (!parsed || publicSubmitting) {
      setErrorMsg(t.ghPublicNotFound);
      return;
    }

    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setPublicSubmitting(true);

    try {
      if (parsed.kind === 'repo') {
        const res = await apiFetch(
          `/api/github/repos?action=public-repo&owner=${encodeURIComponent(parsed.owner)}&repo=${encodeURIComponent(parsed.repo)}`
        );
        const data = await safeReadJson<{ repo?: RepoSummary; error?: string }>(res);
        if (!res.ok || !data?.repo) {
          setErrorMsg(
            data?.error === 'GITHUB_RATE_LIMITED'
              ? t.ghRateLimitError
              : data?.error === 'GITHUB_REPO_NOT_FOUND' || res.status === 404
                ? t.ghPublicNotFound
                : t.ghApiError
          );
          return;
        }
        const ownerProfileRes = await apiFetch(
          `/api/github/repos?action=public-profile&username=${encodeURIComponent(data.repo.owner)}`
        );
        const ownerData = await safeReadJson<{ user?: GitHubUser; repos?: RepoSummary[] }>(
          ownerProfileRes
        );
        setPublicUser(
          ownerData?.user ?? {
            login: data.repo.owner,
            name: data.repo.owner,
            avatar_url: '',
            html_url: `https://github.com/${data.repo.owner}`,
            public_repos: 1,
          }
        );
        const mergedRepos = ownerData?.repos?.some((r) => r.id === data.repo!.id)
          ? ownerData.repos
          : [data.repo, ...(ownerData?.repos ?? [])];
        setRepos(mergedRepos);
        setActiveTab('repos');
        setSuccessMsg(t.ghPublicConnectedBadge);
        await handleBrowseRepo(data.repo, '');
      } else {
        const res = await apiFetch(
          `/api/github/repos?action=public-profile&username=${encodeURIComponent(parsed.username)}`
        );
        const data = await safeReadJson<{
          user?: GitHubUser;
          repos?: RepoSummary[];
          error?: string;
        }>(res);
        if (!res.ok || !data?.user) {
          setErrorMsg(
            data?.error === 'GITHUB_RATE_LIMITED'
              ? t.ghRateLimitError
              : data?.error === 'GITHUB_USER_NOT_FOUND' || res.status === 404
                ? t.ghPublicNotFound
                : t.ghApiError
          );
          return;
        }
        setPublicUser(data.user);
        setRepos(Array.isArray(data.repos) ? data.repos : []);
        setSelectedRepo(null);
        setActiveTab('repos');
        setSuccessMsg(t.ghPublicConnectedBadge);
      }
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setPublicSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    sessionTokenRef.current = null;
    setPublicUser(null);
    setRepos([]);
    setGists([]);
    setSelectedRepo(null);
    setRepoItems([]);
    setRepoPath('');
    await apiFetch('/api/github/logout', { method: 'POST' }).catch(() => {});
    await fetchStatus();
  };

  const handleCopyCallback = async () => {
    if (!status?.callbackUrl) return;
    await navigator.clipboard.writeText(status.callbackUrl).catch(() => {});
    setCopiedCallback(true);
    window.setTimeout(() => setCopiedCallback(false), 1800);
  };

  const handlePushWheelToRepo = async (repo: RepoSummary) => {
    if (!isAuthConnected) {
      setInfoMsg(t.ghReadOnlyNotice);
      return;
    }
    if (activeWheel.entries.length === 0) {
      setErrorMsg(t.ghEmptyWheelWarn);
      return;
    }
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setPushingRepoId(repo.id);

    try {
      const res = await apiFetch('/api/github/repo-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          branch: repo.defaultBranch,
          title: activeWheel.title,
          entries: activeWheel.entries,
          paletteId: activeWheel.paletteId,
        }),
      });
      const data = await safeReadJson<{
        ok?: boolean;
        htmlUrl?: string;
        detail?: string;
      }>(res);
      if (!res.ok || !data?.ok) {
        setErrorMsg(data?.detail || t.ghApiError);
        return;
      }
      setSuccessMsg(t.ghPushSuccess);
      setSuccessLink(data.htmlUrl || null);
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setPushingRepoId(null);
    }
  };

  const handleImportContributors = async (repo: RepoSummary) => {
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setRepoActionLoading(true);
    try {
      const res = await apiFetch(
        `/api/github/repos?action=contributors&owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`
      );
      const data = await safeReadJson<{ contributors?: string[]; error?: string }>(res);
      if (!res.ok || !Array.isArray(data?.contributors) || data.contributors.length === 0) {
        setErrorMsg(
          data?.error === 'GITHUB_RATE_LIMITED' ? t.ghRateLimitError : t.ghApiError
        );
        return;
      }
      const nextEntries = data.contributors.slice(0, MAX_WHEEL_ENTRIES);
      updateActiveWheel({
        title: `${repo.name} Contributors`,
        entries: nextEntries,
      });
      setSuccessMsg(t.ghLoadedToast(nextEntries.length));
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setRepoActionLoading(false);
    }
  };

  const handleBrowseRepo = async (repo: RepoSummary, path = '') => {
    setSelectedRepo(repo);
    setRepoPath(path);
    setRepoActionLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const res = await apiFetch(
        `/api/github/repos?action=contents&owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}&path=${encodeURIComponent(path)}`
      );
      const data = await safeReadJson<{ items?: RepoContentItem[]; error?: string }>(res);
      if (!res.ok) {
        setErrorMsg(
          data?.error === 'GITHUB_RATE_LIMITED' ? t.ghRateLimitError : t.ghApiError
        );
        return;
      }
      setRepoItems(Array.isArray(data?.items) ? data.items : []);
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setRepoActionLoading(false);
    }
  };

  const handleImportRepoFile = async (repo: RepoSummary, item: RepoContentItem) => {
    setRepoActionLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(
        `/api/github/repos?action=file&owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}&path=${encodeURIComponent(item.path)}`
      );
      const data = await safeReadJson<{
        file?: { name: string; content: string };
        error?: string;
      }>(res);
      if (!res.ok || !data?.file) {
        setErrorMsg(
          data?.error === 'GITHUB_RATE_LIMITED' ? t.ghRateLimitError : t.ghApiError
        );
        return;
      }
      const parsed = parseEntriesFromGitHubText(data.file.name, data.file.content);
      if (parsed.entries.length === 0) {
        setErrorMsg(t.scanDocEmptyError);
        return;
      }
      updateActiveWheel({
        ...(parsed.title ? { title: parsed.title } : {}),
        entries: parsed.entries,
      });
      setSuccessMsg(t.ghLoadedToast(parsed.entries.length));
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setRepoActionLoading(false);
    }
  };

  const handleBackupToGist = async () => {
    if (!isAuthConnected) {
      setInfoMsg(t.ghReadOnlyNotice);
      return;
    }
    if (activeWheel.entries.length === 0) {
      setErrorMsg(t.ghEmptyWheelWarn);
      return;
    }
    setSavingGist(true);
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    try {
      const res = await apiFetch('/api/github/gists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeWheel.title,
          entries: activeWheel.entries,
          paletteId: activeWheel.paletteId,
          isPublic: gistPublic,
        }),
      });
      const data = await safeReadJson<{ gist?: GistSummary; detail?: string }>(res);
      if (!res.ok || !data?.gist) {
        setErrorMsg(data?.detail || t.ghApiError);
        return;
      }
      setGists((prev) => [data.gist!, ...prev]);
      setSuccessMsg(t.ghGistSavedMsg);
      setSuccessLink(data.gist.htmlUrl);
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setSavingGist(false);
    }
  };

  const handleLoadGist = async (gist: GistSummary) => {
    setLoadingGistId(gist.id);
    setErrorMsg(null);
    setInfoMsg(null);
    setSuccessMsg(null);
    try {
      const res = await apiFetch(
        `/api/github/gists?gistId=${encodeURIComponent(gist.id)}`
      );
      const data = await safeReadJson<{
        gist?: { files: Array<{ filename: string; content: string }> };
      }>(res);
      const files = data?.gist?.files || [];
      const jsonFile = files.find((f) => f.filename.toLowerCase().endsWith('.json'));
      const candidate = jsonFile || files[0];
      if (!candidate) {
        setErrorMsg(t.scanDocEmptyError);
        return;
      }
      const parsed = parseEntriesFromGitHubText(candidate.filename, candidate.content);
      if (parsed.entries.length === 0) {
        setErrorMsg(t.scanDocEmptyError);
        return;
      }
      updateActiveWheel({
        ...(parsed.title ? { title: parsed.title } : {}),
        entries: parsed.entries,
      });
      setSuccessMsg(t.ghLoadedToast(parsed.entries.length));
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setLoadingGistId(null);
    }
  };

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    if (!q) return repos;
    return repos.filter(
      (r) =>
        r.fullName.toLowerCase().includes(q) ||
        (r.description && r.description.toLowerCase().includes(q))
    );
  }, [repos, repoSearch]);

  const parentFolderPath = useMemo(() => {
    if (!repoPath) return '';
    const parts = repoPath.split('/').filter(Boolean);
    parts.pop();
    return parts.join('/');
  }, [repoPath]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5 text-balance">
              <Github className="w-7 h-7 text-slate-900 dark:text-white shrink-0" />
              <span>{t.ghTitle}</span>
            </h1>
            <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              {t.ghDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('home')}
            className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 self-start sm:self-auto cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span>{t.navHome}</span>
          </button>
        </div>

        {/* Feedback banners */}
        {infoMsg && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-sm text-amber-800 dark:text-amber-200 space-y-2.5">
            <div className="flex items-start gap-2.5">
              <Info className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span className="leading-relaxed">{infoMsg}</span>
            </div>
            {blockedAuthUrl && (
              <a
                href={blockedAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>{t.ghOpenUrlFallback}</span>
              </a>
            )}
          </div>
        )}

        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-sm text-emerald-700 dark:text-emerald-300 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 font-medium">
              <Check className="w-5 h-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
            {successLink && (
              <a
                href={successLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold underline hover:no-underline whitespace-nowrap"
              >
                <span>GitHub</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* Connection Card */}
        <section className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
          {statusLoading ? (
            <div className="py-8 flex items-center justify-center gap-2.5 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
              <span>{t.ghConnecting}</span>
            </div>
          ) : isWorkspaceConnected && activeUser ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                    {activeUser.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={activeUser.avatar_url}
                        alt={activeUser.login}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      activeUser.login.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                        {activeUser.name || activeUser.login}
                      </span>
                      <a
                        href={activeUser.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-[#3B82F6] hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        @{activeUser.login}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                      {isAuthConnected ? t.ghConnectedBadge : t.ghPublicConnectedBadge}
                      {' · '}
                      {activeUser.public_repos}{' '}
                      {isKm ? 'repos សាធារណៈ' : 'public repos'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {isAuthConnected && (
                    <button
                      type="button"
                      onClick={() => void fetchStatus()}
                      className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                      <span>{isKm ? 'ផ្ទុកឡើងវិញ' : 'Refresh'}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.ghDisconnectBtn}</span>
                  </button>
                </div>
              </div>

              {!isAuthConnected && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="leading-relaxed">{t.ghReadOnlyNotice}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setPublicUser(null);
                      setConnectMethod('pat');
                    }}
                    className="min-h-[36px] px-3.5 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                  >
                    <KeyRound className="w-3.5 h-3.5 shrink-0" />
                    <span>{t.ghUpgradeAuthBtn}</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-5">
              {/* Primary Connect Buttons */}
              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  disabled={connectingOAuth}
                  onClick={handleConnectOAuth}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold inline-flex items-center gap-2 shadow-sm transition-colors cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
                >
                  {connectingOAuth ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Github className="w-4 h-4 shrink-0" />
                  )}
                  <span>{connectingOAuth ? t.ghConnecting : t.ghConnectOAuthBtn}</span>
                  {status && (
                    <span className="text-[11px] font-medium opacity-75">
                      · {status.oauthConfigured ? t.ghOAuthReadyBadge : t.ghOAuthSetupNeededBadge}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConnectMethod('pat');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    connectMethod === 'pat'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <KeyRound className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span>{t.ghPatToggleBtn}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setConnectMethod('public');
                    setErrorMsg(null);
                    setInfoMsg(null);
                  }}
                  className={`min-h-[44px] px-4 py-2.5 rounded-xl border text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    connectMethod === 'public'
                      ? 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-[#3B82F6] dark:text-blue-400'
                      : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <Globe className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span>{t.ghPublicToggleBtn}</span>
                </button>
              </div>

              {/* PAT Quick Connect Form */}
              {connectMethod === 'pat' ? (
                <form
                  onSubmit={handleConnectPat}
                  className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
                >
                  <label
                    htmlFor="gh-pat-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {t.ghPatLabel}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="gh-pat-input"
                      type="password"
                      value={patInput}
                      onChange={(e) => setPatInput(e.target.value)}
                      placeholder={t.ghPatPlaceholder}
                      autoComplete="off"
                      className="flex-1 min-w-0 min-h-[42px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!patInput.trim() || patSubmitting}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {patSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Link2 className="w-4 h-4 shrink-0" />
                      )}
                      <span>{t.ghConnectPatBtn}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.ghPatHint}{' '}
                    <a
                      href="https://github.com/settings/tokens/new?scopes=repo,gist,read:user&description=Pickerwel"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#3B82F6] hover:underline inline-flex items-center gap-1"
                    >
                      github.com/settings/tokens
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </p>
                </form>
              ) : (
                /* Public GitHub Username / Repo Quick Connect */
                <form
                  onSubmit={handleConnectPublic}
                  className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3"
                >
                  <label
                    htmlFor="gh-public-input"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {t.ghPublicLabel}
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      id="gh-public-input"
                      type="text"
                      value={publicInput}
                      onChange={(e) => setPublicInput(e.target.value)}
                      placeholder={t.ghPublicPlaceholder}
                      autoComplete="off"
                      className="flex-1 min-w-0 min-h-[42px] px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="submit"
                      disabled={!publicInput.trim() || publicSubmitting}
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-50 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {publicSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                      ) : (
                        <Globe className="w-4 h-4 shrink-0" />
                      )}
                      <span>{t.ghPublicConnectBtn}</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.ghPublicHint}
                  </p>
                </form>
              )}

              {/* Callback URI Instructions for GitHub OAuth App */}
              {status?.callbackUrl && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {t.ghCallbackLabel}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyCallback}
                      className="min-h-[34px] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      {copiedCallback ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          <span>{t.ghCopiedMsg}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 shrink-0" />
                          <span>{t.ghCopyBtn}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <code className="block w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-mono text-xs text-slate-800 dark:text-slate-200 overflow-x-auto select-all">
                    {status.callbackUrl}
                  </code>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {t.ghCallbackHint}
                  </p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Connected GitHub Tools */}
        {isWorkspaceConnected && (
          <section className="space-y-4">
            {/* Active Wheel Summary + Segmented Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start">
                <button
                  type="button"
                  onClick={() => setActiveTab('repos')}
                  className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    activeTab === 'repos'
                      ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <FolderGit2 className="w-4 h-4 shrink-0" />
                  <span>{t.ghTabRepos}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {repos.length}
                  </span>
                </button>
                {isAuthConnected && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('gists')}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      activeTab === 'gists'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <FileCode2 className="w-4 h-4 shrink-0" />
                    <span>{t.ghTabGists}</span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {gists.length}
                    </span>
                  </button>
                )}
              </div>

              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {activeWheel.title}
                </span>
                {' · '}
                <span className="tabular-nums">
                  {t.entriesCount(activeWheel.entries.length)}
                </span>
              </div>
            </div>

            {activeTab === 'repos' ? (
              selectedRepo ? (
                /* File Browser inside selected Repo */
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (repoPath) {
                            void handleBrowseRepo(selectedRepo, parentFolderPath);
                          } else {
                            setSelectedRepo(null);
                            setRepoItems([]);
                          }
                        }}
                        className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                      >
                        <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                        <span>{t.ghBackFolderBtn}</span>
                      </button>
                      <span className="font-mono text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {selectedRepo.fullName}
                        {repoPath ? `/${repoPath}` : ''}
                      </span>
                    </div>

                    {isAuthConnected && (
                      <button
                        type="button"
                        disabled={pushingRepoId === selectedRepo.id}
                        onClick={() => void handlePushWheelToRepo(selectedRepo)}
                        className="min-h-[36px] px-3.5 py-1.5 rounded-xl bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-60"
                      >
                        {pushingRepoId === selectedRepo.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        ) : (
                          <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                        )}
                        <span>
                          {pushingRepoId === selectedRepo.id
                            ? t.ghPushingMsg
                            : t.ghPushWheelBtn}
                        </span>
                      </button>
                    )}
                  </div>

                  {repoActionLoading ? (
                    <div className="py-8 flex items-center justify-center text-slate-500">
                      <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {repoItems.map((item) => {
                        const isImportable =
                          item.type === 'file' &&
                          /\.(txt|csv|tsv|json|md)$/i.test(item.name);
                        return (
                          <div
                            key={item.path}
                            className="py-2.5 flex items-center justify-between gap-3"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.type === 'dir' ? (
                                <Folder className="w-4 h-4 text-[#3B82F6] shrink-0" />
                              ) : (
                                <FileText className="w-4 h-4 text-slate-400 shrink-0" />
                              )}
                              {item.type === 'dir' ? (
                                <button
                                  type="button"
                                  onClick={() => void handleBrowseRepo(selectedRepo, item.path)}
                                  className="text-sm font-medium text-slate-900 dark:text-white hover:text-[#3B82F6] truncate cursor-pointer text-left"
                                >
                                  {item.name}
                                </button>
                              ) : (
                                <span className="text-sm text-slate-700 dark:text-slate-200 truncate">
                                  {item.name}
                                </span>
                              )}
                            </div>

                            {isImportable && (
                              <button
                                type="button"
                                onClick={() => void handleImportRepoFile(selectedRepo, item)}
                                className="min-h-[34px] px-3 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[#3B82F6] dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                              >
                                <DownloadCloud className="w-3.5 h-3.5 shrink-0" />
                                <span>{t.ghImportFileBtn}</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Repositories List */
                <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-4">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder={t.ghReposSearchPlaceholder}
                      className="w-full min-h-[42px] pl-10 pr-4 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {reposLoading ? (
                    <div className="py-10 flex items-center justify-center">
                      <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
                    </div>
                  ) : filteredRepos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      {t.ghReposEmpty}
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredRepos.map((repo) => (
                        <div
                          key={repo.id}
                          className="py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 text-sm">
                              <a
                                href={repo.htmlUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-slate-900 dark:text-white hover:text-[#3B82F6] truncate"
                              >
                                {repo.fullName}
                              </a>
                              <span className="text-xs text-slate-400 shrink-0">
                                {repo.isPrivate
                                  ? isKm
                                    ? '· ឯកជន'
                                    : '· Private'
                                  : isKm
                                    ? '· សាធារណៈ'
                                    : '· Public'}
                              </span>
                            </div>
                            {repo.description && (
                              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                                {repo.description}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => void handleBrowseRepo(repo)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                            >
                              <Folder className="w-3.5 h-3.5 shrink-0" />
                              <span>{t.ghBrowseFilesBtn}</span>
                            </button>
                            <button
                              type="button"
                              disabled={repoActionLoading}
                              onClick={() => void handleImportContributors(repo)}
                              className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
                            >
                              <Users className="w-3.5 h-3.5 shrink-0" />
                              <span>{t.ghImportContributorsBtn}</span>
                            </button>
                            {isAuthConnected && (
                              <button
                                type="button"
                                disabled={pushingRepoId === repo.id}
                                onClick={() => void handlePushWheelToRepo(repo)}
                                className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#3B82F6] hover:bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap disabled:opacity-60"
                              >
                                {pushingRepoId === repo.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                                ) : (
                                  <UploadCloud className="w-3.5 h-3.5 shrink-0" />
                                )}
                                <span>
                                  {pushingRepoId === repo.id
                                    ? t.ghPushingMsg
                                    : t.ghPushWheelBtn}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            ) : (
              /* GitHub Gists Tab */
              <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={gistPublic}
                      onChange={(e) => setGistPublic(e.target.checked)}
                      className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                    />
                    <span>{t.ghSaveGistPublicLabel}</span>
                  </label>

                  <button
                    type="button"
                    disabled={savingGist}
                    onClick={handleBackupToGist}
                    className="min-h-[40px] px-4 py-2 rounded-xl bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {savingGist ? (
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                    ) : (
                      <UploadCloud className="w-4 h-4 shrink-0" />
                    )}
                    <span>{t.ghSaveGistBtn}</span>
                  </button>
                </div>

                {gistsLoading ? (
                  <div className="py-10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-[#3B82F6]" />
                  </div>
                ) : gists.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                    {t.ghGistsEmpty}
                  </p>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {gists.map((gist) => (
                      <div
                        key={gist.id}
                        className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <a
                            href={gist.htmlUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-semibold text-slate-900 dark:text-white hover:text-[#3B82F6] truncate block"
                          >
                            {gist.description}
                          </a>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono truncate">
                            {gist.filenames.join(', ')}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={loadingGistId === gist.id}
                          onClick={() => void handleLoadGist(gist)}
                          className="min-h-[36px] px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-[#3B82F6] dark:text-blue-400 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-auto"
                        >
                          {loadingGistId === gist.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                          ) : (
                            <DownloadCloud className="w-3.5 h-3.5 shrink-0" />
                          )}
                          <span>{t.ghLoadGistBtn}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
