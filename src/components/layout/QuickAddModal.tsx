import React, { useEffect, useState, useMemo } from 'react';
import {
  Search,
  X,
  CheckCheck,
  Play,
  Bookmark,
  FolderPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Film,
  Sparkles,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';
import {
  searchCatalog,
  getCatalogTitleById,
  MOCK_CATALOG_FIXTURES,
} from '../../features/catalog/catalogService';
import {
  upsertLibraryItem,
  logBatchEpisodeProgress,
  calculateTotalEpisodes,
  type UserLibraryItem,
} from '../../features/library/libraryService';
import { useUserLibrary } from '../../features/library/useLibrary';
import { AddToListModal } from '../../features/custom-lists/AddToListModal';
import { resolvePosterUrl } from '../../lib/imageUtils';
import { useQueryClient } from '@tanstack/react-query';
import type { NormalizedCatalogItem } from '../../lib/validators';
import type { MediaType } from '../../types/database.types';

interface QuickAddModalProps {
  onSelectTitle?: (id: string) => void;
}

export const QuickAddModal: React.FC<QuickAddModalProps> = ({ onSelectTitle }) => {
  const { quickAddOpen, setQuickAddOpen, setAuthModalOpen } = useUIStore();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: userLibrary = [] } = useUserLibrary(user?.id);

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<MediaType | 'all'>('all');
  const [results, setResults] = useState<NormalizedCatalogItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Per-item loading state for async tracking mutations
  const [busyItemIds, setBusyItemIds] = useState<Record<string, boolean>>({});

  // Active dropdown menu for compact / mobile row action popups
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Custom List modal targeting
  const [customListTarget, setCustomListTarget] = useState<NormalizedCatalogItem | null>(null);

  // Inline toast state
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Fast lookup for current tracking status in user's library
  const libraryLookup = useMemo(() => {
    const map = new Map<string, UserLibraryItem>();
    for (const item of userLibrary) {
      if (item && item.title_id) {
        map.set(item.title_id, item);
      }
    }
    return map;
  }, [userLibrary]);

  // Keyboard shortcut listener (Escape to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && quickAddOpen) {
        setQuickAddOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [quickAddOpen, setQuickAddOpen]);

  // Toast auto-dismiss
  useEffect(() => {
    if (!toastMessage) return;
    const timer = setTimeout(() => {
      setToastMessage(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toastMessage]);

  // Reset state when modal opens
  useEffect(() => {
    if (quickAddOpen) {
      setQuery('');
      setActiveCategory('all');
      setActiveMenuId(null);
      // Pre-populate with fixtures so user has instant click targets
      const initial = MOCK_CATALOG_FIXTURES.slice(0, 10);
      setResults(initial);
    }
  }, [quickAddOpen]);

  // Live search debounced
  useEffect(() => {
    if (!quickAddOpen) return;

    if (!query.trim()) {
      const initial = MOCK_CATALOG_FIXTURES.filter((item) => {
        if (activeCategory === 'all') return true;
        if (activeCategory === 'anime_series') {
          return item.media_type === 'anime_series' || item.media_type === 'anime_film';
        }
        return item.media_type === activeCategory;
      }).slice(0, 10);
      setResults(initial);
      setIsSearching(false);
      return;
    }

    let mounted = true;
    setIsSearching(true);
    const handler = setTimeout(() => {
      searchCatalog(query, activeCategory, 'watch')
        .then((items) => {
          if (mounted) {
            setResults(items);
            setIsSearching(false);
          }
        })
        .catch(() => {
          if (mounted) setIsSearching(false);
        });
    }, 150);

    return () => {
      mounted = false;
      clearTimeout(handler);
    };
  }, [query, activeCategory, quickAddOpen]);

  if (!quickAddOpen) return null;

  const ensureAuth = (): boolean => {
    if (!user) {
      setToastMessage({
        type: 'error',
        text: 'Please sign in to track media to your library.',
      });
      setAuthModalOpen(true);
      return false;
    }
    return true;
  };

  /* -------------------------------------------------------------
   * ACTION HANDLERS
   * ----------------------------------------------------------- */

  // Movies & Films: Mark Watched ('completed')
  const handleMarkWatched = async (item: NormalizedCatalogItem) => {
    if (!ensureAuth()) return;
    setActiveMenuId(null);
    setBusyItemIds((prev) => ({ ...prev, [item.id]: true }));

    try {
      await upsertLibraryItem({
        userId: user!.id,
        titleId: item.id,
        status: 'completed',
        titleData: item,
      });

      await queryClient.invalidateQueries({ queryKey: ['library', user!.id] });
      setToastMessage({
        type: 'success',
        text: `"${item.title}" marked as watched!`,
      });
    } catch (err: any) {
      console.error('Failed to mark movie as watched:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to update library item.',
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Movies / TV / Anime: Plan to Watch ('planned')
  const handlePlanToWatch = async (item: NormalizedCatalogItem) => {
    if (!ensureAuth()) return;
    setActiveMenuId(null);
    setBusyItemIds((prev) => ({ ...prev, [item.id]: true }));

    try {
      await upsertLibraryItem({
        userId: user!.id,
        titleId: item.id,
        status: 'planned',
        titleData: item,
      });

      await queryClient.invalidateQueries({ queryKey: ['library', user!.id] });
      setToastMessage({
        type: 'success',
        text: `"${item.title}" added to Plan to Watch!`,
      });
    } catch (err: any) {
      console.error('Failed to update plan status:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to update library item.',
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Movies / TV / Anime: Currently Watching ('active' / 'watching')
  const handleCurrentlyWatching = async (item: NormalizedCatalogItem) => {
    if (!ensureAuth()) return;
    setActiveMenuId(null);
    setBusyItemIds((prev) => ({ ...prev, [item.id]: true }));

    try {
      await upsertLibraryItem({
        userId: user!.id,
        titleId: item.id,
        status: 'active',
        titleData: item,
      });

      await queryClient.invalidateQueries({ queryKey: ['library', user!.id] });
      setToastMessage({
        type: 'success',
        text: `"${item.title}" added to Currently Watching!`,
      });
    } catch (err: any) {
      console.error('Failed to set currently watching:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to update library item.',
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // TV Shows & Anime: Mark Completed ('completed' + batch all episodes across all seasons)
  const handleMarkCompleted = async (item: NormalizedCatalogItem) => {
    if (!ensureAuth()) return;
    setActiveMenuId(null);
    setBusyItemIds((prev) => ({ ...prev, [item.id]: true }));

    try {
      // 1. Ensure seasons & episode records are hydrated
      let fullTitle = item;
      if (!fullTitle.seasons || fullTitle.seasons.length === 0) {
        try {
          const fetched = await getCatalogTitleById(item.id);
          if (fetched) {
            fullTitle = fetched;
          }
        } catch {
          // retain basic item
        }
      }

      // 2. Collect all episode IDs across all seasons
      const allShowEpIds: string[] = [];
      if (Array.isArray(fullTitle.seasons) && fullTitle.seasons.length > 0) {
        for (const season of fullTitle.seasons) {
          if (Array.isArray(season.episodes)) {
            for (const ep of season.episodes) {
              if (ep && ep.id) {
                allShowEpIds.push(ep.id);
              }
            }
          }
        }
      }

      // Fallback if seasons are flat or not populated
      if (allShowEpIds.length === 0) {
        const totalCount = calculateTotalEpisodes(fullTitle);
        if (totalCount > 0) {
          for (let i = 1; i <= totalCount; i++) {
            allShowEpIds.push(`ep_${i}`);
          }
        }
      }

      // 3. Upsert library item to completed status
      const libraryEntry = await upsertLibraryItem({
        userId: user!.id,
        titleId: fullTitle.id,
        status: 'completed',
        titleData: fullTitle,
      });

      // 4. Batch-mark all episodes across all seasons as watched
      if (allShowEpIds.length > 0 && libraryEntry?.id) {
        await logBatchEpisodeProgress({
          libraryId: libraryEntry.id,
          userId: user!.id,
          episodeIds: allShowEpIds,
          watched: true,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ['library', user!.id] });
      setToastMessage({
        type: 'success',
        text: `"${fullTitle.title}" marked as completed (${allShowEpIds.length} episodes watched)!`,
      });
    } catch (err: any) {
      console.error('Failed to mark full show as completed:', err);
      setToastMessage({
        type: 'error',
        text: err?.message || 'Failed to complete full show.',
      });
    } finally {
      setBusyItemIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // Trigger Custom List modal
  const handleOpenAddToList = (item: NormalizedCatalogItem) => {
    if (!ensureAuth()) return;
    setActiveMenuId(null);
    setCustomListTarget(item);
  };

  const categories: { id: MediaType | 'all'; label: string }[] = [
    { id: 'all', label: 'All Watch' },
    { id: 'movie', label: 'Movies' },
    { id: 'tv', label: 'TV Shows' },
    { id: 'anime_series', label: 'Anime' },
  ];

  return (
    <>
      <div
        data-testid="quick-add-modal"
        className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
        onClick={() => setQuickAddOpen(false)}
      >
        <div
          className="w-full max-w-2xl bg-surface border border-surface-elevated rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh] animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-elevated bg-surface/70">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-text-primary leading-tight">
                  Quick Add &amp; Track
                </h2>
                <p className="text-[11px] text-text-muted hidden sm:block">
                  Search and immediately track media without leaving your page
                </p>
              </div>
            </div>

            <button
              onClick={() => setQuickAddOpen(false)}
              data-testid="quick-add-close"
              aria-label="Close Quick Add"
              className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-surface-elevated bg-surface-elevated/20">
            <Search className="w-5 h-5 text-accent shrink-0 mr-3" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search movies, TV shows, anime to quick add..."
              data-testid="quick-add-input"
              className="w-full bg-transparent text-text-primary placeholder:text-text-muted text-sm sm:text-base focus:outline-none"
            />
            {isSearching && (
              <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0 ml-2" />
            )}
            {query && !isSearching && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="p-1 text-text-muted hover:text-text-primary ml-1"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-1.5 px-4 py-2 border-b border-surface-elevated overflow-x-auto no-scrollbar">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                data-testid={`quick-add-category-${cat.id}`}
                className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 transition-colors cursor-pointer ${
                  activeCategory === cat.id
                    ? 'bg-accent text-background shadow'
                    : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Search Results List */}
          <div
            data-testid="quick-add-results-list"
            className="p-3 sm:p-4 overflow-y-auto space-y-2 flex-1 max-h-[60vh]"
          >
            {results.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1 pb-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
                    {query ? `Search Results (${results.length})` : 'Popular & Suggested Titles'}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    Click actions to track instantly
                  </span>
                </div>

                {results.map((item) => {
                  const isBusy = !!busyItemIds[item.id];
                  const existingEntry = libraryLookup.get(item.id);
                  const isMovie = item.media_type === 'movie' || item.media_type === 'anime_film';
                  const isMenuOpen = activeMenuId === item.id;
                  const posterUrl = resolvePosterUrl(item.poster_url || (item as any).poster_path);

                  return (
                    <div
                      key={item.id}
                      data-testid={`quick-add-row-${item.id}`}
                      className="p-3 rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated/70 border border-surface-elevated/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative"
                    >
                      {/* Left: Thumbnail + Title + Year */}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-11 h-16 rounded-lg overflow-hidden bg-[#16161D] shrink-0 border border-surface-elevated cursor-pointer"
                          onClick={() => {
                            if (onSelectTitle) {
                              setQuickAddOpen(false);
                              onSelectTitle(item.id);
                            }
                          }}
                        >
                          {posterUrl ? (
                            <img
                              src={posterUrl}
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
                            <div className="w-full h-full flex items-center justify-center text-accent text-xs font-bold">
                              {item.title.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3
                            data-testid={`quick-add-title-${item.id}`}
                            onClick={() => {
                              if (onSelectTitle) {
                                setQuickAddOpen(false);
                                onSelectTitle(item.id);
                              }
                            }}
                            className="text-sm font-semibold text-text-primary hover:text-accent transition-colors truncate cursor-pointer"
                          >
                            {item.title}
                          </h3>

                          <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
                            <span data-testid={`quick-add-year-${item.id}`} className="font-mono">
                              {item.release_year || 'Unknown Year'}
                            </span>
                            <span>•</span>
                            <span className="capitalize text-[11px] text-accent font-medium">
                              {item.media_type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Existing status badge if already in library */}
                          {existingEntry && (
                            <div className="mt-1 flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/30 font-mono">
                                <CheckCheck className="w-2.5 h-2.5" />
                                <span>
                                  {existingEntry.status === 'completed'
                                    ? 'Completed'
                                    : existingEntry.status === 'active'
                                    ? 'Watching'
                                    : existingEntry.status === 'planned'
                                    ? 'Plan to Watch'
                                    : existingEntry.status}
                                </span>
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Inline Action Buttons / Dropdown */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap sm:flex-nowrap justify-end">
                        {isBusy ? (
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-elevated text-xs font-semibold text-accent">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Saving...</span>
                          </div>
                        ) : isMovie ? (
                          /* MOVIE ACTIONS */
                          <>
                            {/* 1. Mark Watched */}
                            <button
                              type="button"
                              onClick={() => handleMarkWatched(item)}
                              data-testid={`quick-add-mark-watched-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Mark Watched (Completed)"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Mark Watched</span>
                            </button>

                            {/* 2. Currently Watching */}
                            <button
                              type="button"
                              onClick={() => handleCurrentlyWatching(item)}
                              data-testid={`quick-add-currently-watching-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent/20 hover:text-accent border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Currently Watching"
                            >
                              <Play className="w-3.5 h-3.5 text-accent" />
                              <span className="hidden md:inline">Currently Watching</span>
                              <span className="md:hidden inline">Watching</span>
                            </button>

                            {/* 3. Plan to Watch */}
                            <button
                              type="button"
                              onClick={() => handlePlanToWatch(item)}
                              data-testid={`quick-add-plan-to-watch-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Plan to Watch"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Plan to Watch</span>
                              <span className="md:hidden inline">Plan</span>
                            </button>

                            {/* 4. Add to List */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddToList(item)}
                              data-testid={`quick-add-add-to-list-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Add to Custom List"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                              <span>Add to List</span>
                            </button>
                          </>
                        ) : (
                          /* TV SHOW & ANIME ACTIONS */
                          <>
                            {/* 1. Mark Completed (Full Show Episode Batch) */}
                            <button
                              type="button"
                              onClick={() => handleMarkCompleted(item)}
                              data-testid={`quick-add-mark-completed-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Mark Full Show Completed"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Mark Completed</span>
                            </button>

                            {/* 2. Currently Watching */}
                            <button
                              type="button"
                              onClick={() => handleCurrentlyWatching(item)}
                              data-testid={`quick-add-currently-watching-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent/20 hover:text-accent border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Currently Watching"
                            >
                              <Play className="w-3.5 h-3.5 text-accent" />
                              <span className="hidden md:inline">Currently Watching</span>
                              <span className="md:hidden inline">Watching</span>
                            </button>

                            {/* 3. Plan to Watch */}
                            <button
                              type="button"
                              onClick={() => handlePlanToWatch(item)}
                              data-testid={`quick-add-plan-to-watch-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Plan to Watch"
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Plan to Watch</span>
                              <span className="md:hidden inline">Plan</span>
                            </button>

                            {/* 4. Add to Custom List */}
                            <button
                              type="button"
                              onClick={() => handleOpenAddToList(item)}
                              data-testid={`quick-add-add-to-custom-list-${item.id}`}
                              className="px-2.5 py-1.5 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background border border-surface-elevated text-xs font-semibold text-text-secondary transition-all flex items-center gap-1 cursor-pointer"
                              title="Add to Custom List"
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                              <span className="hidden md:inline">Add to Custom List</span>
                              <span className="md:hidden inline">Add to List</span>
                            </button>
                          </>
                        )}

                        {/* Mobile Actions Dropdown Trigger */}
                        <div className="relative sm:hidden">
                          <button
                            type="button"
                            onClick={() => setActiveMenuId(isMenuOpen ? null : item.id)}
                            data-testid={`quick-add-actions-menu-btn-${item.id}`}
                            aria-label="More actions"
                            className="p-1.5 rounded-lg bg-surface-elevated text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {isMenuOpen && (
                            <div
                              data-testid={`quick-add-dropdown-menu-${item.id}`}
                              className="absolute right-0 top-full mt-1 w-48 bg-surface border border-surface-elevated rounded-xl shadow-2xl p-1 z-50 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                            >
                              {isMovie ? (
                                <>
                                  <button
                                    onClick={() => handleMarkWatched(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Mark Watched</span>
                                  </button>
                                  <button
                                    onClick={() => handleCurrentlyWatching(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Currently Watching</span>
                                  </button>
                                  <button
                                    onClick={() => handlePlanToWatch(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Bookmark className="w-3.5 h-3.5" />
                                    <span>Plan to Watch</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenAddToList(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    <span>Add to List</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleMarkCompleted(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <CheckCheck className="w-3.5 h-3.5" />
                                    <span>Mark Completed</span>
                                  </button>
                                  <button
                                    onClick={() => handleCurrentlyWatching(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                    <span>Currently Watching</span>
                                  </button>
                                  <button
                                    onClick={() => handlePlanToWatch(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Bookmark className="w-3.5 h-3.5" />
                                    <span>Plan to Watch</span>
                                  </button>
                                  <button
                                    onClick={() => handleOpenAddToList(item)}
                                    className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-text-primary hover:bg-accent hover:text-background flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <FolderPlus className="w-3.5 h-3.5" />
                                    <span>Add to Custom List</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted space-y-2">
                <Film className="w-8 h-8 text-text-muted/40" />
                <p className="text-sm font-medium text-text-secondary">
                  No titles found{query ? ` for "${query}"` : ''}
                </p>
                <p className="text-xs text-text-muted">
                  Try searching by full title, TMDB name, or franchise
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Success / Error Toast */}
      {toastMessage && (
        <div
          data-testid={toastMessage.type === 'success' ? 'quick-add-toast' : 'quick-add-error-toast'}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-text-muted hover:text-text-primary"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Integrated Custom List Selector Modal */}
      {customListTarget && (
        <AddToListModal
          isOpen={!!customListTarget}
          onClose={() => setCustomListTarget(null)}
          title={customListTarget}
          userId={user?.id || ''}
        />
      )}
    </>
  );
};
