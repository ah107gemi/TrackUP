import React, { useEffect, useState } from 'react';
import { Compass, SlidersHorizontal, Info } from 'lucide-react';
import { searchCatalog } from './catalogService';
import { isTmdbConfigured } from './tmdbClient';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';
import { MediaPosterCard } from '../../components/shared/MediaPosterCard';
import { TmdbAttribution } from '../../components/shared/TmdbAttribution';

interface SearchPageProps {
  onSelectTitle: (id: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onSelectTitle }) => {
  const [activeCategory, setActiveCategory] = useState<MediaType | 'all'>('all');
  const [results, setResults] = useState<NormalizedCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      const items = await searchCatalog('', activeCategory);
      if (mounted) {
        setResults(items);
        setLoading(false);
      }
    }, 50);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [activeCategory]);

  const categories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Categories' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'anime_series', label: 'Anime Series' },
    { id: 'anime_film', label: 'Anime Films' },
    { id: 'manga', label: 'Manga' },
    { id: 'manhwa', label: 'Manhwa' },
  ];

  return (
    <div data-testid="discover-page" className="max-w-6xl mx-auto space-y-6">
      {/* Discover Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">
            Discover Catalog
          </h1>
          <p className="text-xs md:text-sm text-text-secondary mt-1">
            Browse across movies, television series, anime, manga, and manhwa.
          </p>
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="relative">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-surface-elevated scrollbar-none snap-x scroll-smooth">
          <SlidersHorizontal className="w-4 h-4 text-text-muted shrink-0 mr-1" />
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              data-testid={`filter-category-${cat.id}`}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 snap-start transition-all touch-manipulation flex items-center justify-center ${
                activeCategory === cat.id
                  ? 'bg-accent text-background shadow-md font-bold'
                  : 'bg-surface border border-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
        {/* Subtle right-edge fade mask for mobile discovery */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-2 w-8 bg-gradient-to-l from-background to-transparent md:hidden" />
      </div>

      {/* TMDB Optional Configuration Notice when viewing movies/tv without a key */}
      {(activeCategory === 'movie' || activeCategory === 'tv') && !isTmdbConfigured() && (
        <div
          data-testid="tmdb-setup-notice"
          className="p-3.5 rounded-2xl bg-surface/80 border border-surface-elevated text-xs text-text-secondary flex items-start sm:items-center gap-3 animate-in fade-in"
        >
          <Info className="w-4 h-4 text-accent shrink-0 mt-0.5 sm:mt-0" />
          <span>
            <strong className="text-text-primary">Curated Hollywood Showcase:</strong> Anime and Manga categories feature live public AniList search. To search the entire live TMDB movie and TV library, add <code className="text-accent bg-surface-elevated px-1.5 py-0.5 rounded font-mono text-[11px]">VITE_TMDB_API_KEY</code> to your <code className="font-mono text-[11px] text-text-primary">.env.local</code>.
          </span>
        </div>
      )}

      {/* Results Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-2xl bg-surface animate-pulse border border-surface-elevated"
            />
          ))}
        </div>
      ) : results.length > 0 ? (
        <div
          data-testid="catalog-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
        >
          {results.map((item) => (
            <MediaPosterCard
              key={item.id}
              item={item}
              onClick={() => onSelectTitle(item.id)}
            />
          ))}
        </div>
      ) : (
        <div className="p-12 text-center bg-surface border border-surface-elevated rounded-2xl max-w-lg mx-auto my-12">
          <Compass className="w-12 h-12 text-text-muted/40 mx-auto mb-3" />
          <h3 className="text-base font-bold text-text-primary">No titles found</h3>
          <p className="text-xs text-text-secondary mt-1">
            No results in{' '}
            {activeCategory === 'all' ? 'any category' : activeCategory}. Try selecting a different category filter.
          </p>
        </div>
      )}

      {/* TMDB & AniList Attribution */}
      <TmdbAttribution className="mt-16" />
    </div>
  );
};
