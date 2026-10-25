import React, { useEffect, useState } from 'react';
import { Heart, Trash2, ExternalLink } from 'lucide-react';
import {
  fetchUserFavorites,
  removeFavorite,
  type FavoriteItem,
} from './favoritesService';

interface FavoritesShowcaseProps {
  userId: string;
  onSelectTitle?: (titleId: string) => void;
}

export const FavoritesShowcase: React.FC<FavoritesShowcaseProps> = ({
  userId,
  onSelectTitle,
}) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadFavorites = async () => {
    setLoading(true);
    const data = await fetchUserFavorites(userId);
    setFavorites(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFavorites();
  }, [userId]);

  const handleRemove = async (titleId: string) => {
    await removeFavorite(userId, titleId);
    setFavorites((prev) => prev.filter((f) => f.title_id !== titleId));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6">
        <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div data-testid="favorites-showcase" className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-500 fill-rose-500" />
          <h3 className="text-sm font-bold text-text-primary">Pinned Favorites</h3>
        </div>
        <span className="text-xs text-text-muted font-mono">{favorites.length} Pinned</span>
      </div>

      {favorites.length === 0 ? (
        <div
          data-testid="favorites-empty-state"
          className="p-6 rounded-xl bg-surface-elevated/40 border border-surface-elevated text-center"
        >
          <p className="text-xs text-text-muted">
            No favorites pinned yet. Click the heart icon on any title detail page to pin it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {favorites.map((fav) => (
            <div
              key={fav.id}
              data-testid={`favorite-item-${fav.title_id}`}
              className="group relative rounded-xl overflow-hidden bg-surface-elevated border border-surface-elevated hover:border-accent/50 transition-all p-2 flex flex-col justify-between"
            >
              <div
                onClick={() => onSelectTitle && onSelectTitle(fav.title_id)}
                className="cursor-pointer space-y-2"
              >
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-surface">
                  <img
                    src={fav.title.poster_url || '/assets/trackup-logo.jpg'}
                    alt={fav.title.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-accent text-background">
                    {fav.title.media_type.replace('_', ' ')}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                    {fav.title.title}
                  </h4>
                  {fav.title.release_year && (
                    <span className="text-[10px] text-text-muted font-mono">
                      {fav.title.release_year}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-surface flex items-center justify-between">
                {onSelectTitle && (
                  <button
                    onClick={() => onSelectTitle(fav.title_id)}
                    className="text-[10px] text-text-muted hover:text-accent flex items-center gap-1 font-semibold"
                  >
                    <span>View</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </button>
                )}
                <button
                  onClick={() => handleRemove(fav.title_id)}
                  data-testid={`remove-favorite-${fav.title_id}`}
                  className="p-1 rounded text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-auto"
                  title="Remove from favorites"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
