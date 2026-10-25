import React, { useState } from 'react';
import type { Review } from './reviewTypes';
import { StarRating } from '../../components/ui/StarRating';
import { Eye, EyeOff, AlertTriangle, Trash2, Edit3, Lock, Users } from 'lucide-react';

interface ReviewCardProps {
  review: Review;
  currentUserId?: string;
  onEdit?: (review: Review) => void;
  onDelete?: (reviewId: string) => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  review,
  currentUserId,
  onEdit,
  onDelete,
}) => {
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const isOwner = currentUserId && currentUserId === review.user_id;

  const formattedDate = new Date(review.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <div
      data-testid={`review-card-${review.id}`}
      className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-3 relative group transition-all"
    >
      {/* Header: Author, Rating, Date, Badges */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-xs font-bold text-accent">
            {review.author_username ? review.author_username[0].toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-text-primary">
                {review.author_name || review.author_username || 'Anonymous'}
              </span>
              {review.author_username && (
                <span className="text-xs text-text-muted">@{review.author_username}</span>
              )}
            </div>
            <span className="text-[11px] text-text-muted font-mono">{formattedDate}</span>
          </div>
        </div>

        {/* Rating and Badges */}
        <div className="flex items-center gap-2">
          {review.visibility === 'private' && (
            <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-text-muted text-[11px] flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>Private</span>
            </span>
          )}
          {review.visibility === 'followers_only' && (
            <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-accent text-[11px] flex items-center gap-1">
              <Users className="w-3 h-3" />
              <span>Followers</span>
            </span>
          )}
          <StarRating value={review.rating} readOnly size="sm" />
        </div>
      </div>

      {/* Review Body & Spoiler Protection */}
      <div className="relative mt-2">
        {review.contains_spoilers && !spoilerRevealed ? (
          <div
            data-testid="spoiler-warning-banner"
            className="p-4 rounded-xl bg-surface-elevated/80 border border-accent/20 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left"
          >
            <div className="flex items-center gap-2 text-accent text-xs font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0 text-accent" />
              <span>Warning: This review contains spoilers</span>
            </div>
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              data-testid="reveal-spoiler-button"
              className="px-3 py-1.5 rounded-lg bg-accent text-background font-bold text-xs flex items-center gap-1.5 hover:bg-accent-hover transition-colors shrink-0 shadow"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Reveal Spoiler</span>
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {review.contains_spoilers && (
              <div className="flex items-center justify-between text-[11px] text-text-muted border-b border-surface-elevated pb-1 mb-2">
                <span className="text-accent font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-accent" />
                  <span>Spoiler Unhidden</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSpoilerRevealed(false)}
                  data-testid="hide-spoiler-button"
                  className="hover:text-text-primary flex items-center gap-1"
                >
                  <EyeOff className="w-3 h-3" />
                  <span>Hide Spoiler</span>
                </button>
              </div>
            )}
            <p
              data-testid="review-body-text"
              className="text-sm text-text-secondary leading-relaxed whitespace-pre-line"
            >
              {review.review_text}
            </p>
          </div>
        )}
      </div>

      {/* Owner Actions */}
      {isOwner && (
        <div className="pt-2 flex items-center justify-end gap-2 border-t border-surface-elevated/60">
          {onEdit && (
            <button
              onClick={() => onEdit(review)}
              data-testid="edit-review-button"
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-text-muted hover:text-accent hover:bg-surface-elevated transition-colors flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(review.id)}
              data-testid="delete-review-button"
              className="px-2.5 py-1 rounded-lg text-xs font-medium text-status-dropped hover:bg-status-dropped/10 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
