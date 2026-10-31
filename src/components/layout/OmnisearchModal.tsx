import React, { useEffect, useState } from 'react';
import { Search, X, Film, BookOpen, Tv } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { searchCatalog, type SearchDomain } from '../../features/catalog/catalogService';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';

interface OmnisearchModalProps {
  onSelectTitle?: (id: string) => void;
}

export const OmnisearchModal: React.FC<OmnisearchModalProps> = ({ onSelectTitle }) => {
  const { omnisearchOpen, setOmnisearchOpen, activeTab, setActiveTab } = useUIStore();
  const [searchDomain, setSearchDomain] = useState<SearchDomain>('watch');
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MediaType | 'all'>('all');
  const [results, setResults] = useState<NormalizedCatalogItem[]>([]);

  const prevOpenRef = React.useRef(false);

  // Automatically align search mode when modal opens based on active navigation tab
  useEffect(() => {
    if (omnisearchOpen && !prevOpenRef.current) {
      if (activeTab === 'read') {
        setSearchDomain('read');
      } else {
        setSearchDomain('watch');
      }
      setActiveCategory('all');
    }
    prevOpenRef.current = omnisearchOpen;
  }, [omnisearchOpen, activeTab]);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K / /)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOmnisearchOpen(!omnisearchOpen);
      } else if (e.key === 'Escape' && omnisearchOpen) {
        setOmnisearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [omnisearchOpen, setOmnisearchOpen]);

  // Live search query execution strictly scoped by searchDomain
  useEffect(() => {
    let mounted = true;

    // Detect if user typed a specific format indicator like "(manga)" or "(manhwa)" while in watch mode
    const lower = query.toLowerCase();
    const effectiveDomain =
      searchDomain === 'watch' && (lower.includes('(manga)') || lower.includes('(manhwa)'))
        ? 'read'
        : searchDomain;

    searchCatalog(query, activeCategory, effectiveDomain).then((items) => {
      if (mounted) setResults(items);
    });
    return () => {
      mounted = false;
    };
  }, [query, activeCategory, searchDomain]);

  if (!omnisearchOpen) return null;

  const watchCategories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Watch' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'anime_series', label: 'Anime Series' },
    { id: 'anime_film', label: 'Anime Films' },
  ];

  const readCategories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Reading' },
    { id: 'manga', label: 'Manga' },
    { id: 'manhwa', label: 'Manhwa' },
  ];

  const categories = searchDomain === 'watch' ? watchCategories : readCategories;

  const handleDomainChange = (domain: SearchDomain) => {
    setSearchDomain(domain);
    setActiveCategory('all');
  };

  const handleItemClick = (id: string) => {
    setOmnisearchOpen(false);
    if (onSelectTitle) {
      onSelectTitle(id);
    } else {
      setActiveTab(searchDomain === 'read' ? 'read' : 'discover');
    }
  };

  return (
    <div
      data-testid="omnisearch-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-background/80 backdrop-blur-sm"
      onClick={() => setOmnisearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-surface-elevated rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Master Domain Mode Toggle: Watch Media vs Dedicated Reading */}
        <div className="flex items-center justify-between px-3 sm:px-4 pt-3 pb-2 border-b border-surface-elevated bg-surface/50 gap-2 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1.5 p-1 bg-surface-elevated rounded-xl shrink-0">
            <button
              onClick={() => handleDomainChange('watch')}
              data-testid="search-mode-watch"
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                searchDomain === 'watch'
                  ? 'bg-accent text-background shadow-md'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Watch Media (TV / Movies / Anime)</span>
              <span className="sm:hidden inline">Watch Media</span>
            </button>
            <button
              onClick={() => handleDomainChange('read')}
              data-testid="search-mode-read"
              className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                searchDomain === 'read'
                  ? 'bg-accent text-background shadow-md'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reading (Manga / Manhwa)</span>
              <span className="sm:hidden inline">Reading</span>
            </button>
          </div>

          <button
            onClick={() => setOmnisearchOpen(false)}
            data-testid="omnisearch-close"
            aria-label="Close search modal"
            className="text-xs font-mono text-text-muted hover:text-text-primary px-2 py-1 rounded bg-surface-elevated transition-colors shrink-0"
          >
            ESC
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-surface-elevated">
          <Search className="w-5 h-5 text-accent shrink-0 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              searchDomain === 'watch'
                ? 'Search movies, TV shows, and anime (TMDB & AniList)...'
                : 'Search Manga and South Korean Manhwa (AniList only)...'
            }
            data-testid="omnisearch-input"
            className="w-full bg-transparent text-text-primary placeholder:text-text-muted text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search query"
              className="p-1 text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Category Pills Scoped to Selected Domain */}
        <div className="relative">
          <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-surface-elevated scrollbar-none snap-x">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                data-testid={`omnisearch-category-${cat.id}`}
                className={`min-h-[30px] px-3 py-1 rounded-full text-xs font-medium shrink-0 snap-start transition-colors ${
                  activeCategory === cat.id
                    ? 'bg-accent text-background font-semibold shadow'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent md:hidden" />
        </div>

        {/* Results / List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {results.length > 0 ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-2 pb-1">
                <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                  {searchDomain === 'watch' ? 'Watch Results' : 'Reading Results'} ({results.length})
                </p>
                <span className="text-[10px] text-text-muted font-medium">
                  {searchDomain === 'watch' ? 'TMDB + AniList Anime' : 'AniList Manga Only'}
                </span>
              </div>
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  data-testid={`omnisearch-result-${item.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated border border-transparent hover:border-surface-elevated transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-[#16161D] shrink-0 border border-surface-elevated">
                      {item.poster_url || (item as any).poster_path ? (
                        <img
                          src={
                            (item.poster_url || (item as any).poster_path).startsWith('http') ||
                            (item.poster_url || (item as any).poster_path).startsWith('/assets/')
                              ? item.poster_url || (item as any).poster_path
                              : `https://image.tmdb.org/t/p/w500${(item.poster_url || (item as any).poster_path).startsWith('/') ? '' : '/'}${item.poster_url || (item as any).poster_path}`
                          }
                          alt={item.title}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/assets/trackup-logo.jpg';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-accent text-xs">
                          {item.title.charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary group-hover:text-accent transition-colors truncate">
                        {item.title}
                      </p>
                      <p className="text-xs text-text-muted truncate">
                        {item.release_year ? `${item.release_year} • ` : ''}
                        {item.genres.slice(0, 2).join(', ')}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`shrink-0 ml-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      item.media_type === 'manhwa'
                        ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                        : item.media_type === 'manga'
                        ? 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-surface-elevated text-accent border-accent/20'
                    }`}
                  >
                    {item.media_type.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted space-y-3">
              <div className="flex gap-4 text-text-muted/40">
                {searchDomain === 'watch' ? (
                  <>
                    <Film className="w-8 h-8" />
                    <Tv className="w-8 h-8" />
                  </>
                ) : (
                  <BookOpen className="w-8 h-8" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-text-secondary">
                  No matching {searchDomain === 'watch' ? 'watchable media' : 'manga/manhwa'} found
                  {query ? ` for "${query}"` : ''}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  {searchDomain === 'watch'
                    ? 'Looking for Manga or South Korean Manhwa?'
                    : 'Looking for Movies, TV shows, or Anime?'}
                </p>
              </div>

              {/* Quick Switch Button */}
              <button
                onClick={() => handleDomainChange(searchDomain === 'watch' ? 'read' : 'watch')}
                className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 text-accent font-semibold text-xs border border-accent/20 transition-all flex items-center gap-2 shadow-sm"
              >
                {searchDomain === 'watch' ? (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Switch to Reading Search (Manga & Manhwa)</span>
                  </>
                ) : (
                  <>
                    <Film className="w-3.5 h-3.5" />
                    <span>Switch to Watch Search (TV, Movies, Anime)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
