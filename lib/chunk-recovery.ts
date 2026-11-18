const CHUNK_RELOAD_STORAGE_KEY = 'pickerwel_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15_000;

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;

  const message =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? `${err.name}: ${err.message}`
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message?: unknown }).message ?? '')
          : '';

  const name =
    typeof err === 'object' && err !== null && 'name' in err
      ? String((err as { name?: unknown }).name ?? '')
      : '';

  return (
    name === 'ChunkLoadError' ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\w/.-]+ failed/i.test(message) ||
    /Loading CSS chunk [\w/.-]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message)
  );
}

/**
 * Performs a single guarded reload to fetch a fresh webpack chunk manifest
 * when a stale client session hits a ChunkLoadError across rebuilds.
 */
export function attemptChunkRecovery(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const raw = window.sessionStorage.getItem(CHUNK_RELOAD_STORAGE_KEY);
    const lastAttempt = raw ? Number(raw) : 0;
    const now = Date.now();
    if (Number.isFinite(lastAttempt) && now - lastAttempt < CHUNK_RELOAD_COOLDOWN_MS) {
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // sessionStorage unavailable in restricted context; avoid infinite reloads
    return false;
  }

  window.location.reload();
  return true;
}
