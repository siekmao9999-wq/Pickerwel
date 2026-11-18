'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
          entries: parsed.map((v) => String(v).trim()).filter(Boolean).slice(0, MAX_WHEEL_ENTRIES),
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

export function GitHubConnectPanel() {
  const { settings, activeWheel, updateActiveWheel, setActiveNav } = usePickerwel();
  const t = COPY[settings.language];
  const isKm = settings.language === 'km';

  const [statusLoading, setStatusLoading] = useState(true);
  const [status, setStatus] = useState<GitHubStatusResponse | null>(null);
  const [connectingOAuth, setConnectingOAuth] = useState(false);
  const [blockedAuthUrl, setBlockedAuthUrl] = useState<string | null>(null);

  const [patOpen, setPatOpen] = useState(false);
  const [patInput, setPatInput] = useState('');
  const [patSubmitting, setPatSubmitting] = useState(false);

  const [copiedCallback, setCopiedCallback] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
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

  const fetchRepos = useCallback(async () => {
    setReposLoading(true);
    try {
      const res = await fetch('/api/github/repos');
      if (!res.ok) return;
      const data = (await res.json()) as { repos?: RepoSummary[] };
      setRepos(Array.isArray(data.repos) ? data.repos : []);
    } finally {
      setReposLoading(false);
    }
  }, []);

  const fetchGists = useCallback(async () => {
    setGistsLoading(true);
    try {
      const res = await fetch('/api/github/gists');
      if (!res.ok) return;
      const data = (await res.json()) as { gists?: GistSummary[] };
      setGists(Array.isArray(data.gists) ? data.gists : []);
    } finally {
      setGistsLoading(false);
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/github/status', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as GitHubStatusResponse;
      setStatus(data);
      if (data.connected) {
        await Promise.all([fetchRepos(), fetchGists()]);
      } else {
        setRepos([]);
        setGists([]);
        setSelectedRepo(null);
      }
    } finally {
      setStatusLoading(false);
    }
  }, [fetchRepos, fetchGists]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Listen for OAuth popup postMessage completion
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin || '';
      const validOrigin =
        origin.endsWith('.run.app') ||
        origin.includes('localhost') ||
        origin === window.location.origin;
      if (!validOrigin) return;

      if (event.data?.type === 'OAUTH_AUTH_SUCCESS' && event.data?.provider === 'github') {
        setConnectingOAuth(false);
        setBlockedAuthUrl(null);
        setErrorMsg(null);
        setSuccessLink(null);
        setSuccessMsg(t.ghConnectedBadge);
        void fetchStatus();
      } else if (event.data?.type === 'OAUTH_AUTH_ERROR' && event.data?.provider === 'github') {
        setConnectingOAuth(false);
        setErrorMsg(
          typeof event.data?.error === 'string' ? event.data.error : t.ghApiError
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchStatus, t.ghConnectedBadge, t.ghApiError]);

  const handleConnectOAuth = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setBlockedAuthUrl(null);
    setConnectingOAuth(true);

    try {
      const res = await fetch('/api/github/auth-url', { cache: 'no-store' });
      const data = (await res.json()) as {
        url?: string;
        error?: string;
        callbackUrl?: string;
      };

      if (!res.ok || !data.url) {
        setConnectingOAuth(false);
        if (data.error === 'OAUTH_NOT_CONFIGURED') {
          setPatOpen(true);
          setErrorMsg(t.ghOAuthMissingHint);
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
        setErrorMsg(t.ghPopupBlockedHint);
      }
    } catch {
      setConnectingOAuth(false);
      setErrorMsg(t.ghApiError);
    }
  };

  const handleConnectPat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patInput.trim() || patSubmitting) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setPatSubmitting(true);

    try {
      const res = await fetch('/api/github/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: patInput.trim() }),
      });

      if (!res.ok) {
        setErrorMsg(t.ghTokenError);
        return;
      }

      setPatInput('');
      setPatOpen(false);
      setSuccessMsg(t.ghConnectedBadge);
      await fetchStatus();
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setPatSubmitting(false);
    }
  };

  const handleDisconnect = async () => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    await fetch('/api/github/logout', { method: 'POST' });
    await fetchStatus();
  };

  const handleCopyCallback = async () => {
    if (!status?.callbackUrl) return;
    await navigator.clipboard.writeText(status.callbackUrl).catch(() => {});
    setCopiedCallback(true);
    window.setTimeout(() => setCopiedCallback(false), 1800);
  };

  const handlePushWheelToRepo = async (repo: RepoSummary) => {
    if (activeWheel.entries.length === 0) {
      setErrorMsg(t.ghEmptyWheelWarn);
      return;
    }
    setErrorMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    setPushingRepoId(repo.id);

    try {
      const res = await fetch('/api/github/repo-sync', {
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
      const data = (await res.json()) as {
        ok?: boolean;
        htmlUrl?: string;
        detail?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorMsg(data.detail || t.ghApiError);
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
    setSuccessMsg(null);
    setSuccessLink(null);
    setRepoActionLoading(true);
    try {
      const res = await fetch(
        `/api/github/repos?action=contributors&owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}`
      );
      const data = (await res.json()) as { contributors?: string[] };
      if (!res.ok || !Array.isArray(data.contributors) || data.contributors.length === 0) {
        setErrorMsg(t.ghApiError);
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
    try {
      const res = await fetch(
        `/api/github/repos?action=contents&owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}&path=${encodeURIComponent(path)}`
      );
      const data = (await res.json()) as { items?: RepoContentItem[] };
      if (!res.ok) {
        setErrorMsg(t.ghApiError);
        return;
      }
      setRepoItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setErrorMsg(t.ghApiError);
    } finally {
      setRepoActionLoading(false);
    }
  };

  const handleImportRepoFile = async (repo: RepoSummary, item: RepoContentItem) => {
    setRepoActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(
        `/api/github/repos?action=file&owner=${encodeURIComponent(repo.owner)}&repo=${encodeURIComponent(repo.name)}&path=${encodeURIComponent(item.path)}`
      );
      const data = (await res.json()) as {
        file?: { name: string; content: string };
      };
      if (!res.ok || !data.file) {
        setErrorMsg(t.ghApiError);
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
    if (activeWheel.entries.length === 0) {
      setErrorMsg(t.ghEmptyWheelWarn);
      return;
    }
    setSavingGist(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSuccessLink(null);
    try {
      const res = await fetch('/api/github/gists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: activeWheel.title,
          entries: activeWheel.entries,
          paletteId: activeWheel.paletteId,
          isPublic: gistPublic,
        }),
      });
      const data = (await res.json()) as { gist?: GistSummary };
      if (!res.ok || !data.gist) {
        setErrorMsg(t.ghApiError);
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
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/github/gists?gistId=${encodeURIComponent(gist.id)}`);
      const data = (await res.json()) as {
        gist?: { files: Array<{ filename: string; content: string }> };
      };
      const files = data.gist?.files || [];
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
        {errorMsg && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-sm text-rose-700 dark:text-rose-300 space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            {blockedAuthUrl && (
              <a
                href={blockedAuthUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold whitespace-nowrap"
              >
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <span>{t.ghOpenUrlFallback}</span>
              </a>
            )}
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
          ) : status?.connected && status.user ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200">
                  {status.user.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={status.user.avatar_url}
                      alt={status.user.login}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    status.user.login.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-base font-bold text-slate-900 dark:text-white truncate">
                      {status.user.name || status.user.login}
                    </span>
                    <a
                      href={status.user.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-[#3B82F6] hover:underline inline-flex items-center gap-1 shrink-0"
                    >
                      @{status.user.login}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    {t.ghConnectedBadge}
                    {' · '}
                    {status.user.public_repos} {isKm ? 'repos សាធារណៈ' : 'public repos'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => void fetchStatus()}
                  className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5 shrink-0" />
                  <span>{isKm ? 'ផ្ទុកឡើងវិញ' : 'Refresh'}</span>
                </button>
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
          ) : (
            <div className="space-y-5">
              {/* Primary Connect Buttons */}
              <div className="flex flex-wrap items-center gap-3">
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
                </button>

                <button
                  type="button"
                  onClick={() => setPatOpen((v) => !v)}
                  className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-semibold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <KeyRound className="w-4 h-4 text-[#3B82F6] shrink-0" />
                  <span>{t.ghPatToggleBtn}</span>
                </button>
              </div>

              {/* PAT Quick Connect Form */}
              {(patOpen || status?.oauthConfigured === false) && (
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
        {status?.connected && (
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
