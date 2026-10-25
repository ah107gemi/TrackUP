import React from 'react';

export const TmdbAttribution: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <footer
      data-testid="tmdb-attribution"
      className={`py-6 px-4 border-t border-surface-elevated text-center text-text-muted text-xs ${className}`}
    >
      <div className="max-w-2xl mx-auto flex flex-col sm:flex-row items-center justify-center gap-3">
        {/* TMDB Badge */}
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-wider bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent text-sm">
            TMDB
          </span>
          <span className="text-text-muted">•</span>
          <span className="font-extrabold tracking-wider text-accent text-sm">
            AniList
          </span>
        </div>
        <p className="text-[11px] leading-relaxed">
          This product uses the TMDB API but is not endorsed or certified by TMDB. Manga and Manhwa metadata powered by AniList.
        </p>
      </div>
    </footer>
  );
};
