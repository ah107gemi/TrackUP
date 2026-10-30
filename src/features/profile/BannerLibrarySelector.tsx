import React, { useState, useMemo } from 'react';
import { X, Search, Check, Film, Tv, Sparkles, Image as ImageIcon } from 'lucide-react';
import type { UserLibraryItem } from '../library/libraryService';

interface BannerLibrarySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBackdrop: (backdropUrl: string) => void;
  library: UserLibraryItem[];
  selectedBannerUrl?: string | null;
}

export function extractBackdropUrl(item: {
  title?: {
    backdrop_url?: string | null;
    backdrop_path?: string | null;
    poster_url?: string | null;
    poster_path?: string | null;
  };
}): string | null {
  if (!item || !item.title) return null;
  const raw =
    item.title.backdrop_url ||
    item.title.backdrop_path ||
    item.title.poster_url ||
    item.title.poster_path;
  if (!raw) return null;
  if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
  return `https://image.tmdb.org/t/p/w1280${raw.startsWith('/') ? '' : '/'}${raw}`;
}

export const BannerLibrarySelector: React.FC<BannerLibrarySelectorProps> = ({
  isOpen,
  onClose,
  onSelectBackdrop,
  library,
  selectedBannerUrl,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'tv' | 'movie' | 'anime'>('all');

  // Filter items that actually have valid backdrops/posters
  const availableItems = useMemo(() => {
    return library.filter((item) => {
      if (!item?.title) return false;
      const backdrop = extractBackdropUrl(item);
      if (!backdrop) return false;

      // Category filter
      if (activeCategory === 'tv' && item.title.media_type !== 'tv') return false;
      if (activeCategory === 'movie' && item.title.media_type !== 'movie') return false;
      if (
        activeCategory === 'anime' &&
        item.title.media_type !== 'anime_series' &&
        item.title.media_type !== 'anime_film'
      ) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = item.title.title?.toLowerCase().includes(query);
        const originalTitleMatch = item.title.original_title?.toLowerCase().includes(query);
        return titleMatch || originalTitleMatch;
      }

      return true;
    });
  }, [library, activeCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="banner-library-selector-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-background/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[90vh] bg-surface border border-surface-elevated rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-surface-elevated flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-accent/15 text-accent flex items-center justify-center">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary tracking-tight">
                Select Banner from Library
              </h2>
              <p className="text-xs text-text-muted">
                Choose a high-resolution cinematic backdrop from your saved shows & movies
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-library-selector-btn"
            className="self-end sm:self-auto p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:px-6 bg-surface-elevated/30 border-b border-surface-elevated flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title..."
              data-testid="banner-library-search"
              className="w-full pl-9 pr-4 py-2 bg-surface-elevated border border-surface-elevated focus:border-accent rounded-xl text-text-primary text-xs focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-elevated border border-surface-elevated text-xs">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              data-testid="library-filter-all"
              className={`py-1 px-3 rounded-lg font-semibold transition-all cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('tv')}
              data-testid="library-filter-tv"
              className={`py-1 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'tv'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Tv className="w-3 h-3" />
              <span>TV</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('movie')}
              data-testid="library-filter-movie"
              className={`py-1 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'movie'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Film className="w-3 h-3" />
              <span>Movies</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('anime')}
              data-testid="library-filter-anime"
              className={`py-1 px-3 rounded-lg font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                activeCategory === 'anime'
                  ? 'bg-accent text-background shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Anime</span>
            </button>
          </div>
        </div>

        {/* Backdrop Grid View */}
        <div
          data-testid="library-backdrops-container"
          className="flex-1 overflow-y-auto p-4 sm:p-6"
        >
          {availableItems.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-text-muted space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center text-text-muted/60">
                <ImageIcon className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-text-secondary">
                {searchQuery ? 'No matching titles found' : 'No titles with backdrops in your library'}
              </p>
              <p className="text-xs max-w-sm">
                {searchQuery
                  ? 'Try clearing your search query or selecting a different category filter.'
                  : 'Track TV shows, movies, or anime to populate cinematic backdrop choices.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {availableItems.map((item) => {
                const backdrop = extractBackdropUrl(item);
                if (!backdrop) return null;
                const isSelected = selectedBannerUrl === backdrop;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onSelectBackdrop(backdrop);
                      onClose();
                    }}
                    data-testid={`library-backdrop-option-${item.title_id}`}
                    className={`group relative rounded-2xl overflow-hidden border text-left cursor-pointer transition-all aspect-[16/9] shadow-md hover:shadow-xl ${
                      isSelected
                        ? 'border-accent ring-2 ring-accent shadow-accent/20'
                        : 'border-surface-elevated hover:border-accent/80'
                    }`}
                  >
                    {/* Backdrop Image */}
                    <img
                      src={backdrop}
                      alt={item.title.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />

                    {/* Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/40 to-transparent" />

                    {/* Top Badges */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-background/80 backdrop-blur-sm text-accent border border-surface-elevated">
                        {item.title.media_type.replace('_', ' ')}
                      </span>

                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-accent text-background shadow">
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Active Banner</span>
                        </span>
                      )}
                    </div>

                    {/* Bottom Metadata */}
                    <div className="absolute bottom-2.5 left-3 right-3 pointer-events-none">
                      <h4 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors truncate">
                        {item.title.title}
                      </h4>
                      {item.title.release_year && (
                        <p className="text-[11px] text-text-muted mt-0.5 font-mono">
                          {item.title.release_year}
                        </p>
                      )}
                    </div>

                    {/* Hover Selection Prompt */}
                    <div className="absolute inset-0 bg-accent/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <span className="px-3 py-1.5 rounded-xl bg-background/90 text-text-primary text-xs font-bold shadow-lg border border-surface-elevated transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        {isSelected ? 'Currently Selected' : 'Set as Banner'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 border-t border-surface-elevated bg-surface-elevated/20 flex items-center justify-between text-xs text-text-muted">
          <span>
            {availableItems.length} backdrop{availableItems.length === 1 ? '' : 's'} available
          </span>
          <button
            type="button"
            onClick={onClose}
            data-testid="banner-library-cancel-btn"
            className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
