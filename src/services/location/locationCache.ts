import { LocationData } from '../../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const STORAGE_PREFIX = 'rt_geo_cache_';

export class LocationCache {
  private memSearch = new Map<string, CacheEntry<LocationData[]>>();
  private memReverse = new Map<string, CacheEntry<LocationData>>();

  private getStorageKey(type: string, key: string): string {
    return `${STORAGE_PREFIX}${type}_${key.toLowerCase().trim()}`;
  }

  // 1. Search Query Cache
  getSearch(query: string): LocationData[] | null {
    const clean = query.trim().toLowerCase();
    const mem = this.memSearch.get(clean);
    if (mem && Date.now() - mem.timestamp < DEFAULT_TTL_MS) {
      return mem.data;
    }

    try {
      const stored = localStorage.getItem(this.getStorageKey('search', clean));
      if (stored) {
        const parsed: CacheEntry<LocationData[]> = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < DEFAULT_TTL_MS) {
          this.memSearch.set(clean, parsed);
          return parsed.data;
        }
      }
    } catch {
      // ignore storage error
    }
    return null;
  }

  setSearch(query: string, results: LocationData[]): void {
    const clean = query.trim().toLowerCase();
    const entry: CacheEntry<LocationData[]> = {
      data: results,
      timestamp: Date.now(),
    };
    this.memSearch.set(clean, entry);

    try {
      localStorage.setItem(this.getStorageKey('search', clean), JSON.stringify(entry));
    } catch {
      // ignore storage quota errors
    }
  }

  // 2. Reverse Geocode Coordinate Cache (Rounded to ~20m precision)
  private makeCoordKey(lat: number, lng: number): string {
    return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
  }

  getReverse(lat: number, lng: number): LocationData | null {
    const key = this.makeCoordKey(lat, lng);
    const mem = this.memReverse.get(key);
    if (mem && Date.now() - mem.timestamp < DEFAULT_TTL_MS) {
      return mem.data;
    }

    try {
      const stored = localStorage.getItem(this.getStorageKey('rev', key));
      if (stored) {
        const parsed: CacheEntry<LocationData> = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < DEFAULT_TTL_MS) {
          this.memReverse.set(key, parsed);
          return parsed.data;
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  setReverse(lat: number, lng: number, result: LocationData): void {
    const key = this.makeCoordKey(lat, lng);
    const entry: CacheEntry<LocationData> = {
      data: result,
      timestamp: Date.now(),
    };
    this.memReverse.set(key, entry);

    try {
      localStorage.setItem(this.getStorageKey('rev', key), JSON.stringify(entry));
    } catch {
      // ignore
    }
  }

  clear(): void {
    this.memSearch.clear();
    this.memReverse.clear();
    try {
      Object.keys(localStorage).forEach((k) => {
        if (k.startsWith(STORAGE_PREFIX)) {
          localStorage.removeItem(k);
        }
      });
    } catch {
      // ignore
    }
  }
}

export const locationCache = new LocationCache();
