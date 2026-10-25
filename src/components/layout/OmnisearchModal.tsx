import React, { useEffect, useState } from 'react';
import { Search, X, Film, Tv, BookOpen } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import type { MediaType } from '../../types/database.types';

export const OmnisearchModal: React.FC = () => {
  const { omnisearchOpen, setOmnisearchOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MediaType | 'all'>('all');

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

        {/* Results / Empty View */}
        <div className="p-6 text-center text-text-muted max-h-[60vh] overflow-y-auto">
          {query ? (
            <div className="space-y-2 text-left">
              <p className="text-xs text-text-secondary uppercase tracking-wider font-semibold px-2 mb-2">
                Unified Search (Phase 2 Preview)
              </p>
              <div className="p-3 rounded-xl bg-surface-elevated/50 flex items-center gap-3">
                <Film className="w-5 h-5 text-accent" />
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    Search result matching: &quot;{query}&quot;
                  </p>
                  <p className="text-xs text-text-secondary">
                    TMDB & AniList normalization layer connects in Phase 2
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="flex gap-4 text-text-muted/40 mb-3">
                <Film className="w-8 h-8" />
                <Tv className="w-8 h-8" />
                <BookOpen className="w-8 h-8" />
              </div>
              <p className="text-sm font-medium text-text-secondary">
                Type to search across all 6 entertainment & reading categories
              </p>
              <p className="text-xs text-text-muted mt-1">
                Movies • TV Shows • Anime Series • Anime Films • Manga • Manhwa
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
