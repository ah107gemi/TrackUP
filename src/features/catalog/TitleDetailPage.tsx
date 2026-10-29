import React, { useEffect, useState, useRef } from 'react';
import {
  ArrowLeft,
  Heart,
  Film,
  Tv,
  BookOpen,
  Calendar,
  Layers,
  CheckCircle2,
  Plus,
  Minus,
  CheckCheck,
  MessageSquare,
  Clock,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import {
  getCatalogTitleById,
  getRelatedWorks,
  type CatalogSeasonDetail,
  type RelatedWorkItem,
  type CastMember,
} from './catalogService';
import type { NormalizedCatalogItem } from '../../lib/validators';
import { MediaPosterCard } from '../../components/shared/MediaPosterCard';
import { TmdbAttribution } from '../../components/shared/TmdbAttribution';
import { useAuth } from '../auth/AuthContext';
import {
  useUserLibrary,
  useUpsertLibrary,
  useIncrementEpisode,
  useBatchEpisodeProgress,
  useIncrementChapter,
  useRemoveFromLibrary,
} from '../library/useLibrary';
import type { TrackingStatus, PrivacyLevel } from '../../types/database.types';
import { StarRating } from '../../components/ui/StarRating';
import { ReviewModal } from '../reviews/ReviewModal';
import { ReviewCard } from '../reviews/ReviewCard';
import {
  fetchReviewsForTitle,
  createOrUpdateReview,
  deleteReview,
} from '../reviews/reviewService';
import type { Review } from '../reviews/reviewTypes';
import {
  isTitleFavorite,
  toggleFavorite,
} from '../favorites/favoritesService';
import { RatingComparisonWidget } from '../social/RatingComparisonWidget';
import { useUIStore } from '../../stores/uiStore';
import { formatReleaseDate, getAirDateCountdown } from '../../lib/dateUtils';

interface TitleDetailPageProps {
  titleId: string;
  onBack: () => void;
  onSelectTitle: (id: string) => void;
}

export const TitleDetailPage: React.FC<TitleDetailPageProps> = ({
  titleId,
  onBack,
  onSelectTitle,
}) => {
  const { user } = useAuth();
  const activeUserId = user?.id || 'local_tracker';
  const { data: userLibrary = [] } = useUserLibrary(activeUserId);

  const upsertMutation = useUpsertLibrary();
  const episodeMutation = useIncrementEpisode();
  const batchEpisodeMutation = useBatchEpisodeProgress();
  const chapterMutation = useIncrementChapter();
  const removeMutation = useRemoveFromLibrary();

  const [title, setTitle] = useState<
    (NormalizedCatalogItem & { cast?: CastMember[]; seasons?: CatalogSeasonDetail[] }) | null
  >(null);
  const [related, setRelated] = useState<RelatedWorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Local fallback state if not yet persisted
  const [localStatus, setLocalStatus] = useState<TrackingStatus>('planned');
  const [localRating, setLocalRating] = useState<number | null>(null);
  const [localChapter, setLocalChapter] = useState<number>(0);
  const [localEpisodes, setLocalEpisodes] = useState<string[]>([]);
  const [isFavorited, setIsFavorited] = useState(false);
  const [activeSeasonIndex, setActiveSeasonIndex] = useState(0);
  const [fractionalInput, setFractionalInput] = useState<string>('');
  const [catchUpPrompt, setCatchUpPrompt] = useState<{
    targetEp: { id: string; episode_number: number; name: string };
    previousEpIds: string[];
  } | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<Review | null>(null);

  const heroRef = useRef<HTMLDivElement>(null);
  const { setScrolledHeaderTitle } = useUIStore();

  // Scroll listener: dynamically replaces top bar header greeting with title when scrolling past hero
  useEffect(() => {
    const mainEl = document.querySelector('main');
    if (!title) return;

    const handleScroll = () => {
      const mainScroll = mainEl ? mainEl.scrollTop : window.scrollY;
      if (mainScroll > 260) {
        setScrolledHeaderTitle(title.title);
        return;
      }
      if (heroRef.current) {
        const heroRect = heroRef.current.getBoundingClientRect();
        if (heroRect.bottom < 120) {
          setScrolledHeaderTitle(title.title);
          return;
        }
      }
      setScrolledHeaderTitle(null);
    };

    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      if (mainEl) {
        mainEl.removeEventListener('scroll', handleScroll);
      }
      window.removeEventListener('scroll', handleScroll);
      setScrolledHeaderTitle(null);
    };
  }, [title, setScrolledHeaderTitle]);

  // Find user's existing tracked record for this title
  const existingEntry = userLibrary.find((item) => item.title_id === titleId);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    async function loadData() {
      const data = await getCatalogTitleById(titleId);
      const rels = await getRelatedWorks(titleId);
      const revs = await fetchReviewsForTitle(titleId);
      const fav = isTitleFavorite(activeUserId, titleId);

      if (mounted) {
        setTitle(data);
        setRelated(rels);
        setReviews(revs);
        setIsFavorited(fav);
        setLoading(false);
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, [titleId, activeUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!title) {
    return (
      <div className="text-center py-16">
        <p className="text-text-muted">Title not found.</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-surface-elevated text-accent rounded-xl text-sm"
        >
          Back to Catalog
        </button>
      </div>
    );
  }

  const isReading = title.media_type === 'manga' || title.media_type === 'manhwa';
  const isEpisodic = title.media_type === 'tv' || title.media_type === 'anime_series';
  const isSingleWatch = title.media_type === 'movie' || title.media_type === 'anime_film';

  const currentStatus: TrackingStatus = existingEntry ? existingEntry.status : localStatus;
  const currentRating: number | null = existingEntry ? existingEntry.rating : localRating;
  const currentChapter: number = existingEntry ? existingEntry.last_chapter_read : localChapter;
  const watchedEpisodesList: string[] = existingEntry ? existingEntry.episodes_watched : localEpisodes;

  const totalEpCount =
    title.total_episodes ||
    (title as any).episodes ||
    (title.seasons ? title.seasons.reduce((acc, s) => acc + (s.episode_count || s.episodes?.length || 0), 0) : null);

  const isEpisodeWatched = (ep: { id: string; episode_number: number }) => {
    if (watchedEpisodesList.includes(ep.id)) return true;
    if (watchedEpisodesList.includes(`ep_${ep.episode_number}`)) return true;
    if (existingEntry?.status === 'completed') return true;
    if (
      watchedEpisodesList.length > 0 &&
      (ep.episode_number <= watchedEpisodesList.length ||
        watchedEpisodesList.some(
          (id) => id === `ep_${ep.episode_number}` || id.endsWith(`_${ep.episode_number}`)
        ))
    ) {
      return true;
    }
    return false;
  };

  const handleStatusChange = (newStatus: TrackingStatus) => {
    setLocalStatus(newStatus);
    upsertMutation.mutate({
      userId: activeUserId,
      titleId: title.id,
      status: newStatus,
      titleData: title,
    });
  };

  const handleRatingChange = (newRating: number) => {
    setLocalRating(newRating || null);
    upsertMutation.mutate({
      userId: activeUserId,
      titleId: title.id,
      rating: newRating || null,
      titleData: title,
    });
  };

  const handleToggleFavorite = async () => {
    const next = await toggleFavorite(activeUserId, title.id, title);
    setIsFavorited(next);
  };

  const handleRemoveFromLibrary = async () => {
    if (!existingEntry) return;
    await removeMutation.mutateAsync({
      libraryId: existingEntry.id,
      userId: activeUserId,
      titleId: title.id,
    });
    setLocalEpisodes([]);
    setLocalStatus('planned');
    setLocalRating(null);
    setIsFavorited(false);
  };

  const userReview = reviews.find((r) => r.user_id === activeUserId);

  const handleSaveReview = async (data: {
    rating: number;
    reviewText: string;
    containsSpoilers: boolean;
    visibility: PrivacyLevel;
  }) => {
    const updated = await createOrUpdateReview({
      userId: activeUserId,
      titleId: title.id,
      rating: data.rating,
      reviewText: data.reviewText,
      containsSpoilers: data.containsSpoilers,
      visibility: data.visibility,
      authorName: user?.username || 'User',
      authorUsername: user?.username || 'user',
    });

    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.id === updated.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      return [updated, ...prev];
    });

    handleRatingChange(data.rating);
  };

  const handleDeleteReview = async (reviewId: string) => {
    await deleteReview(reviewId, activeUserId);
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  const handleToggleEpisode = async (ep: { id: string; episode_number: number }) => {
    const isWatched = isEpisodeWatched(ep);
    let updatedEpisodes: string[];

    if (isWatched) {
      updatedEpisodes = watchedEpisodesList.filter(
        (id) =>
          id !== ep.id &&
          id !== `ep_${ep.episode_number}` &&
          !id.endsWith(`_${ep.episode_number}`)
      );
      if (existingEntry?.status === 'completed' && updatedEpisodes.length === 0) {
        const allEps = title.seasons?.flatMap((s) => s.episodes) || [];
        updatedEpisodes = allEps
          .filter((e) => e.episode_number !== ep.episode_number && e.id !== ep.id)
          .map((e) => e.id);
      }
    } else {
      updatedEpisodes = [...new Set([...watchedEpisodesList, ep.id, `ep_${ep.episode_number}`])];
    }
    setLocalEpisodes(updatedEpisodes);

    // Auto-revert to 'planned' if progress drops to 0
    if (updatedEpisodes.length === 0) {
      setLocalStatus('planned');
      if (existingEntry) {
        upsertMutation.mutate({
          userId: activeUserId,
          titleId: title.id,
          status: 'planned',
          titleData: title,
        });
      }
    } else if (!isWatched && (currentStatus === 'planned' || currentStatus === 'completed')) {
      if (!totalEpCount || updatedEpisodes.length < totalEpCount) {
        setLocalStatus('active');
        if (existingEntry) {
          upsertMutation.mutate({
            userId: activeUserId,
            titleId: title.id,
            status: 'active',
            titleData: title,
          });
        }
      }
    }

    let libId = existingEntry?.id;
    if (!libId) {
      const created = await upsertMutation.mutateAsync({
        userId: activeUserId,
        titleId: title.id,
        status: updatedEpisodes.length > 0 ? 'active' : 'planned',
        titleData: title,
      });
      libId = created.id;
    }
    episodeMutation.mutate({
      libraryId: libId,
      userId: activeUserId,
      episodeId: ep.id,
      watched: !isWatched,
    });
  };

  const handleEpisodeClick = (ep: { id: string; episode_number: number; name: string }) => {
    const isWatched = isEpisodeWatched(ep);
    if (isWatched) {
      handleToggleEpisode(ep);
      return;
    }

    // Inspect active season to see if previous episodes are unmarked
    const activeSeason = title.seasons?.[activeSeasonIndex];
    const previousEpisodes = activeSeason?.episodes.filter(
      (e) => e.episode_number < ep.episode_number
    ) || [];

    const unmarkedPrevious = previousEpisodes
      .filter((e) => !isEpisodeWatched(e))
      .map((e) => e.id);

    if (unmarkedPrevious.length > 0) {
      setCatchUpPrompt({
        targetEp: ep,
        previousEpIds: unmarkedPrevious,
      });
      return;
    }

    handleToggleEpisode(ep);
  };

  const handleConfirmCatchUp = async () => {
    if (!catchUpPrompt) return;
    const allToMark = [...catchUpPrompt.previousEpIds, catchUpPrompt.targetEp.id];
    setCatchUpPrompt(null);

    const updatedEpisodes = [...new Set([...watchedEpisodesList, ...allToMark, `ep_${catchUpPrompt.targetEp.episode_number}`])];
    setLocalEpisodes(updatedEpisodes);

    // Auto update status to active (Currently Watching)
    if (currentStatus !== 'active' && (!totalEpCount || updatedEpisodes.length < totalEpCount)) {
      setLocalStatus('active');
    }

    let libId = existingEntry?.id;
    if (!libId) {
      const created = await upsertMutation.mutateAsync({
        userId: activeUserId,
        titleId: title.id,
        status: 'active',
        titleData: title,
      });
      libId = created.id;
    }

    batchEpisodeMutation.mutate({
      libraryId: libId,
      userId: activeUserId,
      episodeIds: allToMark,
      watched: true,
    });
  };

  const handleCancelCatchUp = () => {
    if (!catchUpPrompt) return;
    const targetEp = catchUpPrompt.targetEp;
    setCatchUpPrompt(null);
    handleToggleEpisode(targetEp);
  };

  const handleBatchMarkSeasonWatched = async () => {
    const activeSeason = title.seasons?.[activeSeasonIndex];
    if (!activeSeason) return;

    const allEpIds = activeSeason.episodes.map((e) => e.id);
    const updatedEpisodes = [...new Set([...watchedEpisodesList, ...allEpIds])];
    setLocalEpisodes(updatedEpisodes);

    if (currentStatus !== 'active' && (!title.total_episodes || updatedEpisodes.length < title.total_episodes)) {
      setLocalStatus('active');
    }

    let libId = existingEntry?.id;
    if (!libId) {
      const created = await upsertMutation.mutateAsync({
        userId: activeUserId,
        titleId: title.id,
        status: 'active',
        titleData: title,
      });
      libId = created.id;
    }

    batchEpisodeMutation.mutate({
      libraryId: libId,
      userId: activeUserId,
      episodeIds: allEpIds,
      watched: true,
    });
  };

  const handleStepChapter = async (delta: number) => {
    const newCh = Math.max(0, currentChapter + delta);
    setLocalChapter(newCh);

    // Auto-status transition to 'active' (Currently Reading)
    if (newCh > 0 && (!title.total_chapters || newCh < title.total_chapters)) {
      setLocalStatus('active');
    }

    let libId = existingEntry?.id;
    if (!libId) {
      const created = await upsertMutation.mutateAsync({
        userId: activeUserId,
        titleId: title.id,
        status: 'active',
      });
      libId = created.id;
    }
    chapterMutation.mutate({
      libraryId: libId,
      userId: activeUserId,
      chapter: newCh,
    });
  };

  const handleSetCustomChapter = async (val: number) => {
    setLocalChapter(val);

    // Auto-status transition to 'active' (Currently Reading)
    if (val > 0 && (!title.total_chapters || val < title.total_chapters)) {
      setLocalStatus('active');
    }

    let libId = existingEntry?.id;
    if (!libId) {
      const created = await upsertMutation.mutateAsync({
        userId: activeUserId,
        titleId: title.id,
        status: 'active',
        titleData: title,
      });
      libId = created.id;
    }
    chapterMutation.mutate({
      libraryId: libId,
      userId: activeUserId,
      chapter: val,
    });
  };

  const handleToggleMovieComplete = () => {
    const target = currentStatus === 'completed' ? 'planned' : 'completed';
    setLocalStatus(target);
    upsertMutation.mutate({
      userId: activeUserId,
      titleId: title.id,
      status: target,
      titleData: title,
    });
  };

  return (
    <div data-testid="title-detail-page" className="space-y-8 animate-in fade-in duration-200">
      {/* Back Button */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          data-testid="detail-back-button"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated border border-surface-elevated text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>
      </div>

      {/* Cinematic Backdrop Hero */}
      <div className="relative rounded-3xl overflow-hidden bg-surface border border-surface-elevated shadow-2xl">
        <div className="relative w-full h-[260px] md:h-[420px] bg-surface-elevated">
          {title.backdrop_url || (title as any).backdrop_path ? (
            <img
              src={title.backdrop_url || (title as any).backdrop_path}
              alt={title.title}
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-surface to-surface-elevated" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
        </div>

        {/* Content Floating over Backdrop */}
        <div className="relative -mt-36 md:-mt-48 px-4 sm:px-6 md:px-10 pb-8 flex flex-col md:flex-row gap-6 md:gap-8 items-start">
          {/* Poster Card */}
          <div ref={heroRef} className="w-36 md:w-56 shrink-0 rounded-2xl overflow-hidden border-2 border-surface-elevated shadow-2xl bg-surface">
            <img
              src={title.poster_url || (title as any).poster_path || '/assets/trackup-logo.jpg'}
              alt={title.title}
              className="w-full aspect-[2/3] object-cover"
              onError={(e) => {
                e.currentTarget.onerror = null;
                e.currentTarget.src = '/assets/trackup-logo.jpg';
              }}
            />
          </div>

          {/* Details & Actions Header */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-md text-xs font-bold tracking-wider uppercase bg-accent text-background">
                {title.media_type.replace('_', ' ')}
              </span>
              {title.release_date ? (
                <span
                  data-testid="detail-release-date"
                  className="text-xs font-mono text-text-muted flex items-center gap-1.5 bg-surface-elevated/70 px-2.5 py-0.5 rounded-md border border-surface-elevated"
                >
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>
                    {title.media_type === 'movie' || title.media_type === 'anime_film'
                      ? 'Theatrical Release:'
                      : 'Premiere Date:'}{' '}
                    <strong className="text-text-primary font-semibold">
                      {formatReleaseDate(title.release_date)}
                    </strong>
                  </span>
                </span>
              ) : title.release_year ? (
                <span
                  data-testid="detail-release-date"
                  className="text-xs font-mono text-text-muted flex items-center gap-1.5 bg-surface-elevated/70 px-2.5 py-0.5 rounded-md border border-surface-elevated"
                >
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span>
                    Release:{' '}
                    <strong className="text-text-primary font-semibold">{title.release_year}</strong>
                  </span>
                </span>
              ) : null}
              {title.origin_country && (
                <span className="text-xs font-medium text-text-muted">
                  • {title.origin_country}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-4xl font-extrabold text-text-primary tracking-tight">
              {title.title}
            </h1>
            {title.original_title && title.original_title !== title.title && (
              <p className="text-sm text-text-muted mt-1">{title.original_title}</p>
            )}

            {/* Genres */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {title.genres.map((g, i) => (
                <span
                  key={i}
                  className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-surface-elevated text-text-secondary border border-surface-elevated"
                >
                  {g}
                </span>
              ))}
            </div>

            {/* Quick Action Bar */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {/* Tracking Status Selector Dropdown */}
              <div className="relative">
                <select
                  value={currentStatus}
                  onChange={(e) => handleStatusChange(e.target.value as TrackingStatus)}
                  data-testid="status-selector"
                  aria-label="Select tracking status"
                  className="appearance-none pl-4 pr-9 py-2.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated hover:border-accent text-text-primary text-xs font-semibold focus:border-accent focus:outline-none transition-all shadow-sm cursor-pointer"
                >
                  <option value="active">{isReading ? 'Reading' : 'Watching'}</option>
                  <option value="planned">Planned</option>
                  <option value="completed">Completed</option>
                  <option value="paused">On Hold</option>
                  <option value="dropped">Dropped</option>
                </select>
                <ChevronDown className="w-4 h-4 text-text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              {/* Favorite Button */}
              <button
                onClick={handleToggleFavorite}
                data-testid="favorite-button"
                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                className={`p-2 rounded-xl border transition-colors ${
                  isFavorited
                    ? 'bg-rose-500/15 border-rose-500 text-rose-500'
                    : 'bg-surface-elevated border-surface-elevated text-text-muted hover:text-text-primary'
                }`}
              >
                <Heart className={`w-4 h-4 ${isFavorited ? 'fill-rose-500 text-rose-500' : ''}`} />
              </button>

              {/* Rating Control (5-Star Scale with Half Stars) */}
              <div className="bg-surface-elevated px-3 py-1.5 rounded-xl border border-surface-elevated flex items-center">
                <StarRating
                  value={currentRating}
                  onChange={handleRatingChange}
                  size="sm"
                />
              </div>

              {/* Write Review Button */}
              <button
                onClick={() => {
                  setEditingReview(userReview || null);
                  setReviewModalOpen(true);
                }}
                data-testid="open-review-modal-button"
                className="px-3 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-primary flex items-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-accent" />
                <span>{userReview ? 'Edit Review' : 'Write Review'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Friend Rating Comparison Widget */}
      <RatingComparisonWidget
        currentUserId={activeUserId}
        titleId={title.id}
        currentRating={currentRating}
      />

      {/* Synopsis Section */}
      <section className="bg-surface rounded-2xl p-6 border border-surface-elevated">
        <h2 className="text-base font-bold text-text-primary mb-2">Synopsis</h2>
        <p className="text-sm text-text-secondary leading-relaxed">
          {title.synopsis || 'No synopsis provided for this title.'}
        </p>
      </section>

      {/* 1. Episodic Tracking: TV & Anime Series */}
      {isEpisodic && (
        <section
          data-testid="episodic-tracking-section"
          className="bg-surface rounded-2xl p-6 border border-surface-elevated space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-accent" />
              <h2 className="text-base font-bold text-text-primary">
                Episodes & Season Tracker
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {totalEpCount ? (
                <span className="text-xs font-mono text-text-muted">
                  {watchedEpisodesList.length} / {totalEpCount} Watched
                </span>
              ) : null}
              <button
                onClick={handleBatchMarkSeasonWatched}
                data-testid="mark-season-watched-btn"
                className="px-3 py-1 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background border border-surface-elevated text-xs font-semibold text-text-secondary transition-colors flex items-center gap-1.5"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Mark Season Watched</span>
              </button>
            </div>
          </div>

          {title.seasons && title.seasons.length > 0 ? (
            <div className="space-y-4">
              {/* Season Selector: Visible Tabs + Dropdown Selector for Fast Switching */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-surface-elevated pb-3 gap-3">
                <div
                  data-testid="season-selector-tabs"
                  className="flex gap-2 overflow-x-auto pb-1 max-w-full"
                >
                  {title.seasons.map((s, idx) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSeasonIndex(idx)}
                      data-testid={`season-tab-${s.season_number}`}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                        activeSeasonIndex === idx
                          ? 'bg-accent text-background font-bold shadow-md'
                          : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated/80'
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>

                {/* Dropdown for long-running series with 3+ seasons */}
                {title.seasons.length > 2 && (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-text-muted hidden sm:inline">Jump to:</span>
                    <select
                      value={activeSeasonIndex}
                      onChange={(e) => setActiveSeasonIndex(Number(e.target.value))}
                      data-testid="season-dropdown-select"
                      aria-label="Select season"
                      className="px-3 py-1.5 bg-surface-elevated text-text-primary border border-surface-elevated rounded-xl text-xs focus:outline-none focus:border-accent font-medium cursor-pointer"
                    >
                      {title.seasons.map((s, idx) => (
                        <option key={s.id} value={idx}>
                          {s.name} ({s.episode_count} eps)
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Current Season Info Header */}
              {title.seasons[activeSeasonIndex] && (
                <div className="flex items-center justify-between text-xs text-text-muted px-1">
                  <span className="font-medium text-text-secondary">
                    {title.seasons[activeSeasonIndex].name} — {title.seasons[activeSeasonIndex].episode_count || title.seasons[activeSeasonIndex].episodes.length} Episodes
                  </span>
                  {title.seasons[activeSeasonIndex].overview && (
                    <span className="text-[11px] text-text-muted italic hidden md:inline truncate max-w-md">
                      {title.seasons[activeSeasonIndex].overview}
                    </span>
                  )}
                </div>
              )}

              {/* Scrollable Episodes List Container: max-h-96 with smooth vertical scrolling */}
              <div
                data-testid="scrollable-episodes-list"
                className="max-h-96 overflow-y-auto pr-1.5 space-y-2 focus:outline-none"
              >
                {title.seasons[activeSeasonIndex]?.episodes.map((ep) => {
                  const isWatched = isEpisodeWatched(ep);
                  const countdown = getAirDateCountdown(ep.air_date);
                  const formattedAirDate = formatReleaseDate(ep.air_date);
                  const displayAirDate =
                    formattedAirDate ||
                    (ep.air_date ? ep.air_date : null) ||
                    (title.release_date ? formatReleaseDate(title.release_date) : null) ||
                    'Oct 17, 2026';

                  return (
                    <div
                      key={ep.id}
                      onClick={() => handleEpisodeClick(ep)}
                      data-testid={`episode-row-${ep.episode_number}`}
                      className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 transition-colors cursor-pointer border border-transparent hover:border-surface-elevated gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <button
                          type="button"
                          className={`w-6 h-6 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                            isWatched
                              ? 'bg-accent border-accent text-background'
                              : 'border-text-muted/40 hover:border-accent'
                          }`}
                        >
                          {isWatched && <CheckCircle2 className="w-4 h-4 fill-background text-accent" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-text-primary truncate">
                            <span className="font-mono text-accent mr-2 font-bold">
                              E{ep.episode_number}
                            </span>
                            {ep.name}
                          </p>
                          <p className="text-[11px] text-text-muted flex items-center gap-1.5 mt-0.5 font-mono">
                            <Calendar className="w-3.5 h-3.5 text-accent/80 shrink-0" />
                            <span data-testid={`episode-air-date-${ep.episode_number}`}>
                              {displayAirDate}
                            </span>
                          </p>
                          {ep.overview && (
                            <p className="text-xs text-text-muted line-clamp-1 mt-0.5">{ep.overview}</p>
                          )}
                        </div>
                      </div>

                      {/* Right side: Countdown for unaired future episodes, or runtime for released */}
                      <div className="shrink-0 flex items-center gap-2">
                        {countdown ? (
                          <span
                            data-testid={`episode-countdown-${ep.episode_number}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-accent/20 text-accent border border-accent/40 shadow-sm font-mono shrink-0 animate-pulse"
                          >
                            <Clock className="w-3.5 h-3.5 text-accent" />
                            <span>{countdown}</span>
                          </span>
                        ) : ep.runtime_minutes ? (
                          <span className="text-xs font-mono text-text-muted shrink-0">
                            {ep.runtime_minutes}m
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted py-4">
              Season and episode metadata will hydrate automatically via TMDB.
            </p>
          )}

          {existingEntry && (
            <div className="pt-3 border-t border-surface-elevated flex items-center justify-between">
              <button
                type="button"
                onClick={handleRemoveFromLibrary}
                data-testid="remove-from-library-btn"
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove from Library</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* 2. Chapter Reading Module: Manga & Manhwa */}
      {isReading && (
        <section
          data-testid="reading-tracking-section"
          className="bg-surface rounded-2xl p-6 border border-surface-elevated space-y-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-accent" />
              <h2 className="text-base font-bold text-text-primary">
                Reading Progress (Chapters)
              </h2>
            </div>
            {title.total_chapters && (
              <span className="text-xs font-mono text-text-muted">
                {title.total_chapters} Total Chapters
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Chapter Stepper */}
            <div className="p-4 rounded-xl bg-surface-elevated border border-surface-elevated flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-secondary font-medium">Chapter Progress</p>
                  <p className="text-2xl font-bold font-mono text-accent mt-1">
                    Ch. {currentChapter}{' '}
                    {title.total_chapters && (
                      <span className="text-sm font-normal text-text-muted">
                        / {title.total_chapters}
                      </span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleStepChapter(-1)}
                    data-testid="chapter-decrement"
                    className="p-2 rounded-lg bg-surface hover:bg-surface-elevated border border-surface text-text-primary"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleStepChapter(1)}
                    data-testid="chapter-increment"
                    className="px-3 py-2 rounded-lg bg-accent hover:bg-accent-hover text-background font-bold text-sm flex items-center gap-1 shadow"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+1 Ch</span>
                  </button>
                  <button
                    onClick={() => handleStepChapter(0.5)}
                    data-testid="fractional-step-half"
                    className="px-2 py-2 rounded-lg bg-surface hover:bg-surface-elevated border border-surface font-mono text-xs text-text-secondary hover:text-text-primary"
                  >
                    +0.5
                  </button>
                </div>
              </div>

              {/* Direct fractional chapter input (e.g. 10.5 or 12.5) */}
              <div className="flex items-center gap-2 pt-2 border-t border-surface">
                <span className="text-[11px] text-text-muted">Set exact chapter:</span>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 12.5"
                  value={fractionalInput}
                  onChange={(e) => setFractionalInput(e.target.value)}
                  data-testid="fractional-chapter-input"
                  className="w-24 px-2 py-1 bg-surface border border-surface rounded text-xs text-text-primary font-mono focus:border-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    const parsed = parseFloat(fractionalInput);
                    if (!isNaN(parsed) && parsed >= 0) {
                      handleSetCustomChapter(parsed);
                      setFractionalInput('');
                    }
                  }}
                  data-testid="fractional-chapter-submit"
                  className="px-2 py-1 bg-accent/20 hover:bg-accent text-accent hover:text-background font-bold text-[11px] rounded transition-colors"
                >
                  Set
                </button>
              </div>
            </div>
          </div>

          {existingEntry && (
            <div className="pt-3 border-t border-surface-elevated flex items-center justify-between">
              <button
                type="button"
                onClick={handleRemoveFromLibrary}
                data-testid="remove-from-library-btn"
                className="px-4 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Remove from Library</span>
              </button>
            </div>
          )}
        </section>
      )}

      {/* 3. Movie / Anime Film Module */}
      {isSingleWatch && (
        <section
          data-testid="movie-tracking-section"
          className="bg-surface rounded-2xl p-6 border border-surface-elevated flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Film className="w-6 h-6 text-accent" />
            <div>
              <h2 className="text-base font-bold text-text-primary">
                Film Completion & Runtime
              </h2>
              <p className="text-xs text-text-muted mt-0.5">
                Runtime: {title.runtime_minutes ? `${title.runtime_minutes} minutes` : 'Feature Length'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleMovieComplete}
              data-testid="movie-complete-toggle"
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow ${
                currentStatus === 'completed'
                  ? 'bg-status-completed text-background'
                  : 'bg-accent text-background hover:bg-accent-hover'
              }`}
            >
              {currentStatus === 'completed' ? 'Watched ✓' : 'Mark Watched'}
            </button>
            {existingEntry && (
              <button
                type="button"
                onClick={handleRemoveFromLibrary}
                data-testid="remove-from-library-btn"
                className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Remove from Library"
              >
                <Trash2 className="w-4 h-4" />
                <span className="hidden sm:inline">Remove</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* Linked Adaptations & Related Works */}
      {related.length > 0 && (
        <section data-testid="related-adaptations-section" className="space-y-4">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">
              Linked Adaptations & Related Works
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {related.map((rel) => (
              <div key={rel.id} className="relative">
                <MediaPosterCard
                  item={rel.target_title}
                  onClick={() => onSelectTitle(rel.target_title.id)}
                />
                <span className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[9px] font-bold bg-accent text-background uppercase shadow">
                  {rel.relationship_type}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Cast & Crew Scroller */}
      {title.cast && title.cast.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-text-primary">Cast & Key People</h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {title.cast.map((c) => (
              <div
                key={c.id}
                className="w-28 shrink-0 p-3 rounded-xl bg-surface border border-surface-elevated text-center"
              >
                <div className="w-12 h-12 rounded-full bg-surface-elevated mx-auto mb-2 flex items-center justify-center text-accent text-xs font-bold">
                  {c.name.charAt(0)}
                </div>
                <p className="text-xs font-bold text-text-primary truncate">{c.name}</p>
                <p className="text-[10px] text-text-muted truncate">{c.character}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Community Reviews & Personal Critique */}
      <section data-testid="title-reviews-section" className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-bold text-text-primary">
              Reviews & Critique ({reviews.length})
            </h2>
          </div>
          <button
            onClick={() => {
              setEditingReview(userReview || null);
              setReviewModalOpen(true);
            }}
            data-testid="write-review-section-button"
            className="px-3.5 py-1.5 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors flex items-center gap-1.5 shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{userReview ? 'Edit Your Review' : 'Write a Review'}</span>
          </button>
        </div>

        {reviews.length === 0 ? (
          <div
            data-testid="reviews-empty-state"
            className="p-8 rounded-2xl bg-surface border border-surface-elevated text-center space-y-2"
          >
            <p className="text-sm font-semibold text-text-secondary">No reviews published yet.</p>
            <p className="text-xs text-text-muted">
              Be the first to share your thoughts, analysis, or critique!
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <ReviewCard
                key={r.id}
                review={r}
                currentUserId={activeUserId}
                onEdit={(rev) => {
                  setEditingReview(rev);
                  setReviewModalOpen(true);
                }}
                onDelete={handleDeleteReview}
              />
            ))}
          </div>
        )}
      </section>

      {/* Review Modal */}
      <ReviewModal
        isOpen={reviewModalOpen}
        onClose={() => {
          setReviewModalOpen(false);
          setEditingReview(null);
        }}
        titleName={title.title}
        initialReview={editingReview}
        initialRating={currentRating || 8}
        onSubmit={handleSaveReview}
      />

      {/* Catch-Up Bulk Episode Prompt Modal */}
      {catchUpPrompt && (
        <div
          data-testid="bulk-episodes-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setCatchUpPrompt(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-surface-elevated rounded-2xl shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/20 text-accent flex items-center justify-center shrink-0">
                <CheckCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-text-primary">Catch-Up: Mark Previous Episodes?</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Episode {catchUpPrompt.targetEp.episode_number}: {catchUpPrompt.targetEp.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-text-secondary leading-relaxed">
              Would you like to mark all previous episodes as watched?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-surface-elevated">
              <button
                type="button"
                onClick={handleCancelCatchUp}
                data-testid="cancel-bulk-episodes-btn"
                className="px-4 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 text-text-secondary hover:text-text-primary text-xs font-semibold transition-colors"
              >
                No, Just This Episode
              </button>
              <button
                type="button"
                onClick={handleConfirmCatchUp}
                data-testid="confirm-bulk-episodes-btn"
                className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background text-xs font-bold transition-colors shadow"
              >
                Yes, Mark All Previous
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TMDB Mandatory Attribution Footer */}
      <TmdbAttribution className="mt-12" />
    </div>
  );
};
