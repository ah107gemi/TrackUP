import React from 'react';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';

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

export const MediaPosterCard: React.FC<MediaPosterCardProps> = ({ item, onClick }) => {
  const meta = categoryLabels[item.media_type] || {
    label: item.media_type.toUpperCase(),
    color: 'bg-surface-elevated text-text-secondary border-surface-elevated',
  };

  return (
    <div
      onClick={onClick}
      data-testid={`poster-card-${item.id}`}
      className="group relative flex flex-col bg-surface rounded-2xl overflow-hidden border border-surface-elevated hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-lg hover:shadow-2xl hover:-translate-y-1 select-none"
    >
      {/* Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-surface-elevated">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center p-4 text-center text-text-muted text-xs">
            {item.title}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

        {/* Category Badge */}
        <div className="absolute top-2.5 left-2.5">
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider border backdrop-blur-md ${meta.color}`}
          >
            {meta.label}
          </span>
        </div>

        {/* Release Year Badge */}
        {item.release_year && (
          <div className="absolute top-2.5 right-2.5">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-medium bg-background/80 text-text-secondary backdrop-blur-md border border-white/10">
              {item.release_year}
            </span>
          </div>
        )}
      </div>

      {/* Info Body */}
      <div className="p-3.5 flex flex-col flex-1 justify-between">
        <div>
          <h3 className="font-semibold text-sm text-text-primary line-clamp-1 group-hover:text-accent transition-colors">
            {item.title}
          </h3>
          {item.original_title && item.original_title !== item.title && (
            <p className="text-[11px] text-text-muted line-clamp-1 mt-0.5">
              {item.original_title}
            </p>
          )}
        </div>

        <div className="mt-2.5 flex items-center justify-between text-xs text-text-secondary">
          {item.genres.length > 0 && (
            <span className="text-[11px] text-text-muted truncate max-w-[120px]">
              {item.genres[0]}
            </span>
          )}

          {/* Type-specific progress unit */}
          {item.runtime_minutes && (
            <span className="font-mono text-[11px] text-text-muted">
              {item.runtime_minutes}m
            </span>
          )}
          {item.total_episodes && (
            <span className="font-mono text-[11px] text-accent">
              {item.total_episodes} eps
            </span>
          )}
          {item.total_chapters && (
            <span className="font-mono text-[11px] text-accent">
              {item.total_chapters} chs
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
