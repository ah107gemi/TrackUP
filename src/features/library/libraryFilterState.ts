import type { TrackingStatus, MediaType } from '../../types/database.types';

export interface LibraryFilterState {
  status: TrackingStatus | 'all';
  format: MediaType | 'all';
  searchQuery: string;
}

export const DEFAULT_LIBRARY_FILTERS: Readonly<LibraryFilterState> = Object.freeze({
  status: 'all',
  format: 'all',
  searchQuery: '',
});

export const VALID_STATUSES = new Set<string>([
  'all',
  'active',
  'planned',
  'completed',
  'paused',
  'dropped',
]);

export const VALID_FORMATS = new Set<string>([
  'all',
  'movie',
  'tv',
  'anime_series',
  'anime_film',
  'manga',
  'manhwa',
]);

function getSessionStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).sessionStorage) {
      return (globalThis as any).sessionStorage;
    }
  } catch {
    // DOMException / security error fallback
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
 * Strictly defaults to 'all' if invalid, null, undefined, or malformed.
 */
export function normalizeStatusParam(raw: unknown): TrackingStatus | 'all' {
  if (!raw || typeof raw !== 'string') return 'all';
  const s = raw.toLowerCase().trim();
  if (s === 'watching' || s === 'reading' || s === 'active') return 'active';
  if (s === 'planned') return 'planned';
  if (s === 'completed') return 'completed';
  if (s === 'paused' || s === 'on_hold' || s === 'on-hold' || s === 'onhold') return 'paused';
  if (s === 'dropped') return 'dropped';
  if (s === 'all') return 'all';
  return 'all';
}

/**
 * Converts internal status to URL parameter representation (e.g. active -> watching/reading)
 */
export function statusToParam(status: TrackingStatus | 'all', domain: 'watch' | 'read'): string {
  if (status === 'all' || !VALID_STATUSES.has(status)) return 'all';
  if (status === 'active') return domain === 'watch' ? 'watching' : 'reading';
  return status;
}

/**
 * Normalizes format / category query string parameter.
 * Strictly defaults to 'all' if invalid, null, undefined, or malformed.
 */
export function normalizeFormatParam(raw: unknown): MediaType | 'all' {
  if (!raw || typeof raw !== 'string') return 'all';
  const t = raw.toLowerCase().trim();
  if (t === 'tv') return 'tv';
  if (t === 'movie') return 'movie';
  if (t === 'anime' || t === 'anime_series') return 'anime_series';
  if (t === 'anime_film') return 'anime_film';
  if (t === 'manga') return 'manga';
  if (t === 'manhwa') return 'manhwa';
  if (t === 'all') return 'all';
  return 'all';
}

/**
 * Strictly sanitizes any input object to ensure no null, undefined, or malformed strings escape.
 * Guarantees a fully valid LibraryFilterState object.
 */
export function sanitizeFilterState(raw: any): LibraryFilterState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_LIBRARY_FILTERS };
  }

  // 1. Status extraction & strict validation
  const rawStatus = raw.status ?? raw.activeStatus;
  let status: TrackingStatus | 'all' = 'all';
  if (typeof rawStatus === 'string' && VALID_STATUSES.has(rawStatus.toLowerCase().trim())) {
    status = rawStatus.toLowerCase().trim() as TrackingStatus | 'all';
  } else {
    status = normalizeStatusParam(rawStatus);
  }

  // 2. Format / Category extraction & strict validation
  const rawFormat = raw.format ?? raw.category ?? raw.selectedFormat ?? raw.type;
  let format: MediaType | 'all' = 'all';
  if (typeof rawFormat === 'string' && VALID_FORMATS.has(rawFormat.toLowerCase().trim())) {
    format = rawFormat.toLowerCase().trim() as MediaType | 'all';
  } else {
    format = normalizeFormatParam(rawFormat);
  }

  // 3. Search query extraction & strict validation
  const rawSearch = raw.searchQuery ?? raw.search ?? raw.q ?? raw.localSearchQuery;
  const searchQuery = typeof rawSearch === 'string' && rawSearch !== 'undefined' && rawSearch !== 'null'
    ? rawSearch
    : '';

  return {
    status: status || 'all',
    format: format || 'all',
    searchQuery: searchQuery || '',
  };
}

/**
 * Safely reads filters from the current URL
 */
export function readFiltersFromUrl(): Partial<LibraryFilterState> {
  try {
    const loc = getWindowLocation();
    if (!loc) return {};
    const searchParams = new URLSearchParams(loc.search || '');
    const hash = loc.hash || '';
    const hashQueryIdx = hash.indexOf('?');
    const hashParams = hashQueryIdx !== -1 ? new URLSearchParams(hash.slice(hashQueryIdx)) : null;

    const result: Partial<LibraryFilterState> = {};

    const rawStatus = searchParams.get('status') || hashParams?.get('status');
    if (rawStatus !== null && rawStatus !== undefined) {
      result.status = normalizeStatusParam(rawStatus);
    }

    const rawFormat =
      searchParams.get('type') ||
      searchParams.get('format') ||
      searchParams.get('category') ||
      hashParams?.get('type') ||
      hashParams?.get('format') ||
      hashParams?.get('category');
    if (rawFormat !== null && rawFormat !== undefined) {
      result.format = normalizeFormatParam(rawFormat);
    }

    const rawQ =
      searchParams.get('q') ||
      searchParams.get('search') ||
      hashParams?.get('q') ||
      hashParams?.get('search');
    if (rawQ !== null && rawQ !== undefined && rawQ !== 'undefined' && rawQ !== 'null') {
      result.searchQuery = String(rawQ);
    }

    return sanitizeFilterState(result);
  } catch {
    return {};
  }
}

/**
 * Safely reads filters from sessionStorage with DOMException and JSON parse protection
 */
export function readFiltersFromSessionStorage(domain: 'watch' | 'read'): Partial<LibraryFilterState> {
  try {
    const storage = getSessionStorage();
    if (!storage) return {};
    const key = `trackup_library_filters_${domain}`;
    const raw = storage.getItem(key);
    if (!raw || typeof raw !== 'string') return {};

    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return sanitizeFilterState(parsed);
    }
  } catch (err) {
    // DOMException / JSON parse error safety: remove poisoned entry
    try {
      const storage = getSessionStorage();
      storage?.removeItem(`trackup_library_filters_${domain}`);
    } catch {
      // ignore
    }
  }
  return {};
}

/**
 * Persists filters to both sessionStorage and URL query parameters with strict DOMException protection
 */
export function persistLibraryFilters(
  filters: Partial<LibraryFilterState> | undefined | null,
  domain: 'watch' | 'read'
): void {
  const safe = sanitizeFilterState(filters);

  // 1. Session Storage with DOMException protection
  try {
    const storage = getSessionStorage();
    if (storage) {
      storage.setItem(`trackup_library_filters_${domain}`, JSON.stringify(safe));
    }
  } catch {
    // ignore DOMException (e.g. quota exceeded or storage disabled)
  }

  // 2. URL Search Params with DOMException / history error protection
  try {
    const loc = getWindowLocation();
    const hist = getWindowHistory();
    if (loc && hist) {
      const url = new URL(loc.href);

      if (safe.status && safe.status !== 'all') {
        url.searchParams.set('status', statusToParam(safe.status, domain));
      } else {
        url.searchParams.delete('status');
      }

      if (safe.format && safe.format !== 'all') {
        url.searchParams.set('type', safe.format);
        url.searchParams.delete('format');
        url.searchParams.delete('category');
      } else {
        url.searchParams.delete('type');
        url.searchParams.delete('format');
        url.searchParams.delete('category');
      }

      if (safe.searchQuery && safe.searchQuery.trim()) {
        url.searchParams.set('q', safe.searchQuery.trim());
        url.searchParams.delete('search');
      } else {
        url.searchParams.delete('q');
        url.searchParams.delete('search');
      }

      hist.replaceState(hist.state, '', url.toString());
    }
  } catch {
    // ignore
  }
}

/**
 * Computes initial filter state: URL query params take precedence, then sessionStorage, then defaults.
 * Always returns a bulletproof, non-undefined LibraryFilterState object.
 */
export function getInitialLibraryFilters(domain: 'watch' | 'read'): LibraryFilterState {
  try {
    const fromStorage = readFiltersFromSessionStorage(domain);
    const fromUrl = readFiltersFromUrl();

    return sanitizeFilterState({
      ...DEFAULT_LIBRARY_FILTERS,
      ...fromStorage,
      ...fromUrl,
    });
  } catch {
    return { ...DEFAULT_LIBRARY_FILTERS };
  }
}
