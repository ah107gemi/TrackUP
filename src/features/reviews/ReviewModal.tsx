import React, { useState, useEffect } from 'react';
import { X, MessageSquare, AlertTriangle, ShieldCheck, Check } from 'lucide-react';
import type { Review } from './reviewTypes';
import type { PrivacyLevel } from '../../types/database.types';
import { StarRating } from '../../components/ui/StarRating';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  titleName: string;
  initialReview?: Review | null;
  initialRating?: number | null;
  onSubmit: (data: {
    rating: number;
    reviewText: string;
    containsSpoilers: boolean;
    visibility: PrivacyLevel;
  }) => Promise<void>;
}

export const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  titleName,
  initialReview,
  initialRating,
  onSubmit,
}) => {
  const [rating, setRating] = useState<number>(initialReview?.rating || initialRating || 8);
  const [reviewText, setReviewText] = useState<string>(initialReview?.review_text || '');
  const [containsSpoilers, setContainsSpoilers] = useState<boolean>(
    initialReview?.contains_spoilers || false
  );
  const [visibility, setVisibility] = useState<PrivacyLevel>(
    initialReview?.visibility || 'public'
  );
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (initialReview) {
      setRating(initialReview.rating);
      setReviewText(initialReview.review_text);
      setContainsSpoilers(initialReview.contains_spoilers);
      setVisibility(initialReview.visibility);
    } else {
      setRating(initialRating || 8);
      setReviewText('');
      setContainsSpoilers(false);
      setVisibility('public');
    }
  }, [initialReview, initialRating, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewText.trim()) return;

    setLoading(true);
    await onSubmit({
      rating: rating || 10,
      reviewText: reviewText.trim(),
      containsSpoilers,
      visibility,
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 600);
  };

  return (
    <div
      data-testid="review-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-surface border border-surface-elevated rounded-2xl shadow-2xl p-6 sm:p-8 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-elevated">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center text-accent">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">
                {initialReview ? 'Edit Your Review' : 'Write a Review'}
              </h2>
              <p className="text-xs text-text-muted truncate max-w-xs">{titleName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            data-testid="close-review-modal"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Rating */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              Your Rating (5-Star Scale with Half Stars)
            </label>
            <div className="p-3 bg-surface-elevated/60 rounded-xl border border-surface-elevated flex items-center justify-between">
              <StarRating
                value={rating}
                onChange={(val) => setRating(val)}
                size="lg"
              />
              <span className="text-xs text-text-muted">
                {rating ? `${rating} / 10 pts` : 'No score'}
              </span>
            </div>
          </div>

          {/* Review Text */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                Review & Critique
              </label>
              <span className="text-[11px] text-text-muted font-mono">
                {reviewText.length} characters
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={reviewText}
              onChange={(e) => setReviewText(e.target.value)}
              placeholder="What did you think of the story, pacing, characters, or cinematography?"
              data-testid="review-textarea"
              className="w-full px-3.5 py-2.5 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none resize-none leading-relaxed"
            />
          </div>

          {/* Spoiler Protection Toggle */}
          <div className="p-3.5 bg-surface-elevated/50 border border-surface-elevated rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-accent shrink-0" />
              <div>
                <p className="text-xs font-bold text-text-primary">Contains Spoilers</p>
                <p className="text-[11px] text-text-muted">
                  Blurs text behind a warning banner to protect other readers.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={containsSpoilers}
              onClick={() => setContainsSpoilers(!containsSpoilers)}
              data-testid="spoiler-toggle"
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                containsSpoilers ? 'bg-accent' : 'bg-surface-elevated border-text-muted/30'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  containsSpoilers ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Review Visibility */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
              <ShieldCheck className="w-3.5 h-3.5 text-accent" />
              <span>Review Visibility</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['public', 'followers_only', 'private'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setVisibility(lvl)}
                  data-testid={`review-visibility-${lvl}`}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                    visibility === lvl
                      ? 'bg-accent/15 border-accent text-accent font-semibold'
                      : 'bg-surface-elevated border-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {lvl === 'public' && 'Public'}
                  {lvl === 'followers_only' && 'Followers'}
                  {lvl === 'private' && 'Private'}
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-surface-elevated flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reviewText.trim()}
              data-testid="submit-review-button"
              className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="w-4 h-4 text-background" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>{initialReview ? 'Update Review' : 'Publish Review'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
