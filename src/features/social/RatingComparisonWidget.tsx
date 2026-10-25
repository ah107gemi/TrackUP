import React, { useEffect, useState } from 'react';
import { Users, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { RatingComparisonData } from './types';
import { getRatingComparison, getStoredFollows } from './socialService';

interface RatingComparisonWidgetProps {
  currentUserId: string;
  titleId: string;
  currentRating: number | null; // 1-10 points
}

export const RatingComparisonWidget: React.FC<RatingComparisonWidgetProps> = ({
  currentUserId,
  titleId,
  currentRating,
}) => {
  const [comparison, setComparison] = useState<RatingComparisonData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadComparison() {
      setLoading(true);
      // Find who the user follows, default to elena
      const follows = getStoredFollows();
      const userFollowed = follows.find((f) => f.follower_id === currentUserId);
      const friendId = userFollowed ? userFollowed.following_id : 'user_elena_cinema';

      const data = await getRatingComparison(currentUserId, friendId, titleId);
      if (mounted) {
        setComparison(data);
        setLoading(false);
      }
    }

    loadComparison();
    return () => {
      mounted = false;
    };
  }, [currentUserId, titleId, currentRating]);

  if (loading || !comparison || comparison.user_b_rating === null) {
    return null;
  }

  const userAScore = currentRating ? (currentRating / 2).toFixed(1) : null;
  const userBScore = (comparison.user_b_rating / 2).toFixed(1);
  const deltaPoints = currentRating ? currentRating - comparison.user_b_rating : null;
  const deltaStars = deltaPoints !== null ? (deltaPoints / 2).toFixed(1) : null;

  return (
    <div
      data-testid="rating-comparison-widget"
      className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-4 shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-text-primary">
            Friend Rating Comparison
          </h3>
        </div>
        <span className="text-xs text-text-muted font-mono">
          with @{comparison.user_b_username}
        </span>
      </div>

      {/* Side-by-side Score Bars */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Your Score */}
        <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-surface-elevated space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">Your Rating</span>
            <span
              data-testid="user-rating-score"
              className="text-xs font-mono font-bold text-accent"
            >
              {userAScore ? `${userAScore} ★` : 'Unrated'}
            </span>
          </div>
          <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
            <div
              style={{ width: `${currentRating ? (currentRating / 10) * 100 : 0}%` }}
              className="h-full bg-accent rounded-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Friend's Score */}
        <div className="p-3.5 rounded-xl bg-surface-elevated/50 border border-surface-elevated space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-text-secondary">
              @{comparison.user_b_username}
            </span>
            <span
              data-testid="friend-rating-score"
              className="text-xs font-mono font-bold text-indigo-400"
            >
              {userBScore} ★
            </span>
          </div>
          <div className="h-2 w-full bg-surface rounded-full overflow-hidden">
            <div
              style={{ width: `${(comparison.user_b_rating / 10) * 100}%` }}
              className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            />
          </div>
        </div>
      </div>

      {/* Delta Callout */}
      {deltaPoints !== null ? (
        <div
          data-testid="rating-delta-pill"
          className="flex items-center gap-2 p-2.5 rounded-xl bg-surface-elevated/40 border border-surface-elevated text-xs font-medium"
        >
          {deltaPoints > 0 ? (
            <>
              <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                You rated this <strong className="text-accent">+{deltaStars} ★</strong> higher than @{comparison.user_b_username}.
              </span>
            </>
          ) : deltaPoints < 0 ? (
            <>
              <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                You rated this <strong className="text-rose-400">{deltaStars} ★</strong> lower than @{comparison.user_b_username}.
              </span>
            </>
          ) : (
            <>
              <Minus className="w-4 h-4 text-accent shrink-0" />
              <span>
                You and @{comparison.user_b_username} are in exact agreement ({userAScore} ★)!
              </span>
            </>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-text-muted">
          Rate this title above to unlock your side-by-side comparison score!
        </p>
      )}
    </div>
  );
};
