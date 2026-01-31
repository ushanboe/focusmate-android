/**
 * FavoriteManager - Save and retrieve favorite breakdowns
 *
 * Allows users to save breakdowns they like for quick access later
 */

export interface FavoriteBreakdown {
  id: string;
  task: string;
  breakdown: string;
  response: string;
  savedAt: number;
  lastUsed: number;
  usageCount: number;
  totalEstimatedTime: number; // in minutes
}

export class FavoriteManager {
  private static instance: FavoriteManager;
  private favorites: Map<string, FavoriteBreakdown> = new Map();
  private storageKey = 'focusmate_favorites';

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): FavoriteManager {
    if (!FavoriteManager.instance) {
      FavoriteManager.instance = new FavoriteManager();
    }
    return FavoriteManager.instance;
  }

  /**
   * Save a breakdown as favorite
   */
  save(task: string, response: string, estimatedTime: number = 0): FavoriteBreakdown {
    const id = this.generateId();

    const favorite: FavoriteBreakdown = {
      id,
      task,
      breakdown: response,
      response,
      savedAt: Date.now(),
      lastUsed: Date.now(),
      usageCount: 1,
      totalEstimatedTime: estimatedTime,
    };

    this.favorites.set(id, favorite);
    this.saveToStorage();

    console.log(`[FavoriteManager] Saved favorite: "${task}"`);
    return favorite;
  }

  /**
   * Remove a favorite
   */
  remove(id: string): void {
    const removed = this.favorites.delete(id);
    if (removed) {
      this.saveToStorage();
      console.log(`[FavoriteManager] Removed favorite: ${id}`);
    }
  }

  /**
   * Get favorite by ID
   */
  get(id: string): FavoriteBreakdown | null {
    return this.favorites.get(id) || null;
  }

  /**
   * Get all favorites
   */
  getAll(): FavoriteBreakdown[] {
    return Array.from(this.favorites.values()).sort(
      (a, b) => b.lastUsed - a.lastUsed
    );
  }

  /**
   * Search favorites by task text
   */
  search(query: string): FavoriteBreakdown[] {
    const lowerQuery = query.toLowerCase();
    return this.getAll().filter(f =>
      f.task.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * Update last used time (when a favorite is used)
   */
  touch(id: string): void {
    const favorite = this.favorites.get(id);
    if (favorite) {
      favorite.lastUsed = Date.now();
      favorite.usageCount += 1;
      this.saveToStorage();
    }
  }

  /**
   * Check if a task is saved as favorite
   */
  isFavorite(task: string): boolean {
    return Array.from(this.favorites.values()).some(
      f => f.task.toLowerCase() === task.toLowerCase()
    );
  }

  /**
   * Get favorite by task
   */
  getByTask(task: string): FavoriteBreakdown | null {
    return this.getAll().find(
      f => f.task.toLowerCase() === task.toLowerCase()
    ) || null;
  }

  /**
   * Clear all favorites
   */
  clear(): void {
    this.favorites.clear();
    this.saveToStorage();
  }

  /**
   * Get stats
   */
  getStats(): {
    count: number;
    totalUsage: number;
    oldestSaved: number;
    newestSaved: number;
  } {
    const favorites = this.getAll();
    const totalUsage = favorites.reduce((sum, f) => sum + f.usageCount, 0);

    const timestamps = favorites.map(f => f.savedAt);
    const oldestSaved = timestamps.length > 0 ? Math.min(...timestamps) : 0;
    const newestSaved = timestamps.length > 0 ? Math.max(...timestamps) : 0;

    return {
      count: favorites.length,
      totalUsage,
      oldestSaved,
      newestSaved,
    };
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Load favorites from localStorage
   */
  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (!data) {
        return;
      }

      const favorites = JSON.parse(data) as [string, FavoriteBreakdown][];
      this.favorites = new Map(favorites);

      console.log(`[FavoriteManager] Loaded ${favorites.length} favorites from storage`);
    } catch (e) {
      console.error('[FavoriteManager] Failed to load from storage:', e);
    }
  }

  /**
   * Save favorites to localStorage
   */
  private saveToStorage(): void {
    try {
      const entries = Array.from(this.favorites.entries());
      const data = JSON.stringify(entries);
      localStorage.setItem(this.storageKey, data);
    } catch (e) {
      console.error('[FavoriteManager] Failed to save to storage:', e);
      // If storage is full, try clearing old entries
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        this.pruneOldest(5);
        this.saveToStorage();
      }
    }
  }

  /**
   * Prune oldest favorites
   */
  private pruneOldest(count: number): void {
    const entries = Array.from(this.favorites.entries());
    entries.sort((a, b) => a[1].lastUsed - b[1].lastUsed);

    const toRemove = entries.slice(0, count);
    for (const [id] of toRemove) {
      this.favorites.delete(id);
    }

    console.log(`[FavoriteManager] Pruned ${toRemove.length} oldest favorites`);
  }
}

// Export singleton instance
export const favoriteManager = FavoriteManager.getInstance();
console.log('[FavoriteManager] Exported favoriteManager singleton');