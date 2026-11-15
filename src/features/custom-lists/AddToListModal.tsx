import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Check,
  Lock,
  Globe,
  FolderPlus,
  ListPlus,
  Folder,
  AlertCircle,
} from 'lucide-react';
import {
  fetchUserCustomLists,
  createCustomList,
  addTitleToList,
  removeTitleFromList,
  type CustomList,
} from './customListsService';
import type { NormalizedCatalogItem } from '../../lib/validators';
import { resolvePosterUrl } from '../../lib/imageUtils';

interface AddToListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: NormalizedCatalogItem;
  userId: string;
}

export const AddToListModal: React.FC<AddToListModalProps> = ({
  isOpen,
  onClose,
  title,
  userId,
}) => {
  const [lists, setLists] = useState<CustomList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyListIds, setBusyListIds] = useState<Record<string, boolean>>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Inline "Create New List" state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDesc, setNewListDesc] = useState('');
  const [newListPrivate, setNewListPrivate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Load custom lists on open
  useEffect(() => {
    if (!isOpen || !userId) return;

    let mounted = true;
    setIsLoading(true);
    setErrorMessage(null);

    fetchUserCustomLists(userId).then((fetched) => {
      if (mounted) {
        setLists(fetched);
        setIsLoading(false);
      }
    });

    return () => {
      mounted = false;
    };
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleToggleTitleInList = async (list: CustomList) => {
    const isCurrentlyAdded = (list.items || []).some((i) => i.title_id === title.id);
    setBusyListIds((prev) => ({ ...prev, [list.id]: true }));
    setErrorMessage(null);

    try {
      if (isCurrentlyAdded) {
        await removeTitleFromList(list.id, title.id);
        setLists((prev) =>
          prev.map((l) =>
            l.id === list.id
              ? { ...l, items: (l.items || []).filter((i) => i.title_id !== title.id) }
              : l
          )
        );
      } else {
        const newItem = await addTitleToList(list.id, title);
        setLists((prev) =>
          prev.map((l) =>
            l.id === list.id ? { ...l, items: [...(l.items || []), newItem] } : l
          )
        );
      }
    } catch (err: any) {
      console.error('Failed to toggle title in custom list:', err);
      setErrorMessage(err?.message || 'Supabase rejected list items update (RLS policy violation).');
    } finally {
      setBusyListIds((prev) => ({ ...prev, [list.id]: false }));
    }
  };

  const handleCreateAndAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListName.trim() || isCreating) return;

    setIsCreating(true);
    setErrorMessage(null);
    try {
      const created = await createCustomList(
        userId,
        newListName.trim(),
        newListDesc.trim() || undefined,
        newListPrivate
      );
      const addedItem = await addTitleToList(created.id, title);
      const withItem: CustomList = {
        ...created,
        items: [addedItem],
      };

      setLists((prev) => [...prev, withItem]);
      setNewListName('');
      setNewListDesc('');
      setNewListPrivate(false);
      setShowCreateForm(false);
    } catch (err: any) {
      console.error('Failed to create and add to custom list:', err);
      setErrorMessage(err?.message || 'Supabase rejected creating list or item.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div
      data-testid="add-to-list-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-surface-elevated rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-surface-elevated pb-3">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={resolvePosterUrl(title.poster_url) || '/assets/trackup-logo.jpg'}
              alt={title.title}
              className="w-10 h-14 rounded-lg object-cover bg-surface-elevated shrink-0 border border-surface-elevated"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/assets/trackup-logo.jpg';
              }}
            />
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
                {title.media_type.replace('_', ' ')}
              </span>
              <h3 className="text-base font-bold text-text-primary truncate">
                Add to Custom List
              </h3>
              <p className="text-xs text-text-muted truncate max-w-xs">{title.title}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            data-testid="close-add-to-list-modal"
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer shrink-0"
            aria-label="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Red Error Toast if Supabase Rejects the Request */}
        {errorMessage && (
          <div
            data-testid="add-to-list-error-toast"
            className="p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between gap-2 shadow-lg animate-in fade-in"
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span className="font-medium truncate">{errorMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              className="p-1 hover:bg-rose-500/20 rounded-lg text-rose-300 transition-colors shrink-0 cursor-pointer"
              aria-label="Dismiss error"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Modal Content: Custom Lists */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-text-muted">Loading your custom lists...</div>
          ) : lists.length === 0 && !showCreateForm ? (
            <div className="py-8 text-center space-y-3">
              <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 text-accent flex items-center justify-center mx-auto">
                <FolderPlus className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-text-primary">No Custom Lists Found</p>
                <p className="text-[11px] text-text-muted mt-0.5">
                  Create your first custom list to start organizing titles.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First List</span>
              </button>
            </div>
          ) : (
            lists.map((list) => {
              const isAdded = (list.items || []).some((i) => i.title_id === title.id);
              const isBusy = busyListIds[list.id];

              return (
                <div
                  key={list.id}
                  data-testid={`custom-list-option-${list.id}`}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isAdded
                      ? 'bg-accent/10 border-accent/40 shadow-sm'
                      : 'bg-background border-surface-elevated hover:border-accent/30'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-xl border shrink-0 ${
                        isAdded
                          ? 'bg-accent/20 border-accent/40 text-accent'
                          : 'bg-surface-elevated border-surface-elevated text-text-muted'
                      }`}
                    >
                      <Folder className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-bold text-text-primary truncate">{list.name}</h4>
                        {list.is_private ? (
                          <span title="Private List" className="inline-flex">
                            <Lock className="w-3 h-3 text-text-muted shrink-0" />
                          </span>
                        ) : (
                          <span title="Public List" className="inline-flex">
                            <Globe className="w-3 h-3 text-text-muted shrink-0" />
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-muted mt-0.5">
                        {list.items?.length || 0} {list.items?.length === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleTitleInList(list)}
                    disabled={isBusy}
                    data-testid={`toggle-list-item-${list.id}`}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                      isAdded
                        ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 hover:bg-rose-500/15 hover:border-rose-500/30 hover:text-rose-400'
                        : 'bg-accent hover:bg-accent-hover text-background shadow'
                    }`}
                  >
                    {isBusy ? (
                      <span className="text-[11px]">Updating...</span>
                    ) : isAdded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Inline Create Form or Create Button */}
        {showCreateForm ? (
          <form
            onSubmit={handleCreateAndAdd}
            className="p-4 rounded-2xl bg-background border border-surface-elevated space-y-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between border-b border-surface-elevated pb-2">
              <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                <ListPlus className="w-4 h-4 text-accent" />
                <span>New List & Add</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCreateForm(false)}
                className="text-text-muted hover:text-text-primary text-xs cursor-pointer"
              >
                Cancel
              </button>
            </div>

            <div>
              <input
                type="text"
                required
                autoFocus
                placeholder="List name (e.g. Must-Watch, Dark Fantasy)..."
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-surface border border-surface-elevated focus:border-accent text-text-primary text-xs focus:outline-none transition-colors"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-text-muted">
                <input
                  type="checkbox"
                  checked={newListPrivate}
                  onChange={(e) => setNewListPrivate(e.target.checked)}
                  className="w-3.5 h-3.5 accent-amber-400 rounded cursor-pointer"
                />
                <span>Private list</span>
              </label>

              <button
                type="submit"
                disabled={isCreating || !newListName.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs disabled:opacity-50 transition-all shadow cursor-pointer"
              >
                {isCreating ? 'Creating...' : 'Create & Add'}
              </button>
            </div>
          </form>
        ) : (
          <div className="pt-2 border-t border-surface-elevated flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              data-testid="create-list-inline-button"
              className="text-xs font-semibold text-accent hover:text-accent-hover flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New List</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 text-text-secondary text-xs font-semibold transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
