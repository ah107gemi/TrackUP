import type { MediaType } from '../../types/database.types';
import type { NormalizedCatalogItem } from '../../lib/validators';

export type RecommendationReasonType =
  | 'cross_format_adaptation'
  | 'genre_affinity'
  | 'community_top_rated';

export interface RecommendationItem {
  id: string;
  title: string;
  media_type: MediaType;
  poster_url: string | null;
  backdrop_url: string | null;
  genres: string[];
  reasonType: RecommendationReasonType;
  reason: string;
  sourceTitleName?: string;
  matchScore: number; // 0 - 100
  catalogItem: NormalizedCatalogItem;
}
