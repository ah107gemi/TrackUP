import type { TrackingStatus, MediaType } from '../../types/database.types';

export interface LibraryFilterState {
  status: TrackingStatus | 'all';
  format: MediaType | 'all';
  searchQuery: string;
}

export const DEFAULT_LIBRARY_FILTERS: LibraryFilterState = {
  status: 'all',
  format: 'all',
  searchQuery: '',
};

function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).sessionStorage) {
      return (globalThis as any).sessionStorage;
    }
  } catch {
    // ignore
  }
  return null;
}

function getWindowLocation(): Location | null {
  try {
    if (typeof window !== 'undefined' && window.location) {
      return window.location;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).location) {
      return (globalThis as any).location;
    }
  } catch {
    // ignore
  }
  return null;
}

function getWindowHistory(): History | null {
  try {
    if (typeof window !== 'undefined' && window.history) {
      return window.history;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).history) {
      return (globalThis as any).history;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Normalizes query string status values like "watching", "reading", "active", "completed", "planned", etc.
 */
export function normalizeStatusParam(raw: string | null | undefined): TrackingStatus | 'all' | null {
  if (!raw) return null;
  const s = raw.toLowerCase().trim();
  if (s === 'watching' || s === 'reading' || s === 'active') return 'active';
  if (s === 'planned') return 'planned';
  if (s === 'completed') return 'completed';
  if (s === 'paused' || s === 'on_hold' || s === 'on-hold' || s === 'onhold') return 'paused';
  if (s === 'dropped') return 'dropped';
  if (s === 'all') return 'all';
  return null;
}

/**
 * Converts internal status to URL parameter representation (e.g. active -> watching/reading)
 */
export function statusToParam(status: TrackingStatus | 'all', domain: 'watch' | 'read'): string {
  if (status === 'all') return 'all';
  if (status === 'active') return domain === 'watch' ? 'watching' : 'reading';
  return status;
}

/**
 * Normalizes format / category query string parameter
 */
export function normalizeFormatParam(raw: string | null | undefined): MediaType | 'all' | null {
  if (!raw) return null;
  const t = raw.toLowerCase().trim();
  if (t === 'tv') return 'tv';
  if (t === 'movie') return 'movie';
  if (t === 'anime' || t === 'anime_series') return 'anime_series';
  if (t === 'anime_film') return 'anime_film';
  if (t === 'manga') return 'manga';
  if (t === 'manhwa') return 'manhwa';
  if (t === 'all') return 'all';
  return null;
}

/**
 * Safely reads filters from the current URL
 */
export function readFiltersFromUrl(): Partial<LibraryFilterState> {
  const loc = getWindowLocation();
  if (!loc) return {};
  try {
    const searchParams = new URLSearchParams(loc.search);
    const hash = loc.hash || '';
    const hashQueryIdx = hash.indexOf('?');
    const hashParams = hashQueryIdx !== -1 ? new URLSearchParams(hash.slice(hashQueryIdx)) : null;

    const result: Partial<LibraryFilterState> = {};

    const rawStatus = searchParams.get('status') || hashParams?.get('status');
    const normalizedStatus = normalizeStatusParam(rawStatus);
    if (normalizedStatus !== null) {
      result.status = normalizedStatus;
    }

    const rawFormat =
      searchParams.get('type') ||
      searchParams.get('format') ||
      hashParams?.get('type') ||
      hashParams?.get('format');
    const normalizedFormat = normalizeFormatParam(rawFormat);
    if (normalizedFormat !== null) {
      result.format = normalizedFormat;
    }

    const rawQ =
      searchParams.get('q') ||
      searchParams.get('search') ||
      hashParams?.get('q') ||
      hashParams?.get('search');
    if (rawQ !== null) {
      result.searchQuery = rawQ;
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Safely reads filters from sessionStorage
 */
export function readFiltersFromSessionStorage(domain: 'watch' | 'read'): Partial<LibraryFilterState> {
  const storage = getSessionStorage();
  if (!storage) return {};
  try {
    const raw = storage.getItem(`trackup_library_filters_${domain}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    // ignore
  }
  return {};
}

/**
 * Persists filters to both sessionStorage and URL query parameters without reloading
 */
export function persistLibraryFilters(
  filters: LibraryFilterState,
  domain: 'watch' | 'read'
): void {
  // 1. Session Storage
  const storage = getSessionStorage();
  if (storage) {
    try {
      storage.setItem(`trackup_library_filters_${domain}`, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }

  // 2. URL Search Params (using replaceState)
  const loc = getWindowLocation();
  const hist = getWindowHistory();
  if (loc && hist) {
    try {
      const url = new URL(loc.href);

      if (filters.status && filters.status !== 'all') {
        url.searchParams.set('status', statusToParam(filters.status, domain));
      } else {
        url.searchParams.delete('status');
      }

      if (filters.format && filters.format !== 'all') {
        url.searchParams.set('type', filters.format);
        url.searchParams.delete('format');
      } else {
        url.searchParams.delete('type');
        url.searchParams.delete('format');
      }

      if (filters.searchQuery && filters.searchQuery.trim()) {
        url.searchParams.set('q', filters.searchQuery.trim());
        url.searchParams.delete('search');
      } else {
        url.searchParams.delete('q');
        url.searchParams.delete('search');
      }

      hist.replaceState(hist.state, '', url.toString());
    } catch {
      // ignore
    }
  }
}

/**
 * Computes initial filter state: URL query params take precedence, then sessionStorage, then defaults.
 */
export function getInitialLibraryFilters(domain: 'watch' | 'read'): LibraryFilterState {
  const fromStorage = readFiltersFromSessionStorage(domain);
  const fromUrl = readFiltersFromUrl();

  return {
    ...DEFAULT_LIBRARY_FILTERS,
    ...fromStorage,
    ...fromUrl,
  };
}
