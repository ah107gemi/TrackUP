import React, { useState } from 'react';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';
import { formatReleaseDate, formatRuntime } from '../../lib/dateUtils';

interface MediaPosterCardProps {
  item: NormalizedCatalogItem;
  onClick?: () => void;
}

const categoryLabels: Record<MediaType, { label: string; color: string }> = {
  movie: { label: 'MOVIE', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  tv: { label: 'TV SHOW', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  anime_series: { label: 'ANIME SERIES', color: 'bg-accent/20 text-accent border-accent/30' },
  anime_film: { label: 'ANIME FILM', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  manga: { label: 'MANGA', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  manhwa: { label: 'MANHWA', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

/**
 * Evaluates poster src in aggressive fallback order:
 * item.poster_url -> item.poster_path (prepended with TMDB base URL) -> item.coverImage?.extraLarge -> item.coverImage?.large -> fallback logo
 */
function getCardPosterSrc(item: any): string {
  // 1. item.poster_url
  if (item?.poster_url && typeof item.poster_url === 'string') {
    const trimmed = item.poster_url.trim();
    if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== '/assets/trackup-logo.jpg') {
      if (trimmed.startsWith('http') || trimmed.startsWith('/assets/')) {
        return trimmed;
      }
      return `https://image.tmdb.org/t/p/w500${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    }
  }

  // 2. item.poster_path (prepended with TMDB base URL)
  if (item?.poster_path && typeof item.poster_path === 'string') {
    const trimmed = item.poster_path.trim();
    if (trimmed && trimmed !== 'null' && trimmed !== 'undefined' && trimmed !== '/assets/trackup-logo.jpg') {
      if (trimmed.startsWith('http') || trimmed.startsWith('/assets/')) {
        return trimmed;
      }
      return `https://image.tmdb.org/t/p/w500${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
    }
  }

  // 3. item.coverImage?.extraLarge
  const extraLarge = item?.coverImage?.extraLarge || item?.cover_image?.extraLarge;
  if (extraLarge && typeof extraLarge === 'string' && extraLarge.trim()) {
    return extraLarge.trim();
  }

  // 4. item.coverImage?.large
  const large = item?.coverImage?.large || item?.cover_image?.large;
  if (large && typeof large === 'string' && large.trim()) {
    return large.trim();
  }

  // 5. Raw medium or backdrop fallback
  const medium = item?.coverImage?.medium || item?.cover_image?.medium;
  if (medium && typeof medium === 'string' && medium.trim()) {
    return medium.trim();
  }
  if (item?.backdrop_url && typeof item.backdrop_url === 'string' && item.backdrop_url.startsWith('http')) {
    return item.backdrop_url;
  }

  return '/assets/trackup-logo.jpg';
}

export const MediaPosterCard: React.FC<MediaPosterCardProps> = ({ item, onClick }) => {
  const [imageLoaded, setImageLoaded] = useState(false);

  if (!item) return null;

  const mediaType = item.media_type || 'manga';
  const meta = categoryLabels[mediaType] || {
    label: (mediaType || '').toUpperCase(),
    color: 'bg-surface-elevated text-text-secondary border-surface-elevated',
  };

  const totalEps =
    item.total_episodes ||
    (item as any).episodes ||
    (item as any).number_of_episodes ||
    ((item as any).seasons ? (item as any).seasons.reduce((acc: number, s: any) => acc + (s.episode_count || s.episodes?.length || 0), 0) : null);

  const totalChs =
    item.total_chapters ||
    (item as any).chapters ||
    (item as any).number_of_chapters;

  const posterUrl = getCardPosterSrc(item);

  return (
    <div
      onClick={onClick}
      data-testid={`poster-card-${item.id}`}
      className="group relative flex flex-col bg-surface rounded-2xl overflow-hidden border border-surface-elevated hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-1 select-none"
    >
      {/* Poster Image Container: Fixed 2:3 aspect ratio with #16161D dark skeleton */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#16161D]">
        {/* Dark Skeleton Loader */}
        {!imageLoaded && posterUrl && (
          <div
            data-testid="poster-skeleton"
            className="absolute inset-0 bg-[#16161D] animate-pulse flex items-center justify-center z-0"
          >
            <div className="w-8 h-8 rounded-full border-2 border-accent/20 border-t-accent animate-spin" />
          </div>
        )}

        {posterUrl ? (
          <img
            src={posterUrl}
            alt={item.title}
            className={`w-full h-full object-cover group-hover:scale-105 transition-all duration-300 relative z-10 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            loading="lazy"
            decoding="async"
            onLoad={() => setImageLoaded(true)}
            onError={(e) => {
              setImageLoaded(true);
              e.currentTarget.onerror = null;
              e.currentTarget.src = '/assets/trackup-logo.jpg';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center text-text-muted text-xs bg-[#16161D]">
            {item.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity z-10" />

        {/* Category Badge */}
        <div className="absolute top-2.5 left-2.5 z-20 max-w-[65%]">
          <span
            className={`inline-block truncate px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border backdrop-blur-md ${meta.color}`}
          >
            {meta.label}
          </span>
        </div>

        {/* Release Date/Year Badge - Positioned at bottom right of poster to prevent top badge collisions */}
        {(item.release_date || item.release_year) && (
          <div className="absolute bottom-2.5 right-2.5 z-20">
            <span
              data-testid={`card-release-date-${item.id}`}
              className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-background/90 text-text-secondary backdrop-blur-md border border-white/10 shadow-sm"
            >
              {formatReleaseDate(item.release_date) || item.release_year}
            </span>
          </div>
        )}
      </div>

      {/* Info Body */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-2">
        <div>
          <h3 className="font-semibold text-sm text-text-primary line-clamp-2 break-words group-hover:text-accent transition-colors">
            {item.title}
          </h3>
          {item.original_title && item.original_title !== item.title && (
            <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
              {item.original_title}
            </p>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between text-xs text-text-secondary">
          {Array.isArray(item.genres) && item.genres.length > 0 && (
            <span className="text-[11px] text-text-muted truncate max-w-[120px]">
              {item.genres[0]}
            </span>
          )}

          {/* Type-specific progress unit */}
          {(mediaType === 'movie' || mediaType === 'anime_film') && (
            <span className="font-mono text-[11px] text-text-muted">
              {formatRuntime(item.runtime_minutes) || 'Feature'}
            </span>
          )}
          {(mediaType === 'tv' || mediaType === 'anime_series') && totalEps && totalEps > 0 ? (
            <span className="font-mono text-[11px] text-accent">
              {totalEps} eps
            </span>
          ) : null}
          {(mediaType === 'manga' || mediaType === 'manhwa') && (
            <span className="font-mono text-[11px] text-accent">
              {totalChs && totalChs > 0
                ? `${totalChs} chs`
                : item.total_volumes
                ? `${item.total_volumes} vols`
                : 'Ongoing'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
