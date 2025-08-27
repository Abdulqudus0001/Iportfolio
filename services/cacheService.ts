interface CacheItem<T> {
  timestamp: number;
  data: T;
}

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const CACHE_PREFIX = 'iportfolio-cache-';

export const cacheService = {
  get: <T>(key: string): T | null => {
    try {
      const itemStr = localStorage.getItem(CACHE_PREFIX + key);
      if (!itemStr) {
        return null;
      }
      const item: CacheItem<T> = JSON.parse(itemStr);
      const now = new Date().getTime();
      if (now - item.timestamp > CACHE_TTL) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return null;
      }
      return item.data;
    } catch (error) {
      console.error(`Error getting cache for key ${key}`, error);
      return null;
    }
  },

  getStale: <T>(key: string): T | null => {
    try {
      const itemStr = localStorage.getItem(CACHE_PREFIX + key);
      if (!itemStr) {
        return null;
      }
      const item: CacheItem<T> = JSON.parse(itemStr);
      return item.data;
    } catch (error) {
      console.error(`Error getting stale cache for key ${key}`, error);
      return null;
    }
  },

  set: <T>(key: string, data: T): void => {
    try {
      if(!data || (Array.isArray(data) && data.length === 0)) return; // Do not cache empty results
      const item: CacheItem<T> = {
        timestamp: new Date().getTime(),
        data,
      };
      localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(item));
    } catch (error) {
      console.error(`Error setting cache for key ${key}`, error);
    }
  },

  withCache: async <T>(key: string, fetcher: () => Promise<T>, staticFallback: T): Promise<{ data: T; source: 'live' | 'cache' | 'static' }> => {
    const cached = cacheService.get<T>(key);
    if (cached) {
        return { data: cached, source: 'cache' };
    }
    try {
        const liveData = await fetcher();
        cacheService.set(key, liveData);
        return { data: liveData, source: 'live' };
    } catch (error) {
        console.warn(`Live data fetch failed for ${key}. Using static fallback.`, error);
        const stale = cacheService.getStale<T>(key);
        if (stale) return { data: stale, source: 'cache' };
        return { data: staticFallback, source: 'static' };
    }
  },
};