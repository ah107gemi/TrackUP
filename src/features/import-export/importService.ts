import Papa from 'papaparse';
import type {
  PlatformPreset,
  ParsedImportRow,
  StagedImportItem,
} from './types';
import {
  detectPlatformPreset,
  parseLetterboxdRow,
  parseImdbRow,
  parseTraktRow,
  parseMalRow,
  parseBingerRow,
  parseGenericRow,
  normalizeTitleString,
} from './parsers';
import { MOCK_CATALOG_FIXTURES } from '../catalog/catalogService';
import { searchTmdbMulti, fetchTmdbMediaById } from '../catalog/tmdbClient';
import { searchAniList } from '../catalog/anilistClient';
import type { UserLibraryItem } from '../library/libraryService';
import {
  getStoredLibraries,
  saveStoredLibraries,
  clearUserLibrary,
  clearImportedDummyTitles,
} from '../library/libraryService';
import type { NormalizedCatalogItem } from '../../lib/validators';

export { clearUserLibrary, clearImportedDummyTitles };

export async function parseCsvFile(
  fileContent: string,
  _fileName?: string
): Promise<{ preset: PlatformPreset; rows: ParsedImportRow[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve({ preset: 'generic', rows: [] });
          return;
        }

        const headers = results.meta.fields || Object.keys(results.data[0]);
        const preset = detectPlatformPreset(headers);

        const rows: ParsedImportRow[] = [];
        const seenFingerprints = new Set<string>();

        results.data.forEach((rawRow, idx) => {
          let parsed: ParsedImportRow | null = null;
          switch (preset) {
            case 'letterboxd':
              parsed = parseLetterboxdRow(rawRow, idx);
              break;
            case 'imdb':
              parsed = parseImdbRow(rawRow, idx);
              break;
            case 'trakt':
              parsed = parseTraktRow(rawRow, idx);
              break;
            case 'mal':
              parsed = parseMalRow(rawRow, idx);
              break;
            case 'binger':
              parsed = parseBingerRow(rawRow, idx);
              break;
            case 'generic':
            default:
              parsed = parseGenericRow(rawRow, idx);
              break;
          }

          if (parsed && !seenFingerprints.has(parsed.fingerprint)) {
            seenFingerprints.add(parsed.fingerprint);
            rows.push(parsed);
          }
        });

        resolve({ preset, rows });
      },
      error: (err: any) => {
        reject(new Error(`CSV Parsing Failed: ${err?.message || String(err)}`));
      },
    });
  });
}

// Async worker pool for batching API queries without hitting rate limits
async function pMap<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = 6
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Resolves a parsed row against TMDB Multi-Search API, AniList, or curated fixtures.
 * Strictly assigns the verified media_type (tv, movie, anime_series, anime_film, manga, manhwa)
 * and retrieves authentic IDs and artwork.
 */
export async function resolveTitleFromApi(
  row: ParsedImportRow
): Promise<NormalizedCatalogItem | null> {
  const normTarget = row.normalizedTitle;

  // 1. Check local catalog fixtures first (instant, covers standard test fixtures)
  const fixtureMatch = MOCK_CATALOG_FIXTURES.find((f) => {
    if (row.externalId) {
      if (f.imdb_id && f.imdb_id.toLowerCase() === row.externalId.toLowerCase()) return true;
      if (f.tmdb_id && String(f.tmdb_id) === row.externalId) return true;
      if (f.anilist_id && String(f.anilist_id) === row.externalId) return true;
    }
    const normF = normalizeTitleString(f.title);
    return normF === normTarget;
  });

  if (fixtureMatch) {
    return fixtureMatch;
  }

  // 2. If row indicates Manga or Manhwa (or chapter/volume tracking is present), query AniList
  const isReading =
    row.mediaType === 'manga' ||
    row.mediaType === 'manhwa' ||
    (row.chaptersRead !== undefined && row.chaptersRead > 0) ||
    (row.volumesRead !== undefined && row.volumesRead > 0);

  if (isReading) {
    try {
      const aniResults = await searchAniList(row.rawTitle, row.mediaType === 'manhwa' ? 'manhwa' : 'manga');
      if (aniResults && aniResults.length > 0) {
        const exact = aniResults.find((a) => normalizeTitleString(a.title) === normTarget);
        if (exact) return exact;
        return aniResults[0];
      }
    } catch (err) {
      console.warn(`AniList manga search failed for "${row.rawTitle}":`, err);
    }
  }

  // 3. TMDB Multi-Search API query (searches movies and TV shows simultaneously)
  try {
    const tmdbResults = await searchTmdbMulti(row.rawTitle);
    if (tmdbResults && tmdbResults.length > 0) {
      // Look for exact title match
      const exactTitleMatches = tmdbResults.filter(
        (t) => normalizeTitleString(t.title) === normTarget
      );

      let verifiedMatch: NormalizedCatalogItem | null = null;
      if (exactTitleMatches.length > 0) {
        if (row.year) {
          const yearMatch = exactTitleMatches.find((t) => t.release_year === row.year);
          verifiedMatch = yearMatch || exactTitleMatches[0];
        } else {
          verifiedMatch = exactTitleMatches[0];
        }
      } else if (row.year) {
        const yearMatch = tmdbResults.find((t) => t.release_year === row.year);
        if (yearMatch) verifiedMatch = yearMatch;
      }

      if (!verifiedMatch && tmdbResults.length > 0) {
        verifiedMatch = tmdbResults[0];
      }

      if (verifiedMatch) {
        if (verifiedMatch.tmdb_id && (!verifiedMatch.runtime_minutes || (verifiedMatch.media_type === 'tv' && !verifiedMatch.total_episodes))) {
          try {
            const details = await fetchTmdbMediaById(
              verifiedMatch.tmdb_id,
              verifiedMatch.media_type === 'movie' || verifiedMatch.media_type === 'anime_film' ? 'movie' : 'tv'
            );
            if (details) return details;
          } catch {
            // retain verifiedMatch
          }
        }
        return verifiedMatch;
      }
    }
  } catch (err) {
    console.warn(`TMDB Multi-Search failed for "${row.rawTitle}":`, err);
  }

  // 4. AniList fallback search (for Anime series or anime movies)
  try {
    const animeResults = await searchAniList(row.rawTitle, 'all');
    if (animeResults && animeResults.length > 0) {
      const exact = animeResults.find((a) => normalizeTitleString(a.title) === normTarget);
      if (exact) return exact;
      return animeResults[0];
    }
  } catch (err) {
    console.warn(`AniList anime fallback search failed for "${row.rawTitle}":`, err);
  }

  // 5. Secondary fuzzy check on catalog fixtures (substring match)
  const fuzzyFixture = MOCK_CATALOG_FIXTURES.find(
    (f) =>
      normalizeTitleString(f.title).includes(normTarget) ||
      normTarget.includes(normalizeTitleString(f.title))
  );
  if (fuzzyFixture) {
    return fuzzyFixture;
  }

  return null;
}

export async function stageAndResolveRows(
  rows: ParsedImportRow[],
  userLibrary: UserLibraryItem[]
): Promise<StagedImportItem[]> {
  return pMap(
    rows,
    async (row) => {
      // 1. Check if user already has this title in library (duplicate)
      const existing = userLibrary.find((item) => {
        const matchTitle =
          normalizeTitleString(item.title.title) === row.normalizedTitle;
        const matchType = item.title.media_type === row.mediaType;
        return matchTitle && matchType;
      });

      if (existing) {
        return {
          id: `stage_${row.index}_${row.fingerprint}`,
          row: { ...row, mediaType: existing.title.media_type },
          status: 'duplicate_in_library',
          resolvedTitle: existing.title,
          candidates: [],
          selectedTitleId: existing.title_id,
        };
      }

      // 2. Query verified API / catalog
      const verified = await resolveTitleFromApi(row);

      if (verified) {
        // Strict categorization: synchronize row mediaType with verified API data
        const updatedRow: ParsedImportRow = {
          ...row,
          mediaType: verified.media_type,
          year: verified.release_year || row.year,
        };

        // Check if user has this verified title ID in library
        const existingById = userLibrary.find((item) => item.title_id === verified.id);
        if (existingById) {
          return {
            id: `stage_${row.index}_${row.fingerprint}`,
            row: updatedRow,
            status: 'duplicate_in_library',
            resolvedTitle: verified,
            candidates: [],
            selectedTitleId: verified.id,
          };
        }

        return {
          id: `stage_${row.index}_${row.fingerprint}`,
          row: updatedRow,
          status: 'exact_match',
          resolvedTitle: verified,
          candidates: [],
          selectedTitleId: verified.id,
        };
      }

      // 3. If unverified, mark as unmatched so broken dummy records are not created
      return {
        id: `stage_${row.index}_${row.fingerprint}`,
        row,
        status: 'unmatched',
        errorMessage: 'Title not found on TMDB or AniList. Skipped to prevent broken library records.',
        candidates: [],
      };
    },
    6
  );
}

export async function commitImportBatch(params: {
  userId: string;
  items: StagedImportItem[];
  duplicatePolicy?: 'skip' | 'fill' | 'overwrite' | 'merge';
}): Promise<{ committed: number; skipped: number }> {
  const { userId, items, duplicatePolicy = 'skip' } = params;
  const allLibraries = getStoredLibraries();
  let committed = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  items.forEach((item) => {
    if (item.status === 'unmatched') {
      skipped++;
      return;
    }

    const titleId = item.selectedTitleId || item.resolvedTitle?.id;
    if (!titleId || titleId.startsWith('imported_')) {
      skipped++;
      return;
    }

    const existingIndex = allLibraries.findIndex(
      (l) => l.user_id === userId && (l.title_id === titleId || normalizeTitleString(l.title.title) === item.row.normalizedTitle)
    );

    if (existingIndex >= 0) {
      if (duplicatePolicy === 'skip') {
        skipped++;
        return;
      }

      const existing = allLibraries[existingIndex];
      const isCompleted = item.row.status === 'completed';
      const isEpisodic = existing.title.media_type === 'tv' || existing.title.media_type === 'anime_series';

      if (duplicatePolicy === 'fill' || duplicatePolicy === 'merge') {
        const incomingEpCount = item.row.episodesWatched || (isCompleted && isEpisodic && existing.title.total_episodes ? existing.title.total_episodes : 0);
        const incomingEps = Array.from(
          { length: incomingEpCount },
          (_, i) => `ep_${i + 1}`
        );
        const existingEps = existing.episodes_watched || [];
        const mergedEps = Array.from(new Set([...existingEps, ...incomingEps]));

        allLibraries[existingIndex] = {
          ...existing,
          rating: duplicatePolicy === 'merge'
            ? (item.row.rating ?? existing.rating)
            : (existing.rating ?? item.row.rating ?? null),
          status: duplicatePolicy === 'merge' && item.row.status === 'completed'
            ? 'completed'
            : (existing.status || item.row.status),
          episodes_watched: mergedEps,
          last_chapter_read: Math.max(existing.last_chapter_read || 0, item.row.chaptersRead || 0),
          last_volume_read: Math.max(existing.last_volume_read || 0, item.row.volumesRead || 0),
          last_progressed_at: now,
        };
      } else if (duplicatePolicy === 'overwrite') {
        const defaultCompletedEps = isCompleted && isEpisodic && existing.title.total_episodes ? existing.title.total_episodes : existing.episodes_watched.length;
        const overwriteEps = item.row.episodesWatched !== undefined
          ? Array.from({ length: item.row.episodesWatched }, (_, i) => `ep_${i + 1}`)
          : Array.from({ length: defaultCompletedEps }, (_, i) => `ep_${i + 1}`);

        allLibraries[existingIndex] = {
          ...existing,
          rating: item.row.rating ?? existing.rating,
          status: item.row.status,
          episodes_watched: overwriteEps,
          last_chapter_read: item.row.chaptersRead ?? existing.last_chapter_read,
          last_volume_read: item.row.volumesRead ?? existing.last_volume_read,
          last_progressed_at: now,
        };
      }
      committed++;
      return;
    }

    // New item creation - only insert if verified title exists
    if (!item.resolvedTitle || !item.resolvedTitle.id || item.resolvedTitle.id.startsWith('imported_')) {
      skipped++;
      return;
    }

    const catalogItem = item.resolvedTitle;
    const isCompleted = item.row.status === 'completed';
    const isEpisodic = catalogItem.media_type === 'tv' || catalogItem.media_type === 'anime_series';
    const initialEpCount = item.row.episodesWatched && item.row.episodesWatched > 0
      ? item.row.episodesWatched
      : (isCompleted && isEpisodic && catalogItem.total_episodes ? catalogItem.total_episodes : 0);

    const newLibraryEntry: UserLibraryItem = {
      id: `lib_${Math.random().toString(36).substring(2, 11)}`,
      user_id: userId,
      title_id: titleId,
      status: item.row.status,
      rating: item.row.rating || null,
      is_private: false,
      personal_notes: item.row.notes || null,
      started_at: item.row.status === 'active' ? now : null,
      completed_at: item.row.completedAt || (item.row.status === 'completed' ? now : null),
      last_progressed_at: now,
      episodes_watched: Array.from(
        { length: initialEpCount },
        (_, i) => `ep_${i + 1}`
      ),
      last_chapter_read: item.row.chaptersRead || 0,
      last_volume_read: item.row.volumesRead || 0,
      title: catalogItem,
    };

    allLibraries.push(newLibraryEntry);
    committed++;
  });

  saveStoredLibraries(allLibraries);
  return { committed, skipped };
}

export function exportUserLibraryToCsv(userLibrary: UserLibraryItem[]): string {
  const exportRows = userLibrary.map((item) => ({
    'Title': item.title.title,
    'Media Type': item.title.media_type,
    'Release Year': item.title.release_year || '',
    'Status': item.status,
    'Rating (1-10)': item.rating || '',
    'Rating (Stars 0.5-5.0)': item.rating ? (item.rating / 2).toFixed(1) : '',
    'Episodes Watched': item.episodes_watched?.length || 0,
    'Chapters Read': item.last_chapter_read || 0,
    'Volumes Read': item.last_volume_read || 0,
    'Started Date': item.started_at || '',
    'Completed Date': item.completed_at || '',
    'Notes': item.personal_notes || '',
    'External TMDB ID': item.title.tmdb_id || '',
    'External IMDB ID': item.title.imdb_id || '',
    'External AniList ID': item.title.anilist_id || '',
  }));

  return Papa.unparse(exportRows);
}

export function downloadCsvFile(csvContent: string, fileName: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
