"use client";

let cachedToken: string | null = null;
let cachedTokenExpiresAt = 0;

export async function ensureCsrfToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now) {
    return cachedToken;
  }

  try {
    const res = await fetch('/api/csrf', { method: 'GET', credentials: 'include' });
    if (!res.ok) return null;
    const data = await res.json();
    const token = data?.csrfToken ?? null;
    if (token) {
      // Cache token for 14 minutes (slightly less than server TTL of 15m)
      cachedToken = token;
      cachedTokenExpiresAt = now + 14 * 60 * 1000;
    }
    return token;
  } catch (err) {
    console.error('[use-csrf] Failed to fetch CSRF token', err);
    return null;
  }
}

export default ensureCsrfToken;
