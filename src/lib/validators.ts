import { z } from 'zod';

/**
 * Sanitizes external URLs, strictly rejecting unsafe schemes like javascript:,
 * data:, vbscript:, or invalid URIs.
 * Only http: and https: protocols are permitted.
 */
export function sanitizeUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;

  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  // Reject explicit javascript: or dangerous pseudo-protocols
  // (handles case-insensitivity, leading spaces, and encoded control chars)
  const normalized = trimmed.replace(/[\u0000-\u001F\u007F-\u009F\s]/g, '').toLowerCase();
  if (
    normalized.startsWith('javascript:') ||
    normalized.startsWith('vbscript:') ||
    normalized.startsWith('data:')
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Relative URLs or malformed URIs
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }
  }

  return null;
}

export const MediaTypeEnum = z.enum([
  'movie',
  'tv',
  'anime_series',
  'anime_film',
  'manga',
  'manhwa',
]);

export const NormalizedCatalogItemSchema = z.object({
  id: z.string(),
  media_type: MediaTypeEnum,
  title: z.string().min(1),
  original_title: z.string().nullable().optional(),
  release_year: z.number().int().nullable().optional(),
  synopsis: z.string().nullable().optional(),
  poster_url: z.string().nullable().optional(),
  backdrop_url: z.string().nullable().optional(),
  genres: z.array(z.string()).default([]),
  origin_country: z.string().nullable().optional(),
  status: z.string().nullable().optional(),
  total_episodes: z.number().int().nullable().optional(),
  total_seasons: z.number().int().nullable().optional(),
  total_chapters: z.number().nullable().optional(),
  total_volumes: z.number().int().nullable().optional(),
  runtime_minutes: z.number().int().nullable().optional(),
  tmdb_id: z.number().int().nullable().optional(),
  imdb_id: z.string().nullable().optional(),
  anilist_id: z.number().int().nullable().optional(),
  mal_id: z.number().int().nullable().optional(),
});

export type NormalizedCatalogItem = z.infer<typeof NormalizedCatalogItemSchema>;
