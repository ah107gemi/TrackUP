import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number | null; // 1 to 10 scale (where 1 = 0.5 stars, 10 = 5.0 stars)
  onChange?: (value: number) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  showScore?: boolean;
}

export const StarRating: React.FC<StarRatingProps> = ({
  value,
  onChange,
  readOnly = false,
  size = 'md',
  showScore = true,
}) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const displayValue = hoverValue !== null ? hoverValue : value || 0;
  const starScore = (displayValue / 2).toFixed(1); // e.g. 4.5

  const starSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  const handleStarClick = (scorePoints: number) => {
    if (readOnly || !onChange) return;
    // Clicking the same rating clears it
    if (value === scorePoints) {
      onChange(0);
    } else {
      onChange(scorePoints);
    }
  };

  return (
    <div
      data-testid="star-rating-control"
      className="inline-flex items-center gap-2 select-none"
      onMouseLeave={() => !readOnly && setHoverValue(null)}
    >
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const fullScore = starIndex * 2;
          const halfScore = fullScore - 1;
          const isFull = displayValue >= fullScore;
          const isHalf = displayValue === halfScore;

          return (
            <div
              key={starIndex}
              className={`relative inline-block ${!readOnly ? 'cursor-pointer' : ''}`}
            >
              {/* Background Empty Star */}
              <Star
                className={`${starSizes[size]} text-surface-elevated transition-colors`}
              />

              {/* Half Star Fill */}
              {isHalf && (
                <div
                  className="absolute inset-0 overflow-hidden w-1/2 pointer-events-none"
                >
                  <Star className={`${starSizes[size]} text-accent fill-accent`} />
                </div>
              )}

              {/* Full Star Fill */}
              {isFull && (
                <div className="absolute inset-0 pointer-events-none">
                  <Star className={`${starSizes[size]} text-accent fill-accent`} />
                </div>
              )}

              {/* Interactive Split Touch/Click Targets for Half and Full */}
              {!readOnly && (
                <div className="absolute inset-0 flex">
                  {/* Left half -> half star */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid={`star-${starIndex}-half`}
                    onClick={() => handleStarClick(halfScore)}
                    onMouseEnter={() => setHoverValue(halfScore)}
                    className="w-1/2 h-full cursor-pointer focus:outline-none"
                    aria-label={`${halfScore / 2} stars`}
                  />
                  {/* Right half -> full star */}
                  <button
                    type="button"
                    tabIndex={-1}
                    data-testid={`star-${starIndex}-full`}
                    data-alias-testid={`rating-star-${starIndex}`}
                    onClick={() => handleStarClick(fullScore)}
                    onMouseEnter={() => setHoverValue(fullScore)}
                    className="w-1/2 h-full cursor-pointer focus:outline-none"
                    aria-label={`${fullScore / 2} stars`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showScore && (
        <span
          data-testid="star-rating-score"
          className="text-xs font-mono font-bold text-accent"
        >
          {displayValue > 0 ? `${starScore} ★` : 'Unrated'}
        </span>
      )}
    </div>
  );
};
