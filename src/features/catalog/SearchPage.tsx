import React, { useEffect, useState } from 'react';
import { Search, Compass, SlidersHorizontal, Info, X, Film, BookOpen } from 'lucide-react';
import { searchCatalog, type SearchDomain } from './catalogService';
import { isTmdbConfigured } from './tmdbClient';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';
import { MediaPosterCard } from '../../components/shared/MediaPosterCard';
import { TmdbAttribution } from '../../components/shared/TmdbAttribution';

interface SearchPageProps {
  onSelectTitle: (id: string) => void;
}

export const SearchPage: React.FC<SearchPageProps> = ({ onSelectTitle }) => {
  const [domain, setDomain] = useState<SearchDomain>('watch');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MediaType | 'all'>('all');
  const [results, setResults] = useState<NormalizedCatalogItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      const items = await searchCatalog(query, activeCategory, domain);
      if (mounted) {
        setResults(items);
        setLoading(false);
      }
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [query, activeCategory, domain]);

  const watchCategories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Watch Categories' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'anime_series', label: 'Anime Series' },
    { id: 'anime_film', label: 'Anime Films' },
  ];

  const readCategories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Reading Categories' },
    { id: 'manga', label: 'Manga' },
    { id: 'manhwa', label: 'Manhwa' },
  ];

  const categories = domain === 'watch' ? watchCategories : readCategories;

  const handleDomainChange = (newDomain: SearchDomain) => {
    setDomain(newDomain);
    setActiveCategory('all');
  };

  return (
    <div data-testid="discover-page" className="max-w-6xl mx-auto space-y-6">
      {/* Master Toggle: Watch Catalog vs Reading Catalog */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1.5 p-1 bg-surface rounded-2xl border border-surface-elevated shadow-sm">
          <button
            onClick={() => handleDomainChange('watch')}
            data-testid="discover-mode-watch"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              domain === 'watch'
                ? 'bg-accent text-background shadow-md'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Watch Catalog (TV / Movies / Anime)</span>
          </button>
          <button
            onClick={() => handleDomainChange('read')}
            data-testid="discover-mode-read"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              domain === 'read'
                ? 'bg-accent text-background shadow-md'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Reading Catalog (Manga & Manhwa)</span>
          </button>
        </div>
      </div>

      {/* Discover Header & Dedicated Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">
            {domain === 'watch' ? 'Discover Watch Catalog' : 'Discover Reading Catalog'}
          </h1>
          <p className="text-xs md:text-sm text-text-secondary mt-1">
            {domain === 'watch'
              ? 'Browse across movies, television series, and anime.'
              : 'Browse across Japanese Manga and South Korean Manhwa (AniList).'}
          </p>
        </div>

        {/* Live Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-accent absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              domain === 'watch'
                ? 'Search movies, TV shows, and anime...'
                : 'Search manga and manhwa...'
            }
            data-testid="discover-search-input"
            className="w-full pl-10 pr-9 py-2 bg-surface border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none shadow-sm placeholder:text-text-muted"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="absolute right-3 top-2.5 p-0.5 text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
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
      {domain === 'watch' && (activeCategory === 'movie' || activeCategory === 'tv') && !isTmdbConfigured() && (
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

      {/* Reading Dedicated Notice when browsing Manga/Manhwa */}
      {domain === 'read' && (
        <div
          data-testid="reading-catalog-notice"
          className="p-3.5 rounded-2xl bg-surface/80 border border-cyan-500/20 text-xs text-text-secondary flex items-center gap-3 animate-in fade-in"
        >
          <BookOpen className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>
            <strong className="text-text-primary">Dedicated Reading Catalog:</strong> Live AniList search strictly isolated for Japanese Manga and South Korean Manhwa. Reading titles are kept independent from television and film trackers.
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
            {query
              ? `No results matching "${query}" in ${domain === 'watch' ? 'Watch' : 'Reading'} catalog (${activeCategory === 'all' ? 'all categories' : activeCategory}). Try refining your search.`
              : `No results in ${domain === 'watch' ? 'Watch' : 'Reading'} catalog (${activeCategory === 'all' ? 'all categories' : activeCategory}). Try selecting a different category filter.`}
          </p>
        </div>
      )}

      {/* TMDB & AniList Attribution */}
      <TmdbAttribution className="mt-16" />
    </div>
  );
};
