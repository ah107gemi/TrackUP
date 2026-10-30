import React, { useState, useEffect } from 'react';
import {
  User,
  UserPlus,
  UserCheck,
  UserMinus,
  ArrowLeft,
  Clock,
  Tv,
  CheckCircle2,
  BookOpen,
  Calendar,
  Lock,
  Search,
  Film,
  Star,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { supabase } from '../../lib/supabase';
import { isVideoBanner } from '../../lib/bannerUpload';
import { formatWatchTime } from '../../lib/dateUtils';
import type { SocialProfile } from '../social/types';
import {
  MOCK_COMMUNITY_PROFILES,
  getStoredFollows,
  followUser,
  unfollowUser,
} from '../social/socialService';
import {
  fetchUserLibrary,
  getStoredLibraries,
  saveStoredLibraries,
  type UserLibraryItem,
} from '../library/libraryService';
import { MOCK_CATALOG_FIXTURES } from '../catalog/catalogService';
import type { TrackingStatus } from '../../types/database.types';

interface PublicProfilePageProps {
  userParam: string; // username or user_id
  onBack: () => void;
  onSelectTitle: (titleId: string) => void;
}

export const PublicProfilePage: React.FC<PublicProfilePageProps> = ({
  userParam,
  onBack,
  onSelectTitle,
}) => {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?.id || 'guest_user';

  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [library, setLibrary] = useState<UserLibraryItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followersCount, setFollowersCount] = useState<number>(0);
  const [followingCount, setFollowingCount] = useState<number>(0);
  const [isHoveringFollow, setIsHoveringFollow] = useState<boolean>(false);

  // Filter state for public library
  const [activeCategory, setActiveCategory] = useState<'all' | 'watch' | 'read'>('all');
  const [activeStatus, setActiveStatus] = useState<TrackingStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Resolve Profile & Library Data
  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    const resolveProfile = async () => {
      const cleanParam = userParam.trim().replace(/^@/, '');
      let resolvedProfile: SocialProfile | null = null;

      // Tier A: Supabase live profile query
      try {
        const isLocalSupabase =
          !import.meta.env.VITE_SUPABASE_URL ||
          import.meta.env.VITE_SUPABASE_URL.includes('127.0.0.1') ||
          import.meta.env.VITE_SUPABASE_URL.includes('localhost');
        const timeoutMs = isLocalSupabase ? 350 : 3000;

        const q = supabase
          .from('profiles')
          .select('id, username, display_name, full_name, avatar_url, banner_url, bio, library_visibility, activity_visibility, created_at')
          .or(`username.eq.${cleanParam},id.eq.${cleanParam}`)
          .single();

        const res: any = await Promise.race([
          q,
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
        ]);

        if (!res?.error && res?.data) {
          const p = res.data;
          resolvedProfile = {
            id: p.id,
            username: p.username || cleanParam,
            display_name: p.display_name || p.full_name || p.username || cleanParam,
            avatar_url: p.avatar_url || null,
            banner_url: p.banner_url || null,
            bio: p.bio || null,
            library_visibility: p.library_visibility || 'public',
            activity_visibility: p.activity_visibility || 'public',
            follower_count: 0,
            following_count: 0,
          };
        }
      } catch {
        // Fallback
      }

      // Tier B: Curated mock community profiles
      if (!resolvedProfile) {
        const mockMatch = MOCK_COMMUNITY_PROFILES.find(
          (p) =>
            p.username.toLowerCase() === cleanParam.toLowerCase() ||
            p.id.toLowerCase() === cleanParam.toLowerCase()
        );
        if (mockMatch) {
          resolvedProfile = { ...mockMatch };
        }
      }

      // Tier C: Dynamically registered browser profiles
      if (!resolvedProfile) {
        try {
          const dynamicProfiles: Record<string, any> = JSON.parse(
            localStorage.getItem('trackup_mock_profiles') || '{}'
          );
          const found = Object.values(dynamicProfiles).find(
            (p: any) =>
              p.username?.toLowerCase() === cleanParam.toLowerCase() ||
              p.id?.toLowerCase() === cleanParam.toLowerCase()
          );
          if (found) {
            resolvedProfile = {
              id: found.id,
              username: found.username,
              display_name: found.display_name || found.full_name || found.username,
              avatar_url: found.avatar_url || null,
              banner_url: found.banner_url || null,
              bio: found.bio || null,
              library_visibility: found.library_visibility || 'public',
              activity_visibility: found.activity_visibility || 'public',
              follower_count: 0,
              following_count: 0,
            };
          }
        } catch {}
      }

      if (!mounted) return;

      if (resolvedProfile) {
        setProfile(resolvedProfile);

        // Calculate follow status and counts
        const follows = getStoredFollows();
        const followers = follows.filter((f) => f.following_id === resolvedProfile?.id).length;
        const following = follows.filter((f) => f.follower_id === resolvedProfile?.id).length;
        const amFollowing = follows.some(
          (f) => f.follower_id === currentUserId && f.following_id === resolvedProfile?.id
        );

        setIsFollowing(amFollowing);
        setFollowersCount(Math.max(resolvedProfile.follower_count || 0, followers));
        setFollowingCount(Math.max(resolvedProfile.following_count || 0, following));

        // Load target user's library items
        let userItems = await fetchUserLibrary(resolvedProfile.id);

        // Seed sample items for mock community members if empty
        if (userItems.length === 0) {
          const seedItems: UserLibraryItem[] = [];
          const allLibraries = getStoredLibraries();

          if (resolvedProfile.username === 'elena_tracker' || resolvedProfile.id === 'user_elena_cinema') {
            const breakingBad = MOCK_CATALOG_FIXTURES.find((f) => f.id === 'tv_breaking_bad_1396');
            const inception = MOCK_CATALOG_FIXTURES.find((f) => f.id === 'movie_inception_27205');
            const yellowstone = MOCK_CATALOG_FIXTURES.find((f) => f.id === 'tmdb_tv_73586');

            if (breakingBad) {
              seedItems.push({
                id: `lib_seed_elena_1`,
                user_id: resolvedProfile.id,
                title_id: breakingBad.id,
                status: 'completed',
                rating: 10,
                is_private: false,
                personal_notes: 'Masterpiece of television history.',
                started_at: '2025-01-01T00:00:00.000Z',
                completed_at: '2025-02-15T00:00:00.000Z',
                last_progressed_at: '2025-02-15T00:00:00.000Z',
                episodes_watched: Array.from({ length: 62 }, (_, i) => `ep_${i + 1}`),
                last_chapter_read: 0,
                last_volume_read: 0,
                title: breakingBad,
              });
            }
            if (inception) {
              seedItems.push({
                id: `lib_seed_elena_2`,
                user_id: resolvedProfile.id,
                title_id: inception.id,
                status: 'completed',
                rating: 9,
                is_private: false,
                personal_notes: 'Nolan at his finest.',
                started_at: '2025-03-01T00:00:00.000Z',
                completed_at: '2025-03-01T02:30:00.000Z',
                last_progressed_at: '2025-03-01T02:30:00.000Z',
                episodes_watched: [],
                last_chapter_read: 0,
                last_volume_read: 0,
                title: inception,
              });
            }
            if (yellowstone) {
              seedItems.push({
                id: `lib_seed_elena_3`,
                user_id: resolvedProfile.id,
                title_id: yellowstone.id,
                status: 'active',
                rating: 9,
                is_private: false,
                personal_notes: 'Riveting modern western family saga.',
                started_at: '2025-04-01T00:00:00.000Z',
                completed_at: null,
                last_progressed_at: '2025-04-10T00:00:00.000Z',
                episodes_watched: ['ep_1', 'ep_2', 'ep_3', 'ep_4', 'ep_5'],
                last_chapter_read: 0,
                last_volume_read: 0,
                title: yellowstone,
              });
            }
          } else if (resolvedProfile.username === 'marcus_anime' || resolvedProfile.id === 'user_marcus_anime') {
            const frieren = MOCK_CATALOG_FIXTURES.find((f) => f.id === 'anime_frieren_154587');
            const soloLeveling = MOCK_CATALOG_FIXTURES.find((f) => f.id === 'manga_solo_leveling_105398');
            if (frieren) {
              seedItems.push({
                id: `lib_seed_marcus_1`,
                user_id: resolvedProfile.id,
                title_id: frieren.id,
                status: 'completed',
                rating: 10,
                is_private: false,
                personal_notes: 'Peak fantasy storytelling.',
                started_at: '2025-01-10T00:00:00.000Z',
                completed_at: '2025-03-25T00:00:00.000Z',
                last_progressed_at: '2025-03-25T00:00:00.000Z',
                episodes_watched: Array.from({ length: 28 }, (_, i) => `ep_${i + 1}`),
                last_chapter_read: 0,
                last_volume_read: 0,
                title: frieren,
              });
            }
            if (soloLeveling) {
              seedItems.push({
                id: `lib_seed_marcus_2`,
                user_id: resolvedProfile.id,
                title_id: soloLeveling.id,
                status: 'active',
                rating: 9,
                is_private: false,
                personal_notes: 'Incredible action and artwork.',
                started_at: '2025-02-01T00:00:00.000Z',
                completed_at: null,
                last_progressed_at: '2025-04-05T00:00:00.000Z',
                episodes_watched: [],
                last_chapter_read: 145,
                last_volume_read: 12,
                title: soloLeveling,
              });
            }
          }

          if (seedItems.length > 0) {
            saveStoredLibraries([...allLibraries, ...seedItems]);
            userItems = seedItems;
          }
        }

        // Only display public items to viewers
        setLibrary(userItems.filter((item) => !item.is_private));
      }

      setIsLoading(false);
    };

    resolveProfile();

    return () => {
      mounted = false;
    };
  }, [userParam, currentUserId]);

  // Handle Follow / Unfollow toggle
  const handleToggleFollow = async () => {
    if (!profile) return;
    try {
      if (isFollowing) {
        await unfollowUser(currentUserId, profile.id);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await followUser(currentUserId, profile.id);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  // Metrics calculation
  const tvSeriesItems = library.filter((i) => i.title?.media_type === 'tv');
  const movieItems = library.filter((i) => i.title?.media_type === 'movie');
  const animeItems = library.filter(
    (i) => i.title?.media_type === 'anime_series' || i.title?.media_type === 'anime_film'
  );
  const readingItems = library.filter(
    (i) => i.title?.media_type === 'manga' || i.title?.media_type === 'manhwa'
  );

  const tvEpisodes = tvSeriesItems.reduce((sum, item) => sum + (item.episodes_watched?.length || 0), 0);
  const animeEpisodes = animeItems.reduce((sum, item) => sum + (item.episodes_watched?.length || 0), 0);
  const totalEpisodesWatched = tvEpisodes + animeEpisodes;

  const tvWatchMinutes = tvSeriesItems.reduce((sum, item) => {
    const epRuntime = item.title?.runtime_minutes || 45;
    return sum + (item.episodes_watched?.length || 0) * epRuntime;
  }, 0);
  const animeWatchMinutes = animeItems.reduce((sum, item) => {
    const epRuntime = item.title?.runtime_minutes || 24;
    return sum + (item.episodes_watched?.length || 0) * epRuntime;
  }, 0);
  const movieWatchMinutes = movieItems.reduce((sum, item) => {
    return sum + (item.status === 'completed' ? (item.title?.runtime_minutes || 110) : 0);
  }, 0);
  const combinedWatchTimeMinutes = tvWatchMinutes + animeWatchMinutes + movieWatchMinutes;

  const totalChaptersRead = readingItems.reduce((sum, item) => sum + (item.last_chapter_read || 0), 0);

  // Filtered Library Items
  const filteredLibrary = library.filter((item) => {
    if (!item || !item.title) return false;
    const type = item.title.media_type;

    // Category filter
    if (activeCategory === 'watch') {
      if (!['tv', 'movie', 'anime_series', 'anime_film'].includes(type)) return false;
    } else if (activeCategory === 'read') {
      if (!['manga', 'manhwa'].includes(type)) return false;
    }

    // Status filter
    if (activeStatus !== 'all' && item.status !== activeStatus) return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = item.title.title?.toLowerCase().includes(q);
      const matchGenre = item.title.genres?.some((g) => g.toLowerCase().includes(q));
      if (!matchTitle && !matchGenre) return false;
    }

    return true;
  });

  if (isLoading) {
    return (
      <div data-testid="public-profile-loading" className="max-w-6xl mx-auto space-y-8 animate-pulse p-4">
        <div className="w-full h-56 rounded-3xl bg-surface-elevated/40" />
        <div className="space-y-4 px-4">
          <div className="w-32 h-32 rounded-full bg-surface-elevated -mt-16 border-4 border-background" />
          <div className="w-48 h-6 rounded bg-surface-elevated" />
          <div className="w-32 h-4 rounded bg-surface-elevated" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div data-testid="public-profile-not-found" className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-surface-elevated border border-surface-elevated flex items-center justify-center mx-auto text-accent">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">User Profile Not Found</h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto">
          The user &quot;{userParam}&quot; could not be located in the community directory.
        </p>
        <button
          onClick={onBack}
          data-testid="public-profile-back-btn"
          className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Friends & Social</span>
        </button>
      </div>
    );
  }

  const isSelf = currentUser && currentUser.id === profile.id;
  const isPrivateLibrary = profile.library_visibility === 'private' && !isSelf;

  return (
    <div data-testid="public-profile-page" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Top Back Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          data-testid="public-profile-back-btn"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-surface hover:bg-surface-elevated border border-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back</span>
        </button>
        <span className="text-xs font-mono text-text-muted">Public Community Profile</span>
      </div>

      {/* Hero Header - Exact Pro Max Left-Aligned Aesthetic */}
      <div
        data-testid="public-profile-header"
        className="relative rounded-3xl overflow-hidden bg-surface border border-surface-elevated shadow-xl"
      >
        {/* 1. Full-Width Top Banner Block */}
        <div
          data-testid="public-profile-banner"
          className="relative w-full h-48 sm:h-56 md:h-64 overflow-hidden bg-surface-elevated/40"
        >
          {profile.banner_url ? (
            isVideoBanner(profile.banner_url) ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
                src={profile.banner_url}
              />
            ) : (
              <img
                src={profile.banner_url}
                alt={`${profile.display_name} Banner`}
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div className="w-full h-full bg-gradient-to-r from-surface via-surface-elevated to-surface" />
          )}
        </div>

        {/* 2. Hero Content Section with Overlapping Avatar */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Left-Aligned Overlapping Avatar */}
            <div className="relative shrink-0 ml-1 sm:ml-0">
              <div
                data-testid="public-profile-avatar"
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-surface-elevated border-4 border-background shadow-2xl flex items-center justify-center relative ring-2 ring-accent/30"
              >
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.display_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 sm:w-16 sm:h-16 text-accent" />
                )}
              </div>
            </div>

            {/* Top-Right Action: Follow / Unfollow */}
            <div className="flex items-center gap-2.5 self-start sm:self-end">
              {!isSelf ? (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  onMouseEnter={() => setIsHoveringFollow(true)}
                  onMouseLeave={() => setIsHoveringFollow(false)}
                  data-testid="public-profile-follow-btn"
                  className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer ${
                    isFollowing
                      ? isHoveringFollow
                        ? 'bg-rose-500/15 border border-rose-500/30 text-rose-400'
                        : 'bg-surface-elevated border border-accent/40 text-accent'
                      : 'bg-accent hover:bg-accent-hover text-background'
                  }`}
                >
                  {isFollowing ? (
                    isHoveringFollow ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        <span>Unfollow</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Following</span>
                      </>
                    )
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Follow</span>
                    </>
                  )}
                </button>
              ) : (
                <span className="px-4 py-2 rounded-xl bg-surface-elevated border border-surface-elevated text-xs font-bold text-text-muted">
                  Your Public Profile
                </span>
              )}
            </div>
          </div>

          {/* 3. User Details: Display Name and @username */}
          <div className="text-left space-y-1">
            <h1 data-testid="public-profile-display-name" className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {profile.display_name}
            </h1>
            <p data-testid="public-profile-username" className="text-sm font-mono text-accent">
              @{profile.username}
            </p>

            {profile.bio && (
              <p className="text-sm text-text-secondary mt-2 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}
          </div>

          {/* 4. Social Metrics Row */}
          <div className="flex flex-wrap items-center gap-5 sm:gap-6 mt-4 text-sm">
            <div className="flex items-center gap-1.5" data-testid="public-profile-followers-count">
              <span className="font-extrabold text-text-primary">{followersCount}</span>
              <span className="text-text-muted text-xs">Followers</span>
            </div>
            <div className="flex items-center gap-1.5" data-testid="public-profile-following-count">
              <span className="font-extrabold text-text-primary">{followingCount}</span>
              <span className="text-text-muted text-xs">Following</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Community Member</span>
            </div>
          </div>

          {/* 5. Metrics Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-surface-elevated/70">
            {/* Watch Time */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Watch Time</span>
                <Clock className="w-4 h-4 text-accent" />
              </div>
              <p data-testid="public-profile-watch-time" className="text-lg sm:text-xl font-extrabold text-accent font-mono">
                {formatWatchTime(combinedWatchTimeMinutes)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Series & anime</p>
            </div>

            {/* Episodes */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Episodes</span>
                <Tv className="w-4 h-4 text-purple-400" />
              </div>
              <p data-testid="public-profile-episodes-watched" className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
                {totalEpisodesWatched.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Watched total</p>
            </div>

            {/* Library Titles */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Library</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <p data-testid="public-profile-titles-count" className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
                {library.length}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Public titles</p>
            </div>

            {/* Chapters Read */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Reading</span>
                <BookOpen className="w-4 h-4 text-amber-400" />
              </div>
              <p data-testid="public-profile-chapters-read" className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
                {totalChaptersRead.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Chapters read</p>
            </div>
          </div>
        </div>
      </div>

      {/* Public Library View Section */}
      <section data-testid="public-profile-library" className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-surface-elevated">
          <div>
            <h2 className="text-xl font-extrabold text-text-primary tracking-tight">
              {profile.display_name}&apos;s Public Library
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Browse tracked movies, TV shows, anime, and manga.
            </p>
          </div>

          {/* Category Switcher */}
          {!isPrivateLibrary && (
            <div className="inline-flex items-center gap-1 p-1 bg-surface rounded-xl border border-surface-elevated text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveCategory('all')}
                data-testid="public-library-filter-all"
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'all'
                    ? 'bg-accent text-background font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All ({library.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('watch')}
                data-testid="public-library-filter-watch"
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'watch'
                    ? 'bg-accent text-background font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Watch ({tvSeriesItems.length + movieItems.length + animeItems.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory('read')}
                data-testid="public-library-filter-read"
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  activeCategory === 'read'
                    ? 'bg-accent text-background font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Read ({readingItems.length})
              </button>
            </div>
          )}
        </div>

        {/* Private Library State */}
        {isPrivateLibrary ? (
          <div
            data-testid="public-profile-private-notice"
            className="p-10 rounded-3xl bg-surface border border-surface-elevated text-center space-y-3 shadow-lg"
          >
            <div className="w-12 h-12 rounded-2xl bg-surface-elevated border border-surface-elevated flex items-center justify-center mx-auto text-text-muted">
              <Lock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">This Library is Private</h3>
            <p className="text-xs text-text-secondary max-w-sm mx-auto">
              @{profile.username} has set their library visibility to private. Only approved activity is shared.
            </p>
          </div>
        ) : (
          <>
            {/* Filter Toolbar: Status tabs & Search Input */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs font-medium">
                {(['all', 'active', 'completed', 'planned'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setActiveStatus(st)}
                    data-testid={`public-status-filter-${st}`}
                    className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer capitalize shrink-0 ${
                      activeStatus === st
                        ? 'bg-accent/15 border-accent text-accent font-bold shadow-sm'
                        : 'bg-surface border-surface-elevated text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {st === 'active' ? 'Watching / Reading' : st}
                  </button>
                ))}
              </div>

              {/* Search Within Public Library */}
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter public library..."
                  data-testid="public-library-search"
                  className="w-full pl-8 pr-3 py-1.5 bg-surface border border-surface-elevated focus:border-accent rounded-xl text-xs text-text-primary focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Empty State */}
            {filteredLibrary.length === 0 ? (
              <div
                data-testid="public-library-empty"
                className="p-10 rounded-3xl bg-surface border border-surface-elevated text-center space-y-3 shadow-md"
              >
                <div className="w-12 h-12 rounded-2xl bg-surface-elevated flex items-center justify-center mx-auto text-text-muted">
                  <Film className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-text-primary">No Titles Found</h3>
                <p className="text-xs text-text-muted max-w-sm mx-auto">
                  {searchQuery
                    ? `No titles match "${searchQuery}".`
                    : `@${profile.username} does not have any public titles under this category.`}
                </p>
              </div>
            ) : (
              /* Media Poster Grid */
              <div
                data-testid="public-library-grid"
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"
              >
                {filteredLibrary.map((item) => {
                  const isEpisodic =
                    item.title.media_type === 'tv' || item.title.media_type === 'anime_series';
                  const isReading =
                    item.title.media_type === 'manga' || item.title.media_type === 'manhwa';

                  return (
                    <div
                      key={item.id}
                      onClick={() => onSelectTitle(item.title_id)}
                      data-testid={`public-media-card-${item.id}`}
                      className="group relative rounded-2xl overflow-hidden bg-surface border border-surface-elevated hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-1 flex flex-col"
                    >
                      {/* Poster Image Container */}
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#16161D]">
                        <img
                          src={item.title.poster_url || '/assets/trackup-logo.jpg'}
                          alt={item.title.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />

                        {/* Top Status & Type Badges */}
                        <div className="absolute top-2 left-2 right-2 flex items-center justify-between gap-1 pointer-events-none">
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-background/80 backdrop-blur-md text-text-primary border border-surface-elevated">
                            {item.title.media_type.replace('_', ' ')}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full backdrop-blur-md ${
                              item.status === 'completed'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.status === 'active'
                                ? 'bg-accent/20 text-accent border border-accent/30'
                                : 'bg-surface-elevated text-text-muted border border-surface-elevated'
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>

                        {/* Bottom Rating and Progress */}
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between text-xs font-semibold pointer-events-none">
                          {item.rating !== null && item.rating !== undefined ? (
                            <span className="flex items-center gap-1 text-amber-300 font-mono text-[11px] bg-background/80 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-surface-elevated">
                              <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                              <span>{item.rating}/10</span>
                            </span>
                          ) : (
                            <span />
                          )}

                          <span className="text-[10px] font-mono text-text-secondary bg-background/80 backdrop-blur-md px-1.5 py-0.5 rounded-md border border-surface-elevated">
                            {isEpisodic && (item.status === 'completed' ? `${item.title.total_episodes || item.episodes_watched?.length || 1} eps` : `${item.episodes_watched?.length || 0} eps`)}
                            {isReading && `Ch. ${item.last_chapter_read || 0}`}
                            {!isEpisodic && !isReading && item.status}
                          </span>
                        </div>
                      </div>

                      {/* Title Info */}
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <h4 className="text-xs font-bold text-text-primary truncate group-hover:text-accent transition-colors">
                          {item.title.title}
                        </h4>
                        <div className="flex items-center justify-between mt-1 text-[11px] text-text-muted">
                          <span>{item.title.release_year || '—'}</span>
                          {item.title.genres && item.title.genres[0] && (
                            <span className="truncate max-w-[90px]">{item.title.genres[0]}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
};
