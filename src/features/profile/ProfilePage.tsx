import React, { useRef, useState } from 'react';
import {
  User,
  Camera,
  Film,
  Tv,
  Sparkles,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../stores/uiStore';
import { useUserLibrary } from '../library/useLibrary';
import { uploadAvatarImage } from '../../lib/avatarUpload';
import { FavoritesShowcase } from '../favorites/FavoritesShowcase';

interface ProfilePageProps {
  onSelectTitle?: (titleId: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectTitle }) => {
  const { user, profile, updateProfile } = useAuth();
  const { setProfileModalOpen } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const { data: library = [] } = useUserLibrary(user?.id);

  if (!user) return null;

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);

    const { url, error } = await uploadAvatarImage(file, user.id);
    if (error || !url) {
      setUploadError(error || 'Failed to upload image');
      setUploading(false);
      return;
    }

    await updateProfile({ avatar_url: url });
    setUploading(false);
  };

  // Metrics computation for TV Time-style breakdown
  const tvSeriesItems = library.filter((i) => i.title.media_type === 'tv');
  const movieItems = library.filter((i) => i.title.media_type === 'movie');
  const animeItems = library.filter(
    (i) => i.title.media_type === 'anime_series' || i.title.media_type === 'anime_film'
  );
  const readingItems = library.filter(
    (i) => i.title.media_type === 'manga' || i.title.media_type === 'manhwa'
  );

  const totalEpisodesWatched = library.reduce(
    (sum, item) => sum + (item.episodes_watched?.length || 0),
    0
  );
  const totalChaptersRead = library.reduce(
    (sum, item) => sum + (item.last_chapter_read || 0),
    0
  );

  return (
    <div data-testid="profile-page" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Profile Hero Header */}
      <div className="relative rounded-3xl overflow-hidden bg-surface border border-surface-elevated p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Custom Upload Trigger */}
          <div className="relative group shrink-0">
            <div
              data-testid="profile-avatar-container"
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden bg-surface-elevated border-2 border-accent/40 shadow-xl flex items-center justify-center relative"
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || user.username}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-accent" />
              )}

              {/* Hover upload overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                data-testid="avatar-upload-trigger"
                aria-label="Upload profile picture"
                className="absolute inset-0 bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-accent font-semibold text-xs gap-1 cursor-pointer"
              >
                <Camera className="w-6 h-6" />
                <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              data-testid="avatar-file-input"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          {/* User Details */}
          <div className="flex-1 text-center sm:text-left min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
                  {profile?.display_name || user.username}
                </h1>
                <p className="text-sm font-mono text-accent mt-0.5">@{user.username}</p>
              </div>

              <button
                onClick={() => setProfileModalOpen(true)}
                data-testid="edit-profile-btn"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-surface-elevated hover:bg-accent hover:text-background border border-surface-elevated text-xs font-semibold text-text-primary transition-all shadow-sm"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile & Settings</span>
              </button>
            </div>

            {profile?.bio && (
              <p className="text-sm text-text-secondary mt-3 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}

            {uploadError && (
              <p className="text-xs text-status-dropped mt-2 font-medium">{uploadError}</p>
            )}

            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 mt-4 pt-4 border-t border-surface-elevated text-xs text-text-muted">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-accent" />
                <span>Member since {new Date().getFullYear()}</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5 text-status-completed" />
                <span>{library.length} titles in library</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <Tv className="w-3.5 h-3.5 text-purple-400" />
                <span>{totalEpisodesWatched} eps watched</span>
              </span>
              <span className="flex items-center gap-1.5 font-mono">
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>{totalChaptersRead} chs read</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* TV Time-Style Tracking Sections Groundwork */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Tracking Overview & Showcases
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Personalized breakdown for Series, Movies, Anime, and Manga/Manhwa.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. TV Series Section */}
          <div
            data-testid="profile-section-tv"
            className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-purple-400">
                <Tv className="w-5 h-5" />
                <h3 className="font-bold text-sm text-text-primary">TV Series</h3>
              </div>
              <span className="text-xs font-mono font-bold text-purple-400 px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30">
                {tvSeriesItems.length} Shows
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Track multi-season episodes, upcoming airings, and next episodes to watch.
            </p>
            <div className="pt-2 border-t border-surface-elevated/70 flex items-center justify-between text-xs text-text-muted font-mono">
              <span>{tvSeriesItems.filter((i) => i.status === 'completed').length} Finished</span>
              <span>{tvSeriesItems.filter((i) => i.status === 'active').length} Watching</span>
            </div>
          </div>

          {/* 2. Movies Section */}
          <div
            data-testid="profile-section-movies"
            className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-blue-400">
                <Film className="w-5 h-5" />
                <h3 className="font-bold text-sm text-text-primary">Movies</h3>
              </div>
              <span className="text-xs font-mono font-bold text-blue-400 px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30">
                {movieItems.length} Films
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Log theatrical and streaming films, ratings, and runtime achievements.
            </p>
            <div className="pt-2 border-t border-surface-elevated/70 flex items-center justify-between text-xs text-text-muted font-mono">
              <span>{movieItems.filter((i) => i.status === 'completed').length} Watched</span>
              <span>{movieItems.filter((i) => i.status === 'planned').length} Watchlist</span>
            </div>
          </div>

          {/* 3. Anime Section */}
          <div
            data-testid="profile-section-anime"
            className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-accent">
                <Sparkles className="w-5 h-5" />
                <h3 className="font-bold text-sm text-text-primary">Anime</h3>
              </div>
              <span className="text-xs font-mono font-bold text-accent px-2 py-0.5 rounded bg-accent/15 border border-accent/30">
                {animeItems.length} Anime
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Synchronize weekly airing anime seasons, OVA specials, and films.
            </p>
            <div className="pt-2 border-t border-surface-elevated/70 flex items-center justify-between text-xs text-text-muted font-mono">
              <span>{animeItems.filter((i) => i.status === 'completed').length} Completed</span>
              <span>{animeItems.filter((i) => i.status === 'active').length} Airing</span>
            </div>
          </div>

          {/* 4. Manga & Manhwa Section */}
          <div
            data-testid="profile-section-reading"
            className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-3 relative overflow-hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-400">
                <BookOpen className="w-5 h-5" />
                <h3 className="font-bold text-sm text-text-primary">Manga & Manhwa</h3>
              </div>
              <span className="text-xs font-mono font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/15 border border-rose-500/30">
                {readingItems.length} Titles
              </span>
            </div>
            <p className="text-xs text-text-secondary">
              Granular chapter-by-chapter and volume reading steppers with adaptation links.
            </p>
            <div className="pt-2 border-t border-surface-elevated/70 flex items-center justify-between text-xs text-text-muted font-mono">
              <span>{totalChaptersRead} Chs read</span>
              <span>{readingItems.filter((i) => i.status === 'active').length} Reading</span>
            </div>
          </div>
        </div>
      </div>

      {/* Favorites Showcase */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold text-text-primary tracking-tight">
          Featured Favorites
        </h2>
        <FavoritesShowcase userId={user.id} onSelectTitle={onSelectTitle} />
      </div>
    </div>
  );
};
