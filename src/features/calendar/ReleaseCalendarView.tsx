import React, { useState } from 'react';
import {
  CalendarDays,
  Clock,
  Filter,
  CheckCircle2,
  BookmarkPlus,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUserLibrary, useUpsertLibrary } from '../library/useLibrary';
import {
  MOCK_RELEASE_SCHEDULES,
  DAYS_OF_WEEK,
  filterReleases,
  formatAirDate,
} from './calendarService';
import type { MediaType } from '../../types/database.types';

interface ReleaseCalendarViewProps {
  onSelectTitle: (id: string) => void;
}

export const ReleaseCalendarView: React.FC<ReleaseCalendarViewProps> = ({
  onSelectTitle,
}) => {
  const { user } = useAuth();
  const { data: userLibrary = [] } = useUserLibrary(user?.id);
  const upsertMutation = useUpsertLibrary();

  const [selectedDay, setSelectedDay] = useState<number | null>(null); // null = entire week
  const [trackedOnly, setTrackedOnly] = useState(false);

  const displayedReleases = filterReleases(
    MOCK_RELEASE_SCHEDULES,
    userLibrary,
    selectedDay,
    trackedOnly
  );

  const handleTrackTitle = (e: React.MouseEvent, titleId: string) => {
    e.stopPropagation();
    if (!user) return;

    upsertMutation.mutate({
      userId: user.id,
      titleId,
      status: 'active',
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
    <div data-testid="release-calendar-view" className="max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-surface to-surface-elevated border border-surface-elevated p-6 md:p-8 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-3">
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Airing Schedule & Release Radar</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-text-primary tracking-tight">
              Weekly Release <span className="text-accent">Calendar</span>
            </h1>
            <p className="text-sm text-text-secondary mt-1 max-w-xl">
              Track new episode broadcasts and manga/manhwa chapter drops across the entire week.
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setTrackedOnly(!trackedOnly)}
              data-testid="calendar-filter-tracked-button"
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all border ${
                trackedOnly
                  ? 'bg-accent text-background border-accent'
                  : 'bg-surface border-surface-elevated text-text-secondary hover:text-text-primary'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{trackedOnly ? 'Showing: Tracked Only' : 'Filter: My Tracked Only'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Day of Week Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button
          onClick={() => setSelectedDay(null)}
          data-testid="day-selector-all"
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 border ${
            selectedDay === null
              ? 'bg-accent text-background border-accent shadow-md'
              : 'bg-surface border-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
          }`}
        >
          All Days ({MOCK_RELEASE_SCHEDULES.length})
        </button>

        {DAYS_OF_WEEK.map((d) => {
          const count = MOCK_RELEASE_SCHEDULES.filter((s) => s.day_of_week === d.day).length;
          const isSelected = selectedDay === d.day;

          return (
            <button
              key={d.day}
              onClick={() => setSelectedDay(d.day)}
              data-testid={`day-selector-${d.label.toLowerCase()}`}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 border ${
                isSelected
                  ? 'bg-accent text-background border-accent shadow-md'
                  : 'bg-surface border-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              }`}
            >
              <span>{d.fullLabel}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isSelected ? 'bg-background/20 text-background' : 'bg-surface-elevated text-text-muted'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Releases Grid */}
      {displayedReleases.length === 0 ? (
        <div data-testid="calendar-empty-state" className="text-center py-16 px-4 bg-surface rounded-3xl border border-surface-elevated">
          <CalendarDays className="w-12 h-12 text-text-muted mx-auto mb-3 opacity-40" />
          <h3 className="text-base font-bold text-text-primary">No Scheduled Releases Found</h3>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            {trackedOnly
              ? "You haven't tracked any titles that air on this selected day. Try toggling off the 'Tracked Only' filter."
              : 'No broadcasts or chapter releases scheduled for this specific day.'}
          </p>
          {trackedOnly && (
            <button
              onClick={() => setTrackedOnly(false)}
              className="mt-4 px-4 py-2 rounded-xl bg-accent text-background text-xs font-bold hover:bg-accent-hover transition-colors"
            >
              Show All Titles
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedReleases.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelectTitle(item.title_id)}
              data-testid={`release-card-${item.id}`}
              className="p-4 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-all cursor-pointer group shadow flex flex-col justify-between"
            >
              <div className="flex gap-3.5">
                <img
                  src={item.poster_url || '/assets/trackup-logo.jpg'}
                  alt={item.title_name}
                  className="w-16 h-24 rounded-xl object-cover shrink-0 shadow group-hover:scale-105 transition-transform"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${getMediaBadge(
                        item.media_type
                      )}`}
                    >
                      {item.media_type.replace('_', ' ')}
                    </span>
                    {item.is_in_user_library && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-accent font-semibold">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Tracked</span>
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                    {item.title_name}
                  </h3>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-accent font-semibold">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">
                      {item.release_type === 'episode' && `Episode ${item.item_number}`}
                      {item.release_type === 'chapter' && `Chapter ${item.item_number}`}
                      {item.release_type === 'season' && `Special Broadcast`}
                      {item.release_type === 'volume' && `Volume Drop`}
                    </span>
                  </div>
                  <p className="text-[11px] text-text-muted truncate mt-0.5">
                    {item.item_title}
                  </p>
                </div>
              </div>

              {/* Bottom Card Footer */}
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-surface-elevated text-[11px]">
                <span className="text-text-secondary font-medium">
                  {formatAirDate(item.air_date, item.day_of_week)}
                </span>
                {!item.is_in_user_library && user && (
                  <button
                    onClick={(e) => handleTrackTitle(e, item.title_id)}
                    data-testid={`calendar-quick-track-${item.id}`}
                    className="px-2.5 py-1 rounded-lg bg-surface-elevated hover:bg-accent hover:text-background text-text-secondary text-xs font-semibold flex items-center gap-1 transition-all"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Track</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
