interface CacheItem<T> {
  timestamp: number;
  data: T;
}

// Define various TTLs for tiered caching
export const TTL = {
    FIFTEEN_MINUTES: 15 * 60 * 1000,
    ONE_HOUR: 60 * 60 * 1000,
    SIX_HOURS: 6 * 60 * 60 * 1000,
    TWENTY_FOUR_HOURS: 24 * 60 * 60 * 1000,
};

const CACHE_PREFIX = 'iportfolio-cache-';

export const cacheService = {
  get: <T>(key: string, ttl: number = TTL.FIFTEEN_MINUTES): T | null => {
    try {
      const itemStr = localStorage.getItem(CACHE_PREFIX + key);
      if (!itemStr) {
        return null;
      }
      const item: CacheItem<T> = JSON.parse(itemStr);
      const now = new Date().getTime();
      if (now - item.timestamp > ttl) {
        // Don't remove here, let stale-while-revalidate handle it
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

  withCache: async <T>(key: string, fetcher: () => Promise<T>, staticFallback: T, ttl: number = TTL.FIFTEEN_MINUTES): Promise<{ data: T; source: 'live' | 'cache' | 'static' }> => {
    const cachedFresh = cacheService.get<T>(key, ttl);
    
    // 1. If fresh data exists, return it immediately.
    if (cachedFresh) {
        return { data: cachedFresh, source: 'cache' };
    }

    const cachedStale = cacheService.getStale<T>(key);

    // This function triggers a background refresh. It's a "fire-and-forget" promise.
    const revalidate = () => {
        fetcher().then(liveData => {
            console.log(`Background revalidation successful for ${key}.`);
            cacheService.set(key, liveData);
        }).catch(error => {
            console.warn(`Background revalidation failed for ${key}.`, error);
        });
    };

    // 2. If stale data exists, return it now and trigger a revalidation in the background.
    if (cachedStale) {
        console.log(`Serving stale data for ${key} and revalidating in background.`);
        revalidate(); 
        return { data: cachedStale, source: 'cache' };
    }

    // 3. If no data exists at all, fetch synchronously, wait for the result, and return it.
    try {
        console.log(`No cache for ${key}. Fetching live data...`);
        const liveData = await fetcher();
        cacheService.set(key, liveData);
        return { data: liveData, source: 'live' };
    } catch (error) {
        // 4. If the initial fetch fails, there's no stale data to fall back on, so use the static fallback.
        console.warn(`Initial fetch failed for ${key}. Using static fallback.`, error);
        return { data: staticFallback, source: 'static' };
    }
  },
};
