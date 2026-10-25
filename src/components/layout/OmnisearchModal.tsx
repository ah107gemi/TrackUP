import React, { useEffect, useState } from 'react';
import { Search, X, Film, BookOpen, Tv } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { searchCatalog } from '../../features/catalog/catalogService';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';

interface OmnisearchModalProps {
  onSelectTitle?: (id: string) => void;
}

export const OmnisearchModal: React.FC<OmnisearchModalProps> = ({ onSelectTitle }) => {
  const { omnisearchOpen, setOmnisearchOpen, setActiveTab } = useUIStore();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MediaType | 'all'>('all');
  const [results, setResults] = useState<NormalizedCatalogItem[]>([]);

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

  // Live search query execution
  useEffect(() => {
    let mounted = true;
    searchCatalog(query, activeCategory).then((items) => {
      if (mounted) setResults(items);
    });
    return () => {
      mounted = false;
    };
  }, [query, activeCategory]);

  if (!omnisearchOpen) return null;

  const categories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'anime_series', label: 'Anime Series' },
    { id: 'anime_film', label: 'Anime Films' },
    { id: 'manga', label: 'Manga' },
    { id: 'manhwa', label: 'Manhwa' },
  ];

  const handleItemClick = (id: string) => {
    setOmnisearchOpen(false);
    if (onSelectTitle) {
      onSelectTitle(id);
    } else {
      setActiveTab('discover');
    }
  };

  return (
    <div
      data-testid="omnisearch-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-background/80 backdrop-blur-sm"
      onClick={() => setOmnisearchOpen(false)}
    >
      <div
        className="w-full max-w-2xl bg-surface border border-surface-elevated rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-surface-elevated">
          <Search className="w-5 h-5 text-accent shrink-0 mr-3" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across movies, anime, tv, manga, manhwa..."
            data-testid="omnisearch-input"
            className="w-full bg-transparent text-text-primary placeholder:text-text-muted text-base focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-text-muted hover:text-text-primary"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setOmnisearchOpen(false)}
            data-testid="omnisearch-close"
            className="ml-2 text-xs font-mono text-text-muted hover:text-text-primary px-2 py-1 rounded bg-surface-elevated"
          >
            ESC
          </button>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 overflow-x-auto border-b border-surface-elevated no-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium shrink-0 transition-colors ${
                activeCategory === cat.id
                  ? 'bg-accent text-background font-semibold'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Results / List */}
        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
          {results.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-text-muted uppercase tracking-wider px-2">
                Matching Titles ({results.length})
              </p>
              {results.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item.id)}
                  data-testid={`omnisearch-result-${item.id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated border border-transparent hover:border-surface-elevated transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-surface shrink-0 border border-surface-elevated">
                      {item.poster_url ? (
                        <img
                          src={item.poster_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
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

                  <span className="shrink-0 ml-3 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-surface-elevated text-accent border border-accent/20">
                    {item.media_type.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center text-text-muted">
              <div className="flex gap-4 text-text-muted/40 mb-3">
                <Film className="w-8 h-8" />
                <Tv className="w-8 h-8" />
                <BookOpen className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-text-secondary">
                No matching titles found for &quot;{query}&quot;
              </p>
              <p className="text-xs text-text-muted mt-1">
                Try searching by title or changing category filter
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
