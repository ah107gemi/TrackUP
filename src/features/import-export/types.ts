import type { MediaType, TrackingStatus } from '../../types/database.types';
import type { NormalizedCatalogItem } from '../../lib/validators';

export type PlatformPreset = 'letterboxd' | 'imdb' | 'trakt' | 'mal' | 'binger' | 'generic';

export interface ParsedImportRow {
  index: number;
  rawTitle: string;
  normalizedTitle: string;
  year?: number;
  mediaType: MediaType;
  externalId?: string;
  status: TrackingStatus;
  rating?: number; // 1-10 scale
  episodesWatched?: number;
  chaptersRead?: number;
  volumesRead?: number;
  completedAt?: string;
  notes?: string;
  fingerprint: string;
}

export type ResolutionStatus = 'exact_match' | 'ambiguous_match' | 'duplicate_in_library' | 'unmatched';

export interface StagedImportItem {
  id: string;
  row: ParsedImportRow;
  status: ResolutionStatus;
  resolvedTitle?: NormalizedCatalogItem;
  candidates: NormalizedCatalogItem[];
  selectedTitleId?: string;
  errorMessage?: string;
}

export interface ImportBatchSummary {
  id: string;
  source: PlatformPreset;
  fileName: string;
  totalRows: number;
  matchedCount: number;
  duplicateCount: number;
  unmatchedCount: number;
  items: StagedImportItem[];
}

export type ImportPipelineStep = 'idle' | 'uploading' | 'parsing' | 'resolving' | 'preview' | 'importing' | 'complete';
