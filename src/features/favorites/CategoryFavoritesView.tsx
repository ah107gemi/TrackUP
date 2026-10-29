import React, { useEffect, useState } from 'react';
import { ArrowLeft, Film, Tv, Sparkles, BookOpen, Trash2 } from 'lucide-react';
import {
  fetchUserFavorites,
  removeFavorite,
  filterFavoritesByCategory,
  type FavoriteItem,
  type FavoriteCategory,
} from './favoritesService';
import { MediaPosterCard } from '../../components/shared/MediaPosterCard';

interface CategoryFavoritesViewProps {
  userId: string;
  category: FavoriteCategory;
  onBack: () => void;
  onSelectTitle?: (titleId: string) => void;
}

const CATEGORY_META: Record<
  FavoriteCategory,
  {
    title: string;
    subtitle: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    badgeColor: string;
    emptyText: string;
  }
> = {
  tv: {
    title: 'Favorite TV Shows',
    subtitle: 'Your top pinned television series and multi-season dramas',
    icon: Tv,
    accentColor: 'text-purple-400',
    badgeColor: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    emptyText: 'No favorite TV shows pinned yet. Click the heart icon on any TV show detail page to pin it here.',
  },
  movie: {
    title: 'Favorite Movies',
    subtitle: 'Your top pinned cinema and feature films',
    icon: Film,
    accentColor: 'text-blue-400',
    badgeColor: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    emptyText: 'No favorite movies pinned yet. Click the heart icon on any movie detail page to pin it here.',
  },
  anime: {
    title: 'Favorite Anime',
    subtitle: 'Your top pinned Japanese anime series and feature films',
    icon: Sparkles,
    accentColor: 'text-accent',
    badgeColor: 'bg-accent/20 text-accent border-accent/30',
    emptyText: 'No favorite anime pinned yet. Click the heart icon on any anime detail page to pin it here.',
  },
  reading: {
    title: 'Favorite Manga & Manhwa',
    subtitle: 'Your top pinned Japanese Manga and South Korean Manhwa',
    icon: BookOpen,
    accentColor: 'text-cyan-400',
    badgeColor: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    emptyText: 'No favorite Manga or Manhwa pinned yet. Click the heart icon on any reading detail page to pin it here.',
  },
};

export const CategoryFavoritesView: React.FC<CategoryFavoritesViewProps> = ({
  userId,
  category,
  onBack,
  onSelectTitle,
}) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const meta = CATEGORY_META[category] || CATEGORY_META.tv;
  const Icon = meta.icon;

  const loadData = async () => {
    setLoading(true);
    try {
      const allFavs = await fetchUserFavorites(userId);
      const filtered = filterFavoritesByCategory(allFavs, category);
      setFavorites(filtered);
    } catch (err) {
      console.warn('Failed to load user category favorites:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [userId, category]);

  const handleRemove = async (titleId: string) => {
    await removeFavorite(userId, titleId);
    setFavorites((prev) => prev.filter((f) => f.title_id !== titleId));
  };

  return (
    <div
      data-testid="dedicated-favorites-view"
      data-category={category}
      className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200"
    >
      {/* Top Navigation & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-elevated">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            data-testid="favorites-back-btn"
            className="p-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-text-secondary hover:text-text-primary transition-all flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
            title="Back to Profile"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Profile</span>
          </button>

          <div className="h-6 w-px bg-surface-elevated hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl bg-surface-elevated border border-surface-elevated ${meta.accentColor}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
                  {meta.title}
                </h1>
                <span
                  data-testid="favorites-count-badge"
                  className={`text-xs font-bold px-2 py-0.5 rounded-full border ${meta.badgeColor}`}
                >
                  {favorites.length}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-0.5">{meta.subtitle}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-surface-elevated animate-pulse" />
          ))}
        </div>
      ) : favorites.length === 0 ? (
        <div
          data-testid="favorites-category-empty"
          className="p-12 rounded-2xl bg-surface border border-surface-elevated text-center space-y-3"
        >
          <div className={`w-12 h-12 rounded-2xl bg-surface-elevated mx-auto flex items-center justify-center ${meta.accentColor}`}>
            <Icon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">No Pinned Favorites Yet</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto">{meta.emptyText}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-2 px-4 py-2 rounded-xl bg-accent text-background font-bold text-xs hover:bg-accent-hover transition-colors shadow"
          >
            Explore Profile
          </button>
        </div>
      ) : (
        <div
          data-testid="favorites-grid"
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
        >
          {favorites.map((fav) => (
            <div
              key={fav.id}
              data-testid={`favorite-card-${fav.title_id}`}
              className="relative group flex flex-col"
            >
              <MediaPosterCard
                item={fav.title}
                onClick={() => onSelectTitle && onSelectTitle(fav.title_id)}
              />

              {/* Quick Remove Favorite Button */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove(fav.title_id);
                }}
                data-testid={`remove-favorite-${fav.title_id}`}
                aria-label={`Remove ${fav.title.title} from favorites`}
                title="Remove from favorites"
                className="absolute top-2 right-2 z-30 p-1.5 rounded-full bg-background/80 hover:bg-rose-500 text-rose-400 hover:text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all shadow-md cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
