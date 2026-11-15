import React, { useState, useEffect, useMemo } from 'react';
import {
  ListPlus,
  Edit3,
  Trash2,
  Plus,
  Film,
  Search,
  X,
  Lock,
  Globe,
  Check,
  FolderPlus,
  BookOpen,
} from 'lucide-react';
import {
  fetchUserCustomLists,
  createCustomList,
  updateCustomList,
  deleteCustomList,
  addTitleToList,
  removeTitleFromList,
  type CustomList,
} from './customListsService';
import { resolvePosterUrl } from '../../lib/imageUtils';
import { searchCatalog, MOCK_CATALOG_FIXTURES } from '../catalog/catalogService';
import type { NormalizedCatalogItem } from '../../lib/validators';

interface CustomListsSectionProps {
  userId: string;
  isOwnProfile: boolean;
  onSelectTitle?: (titleId: string) => void;
}

export const CustomListsSection: React.FC<CustomListsSectionProps> = ({
  userId,
  isOwnProfile,
  onSelectTitle,
}) => {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListPrivate, setNewListPrivate] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editListName, setEditListName] = useState('');
  const [editListDesc, setEditListDesc] = useState('');
  const [editListPrivate, setEditListPrivate] = useState(false);

  const [isAddMediaOpen, setIsAddMediaOpen] = useState(false);
  const [mediaSearchQuery, setMediaSearchQuery] = useState('');
  const [mediaSearchDomain, setMediaSearchDomain] = useState<'watch' | 'read'>('watch');
  const [mediaSearchResults, setMediaSearchResults] = useState<NormalizedCatalogItem[]>([]);
  const [isSearchingMedia, setIsSearchingMedia] = useState(false);

  // Load custom lists
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    fetchUserCustomLists(userId).then((fetched) => {
      if (!mounted) return;
      // Filter out private lists if not own profile
      const visible = isOwnProfile ? fetched : fetched.filter((l) => !l.is_private);
      setLists(visible);
      if (visible.length > 0) {
        setActiveListId((prev) => (prev && visible.some((l) => l.id === prev) ? prev : visible[0].id));
      } else {
        setActiveListId(null);
      }
      setIsLoading(false);
    });

    return () => {
      mounted = false;
    };
  }, [userId, isOwnProfile]);

  const activeList = useMemo(() => {
    return lists.find((l) => l.id === activeListId) || null;
  }, [lists, activeListId]);

  // Live media search inside Add Media Modal
  useEffect(() => {
    if (!isAddMediaOpen) return;
    let mounted = true;

    if (!mediaSearchQuery.trim()) {
      // Default to curated fixtures matching the domain
      const fixtures = MOCK_CATALOG_FIXTURES.filter((f) =>
        mediaSearchDomain === 'read'
          ? ['manga', 'manhwa'].includes(f.media_type)
          : ['movie', 'tv', 'anime_series', 'anime_film'].includes(f.media_type)
      );
      setMediaSearchResults(fixtures.slice(0, 8));
      setIsSearchingMedia(false);
      return;
    }

    setIsSearchingMedia(true);
    searchCatalog(mediaSearchQuery, 'all', mediaSearchDomain).then((results) => {
      if (mounted) {
        setMediaSearchResults(results);
        setIsSearchingMedia(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [mediaSearchQuery, mediaSearchDomain, isAddMediaOpen]);

  // Handler: Create List
  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim()) return;

    try {
      const created = await createCustomList(userId, newListName, newListDesc, newListPrivate);
      setLists((prev) => [...prev, created]);
      setActiveListId(created.id);
      setIsCreateOpen(false);
      setNewListName('');
      setNewListDesc('');
      setNewListPrivate(false);
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  // Handler: Open Edit Modal
  const handleOpenEdit = () => {
    if (!activeList) return;
    setEditListName(activeList.name);
    setEditListDesc(activeList.description || '');
    setEditListPrivate(activeList.is_private);
    setIsEditOpen(true);
  };

  // Handler: Save Edit List
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeList || !editListName.trim()) return;

    try {
      const updated = await updateCustomList(activeList.id, {
        name: editListName,
        description: editListDesc,
        is_private: editListPrivate,
      });

      setLists((prev) => prev.map((l) => (l.id === updated.id ? { ...l, ...updated } : l)));
      setIsEditOpen(false);
    } catch (err) {
      console.error('Failed to update list:', err);
    }
  };

  // Handler: Delete List
  const handleDeleteList = async () => {
    if (!activeList) return;
    const confirmed = window.confirm(`Are you sure you want to delete the list "${activeList.name}"?`);
    if (!confirmed) return;

    try {
      await deleteCustomList(activeList.id);
      const remaining = lists.filter((l) => l.id !== activeList.id);
      setLists(remaining);
      setActiveListId(remaining.length > 0 ? remaining[0].id : null);
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  // Handler: Add Media Title
  const handleAddTitle = async (title: NormalizedCatalogItem) => {
    if (!activeList) return;
    try {
      const newItem = await addTitleToList(activeList.id, title);
      setLists((prev) =>
        prev.map((l) => {
          if (l.id === activeList.id) {
            const exists = l.items.some((i) => i.title_id === title.id);
            if (exists) return l;
            return {
              ...l,
              items: [...l.items, newItem],
            };
          }
          return l;
        })
      );
    } catch (err) {
      console.error('Failed to add title to list:', err);
    }
  };

  // Handler: Remove Media Title
  const handleRemoveTitle = async (titleId: string) => {
    if (!activeList) return;
    try {
      await removeTitleFromList(activeList.id, titleId);
      setLists((prev) =>
        prev.map((l) => {
          if (l.id === activeList.id) {
            return {
              ...l,
              items: l.items.filter((i) => i.title_id !== titleId),
            };
          }
          return l;
        })
      );
    } catch (err) {
      console.error('Failed to remove title from list:', err);
    }
  };

  return (
    <section data-testid="profile-custom-lists-section" className="space-y-6 pt-4 border-t border-surface-elevated/70">
      {/* Top Header & Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-surface-elevated">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-text-primary tracking-tight">Custom Lists</h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/30 font-mono">
              {lists.length} {lists.length === 1 ? 'List' : 'Lists'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {isOwnProfile
              ? 'Organize movies, shows, anime, and manga into personalized custom collections.'
              : 'Browse personalized custom collections and curated recommendations.'}
          </p>
        </div>

        {isOwnProfile && (
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            data-testid="create-list-button"
            className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shrink-0 cursor-pointer"
          >
            <ListPlus className="w-4 h-4" />
            <span>Create New List</span>
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-muted text-xs">Loading custom lists...</div>
      ) : lists.length === 0 ? (
        <div
          data-testid="custom-lists-empty"
          className="p-10 rounded-3xl bg-surface border border-surface-elevated text-center space-y-3 shadow-md"
        >
          <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto text-text-muted">
            <FolderPlus className="w-6 h-6 text-accent" />
          </div>
          <h3 className="text-base font-bold text-text-primary">No Custom Lists Yet</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            {isOwnProfile
              ? 'Create your first custom list to organize any media type (films, TV, anime, manga, and manhwa).'
              : 'This user has not created any public custom lists yet.'}
          </p>
          {isOwnProfile && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First List</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {/* List Selector Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            {lists.map((list) => {
              const isSelected = list.id === activeListId;
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setActiveListId(list.id)}
                  data-testid={`custom-list-tab-${list.id}`}
                  className={`px-4 py-2 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-accent/15 border-accent text-accent shadow-sm'
                      : 'bg-surface border-surface-elevated text-text-secondary hover:text-text-primary hover:border-surface-elevated/80'
                  }`}
                >
                  {list.is_private ? (
                    <Lock className="w-3.5 h-3.5 text-text-muted" />
                  ) : (
                    <Globe className="w-3.5 h-3.5 text-text-muted" />
                  )}
                  <span>{list.name}</span>
                  <span className="font-mono text-[11px] px-1.5 py-0.2 rounded-md bg-surface-elevated text-text-muted">
                    {list.items?.length || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Active List Showcase Card */}
          {activeList && (
            <div className="p-5 rounded-3xl bg-surface border border-surface-elevated space-y-5 shadow-lg">
              {/* Header with Title, Description, and Actions */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-surface-elevated">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 data-testid="active-list-title" className="text-lg font-bold text-text-primary">
                      {activeList.name}
                    </h3>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                        activeList.is_private
                          ? 'bg-surface-elevated text-text-muted border-surface-elevated'
                          : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      }`}
                    >
                      {activeList.is_private ? 'Private' : 'Public'}
                    </span>
                  </div>
                  {activeList.description && (
                    <p data-testid="active-list-desc" className="text-xs text-text-secondary mt-1 max-w-xl">
                      {activeList.description}
                    </p>
                  )}
                </div>

                {/* List Action Buttons (Owner Only) */}
                {isOwnProfile && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsAddMediaOpen(true)}
                      data-testid="add-media-to-list-btn"
                      className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs flex items-center gap-1.5 transition-all shadow cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Media</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleOpenEdit}
                      data-testid="edit-list-button"
                      title="Edit List Details"
                      aria-label="Edit List Details"
                      className="p-2 rounded-xl bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteList}
                      data-testid="delete-list-button"
                      title="Delete List"
                      aria-label="Delete List"
                      className="p-2 rounded-xl bg-surface-elevated text-text-muted hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Items Grid */}
              {activeList.items.length === 0 ? (
                <div
                  data-testid="active-list-empty"
                  className="py-12 text-center space-y-2 border border-dashed border-surface-elevated rounded-2xl"
                >
                  <Film className="w-8 h-8 text-text-muted mx-auto" />
                  <p className="text-sm font-semibold text-text-primary">List is currently empty</p>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    {isOwnProfile
                      ? 'Add any media type to this list: Movies, TV Shows, Anime, Japanese Manga, or Korean Manhwa.'
                      : 'No titles have been added to this custom list yet.'}
                  </p>
                  {isOwnProfile && (
                    <button
                      type="button"
                      onClick={() => setIsAddMediaOpen(true)}
                      className="mt-2 px-3.5 py-1.5 rounded-xl bg-accent text-background font-bold text-xs inline-flex items-center gap-1.5 hover:bg-accent-hover transition-all cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Media Now</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  data-testid="custom-list-items-grid"
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
                >
                  {activeList.items.map((item) => {
                    const isRead = item.title.media_type === 'manga' || item.title.media_type === 'manhwa';
                    return (
                      <div
                        key={item.id}
                        data-testid={`custom-list-card-${item.title_id}`}
                        onClick={() => onSelectTitle?.(item.title_id)}
                        className="group relative rounded-2xl overflow-hidden bg-[#16161D] border border-surface-elevated hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-1 flex flex-col"
                      >
                        {/* Poster Container */}
                        <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#101014]">
                          <img
                            src={resolvePosterUrl(item.title.poster_url) || '/assets/trackup-logo.jpg'}
                            alt={item.title.title}
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = '/assets/trackup-logo.jpg';
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                          {/* Media Type Badge */}
                          <div className="absolute top-2 left-2 flex items-center gap-1 pointer-events-none">
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-md text-text-primary border border-surface-elevated">
                              {item.title.media_type.replace('_', ' ')}
                            </span>
                          </div>

                          {/* Delete Item from List Button (Owner Only) */}
                          {isOwnProfile && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveTitle(item.title_id);
                              }}
                              data-testid={`remove-item-btn-${item.title_id}`}
                              title="Remove from list"
                              aria-label="Remove from list"
                              className="absolute top-2 right-2 p-1.5 rounded-lg bg-background/80 backdrop-blur-md text-text-muted hover:text-rose-400 hover:bg-rose-500/20 transition-all opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Bottom metadata */}
                          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-[11px] font-mono text-text-secondary pointer-events-none">
                            <span>{item.title.release_year || '—'}</span>
                            <span>{isRead ? 'Reading' : 'Watch'}</span>
                          </div>
                        </div>

                        {/* Title Info */}
                        <div className="p-3 flex-1 flex flex-col justify-between">
                          <h4 className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                            {item.title.title}
                          </h4>
                          {item.title.genres && item.title.genres[0] && (
                            <span className="text-[10px] text-text-muted mt-0.5 truncate">
                              {item.title.genres[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE LIST MODAL */}
      {isCreateOpen && (
        <div
          data-testid="create-list-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-surface-elevated rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-elevated pb-3">
              <div className="flex items-center gap-2 text-accent">
                <ListPlus className="w-5 h-5" />
                <h3 className="text-base font-bold text-text-primary">Create New Custom List</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateList} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  List Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Cyberpunk & Sci-Fi Favorites, Plan to Read"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  data-testid="create-list-name-input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-surface-elevated focus:border-accent text-text-primary text-xs focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description (Optional)</label>
                <textarea
                  rows={3}
                  placeholder="What is this collection about?"
                  value={newListDesc}
                  onChange={(e) => setNewListDesc(e.target.value)}
                  data-testid="create-list-desc-input"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-surface-elevated focus:border-accent text-text-primary text-xs focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-elevated">
                <div>
                  <p className="text-xs font-semibold text-text-primary">Keep List Private</p>
                  <p className="text-[11px] text-text-muted">Only you can view this list</p>
                </div>
                <input
                  type="checkbox"
                  checked={newListPrivate}
                  onChange={(e) => setNewListPrivate(e.target.checked)}
                  data-testid="create-list-private-checkbox"
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-elevated text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="create-list-submit-btn"
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow cursor-pointer"
                >
                  Create List
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT / RENAME LIST MODAL */}
      {isEditOpen && activeList && (
        <div
          data-testid="edit-list-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsEditOpen(false)}
        >
          <div
            className="w-full max-w-md bg-surface border border-surface-elevated rounded-3xl p-6 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-surface-elevated pb-3">
              <div className="flex items-center gap-2 text-accent">
                <Edit3 className="w-5 h-5" />
                <h3 className="text-base font-bold text-text-primary">Edit List Details</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditOpen(false)}
                className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  List Name <span className="text-accent">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editListName}
                  onChange={(e) => setEditListName(e.target.value)}
                  data-testid="edit-list-name-input"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-background border border-surface-elevated focus:border-accent text-text-primary text-xs focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">Description</label>
                <textarea
                  rows={3}
                  value={editListDesc}
                  onChange={(e) => setEditListDesc(e.target.value)}
                  data-testid="edit-list-desc-input"
                  className="w-full px-3.5 py-2 rounded-xl bg-background border border-surface-elevated focus:border-accent text-text-primary text-xs focus:outline-none transition-colors resize-none"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-background border border-surface-elevated">
                <div>
                  <p className="text-xs font-semibold text-text-primary">Keep List Private</p>
                  <p className="text-[11px] text-text-muted">Only you can view this list</p>
                </div>
                <input
                  type="checkbox"
                  checked={editListPrivate}
                  onChange={(e) => setEditListPrivate(e.target.checked)}
                  data-testid="edit-list-private-checkbox"
                  className="w-4 h-4 accent-amber-400 rounded cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="px-4 py-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-elevated text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  data-testid="edit-list-submit-btn"
                  className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEDIA MODAL (Supports any media type: Shows, Movies, Anime, Manga, Manhwa) */}
      {isAddMediaOpen && activeList && (
        <div
          data-testid="add-media-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsAddMediaOpen(false)}
        >
          <div
            className="w-full max-w-xl max-h-[85vh] bg-surface border border-surface-elevated rounded-3xl p-6 shadow-2xl flex flex-col space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-surface-elevated pb-3">
              <div>
                <h3 className="text-base font-bold text-text-primary">Add Media to &quot;{activeList.name}&quot;</h3>
                <p className="text-xs text-text-muted">
                  Search across Movies, TV Series, Anime, Japanese Manga, and Korean Manhwa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddMediaOpen(false)}
                className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Domain Switcher */}
            <div className="flex items-center gap-2 p-1 bg-background rounded-xl border border-surface-elevated text-xs font-semibold">
              <button
                type="button"
                onClick={() => setMediaSearchDomain('watch')}
                data-testid="add-media-tab-watch"
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mediaSearchDomain === 'watch'
                    ? 'bg-accent text-background font-bold shadow'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Watch (Shows, Movies, Anime)</span>
              </button>
              <button
                type="button"
                onClick={() => setMediaSearchDomain('read')}
                data-testid="add-media-tab-read"
                className={`flex-1 py-1.5 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  mediaSearchDomain === 'read'
                    ? 'bg-accent text-background font-bold shadow'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Reading (Manga & Manhwa)</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-accent absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                autoFocus
                placeholder={
                  mediaSearchDomain === 'watch'
                    ? 'Search movies, TV shows, and anime (e.g. Inception, Breaking Bad)...'
                    : 'Search manga and manhwa (e.g. Solo Leveling, Berserk)...'
                }
                value={mediaSearchQuery}
                onChange={(e) => setMediaSearchQuery(e.target.value)}
                data-testid="add-media-search-input"
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-background border border-surface-elevated focus:border-accent text-text-primary text-xs focus:outline-none transition-colors"
              />
            </div>

            {/* Search Results List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {isSearchingMedia ? (
                <div className="py-12 text-center text-xs text-text-muted">Searching catalog...</div>
              ) : mediaSearchResults.length === 0 ? (
                <div className="py-12 text-center text-xs text-text-muted">
                  No titles found matching &quot;{mediaSearchQuery}&quot;
                </div>
              ) : (
                mediaSearchResults.map((title) => {
                  const isAlreadyInList = activeList.items.some((i) => i.title_id === title.id);
                  return (
                    <div
                      key={title.id}
                      data-testid={`add-media-result-${title.id}`}
                      className="p-2.5 rounded-xl bg-background border border-surface-elevated hover:border-accent/40 flex items-center justify-between gap-3 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={resolvePosterUrl(title.poster_url) || '/assets/trackup-logo.jpg'}
                          alt={title.title}
                          className="w-10 h-14 rounded-lg object-cover bg-surface-elevated shrink-0"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/assets/trackup-logo.jpg';
                          }}
                        />
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase text-accent tracking-wider">
                            {title.media_type.replace('_', ' ')}
                          </span>
                          <h4 className="text-xs font-bold text-text-primary truncate">{title.title}</h4>
                          <span className="text-[11px] text-text-muted">{title.release_year || '—'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddTitle(title)}
                        disabled={isAlreadyInList}
                        data-testid={`add-title-btn-${title.id}`}
                        className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                          isAlreadyInList
                            ? 'bg-surface-elevated text-text-muted cursor-not-allowed opacity-60'
                            : 'bg-accent hover:bg-accent-hover text-background shadow'
                        }`}
                      >
                        {isAlreadyInList ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Added</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add to List</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
