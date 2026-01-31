/**
 * ResponseCache - Local caching for LLM responses
 *
 * Caches task → response pairs so we don't need to call LLM
 * for repeated tasks. Makes the app faster and saves inference.
 */

console.log('[ResponseCache.ts] File loading...');

export type CacheEntry = {
  task: string;
  response: string;
  timestamp: number;
  inferenceTime: number;
};

console.log('[ResponseCache.ts] CacheEntry type exported');

export class ResponseCache {
  private static instance: ResponseCache | null = null;
  private cache: Map<string, CacheEntry> | null = null;
  private cacheKey = 'focusmate_cache';
  private maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
  private maxSize = 100; // Max entries
  private initialized = false;

  private constructor() {
    // Don't call loadFromStorage in constructor - do it lazily
    console.log('[ResponseCache] Constructor called (not loading yet)');
  }

  static getInstance(): ResponseCache {
    if (!ResponseCache.instance) {
      ResponseCache.instance = new ResponseCache();
    }

    // Lazy load cache on first use
    if (!ResponseCache.instance.initialized) {
      try {
        ResponseCache.instance.cache = new Map();
        ResponseCache.instance.loadFromStorage();
        ResponseCache.instance.initialized = true;
        console.log('[ResponseCache] Cache initialized successfully');
      } catch (e) {
        console.error('[ResponseCache] Failed to initialize cache:', e);
        ResponseCache.instance.initialized = true; // Mark as initialized even if failed
      }
    }

    return ResponseCache.instance;
  }

  /**
   * Get cached response for a task
   */
  get(task: string): CacheEntry | null {
    if (!this.cache) {
      return null;
    }

    const normalizedTask = this.normalizeTask(task);
    const entry = this.cache.get(normalizedTask);

    if (!entry) {
      return null;
    }

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > this.maxAge) {
      this.cache.delete(normalizedTask);
      this.saveToStorage();
      return null;
    }

    console.log(`[ResponseCache] CACHE HIT: "${task}"`);
    return entry;
  }

  /**
   * Store a response in cache
   */
  set(task: string, response: string, inferenceTime: number): void {
    if (!this.cache) {
      return;
    }

    const normalizedTask = this.normalizeTask(task);

    const entry: CacheEntry = {
      task,
      response,
      timestamp: Date.now(),
      inferenceTime,
    };

    this.cache.set(normalizedTask, entry);

    // Prune old entries if over limit
    this.prune();

    this.saveToStorage();
    console.log(`[ResponseCache] CACHE MISS: "${task}" - CACHED NOW`);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    if (!this.cache) {
      return;
    }

    this.cache.clear();
    this.saveToStorage();
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; sizeBytes: number } {
    if (!this.cache) {
      return { size: 0, sizeBytes: 0 };
    }

    let sizeBytes = JSON.stringify(Array.from(this.cache.entries())).length;
    return {
      size: this.cache.size,
      sizeBytes,
    };
  }

  /**
   * Get all cache entries for debugging
   */
  getAll(): CacheEntry[] {
    if (!this.cache) {
      return [];
    }

    return Array.from(this.cache.values());
  }

  /**
   * Normalize task for caching (case insensitive, trim, etc.)
   */
  private normalizeTask(task: string): string {
    return task
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }

  /**
   * Prune old entries if cache is too large
   */
  private prune(): void {
    if (!this.cache || this.cache.size <= this.maxSize) {
      return;
    }

    // Sort by timestamp (oldest first)
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest entries
    const toRemove = entries.slice(0, this.cache.size - this.maxSize);

    for (const [key] of toRemove) {
      this.cache.delete(key);
    }

    console.log(`[ResponseCache] Pruned ${toRemove.length} old entries`);
  }

  /**
   * Load cache from localStorage
   */
  private loadFromStorage(): void {
    try {
      // Check if localStorage is available (might be restricted in some mobile contexts)
      if (typeof localStorage === 'undefined') {
        console.warn('[ResponseCache] localStorage not available, running without persistence');
        return;
      }

      const data = localStorage.getItem(this.cacheKey);
      if (!data) {
        return;
      }

      const entries = JSON.parse(data) as [string, CacheEntry][];
      if (this.cache) {
        for (const [key, value] of entries) {
          this.cache.set(key, value);
        }
      }

      console.log(`[ResponseCache] Loaded ${entries.length} entries from storage`);
    } catch (e) {
      console.error('[ResponseCache] Failed to load from storage:', e);
      // Continue with empty cache
    }
  }

  /**
   * Save cache to localStorage
   */
  private saveToStorage(): void {
    try {
      // Check if localStorage is available
      if (typeof localStorage === 'undefined') {
        return; // Silent fail - cache will work in memory only
      }

      if (!this.cache) {
        return;
      }

      const entries = Array.from(this.cache.entries());
      const data = JSON.stringify(entries);
      localStorage.setItem(this.cacheKey, data);
    } catch (e) {
      console.error('[ResponseCache] Failed to save to storage:', e);
      // If storage is full, try clearing old entries
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        if (this.cache) {
          this.cache.clear();
        }
        try {
          this.saveToStorage();
        } catch (retryError) {
          console.error('[ResponseCache] Still failed after clearing:', retryError);
        }
      }
    }
  }
}

// Export singleton instance
export const responseCache = ResponseCache.getInstance();