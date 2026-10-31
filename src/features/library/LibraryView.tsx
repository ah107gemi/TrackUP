import React, { useState, useEffect } from 'react';
import {
  Grid,
  LayoutGrid,
  List,
  Plus,
  Compass,
  Star,
  Film,
  BookOpen,
  Search,
  X,
  Check,
  ChevronDown,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../auth/AuthContext';
import {
  useUserLibrary,
  useIncrementEpisode,
  useIncrementChapter,
  useUpsertLibrary,
} from './useLibrary';
import type { UserLibraryItem } from './libraryService';
import { searchReadingCatalog } from '../catalog/catalogService';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { TrackingStatus, MediaType } from '../../types/database.types';
import { formatRuntime } from '../../lib/dateUtils';
import {
  readFiltersFromUrl,
  persistLibraryFilters,
  sanitizeFilterState,
  VALID_STATUSES,
  VALID_FORMATS,
} from './libraryFilterState';

interface LibraryViewProps {
  domain: 'watch' | 'read';
  onSelectTitle: (id: string) => void;
  userId?: string;
  readOnly?: boolean;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  domain,
  onSelectTitle,
  userId,
  readOnly: _readOnly = false,
}) => {
  const {
    libraryViewMode,
    setLibraryViewMode,
    setActiveTab,
    watchLibraryFilters,
    setWatchLibraryFilters,
    readLibraryFilters,
    setReadLibraryFilters,
  } = useUIStore();
  const { user } = useAuth();
  const effectiveUserId = userId || user?.id;
  const { data: library = [], isLoading } = useUserLibrary(effectiveUserId);

  const incrementEpisode = useIncrementEpisode();
  const incrementChapter = useIncrementChapter();
  const upsertMutation = useUpsertLibrary();

  const currentFilters = domain === 'watch' ? watchLibraryFilters : readLibraryFilters;
  const setFilters = domain === 'watch' ? setWatchLibraryFilters : setReadLibraryFilters;

  const safeFilters = sanitizeFilterState(currentFilters);
  const activeStatus = safeFilters.status || 'all';
  const selectedFormat = safeFilters.format || 'all';
  const localSearchQuery = safeFilters.searchQuery || '';

  const setActiveStatus = (status: TrackingStatus | 'all') => setFilters({ status: status || 'all' });
  const setSelectedFormat = (format: MediaType | 'all') => setFilters({ format: format || 'all' });
  const setLocalSearchQuery = (searchQuery: string) => setFilters({ searchQuery: searchQuery || '' });

  // Listen to popstate for back/forward browser navigation affecting query params
  useEffect(() => {
    const handlePopState = () => {
      const fromUrl = readFiltersFromUrl();
      if (fromUrl.status || fromUrl.format || fromUrl.searchQuery !== undefined) {
        setFilters(fromUrl);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [setFilters]);

  // Ensure current filters are reflected in URL for active domain
  useEffect(() => {
    persistLibraryFilters(safeFilters, domain);
  }, [domain]);

  // Dedicated Reading Search & Quick-Add state (Manga/Manhwa only)
  const [readingSearchQuery, setReadingSearchQuery] = useState('');
  const [readingSearchResults, setReadingSearchResults] = useState<NormalizedCatalogItem[]>([]);
  const [isReadingSearching, setIsReadingSearching] = useState(false);
  const [addedItemIds, setAddedItemIds] = useState<Set<string>>(new Set());

  const getEpProgressDisplay = (item: UserLibraryItem) => {
    if (!item || typeof item !== 'object') return '';
    const titleObj = item.title || ({} as any);
    const total =
      titleObj.total_episodes ||
      titleObj.episodes ||
      (titleObj as any).number_of_episodes ||
      (item as any).total_episodes ||
      (item as any).episodes ||
      (titleObj.seasons ? titleObj.seasons.reduce((acc: number, s: any) => acc + (s.episode_count || s.episodes?.length || 0), 0) : null);

    const watchedLen = Array.isArray(item.episodes_watched) ? item.episodes_watched.length : 0;
    if (item.status === 'completed') {
      return `${(total && total > 0 ? total : null) || (watchedLen > 0 ? watchedLen : null) || 12} eps`;
    }
    return `${watchedLen}${total && total > 0 ? ` / ${total}` : ''} eps`;
  };

  useEffect(() => {
    if (domain !== 'read' || !readingSearchQuery.trim()) {
      setReadingSearchResults([]);
      setIsReadingSearching(false);
      return;
    }

    let mounted = true;
    setIsReadingSearching(true);

    const timer = setTimeout(async () => {
      const results = await searchReadingCatalog(readingSearchQuery, 'all');
      if (mounted) {
        setReadingSearchResults(results);
        setIsReadingSearching(false);
      }
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [readingSearchQuery, domain]);

  const domainMediaTypes: MediaType[] =
    domain === 'watch'
      ? ['movie', 'tv', 'anime_series', 'anime_film']
      : ['manga', 'manhwa'];

  // Bulletproof filtering: guard null/undefined items, invalid filter states, and handle missing metadata safely
  const filtered = (Array.isArray(library) ? library : []).filter((item) => {
    if (!item || typeof item !== 'object') return false;

    const itemMediaType = item.title?.media_type;
    if (itemMediaType && !domainMediaTypes.includes(itemMediaType)) {
      return false;
    }

    // Status filter: only filter if activeStatus is valid and not 'all'
    if (activeStatus && activeStatus !== 'all' && VALID_STATUSES.has(activeStatus)) {
      const itemStatus = item.status;
      if (itemStatus && itemStatus !== activeStatus) {
        return false;
      }
    }

    // Sub-format / Category filter: only filter if selectedFormat is valid and not 'all'
    if (selectedFormat && selectedFormat !== 'all' && VALID_FORMATS.has(selectedFormat)) {
      if (itemMediaType && itemMediaType !== selectedFormat) {
        return false;
      }
    }

    // Local library search
    const q = (localSearchQuery || '').trim().toLowerCase();
    if (q) {
      const title = (item.title?.title || '').toLowerCase();
      const originalTitle = (item.title?.original_title || '').toLowerCase();
      if (!title.includes(q) && !originalTitle.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const domainTotalCount = (Array.isArray(library) ? library : []).filter((item) => {
    if (!item || typeof item !== 'object') return false;
    const type = item.title?.media_type;
    return type ? domainMediaTypes.includes(type) : true;
  }).length;

  // Auto-heal truly poisoned filter states:
  // If filter parameters contain corrupted/invalid types (e.g. malformed status or format),
  // reset filters to safe defaults. Never clear valid user searches or active filters when 0 results match.
  useEffect(() => {
    if (isLoading) return;
    const isPoisoned =
      !activeStatus ||
      !VALID_STATUSES.has(activeStatus) ||
      !selectedFormat ||
      !VALID_FORMATS.has(selectedFormat) ||
      typeof localSearchQuery !== 'string';

    if (isPoisoned) {
      const safeDefaults = { status: 'all' as const, format: 'all' as const, searchQuery: '' };
      setFilters(safeDefaults);
      persistLibraryFilters(safeDefaults, domain);
    }
  }, [activeStatus, selectedFormat, localSearchQuery, isLoading, domain, setFilters]);

  const statuses: { id: TrackingStatus | 'all'; label: string }[] = [
    { id: 'all', label: 'All Statuses' },
    { id: 'active', label: domain === 'watch' ? 'Watching' : 'Reading' },
    { id: 'planned', label: 'Planned' },
    { id: 'completed', label: 'Completed' },
    { id: 'paused', label: 'On Hold' },
    { id: 'dropped', label: 'Dropped' },
  ];

  const handleQuickProgress = (e: React.MouseEvent, item: (typeof library)[0]) => {
    e.stopPropagation();
    if (!user) return;

    if (item.title.media_type === 'tv' || item.title.media_type === 'anime_series') {
      const nextEpNum = item.episodes_watched.length + 1;
      incrementEpisode.mutate({
        libraryId: item.id,
        userId: user.id,
        episodeId: `ep_${nextEpNum}`,
        watched: true,
      });
    } else if (item.title.media_type === 'manga' || item.title.media_type === 'manhwa') {
      incrementChapter.mutate({
        libraryId: item.id,
        userId: user.id,
        chapter: item.last_chapter_read + 1,
      });
    }
  };

  const handleFractionalProgress = (e: React.MouseEvent, item: (typeof library)[0]) => {
    e.stopPropagation();
    if (!user) return;
    incrementChapter.mutate({
      libraryId: item.id,
      userId: user.id,
      chapter: item.last_chapter_read + 0.5,
    });
  };

  const handleQuickAddReading = (e: React.MouseEvent, item: NormalizedCatalogItem) => {
    e.stopPropagation();
    if (!user) return;

    upsertMutation.mutate({
      userId: user.id,
      titleId: item.id,
      status: 'active',
      titleData: item,
    });

    setAddedItemIds((prev) => new Set(prev).add(item.id));
  };

  return (
    <div data-testid={`${domain}-library-view`} className="max-w-6xl mx-auto space-y-6">
      {/* Master Library Segment Controller: Switch cleanly between Watch and Read Libraries */}
      <div className="flex items-center justify-between gap-4">
        <div className="inline-flex items-center gap-1.5 p-1 bg-surface rounded-2xl border border-surface-elevated shadow-sm">
          <button
            onClick={() => setActiveTab('watch')}
            data-testid="library-toggle-watch"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              domain === 'watch'
                ? 'bg-accent text-background shadow-md'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Watch Library</span>
          </button>
          <button
            onClick={() => setActiveTab('read')}
            data-testid="library-toggle-read"
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              domain === 'read'
                ? 'bg-accent text-background shadow-md'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Reading Library (Manga / Manhwa)</span>
          </button>
        </div>
      </div>

      {/* Top Header & View Mode Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">
            {domain === 'watch' ? 'Watch Library' : 'Reading Library'}
          </h1>
          <p className="text-xs md:text-sm text-text-secondary mt-1">
            {domain === 'watch'
              ? 'Movies, TV Shows, Anime Series & Anime Films'
              : 'Japanese Manga & South Korean Manhwa'}
          </p>
        </div>

        {/* 3 View Modes Toolbar (Persisted in Zustand) */}
        <div
          data-testid="view-mode-selector"
          className="flex items-center gap-1 bg-surface p-1 rounded-xl border border-surface-elevated self-start md:self-auto"
        >
          <button
            onClick={() => setLibraryViewMode('grid')}
            title="Poster Grid"
            data-testid="view-mode-grid"
            className={`p-1.5 rounded-lg transition-colors ${
              libraryViewMode === 'grid'
                ? 'bg-accent text-background shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLibraryViewMode('compact')}
            title="Compact Grid"
            data-testid="view-mode-compact"
            className={`p-1.5 rounded-lg transition-colors ${
              libraryViewMode === 'compact'
                ? 'bg-accent text-background shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setLibraryViewMode('list')}
            title="Detailed List / Table"
            data-testid="view-mode-list"
            className={`p-1.5 rounded-lg transition-colors ${
              libraryViewMode === 'list'
                ? 'bg-accent text-background shadow'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dedicated Reading Search & Quick Add Panel (Only shown in Reading Library) */}
      {domain === 'read' && (
        <div
          data-testid="reading-library-search-panel"
          className="p-4 rounded-2xl bg-surface border border-surface-elevated space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-text-primary">
                Dedicated Reading Search & Quick Add
              </h2>
            </div>
            <span className="text-[11px] text-text-muted font-mono bg-surface-elevated px-2 py-0.5 rounded">
              AniList Manga Only
            </span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-accent absolute left-3.5 top-3" />
            <input
              type="text"
              value={readingSearchQuery}
              onChange={(e) => setReadingSearchQuery(e.target.value)}
              placeholder="Search Manga or South Korean Manhwa to track (e.g. Solo Leveling, Berserk)..."
              data-testid="reading-library-search-input"
              className="w-full pl-10 pr-9 py-2 bg-surface-elevated/60 border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none placeholder:text-text-muted"
            />
            {readingSearchQuery && (
              <button
                onClick={() => setReadingSearchQuery('')}
                aria-label="Clear reading search query"
                className="absolute right-3 top-2.5 p-0.5 text-text-muted hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Add Reading Results Shelf */}
          {isReadingSearching ? (
            <div className="py-3 text-center text-xs text-text-muted animate-pulse">
              Searching AniList Manga & Manhwa...
            </div>
          ) : readingSearchResults.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 pt-1 max-h-64 overflow-y-auto">
              {readingSearchResults.slice(0, 6).map((item) => {
                const isAlreadyAdded =
                  addedItemIds.has(item.id) || library.some((l) => l.title_id === item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => onSelectTitle(item.id)}
                    data-testid={`reading-search-result-${item.id}`}
                    className="flex items-center justify-between p-2 rounded-xl bg-surface-elevated/70 hover:bg-surface-elevated border border-transparent hover:border-surface-elevated transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <img
                        src={item.poster_url || '/assets/trackup-logo.jpg'}
                        alt={item.title}
                        className="w-8 h-12 rounded-lg object-cover shrink-0 bg-[#16161D]"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate group-hover:text-accent transition-colors">
                          {item.title}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${
                              item.media_type === 'manhwa'
                                ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                                : 'bg-rose-500/20 text-rose-400 border-rose-500/30'
                            }`}
                          >
                            {item.media_type}
                          </span>
                          {item.total_chapters && (
                            <span className="text-[10px] text-text-muted font-mono">
                              {item.total_chapters} chs
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleQuickAddReading(e, item)}
                      disabled={isAlreadyAdded}
                      title={isAlreadyAdded ? 'Already in Library' : 'Add to Reading Library'}
                      data-testid={`quick-add-${item.id}`}
                      className={`shrink-0 ml-2 p-1.5 rounded-lg text-xs font-bold transition-all ${
                        isAlreadyAdded
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-default'
                          : 'bg-accent/20 text-accent hover:bg-accent hover:text-background border border-accent/30'
                      }`}
                    >
                      {isAlreadyAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : readingSearchQuery.length >= 2 ? (
            <p className="text-xs text-text-muted py-2 text-center">
              No manga or manhwa matching &quot;{readingSearchQuery}&quot;
            </p>
          ) : null}
        </div>
      )}

      {/* Filter Row: Local Library Search Bar + Status Select Dropdown + Sub-format filter */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 border-b border-surface-elevated pb-3">
        {/* Left: Local Search Input + Status Dropdown */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1 max-w-xl">
          {/* Local Library Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-accent absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={localSearchQuery}
              onChange={(e) => setLocalSearchQuery(e.target.value)}
              placeholder={domain === 'watch' ? 'Search your watch library...' : 'Search your reading library...'}
              data-testid="library-search-input"
              className="w-full pl-9 pr-8 py-2 bg-surface border border-surface-elevated rounded-xl text-text-primary text-xs focus:border-accent focus:outline-none placeholder:text-text-muted transition-colors shadow-sm"
            />
            {localSearchQuery && (
              <button
                type="button"
                onClick={() => setLocalSearchQuery('')}
                aria-label="Clear local search"
                data-testid="library-search-clear-btn"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-text-muted hover:text-text-primary cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Status Dropdown Filter */}
          <div className="relative shrink-0">
            <select
              value={activeStatus}
              onChange={(e) => setActiveStatus(e.target.value as TrackingStatus | 'all')}
              data-testid="library-status-select"
              aria-label="Filter by tracking status"
              className="w-full sm:w-auto appearance-none pl-3.5 pr-9 py-2 bg-surface hover:bg-surface-elevated border border-surface-elevated hover:border-accent/40 rounded-xl text-text-primary text-xs font-semibold focus:border-accent focus:outline-none transition-colors shadow-sm cursor-pointer"
            >
              {statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>

        {/* Right: Sub-format filter */}
        <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto no-scrollbar">
          <button
            onClick={() => setSelectedFormat('all')}
            data-testid="format-filter-all"
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedFormat === 'all'
                ? 'text-accent font-bold bg-accent/15 border border-accent/30'
                : 'text-text-muted hover:text-text-secondary bg-surface border border-surface-elevated'
            }`}
          >
            All
          </button>
          {domainMediaTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedFormat(t)}
              data-testid={`format-filter-${t}`}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium capitalize transition-colors ${
                selectedFormat === t
                  ? 'text-accent font-bold bg-accent/15 border border-accent/30'
                  : 'text-text-muted hover:text-text-secondary bg-surface border border-surface-elevated'
              }`}
            >
              {t.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Library Content */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-[2/3] rounded-2xl bg-surface animate-pulse border border-surface-elevated"
            />
          ))}
        </div>
      ) : domainTotalCount === 0 ? (
        <div
          data-testid="empty-library-callout"
          className="text-center py-16 px-4 bg-surface rounded-2xl border border-surface-elevated max-w-lg mx-auto"
        >
          {domain === 'watch' ? (
            <Film className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
          ) : (
            <BookOpen className="w-12 h-12 text-text-muted/30 mx-auto mb-3" />
          )}
          <h3 className="text-base font-bold text-text-primary">
            Your {domain === 'watch' ? 'Watch' : 'Reading'} List is Empty
          </h3>
          <p className="text-xs text-text-secondary mt-1 max-w-sm mx-auto">
            Search titles in the catalog or open Omnisearch to add titles to your personal library.
          </p>
          <button
            onClick={() => setActiveTab('discover')}
            data-testid="explore-catalog-btn"
            className="mt-5 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow-md inline-flex items-center gap-2"
          >
            <Compass className="w-4 h-4" />
            <span>Discover Titles</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div
          data-testid="no-library-matches"
          className="text-center py-12 px-4 bg-surface rounded-2xl border border-surface-elevated max-w-lg mx-auto space-y-3"
        >
          <Search className="w-10 h-10 text-text-muted/40 mx-auto" />
          <h3 className="text-sm font-bold text-text-primary">No matching titles in your library</h3>
          <p className="text-xs text-text-muted">
            {localSearchQuery
              ? `No titles found matching "${localSearchQuery}"`
              : `No tracked items match your filters${activeStatus !== 'all' ? ` with status "${activeStatus}"` : ''}.`}
          </p>
          <button
            type="button"
            onClick={() => {
              setLocalSearchQuery('');
              setActiveStatus('all');
              setSelectedFormat('all');
            }}
            data-testid="reset-library-filters-btn"
            className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-accent hover:text-background text-xs font-semibold text-text-secondary hover:text-background transition-colors cursor-pointer"
          >
            Reset Library Filters
          </button>
        </div>
      ) : (
        <>
          {/* 1. POSTER GRID MODE */}
          {libraryViewMode === 'grid' && (
            <div
              data-testid="library-poster-grid"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4"
            >
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectTitle(item.title_id)}
                  data-testid={`library-item-${item.id}`}
                  className="group relative flex flex-col bg-surface rounded-2xl overflow-hidden border border-surface-elevated hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-lg hover:-translate-y-1 select-none"
                >
                  <div className="relative aspect-[2/3] w-full bg-[#16161D] overflow-hidden">
                    <img
                      src={item.title?.poster_url || (item.title as any)?.poster_path || '/assets/trackup-logo.jpg'}
                      alt={item.title?.title || 'Unknown Title'}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-background/80 text-accent border border-accent/20 backdrop-blur-md">
                        {item.status || 'planned'}
                      </span>
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-xs text-text-primary truncate group-hover:text-accent transition-colors">
                      {item.title?.title || 'Unknown Title'}
                    </h3>
                    <div className="flex items-center justify-between mt-2 text-[11px] text-text-muted">
                      {item.title?.media_type === 'tv' || item.title?.media_type === 'anime_series' ? (
                        <span className="font-mono text-accent">
                          {getEpProgressDisplay(item)}
                        </span>
                      ) : item.title?.media_type === 'movie' || item.title?.media_type === 'anime_film' ? (
                        <span className="font-mono text-text-muted">
                          {formatRuntime(item.title?.runtime_minutes) || 'Feature'}
                        </span>
                      ) : (
                        <span className="font-mono text-accent">
                          Ch. {item.last_chapter_read || 0}
                          {item.title?.total_chapters ? ` / ${item.title.total_chapters}` : ''}
                        </span>
                      )}
                      {item.rating && (
                        <span className="flex items-center gap-0.5 text-accent font-bold">
                          <Star className="w-3 h-3 fill-accent" />
                          {(item.rating / 2).toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 2. COMPACT GRID MODE */}
          {libraryViewMode === 'compact' && (
            <div
              data-testid="library-compact-grid"
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3"
            >
              {filtered.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onSelectTitle(item.title_id)}
                  data-testid={`library-compact-item-${item.id}`}
                  className="flex items-center gap-3 p-2.5 bg-surface rounded-xl border border-surface-elevated hover:border-accent/40 transition-all cursor-pointer group"
                >
                  <img
                    src={item.title?.poster_url || (item.title as any)?.poster_path || '/assets/trackup-logo.jpg'}
                    alt={item.title?.title || 'Unknown Title'}
                    loading="lazy"
                    decoding="async"
                    className="w-12 h-16 rounded-lg object-cover shrink-0 bg-[#16161D]"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-bold text-text-primary truncate group-hover:text-accent">
                      {item.title?.title || 'Unknown Title'}
                    </h4>
                    <p className="text-[10px] text-text-muted capitalize mt-0.5">{item.status || 'planned'}</p>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="font-mono text-[11px] text-accent">
                        {item.title?.media_type === 'tv' || item.title?.media_type === 'anime_series'
                          ? getEpProgressDisplay(item)
                          : item.title?.media_type === 'movie' || item.title?.media_type === 'anime_film'
                          ? (formatRuntime(item.title?.runtime_minutes) || 'Feature')
                          : `Ch. ${item.last_chapter_read || 0}`}
                      </span>
                      {item.title?.media_type !== 'movie' && item.title?.media_type !== 'anime_film' && item.status !== 'completed' && (
                        <button
                          onClick={(e) => handleQuickProgress(e, item)}
                          data-testid={`quick-increment-${item.id}`}
                          className="px-2 py-0.5 rounded bg-accent text-background font-bold text-[10px] flex items-center gap-0.5 hover:bg-accent-hover transition-colors shadow"
                        >
                          <Plus className="w-3 h-3" />
                          <span>1</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. DETAILED LIST / TABLE MODE */}
          {libraryViewMode === 'list' && (
            <div
              data-testid="library-detailed-list"
              className="bg-surface rounded-2xl border border-surface-elevated overflow-hidden shadow-xl"
            >
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-elevated/70 text-text-muted border-b border-surface-elevated uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Title</th>
                    <th className="py-3 px-3">Category</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">Progress</th>
                    <th className="py-3 px-3 text-right">Quick Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-elevated">
                  {filtered.map((item) => (
                    <tr
                      key={item.id}
                      onClick={() => onSelectTitle(item.title_id)}
                      data-testid={`library-list-row-${item.id}`}
                      className="hover:bg-surface-elevated/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3 px-4 flex items-center gap-3">
                        <img
                          src={item.title?.poster_url || (item.title as any)?.poster_path || '/assets/trackup-logo.jpg'}
                          alt={item.title?.title || 'Unknown Title'}
                          loading="lazy"
                          decoding="async"
                          className="w-8 h-12 rounded object-cover shrink-0 bg-[#16161D]"
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary group-hover:text-accent truncate">
                            {item.title?.title || 'Unknown Title'}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {item.title?.release_year || ''}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-surface-elevated text-accent border border-accent/20">
                          {(item.title?.media_type || '').replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="capitalize font-medium text-text-secondary">
                          {item.status || 'planned'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-text-primary">
                        {item.title?.media_type === 'tv' || item.title?.media_type === 'anime_series' ? (
                          <span className="text-accent">
                            {getEpProgressDisplay(item)}
                          </span>
                        ) : item.title?.media_type === 'movie' || item.title?.media_type === 'anime_film' ? (
                          <span className="text-text-muted">{formatRuntime(item.title?.runtime_minutes) || 'Feature'}</span>
                        ) : (
                          <span className="text-accent">
                            Ch. {item.last_chapter_read || 0}
                            {item.title?.total_chapters ? ` / ${item.title.total_chapters}` : ''}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        {item.title.media_type !== 'movie' && item.title.media_type !== 'anime_film' ? (
                          <div className="inline-flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleQuickProgress(e, item)}
                              data-testid={`list-increment-${item.id}`}
                              className="px-2.5 py-1 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold text-xs flex items-center gap-1 shadow transition-colors"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>+1</span>
                            </button>
                            {(item.title.media_type === 'manga' || item.title.media_type === 'manhwa') && (
                              <button
                                onClick={(e) => handleFractionalProgress(e, item)}
                                data-testid={`fractional-increment-${item.id}`}
                                title="Add half chapter (+0.5)"
                                className="px-2 py-1 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-text-secondary hover:text-text-primary font-mono text-xs transition-colors"
                              >
                                +0.5
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted font-mono">{formatRuntime(item.title.runtime_minutes) || 'Movie'}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};
