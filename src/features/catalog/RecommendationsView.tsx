import React, { useEffect, useState } from 'react';
import {
  Sparkles,
  Layers,
  Flame,
  Plus,
  Star,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUserLibrary, useUpsertLibrary } from '../library/useLibrary';
import { getPersonalizedRecommendations } from '../recommendations/recommendationService';
import type { RecommendationItem } from '../recommendations/types';
import type { MediaType } from '../../types/database.types';

interface RecommendationsViewProps {
  onSelectTitle: (id: string) => void;
}

export const RecommendationsView: React.FC<RecommendationsViewProps> = ({
  onSelectTitle,
}) => {
  const { user } = useAuth();
  const { data: userLibrary = [] } = useUserLibrary(user?.id);
  const upsertMutation = useUpsertLibrary();

  const [loading, setLoading] = useState(true);
  const [adaptations, setAdaptations] = useState<RecommendationItem[]>([]);
  const [genreAffinity, setGenreAffinity] = useState<RecommendationItem[]>([]);
  const [communityPicks, setCommunityPicks] = useState<RecommendationItem[]>([]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    getPersonalizedRecommendations(userLibrary).then((res) => {
      if (!isMounted) return;
      setAdaptations(res.adaptations);
      setGenreAffinity(res.genreAffinity);
      setCommunityPicks(res.communityPicks);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, [userLibrary]);

  const handleQuickAdd = (e: React.MouseEvent, rec: RecommendationItem) => {
    e.stopPropagation();
    if (!user) return;

    upsertMutation.mutate({
      userId: user.id,
      titleId: rec.id,
      status: 'planned',
    });
  };

  const getMediaBadge = (mediaType: MediaType) => {
    switch (mediaType) {
      case 'movie':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'tv':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'anime_series':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'anime_film':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'manga':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'manhwa':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/30';
    }
  };

  return (
    <div data-testid="recommendations-view" className="max-w-6xl mx-auto space-y-10">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-surface to-surface-elevated border border-surface-elevated p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-3">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Recommendation Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">
              Recommended For <span className="text-accent">You</span>
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Cross-format adaptation bridges, genre affinity scoring, and community favorites curated for your tracking taste.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start md:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-surface border border-surface-elevated text-xs font-medium text-text-muted">
              {adaptations.length + genreAffinity.length + communityPicks.length} Suggestions
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin w-8 h-8 border-4 border-accent border-t-transparent rounded-full mb-3" />
          <p className="text-sm text-text-muted">Analyzing your tracking tastes...</p>
        </div>
      ) : (
        <>
          {/* Section 1: Cross-Format Adaptations */}
          {adaptations.length > 0 && (
            <section data-testid="recommendations-adaptations-section" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-accent/10 border border-accent/20 text-accent">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
                    Cross-Format Adaptations
                    <span className="text-xs font-normal text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                      Highest Priority
                    </span>
                  </h2>
                  <p className="text-xs text-text-muted">
                    Anime series and manga adaptations connected to titles you love.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adaptations.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onSelectTitle(rec.id)}
                    data-testid={`recommendation-adaptation-card-${rec.id}`}
                    className="p-4 rounded-2xl bg-surface border border-accent/30 hover:border-accent transition-all cursor-pointer group shadow-lg flex gap-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 bg-accent text-background text-[10px] font-extrabold px-3 py-1 rounded-bl-xl tracking-wider">
                      {rec.matchScore}% MATCH
                    </div>
                    <img
                      src={rec.poster_url || '/assets/trackup-logo.jpg'}
                      alt={rec.title}
                      className="w-20 h-28 rounded-xl object-cover shrink-0 shadow-md group-hover:scale-105 transition-transform"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border ${getMediaBadge(
                              rec.media_type
                            )}`}
                          >
                            {rec.media_type.replace('_', ' ')}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                          {rec.title}
                        </h3>
                        <p className="text-xs text-accent font-medium mt-1">
                          {rec.reason}
                        </p>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-elevated">
                        <span className="text-[11px] text-text-muted">
                          {rec.genres.slice(0, 2).join(' • ')}
                        </span>
                        {user && (
                          <button
                            onClick={(e) => handleQuickAdd(e, rec)}
                            data-testid={`quick-add-adaptation-${rec.id}`}
                            className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background text-text-secondary text-xs font-semibold flex items-center gap-1 transition-all"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Plan to Watch</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 2: Genre Affinity Recommendations */}
          {genreAffinity.length > 0 && (
            <section data-testid="recommendations-genre-affinity-section" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    Based on Your Genre Taste
                  </h2>
                  <p className="text-xs text-text-muted">
                    Titles mathematically aligned with your tracked and completed genres.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {genreAffinity.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onSelectTitle(rec.id)}
                    data-testid={`recommendation-genre-card-${rec.id}`}
                    className="p-3.5 rounded-2xl bg-surface border border-surface-elevated hover:border-purple-500/40 transition-all cursor-pointer group shadow flex flex-col justify-between"
                  >
                    <div className="flex gap-3">
                      <img
                        src={rec.poster_url || '/assets/trackup-logo.jpg'}
                        alt={rec.title}
                        className="w-16 h-24 rounded-xl object-cover shrink-0 shadow group-hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getMediaBadge(
                              rec.media_type
                            )}`}
                          >
                            {rec.media_type.replace('_', ' ')}
                          </span>
                          <span className="text-[10px] font-mono font-bold text-purple-400">
                            {rec.matchScore}%
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                          {rec.title}
                        </h3>
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-1">
                          {rec.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-elevated">
                      <span className="text-[10px] text-text-muted truncate max-w-[140px]">
                        {rec.genres.join(', ')}
                      </span>
                      {user && (
                        <button
                          onClick={(e) => handleQuickAdd(e, rec)}
                          data-testid={`quick-add-genre-${rec.id}`}
                          className="px-2 py-1 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background text-text-secondary text-[11px] font-semibold flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Section 3: Community Top Rated */}
          {communityPicks.length > 0 && (
            <section data-testid="recommendations-community-section" className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-text-primary">
                    Community Favorites
                  </h2>
                  <p className="text-xs text-text-muted">
                    Highly rated masterworks across movies, television, anime, and manga.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {communityPicks.map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => onSelectTitle(rec.id)}
                    data-testid={`recommendation-community-card-${rec.id}`}
                    className="p-3.5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-all cursor-pointer group shadow flex flex-col justify-between"
                  >
                    <div className="flex gap-3">
                      <img
                        src={rec.poster_url || '/assets/trackup-logo.jpg'}
                        alt={rec.title}
                        className="w-16 h-24 rounded-xl object-cover shrink-0 shadow group-hover:scale-105 transition-transform"
                      />
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border inline-block mb-1 ${getMediaBadge(
                            rec.media_type
                          )}`}
                        >
                          {rec.media_type.replace('_', ' ')}
                        </span>
                        <h3 className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                          {rec.title}
                        </h3>
                        <p className="text-[11px] text-text-muted line-clamp-2 mt-1">
                          {rec.catalogItem.synopsis || rec.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-elevated">
                      <span className="text-[10px] text-text-muted">
                        {rec.genres.slice(0, 2).join(' • ')}
                      </span>
                      {user && (
                        <button
                          onClick={(e) => handleQuickAdd(e, rec)}
                          data-testid={`quick-add-community-${rec.id}`}
                          className="px-2 py-1 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background text-text-secondary text-[11px] font-semibold flex items-center gap-1 transition-all"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Add</span>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
