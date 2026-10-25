import React from 'react';
import type { UserLibraryItem } from '../library/libraryService';
import {
  BookOpen,
  Clock,
  PieChart,
  Star,
  Tv,
} from 'lucide-react';

interface DashboardStatsProps {
  userLibrary: UserLibraryItem[];
}

export const DashboardStats: React.FC<DashboardStatsProps> = ({ userLibrary }) => {
  // 1. Total Episodes Watched
  const totalEpisodesWatched = userLibrary.reduce(
    (acc, item) => acc + (item.episodes_watched?.length || 0),
    0
  );

  // 2. Total Chapters Read
  const totalChaptersRead = userLibrary.reduce((acc, item) => {
    if (['manga', 'manhwa'].includes(item.title.media_type)) {
      return acc + (Number(item.last_chapter_read) || 0);
    }
    return acc;
  }, 0);

  // 3. Watch Time Calculation (Minutes & Days)
  // Episodes: ~24 minutes per episode average (or title.episode_count)
  // Movies: item.title.runtime_minutes || 110 minutes
  const episodicMinutes = totalEpisodesWatched * 24;
  const completedMovieMinutes = userLibrary
    .filter(
      (item) =>
        ['movie', 'anime_film'].includes(item.title.media_type) &&
        item.status === 'completed'
    )
    .reduce((acc, item) => acc + (item.title.runtime_minutes || 115), 0);

  const totalWatchMinutes = episodicMinutes + completedMovieMinutes;
  const watchDays = (totalWatchMinutes / 1440).toFixed(1);
  const watchHours = Math.round(totalWatchMinutes / 60);

  // 4. Media Type Distribution
  const mediaCounts: Record<string, number> = {
    movie: 0,
    tv: 0,
    anime_series: 0,
    anime_film: 0,
    manga: 0,
    manhwa: 0,
  };

  userLibrary.forEach((item) => {
    const type = item.title.media_type;
    if (mediaCounts[type] !== undefined) {
      mediaCounts[type] += 1;
    }
  });

  const totalTitles = userLibrary.length;

  // 5. Rating Stats
  const ratedItems = userLibrary.filter((item) => item.rating && item.rating > 0);
  const averageRating =
    ratedItems.length > 0
      ? (
          ratedItems.reduce((acc, item) => acc + (item.rating || 0), 0) /
          ratedItems.length /
          2
        ).toFixed(1)
      : '0.0';

  const mediaLabels: Record<string, string> = {
    movie: 'Movies',
    tv: 'TV Shows',
    anime_series: 'Anime Series',
    anime_film: 'Anime Films',
    manga: 'Manga',
    manhwa: 'Manhwa',
  };

  const mediaColors: Record<string, string> = {
    movie: 'bg-amber-400',
    tv: 'bg-indigo-400',
    anime_series: 'bg-pink-400',
    anime_film: 'bg-purple-400',
    manga: 'bg-emerald-400',
    manhwa: 'bg-teal-400',
  };

  return (
    <section data-testid="dashboard-stats-section" className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PieChart className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-text-primary">Analytics & Overview</h2>
        </div>
        <span className="text-xs text-text-muted font-mono">
          {totalTitles} Tracked Titles
        </span>
      </div>

      {/* 4 Primary High-Level Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Episodes Watched */}
        <div
          data-testid="stat-episodes-watched"
          className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-colors flex items-center gap-4 shadow"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-500">
            <Tv className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">
              Episodes Watched
            </p>
            <p className="text-2xl font-black text-text-primary mt-0.5 font-mono">
              {totalEpisodesWatched}
            </p>
          </div>
        </div>

        {/* Chapters Read */}
        <div
          data-testid="stat-chapters-read"
          className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-colors flex items-center gap-4 shadow"
        >
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-500">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">
              Chapters Read
            </p>
            <p className="text-2xl font-black text-text-primary mt-0.5 font-mono">
              {totalChaptersRead}
            </p>
          </div>
        </div>

        {/* Days of Watch Time */}
        <div
          data-testid="stat-watch-time"
          className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-colors flex items-center gap-4 shadow"
        >
          <div className="w-12 h-12 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0 text-accent">
            <Clock className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">
              Watch Time
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-text-primary font-mono">
                {watchDays}
              </span>
              <span className="text-xs text-text-muted font-semibold">days ({watchHours} hrs)</span>
            </div>
          </div>
        </div>

        {/* Average Rating & Rated */}
        <div
          data-testid="stat-average-rating"
          className="p-4 sm:p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-colors flex items-center gap-4 shadow"
        >
          <div className="w-12 h-12 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center shrink-0 text-rose-500">
            <Star className="w-6 h-6 fill-rose-500/40" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">
              Avg Rating
            </p>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-text-primary font-mono">
                {averageRating} ★
              </span>
              <span className="text-xs text-text-muted font-semibold">({ratedItems.length} rated)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Media Type Distribution Breakdown */}
      <div
        data-testid="media-distribution-card"
        className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-4 shadow"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Content Format Distribution (All 6 Media Types)
          </h3>
          <span className="text-xs text-text-muted font-mono">{totalTitles} Total</span>
        </div>

        {/* Stacked Proportional Progress Bar */}
        <div className="h-3 w-full bg-surface-elevated rounded-full overflow-hidden flex">
          {totalTitles === 0 ? (
            <div className="w-full h-full bg-surface-elevated" />
          ) : (
            Object.entries(mediaCounts).map(([type, count]) => {
              if (count === 0) return null;
              const pct = (count / totalTitles) * 100;
              return (
                <div
                  key={type}
                  style={{ width: `${pct}%` }}
                  title={`${mediaLabels[type]}: ${count} (${pct.toFixed(0)}%)`}
                  className={`h-full ${mediaColors[type]} transition-all`}
                />
              );
            })
          )}
        </div>

        {/* Distribution Legend Chips */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
          {Object.entries(mediaCounts).map(([type, count]) => {
            const pct = totalTitles > 0 ? Math.round((count / totalTitles) * 100) : 0;
            return (
              <div
                key={type}
                data-testid={`distribution-chip-${type}`}
                className="p-2 rounded-xl bg-surface-elevated/50 border border-surface-elevated flex items-center justify-between gap-1.5"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${mediaColors[type]}`} />
                  <span className="text-xs font-medium text-text-secondary truncate">
                    {mediaLabels[type]}
                  </span>
                </div>
                <span className="text-xs font-mono font-bold text-text-primary">
                  {count} {totalTitles > 0 ? `(${pct}%)` : ''}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
