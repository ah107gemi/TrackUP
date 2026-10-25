import React, { useState, useEffect } from 'react';
import { Clock, Film, BookOpen, Calendar, ExternalLink } from 'lucide-react';
import { getStoredHistory, type HistoryRecord } from '../library/libraryService';
import { MOCK_CATALOG_FIXTURES } from '../catalog/catalogService';

interface HistoryTimelineProps {
  userId?: string;
  onSelectTitle?: (titleId: string) => void;
}

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({
  userId,
  onSelectTitle,
}) => {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [filter, setFilter] = useState<'all' | 'watch' | 'read'>('all');

  useEffect(() => {
    const records = getStoredHistory();
    const userRecords = userId
      ? records.filter((r) => r.user_id === userId)
      : records;
    // Sort descending by timestamp
    userRecords.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setHistory(userRecords);
  }, [userId]);

  const filteredHistory = history.filter((item) => {
    if (filter === 'watch') return item.type === 'watch';
    if (filter === 'read') return item.type === 'read';
    return true;
  });

  // Group by date string
  const groupedByDate: { [dateStr: string]: HistoryRecord[] } = {};
  filteredHistory.forEach((item) => {
    const dateKey = new Date(item.timestamp).toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(item);
  });

  return (
    <div data-testid="history-timeline-view" className="max-w-4xl mx-auto space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-surface-elevated">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-text-primary flex items-center gap-2">
            <Clock className="w-6 h-6 text-accent" />
            <span>Activity History Timeline</span>
          </h2>
          <p className="text-xs text-text-muted mt-1">
            Chronological audit log of episodes watched and chapters read.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-surface-elevated">
          {(['all', 'watch', 'read'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setFilter(mode)}
              data-testid={`history-filter-${mode}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                filter === mode
                  ? 'bg-accent text-background shadow'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {mode === 'all' ? 'All Activity' : mode === 'watch' ? 'Watching' : 'Reading'}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Content */}
      {Object.keys(groupedByDate).length === 0 ? (
        <div
          data-testid="history-empty-state"
          className="p-12 rounded-2xl bg-surface border border-surface-elevated text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 mx-auto flex items-center justify-center text-accent">
            <Calendar className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary">No activity logged yet</h3>
          <p className="text-xs text-text-muted max-w-sm mx-auto">
            Mark episodes as watched or increment chapters in your library to start building your chronological history timeline.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedByDate).map(([dateLabel, items]) => (
            <div key={dateLabel} className="space-y-3">
              {/* Date Header */}
              <div className="sticky top-0 z-10 py-1 bg-background/90 backdrop-blur-sm flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span className="text-xs font-bold text-text-secondary tracking-wide uppercase">
                  {dateLabel}
                </span>
                <span className="text-[10px] text-text-muted font-mono">
                  ({items.length} {items.length === 1 ? 'entry' : 'entries'})
                </span>
              </div>

              {/* Items for this date */}
              <div className="space-y-2.5 pl-3 border-l-2 border-surface-elevated ml-1">
                {items.map((item) => {
                  const title =
                    MOCK_CATALOG_FIXTURES.find((t) => t.id === item.title_id) || {
                      id: item.title_id,
                      title: 'Tracked Title',
                      media_type: item.type === 'watch' ? 'tv' : 'manga',
                    };

                  const timeStr = new Date(item.timestamp).toLocaleTimeString(undefined, {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={item.id}
                      data-testid={`history-item-${item.id}`}
                      className="p-3 rounded-xl bg-surface border border-surface-elevated hover:border-accent/40 transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Type Icon */}
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            item.type === 'watch'
                              ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                              : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                          }`}
                        >
                          {item.type === 'watch' ? (
                            <Film className="w-4 h-4" />
                          ) : (
                            <BookOpen className="w-4 h-4" />
                          )}
                        </div>

                        {/* Title and Progress Details */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              onClick={() => onSelectTitle && onSelectTitle(title.id)}
                              className="text-xs font-bold text-text-primary hover:text-accent cursor-pointer transition-colors truncate"
                            >
                              {title.title}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.2 rounded bg-surface-elevated text-text-muted">
                              {title.media_type.replace('_', ' ')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs font-mono font-semibold text-accent">
                              {item.type === 'watch'
                                ? item.episode_id
                                  ? `Watched ${item.episode_id.replace('ep_', 'Episode ')}`
                                  : 'Watched Title'
                                : `Read Chapter ${item.chapter_number}`}
                            </span>
                            {item.volume_number ? (
                              <span className="text-[11px] text-text-muted font-mono">
                                (Vol. {item.volume_number})
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Right: Timestamp & Action */}
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[11px] font-mono text-text-muted">
                          {timeStr}
                        </span>
                        {onSelectTitle && (
                          <button
                            onClick={() => onSelectTitle(title.id)}
                            className="p-1 rounded-lg text-text-muted hover:text-accent hover:bg-surface-elevated transition-colors opacity-0 group-hover:opacity-100"
                            title="Open Title"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
