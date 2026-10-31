/**
 * Image Utilities & Auto-Repair for TMDB and AniList assets.
 */

/**
 * Bulletproofs and repairs poster URLs dynamically.
 * If a stored URL or path starts with a forward slash (e.g. "/8G2i63sTq1vW0bS8u6r5e71p.jpg"),
 * dynamically prepends "https://image.tmdb.org/t/p/{size}".
 * Also safely handles empty, null, or undefined values by returning the fallback logo.
 */
export function resolvePosterUrl(
  pathOrUrl: string | null | undefined,
  fallback: string = '/assets/trackup-logo.jpg',
  size: string = 'w500'
): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return fallback;
  }

  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === fallback) {
    return fallback;
  }

  // Already a full HTTP or HTTPS URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  // Local assets (e.g. /assets/trackup-logo.jpg)
  if (trimmed.startsWith('/assets/')) {
    return trimmed;
  }

  // Raw relative TMDB path starting with forward slash (e.g., "/8G2i63sTq1vW0bS8u6r5e71p.jpg")
  if (trimmed.startsWith('/')) {
    return `https://image.tmdb.org/t/p/${size}${trimmed}`;
  }

  // File name without leading slash (e.g., "8G2i63sTq1vW0bS8u6r5e71p.jpg")
  if (
    trimmed.endsWith('.jpg') ||
    trimmed.endsWith('.jpeg') ||
    trimmed.endsWith('.png') ||
    trimmed.endsWith('.webp')
  ) {
    return `https://image.tmdb.org/t/p/${size}/${trimmed}`;
  }

  return trimmed;
}

/**
 * Bulletproofs and repairs backdrop URLs dynamically.
 * Defaults to "w1280" size for high quality banners/backdrops.
 */
export function resolveBackdropUrl(
  pathOrUrl: string | null | undefined,
  fallback: string = '',
  size: string = 'w1280'
): string {
  if (!pathOrUrl || typeof pathOrUrl !== 'string') {
    return fallback;
  }

  const trimmed = pathOrUrl.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === fallback) {
    return fallback;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/assets/')) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return `https://image.tmdb.org/t/p/${size}${trimmed}`;
  }

  if (
    trimmed.endsWith('.jpg') ||
    trimmed.endsWith('.jpeg') ||
    trimmed.endsWith('.png') ||
    trimmed.endsWith('.webp')
  ) {
    return `https://image.tmdb.org/t/p/${size}/${trimmed}`;
  }

  return trimmed;
}
