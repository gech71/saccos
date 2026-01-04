"use client";

let _cachedToken: string | null = null;

export async function ensureCsrfToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  if (_cachedToken) return _cachedToken;
  try {
    const res = await fetch('/api/csrf', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    _cachedToken = data?.csrfToken ?? null;
    return _cachedToken;
  } catch (err) {
    // Non-fatal: return null so callers can handle gracefully
    // eslint-disable-next-line no-console
    console.error('[use-csrf] fetch error', err);
    return null;
  }
}

export function clearCachedCsrfToken() {
  _cachedToken = null;
}
