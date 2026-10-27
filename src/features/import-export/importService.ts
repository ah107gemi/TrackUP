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
import type { UserLibraryItem } from '../library/libraryService';
import { getStoredLibraries, saveStoredLibraries } from '../library/libraryService';
import type { NormalizedCatalogItem } from '../../lib/validators';

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

export function stageAndResolveRows(
  rows: ParsedImportRow[],
  userLibrary: UserLibraryItem[]
): StagedImportItem[] {
  return rows.map((row) => {
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
        row,
        status: 'duplicate_in_library',
        resolvedTitle: existing.title,
        candidates: [],
        selectedTitleId: existing.title_id,
      };
    }

    // 2. Look up in catalog fixtures by external ID or normalized title & media type
    const exactMatch = MOCK_CATALOG_FIXTURES.find((f) => {
      // Check external ID matches
      if (row.externalId) {
        if (f.imdb_id && f.imdb_id.toLowerCase() === row.externalId.toLowerCase()) return true;
        if (f.tmdb_id && String(f.tmdb_id) === row.externalId) return true;
      }
      // Check title + media_type
      const normCatalog = normalizeTitleString(f.title);
      const sameType = f.media_type === row.mediaType;
      return normCatalog === row.normalizedTitle && sameType;
    });

    if (exactMatch) {
      return {
        id: `stage_${row.index}_${row.fingerprint}`,
        row,
        status: 'exact_match',
        resolvedTitle: exactMatch,
        candidates: [],
        selectedTitleId: exactMatch.id,
      };
    }

    // 3. Look for ambiguous / candidate matches of same media type
    const candidates = MOCK_CATALOG_FIXTURES.filter(
      (f) =>
        f.media_type === row.mediaType &&
        (normalizeTitleString(f.title).includes(row.normalizedTitle) ||
          row.normalizedTitle.includes(normalizeTitleString(f.title)))
    );

    if (candidates.length > 0) {
      return {
        id: `stage_${row.index}_${row.fingerprint}`,
        row,
        status: 'ambiguous_match',
        resolvedTitle: candidates[0],
        candidates,
        selectedTitleId: candidates[0].id,
      };
    }

    // 4. Synthesize imported catalog item so user doesn't lose data
    const synthesized: NormalizedCatalogItem = {
      id: `imported_${row.mediaType}_${row.fingerprint.substring(0, 12)}`,
      media_type: row.mediaType,
      title: row.rawTitle,
      release_year: row.year,
      genres: ['Imported'],
      status: 'released',
    };

    return {
      id: `stage_${row.index}_${row.fingerprint}`,
      row,
      status: 'exact_match',
      resolvedTitle: synthesized,
      candidates: [],
      selectedTitleId: synthesized.id,
    };
  });
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
    if (!titleId) {
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
      if (duplicatePolicy === 'fill' || duplicatePolicy === 'merge') {
        const incomingEpCount = item.row.episodesWatched || 0;
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
        const overwriteEps = item.row.episodesWatched !== undefined
          ? Array.from({ length: item.row.episodesWatched }, (_, i) => `ep_${i + 1}`)
          : existing.episodes_watched;

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

    // New item creation
    const catalogItem = item.resolvedTitle || {
      id: titleId,
      media_type: item.row.mediaType,
      title: item.row.rawTitle,
      genres: [],
    };

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
        { length: item.row.episodesWatched || 0 },
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
