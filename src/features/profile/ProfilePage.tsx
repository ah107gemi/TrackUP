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
  Clock,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../stores/uiStore';
import { useUserLibrary } from '../library/useLibrary';
import { uploadAvatarImage } from '../../lib/avatarUpload';
import { FavoritesShowcase } from '../favorites/FavoritesShowcase';
import { formatWatchTime } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { clearUserLibrary } from '../library/libraryService';

interface ProfilePageProps {
  onSelectTitle?: (titleId: string) => void;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({ onSelectTitle }) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { setProfileModalOpen } = useUIStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: library = [] } = useUserLibrary(user?.id);

  if (!user) return null;

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete your account? All your tracked data, reviews, and library will be erased. This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      try {
        await supabase.rpc('delete_account');
      } catch (rpcErr) {
        console.warn('RPC delete_account failed or not applied yet:', rpcErr);
      }

      await clearUserLibrary(user.id);
      localStorage.removeItem('trackup_user_libraries');
      localStorage.removeItem('trackup_watch_history');
      localStorage.removeItem('trackup_reading_history');
      localStorage.removeItem('trackup_reviews');

      await signOut();
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

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

  // Category segregation
  const tvSeriesItems = library.filter((i) => i.title.media_type === 'tv');
  const movieItems = library.filter((i) => i.title.media_type === 'movie');
  const animeItems = library.filter(
    (i) => i.title.media_type === 'anime_series' || i.title.media_type === 'anime_film'
  );
  const readingItems = library.filter(
    (i) => i.title.media_type === 'manga' || i.title.media_type === 'manhwa'
  );

  // 1. TV Series Metrics
  const tvCompletedCount = tvSeriesItems.filter((i) => i.status === 'completed').length;
  const tvActiveCount = tvSeriesItems.filter((i) => i.status === 'active').length;
  const tvEpisodesWatched = tvSeriesItems.reduce((sum, item) => {
    if (item.episodes_watched && item.episodes_watched.length > 0) {
      return sum + item.episodes_watched.length;
    }
    if (item.status === 'completed' && item.title.total_episodes) {
      return sum + item.title.total_episodes;
    }
    return sum;
  }, 0);
  const tvWatchTimeMinutes = tvSeriesItems.reduce((sum, item) => {
    const epRuntime = item.title.runtime_minutes || 45;
    const eps = (item.episodes_watched && item.episodes_watched.length > 0)
      ? item.episodes_watched.length
      : (item.status === 'completed' ? (item.title.total_episodes || 10) : 0);
    return sum + eps * epRuntime;
  }, 0);

  // 2. Movies Metrics
  const moviesCompletedCount = movieItems.filter((i) => i.status === 'completed').length;
  const moviesPlannedCount = movieItems.filter((i) => i.status === 'planned').length;
  const movieWatchTimeMinutes = movieItems.reduce((sum, item) => {
    if (item.status === 'completed') {
      return sum + (item.title.runtime_minutes || 110);
    }
    return sum;
  }, 0);

  // 3. Anime Metrics (Anime Series & Anime Films)
  const animeCompletedCount = animeItems.filter((i) => i.status === 'completed').length;
  const animeActiveCount = animeItems.filter((i) => i.status === 'active').length;
  const animeEpisodesWatched = animeItems.reduce((sum, item) => {
    if (item.title.media_type === 'anime_film') {
      return sum + (item.status === 'completed' ? 1 : 0);
    }
    if (item.episodes_watched && item.episodes_watched.length > 0) {
      return sum + item.episodes_watched.length;
    }
    if (item.status === 'completed' && item.title.total_episodes) {
      return sum + item.title.total_episodes;
    }
    return sum;
  }, 0);
  const animeWatchTimeMinutes = animeItems.reduce((sum, item) => {
    if (item.title.media_type === 'anime_film') {
      return sum + (item.status === 'completed' ? (item.title.runtime_minutes || 100) : 0);
    }
    const epRuntime = item.title.runtime_minutes || 24;
    const eps = (item.episodes_watched && item.episodes_watched.length > 0)
      ? item.episodes_watched.length
      : (item.status === 'completed' ? (item.title.total_episodes || 12) : 0);
    return sum + eps * epRuntime;
  }, 0);

  // 4. Reading Metrics
  const readingCompletedCount = readingItems.filter((i) => i.status === 'completed').length;
  const readingActiveCount = readingItems.filter((i) => i.status === 'active').length;
  const totalChaptersRead = readingItems.reduce(
    (sum, item) => sum + (item.last_chapter_read || 0),
    0
  );
  // Average reading time ~6 minutes per chapter
  const readingTimeMinutes = Math.round(totalChaptersRead * 6);

  // Total aggregate metrics for hero header
  const totalEpisodesWatched = tvEpisodesWatched + animeEpisodesWatched;
  const combinedWatchTimeMinutes = tvWatchTimeMinutes + animeWatchTimeMinutes;

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
              <span data-testid="global-watch-time" className="flex items-center gap-1.5 font-mono">
                <Clock className="w-3.5 h-3.5 text-accent" />
                <span className="font-bold text-accent">{formatWatchTime(combinedWatchTimeMinutes)}</span>
                <span>watch time</span>
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

            {/* Watch Time Badge */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-elevated">
              <Clock className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Watch Time</p>
                <p data-testid="tv-watch-time" className="text-sm font-bold font-mono text-text-primary">
                  {formatWatchTime(tvWatchTimeMinutes)}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              Track multi-season episodes, upcoming airings, and next episodes to watch.
            </p>

            <div className="pt-2 border-t border-surface-elevated/70 flex flex-col gap-1 text-xs text-text-muted font-mono">
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-semibold">{tvEpisodesWatched} eps watched</span>
                <span className="text-purple-400">{tvCompletedCount} Finished</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>{tvActiveCount} Watching</span>
                <span>{tvSeriesItems.length} Shows total</span>
              </div>
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

            {/* Watch Time Badge */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-elevated">
              <Clock className="w-4 h-4 text-blue-400 shrink-0" />
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Watch Time</p>
                <p data-testid="movies-watch-time" className="text-sm font-bold font-mono text-text-primary">
                  {formatWatchTime(movieWatchTimeMinutes)}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              Log theatrical and streaming films, ratings, and runtime achievements.
            </p>

            <div className="pt-2 border-t border-surface-elevated/70 flex flex-col gap-1 text-xs text-text-muted font-mono">
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-semibold">{moviesCompletedCount} watched</span>
                <span className="text-blue-400">{moviesPlannedCount} Watchlist</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>{movieItems.length} Films total</span>
                <span>{movieItems.length > 0 ? `${Math.round((moviesCompletedCount / movieItems.length) * 100)}%` : '0%'}</span>
              </div>
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

            {/* Watch Time Badge */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-elevated">
              <Clock className="w-4 h-4 text-accent shrink-0" />
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Watch Time</p>
                <p data-testid="anime-watch-time" className="text-sm font-bold font-mono text-text-primary">
                  {formatWatchTime(animeWatchTimeMinutes)}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              Synchronize weekly airing anime seasons, OVA specials, and films.
            </p>

            <div className="pt-2 border-t border-surface-elevated/70 flex flex-col gap-1 text-xs text-text-muted font-mono">
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-semibold">{animeEpisodesWatched} eps watched</span>
                <span className="text-accent">{animeCompletedCount} Completed</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>{animeActiveCount} Airing</span>
                <span>{animeItems.length} Anime total</span>
              </div>
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

            {/* Reading Time Badge */}
            <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-surface-elevated/80 border border-surface-elevated">
              <Clock className="w-4 h-4 text-rose-400 shrink-0" />
              <div>
                <p className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Reading Time</p>
                <p data-testid="reading-watch-time" className="text-sm font-bold font-mono text-text-primary">
                  {formatWatchTime(readingTimeMinutes)}
                </p>
              </div>
            </div>

            <p className="text-xs text-text-secondary">
              Granular chapter-by-chapter reading stepper with adaptation links.
            </p>

            <div className="pt-2 border-t border-surface-elevated/70 flex flex-col gap-1 text-xs text-text-muted font-mono">
              <div className="flex items-center justify-between">
                <span className="text-text-primary font-semibold">{totalChaptersRead} chs read</span>
                <span className="text-rose-400">{readingCompletedCount} Finished</span>
              </div>
              <div className="flex items-center justify-between text-[11px]">
                <span>{readingActiveCount} Reading</span>
                <span>{readingItems.length} Titles total</span>
              </div>
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

      {/* Account Settings & Danger Zone */}
      <div className="p-6 rounded-2xl bg-surface border border-rose-500/20 space-y-4">
        <div className="flex items-center gap-2 text-rose-500">
          <AlertTriangle className="w-5 h-5" />
          <h3 className="text-base font-bold text-text-primary">Danger Zone</h3>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div>
            <p className="text-sm font-semibold text-text-primary">Delete Account</p>
            <p className="text-xs text-text-muted mt-0.5">
              Permanently erase your account, tracked media progress, reviews, and library history.
            </p>
          </div>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            data-testid="delete-account-btn"
            className="px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-colors shrink-0 shadow cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Account'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
