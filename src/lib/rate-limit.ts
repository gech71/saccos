// Use the global fetch available in modern Node / Next.js runtimes.

type RLRecord = { count: number; expiresAt: number };

const memoryStore = new Map<string, RLRecord>();

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function upstashIncr(key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  const incrRes = await fetch(`${url}/incr/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const incrJson = await incrRes.json();
  return incrJson.result as number;
}

async function upstashTTL(key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  const ttlRes = await fetch(`${url}/ttl/${encodeURIComponent(key)}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  const ttlJson = await ttlRes.json();
  return ttlJson.result as number;
}

async function upstashExpire(key: string, seconds: number) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  await fetch(`${url}/expire/${encodeURIComponent(key)}/${seconds}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

async function upstashDel(key: string) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash not configured');

  await fetch(`${url}/del/${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function rateLimitCheck(key: string, limit: number, windowSeconds: number) {
  // Prefer Upstash Redis if configured
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const count = await upstashIncr(key);
      const ttl = await upstashTTL(key);
      if (ttl === -1) {
        await upstashExpire(key, windowSeconds);
      }
      return { allowed: count <= limit, count, remaining: Math.max(0, limit - count) };
    }
  } catch (err) {
    // Fall through to memory fallback
    // eslint-disable-next-line no-console
    console.warn('Upstash rate limiter failed, using memory fallback:', err);
  }

  // Memory fallback
  const now = Date.now();
  const rec = memoryStore.get(key);
  if (!rec || rec.expiresAt < now) {
    memoryStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { allowed: 1 <= limit, count: 1, remaining: Math.max(0, limit - 1) };
  }
  rec.count += 1;
  memoryStore.set(key, rec);
  return { allowed: rec.count <= limit, count: rec.count, remaining: Math.max(0, limit - rec.count) };
}

export async function rateLimitReset(key: string) {
  try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      await upstashDel(key);
      return;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Upstash del failed, clearing memory fallback instead:', err);
  }
  memoryStore.delete(key);
}

export async function rateLimitDelay(ms = 300) {
  await sleep(ms);
}
