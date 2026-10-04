// ============================================================================
// In-Memory & Session-Backed Fast Data Cache
// ============================================================================

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheItem<unknown>>();

/**
 * Retrieves cached data by key if not expired.
 * @param key unique cache identifier
 * @param maxAgeMs time-to-live in milliseconds (default: 5 minutes)
 */
export function getCachedData<T>(key: string, maxAgeMs = 5 * 60 * 1000): T | null {
  // 1. In-memory check (fastest: 0ms)
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < maxAgeMs) {
    return mem.data as T;
  }

  // 2. SessionStorage check (persists across page reloads without disk clutter)
  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(`kk_cache_${key}`);
      if (raw) {
        const parsed: CacheItem<T> = JSON.parse(raw);
        if (Date.now() - parsed.timestamp < maxAgeMs) {
          memoryCache.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Stores data in both memory and sessionStorage.
 */
export function setCachedData<T>(key: string, data: T): void {
  const item: CacheItem<T> = { data, timestamp: Date.now() };
  memoryCache.set(key, item);
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(`kk_cache_${key}`, JSON.stringify(item));
    } catch {
      // quota exceeded or private mode
    }
  }
}

/**
 * Invalidates a specific cache key or all keys matching a prefix.
 */
export function invalidateCache(prefix?: string): void {
  if (!prefix) {
    memoryCache.clear();
    return;
  }
  for (const k of memoryCache.keys()) {
    if (k.startsWith(prefix)) {
      memoryCache.delete(k);
    }
  }
}
