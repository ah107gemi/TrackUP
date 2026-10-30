import React, { useRef, useState, useEffect } from 'react';
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
  X,
  Lock,
  ChevronRight,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../stores/uiStore';
import { useUserLibrary } from '../library/useLibrary';
import { uploadAvatarImage } from '../../lib/avatarUpload';
import { uploadBannerImage, isVideoBanner } from '../../lib/bannerUpload';
import { BannerCropperModal } from './BannerCropperModal';
import { BannerLibrarySelector } from './BannerLibrarySelector';
import {
  fetchUserFavorites,
  filterFavoritesByCategory,
  type FavoriteItem,
  type FavoriteCategory,
} from '../favorites/favoritesService';
import { CategoryFavoritesView } from '../favorites/CategoryFavoritesView';
import { formatWatchTime } from '../../lib/dateUtils';
import { supabase } from '../../lib/supabase';
import { clearUserLibrary } from '../library/libraryService';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { getStoredFollows, MOCK_COMMUNITY_PROFILES } from '../social/socialService';

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

  // Dedicated Edit Profile state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Background Banner state
  const [editBannerUrl, setEditBannerUrl] = useState<string | null>(null);
  const [bannerTab, setBannerTab] = useState<'upload' | 'library'>('upload');
  const [bannerUploading, setBannerUploading] = useState(false);
  const [bannerUploadError, setBannerUploadError] = useState<string | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  // Cached banner retrieval for resilient hydration on mobile browsers / hard-refreshes
  const getCachedBanner = (): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      if (user?.id) {
        const direct = localStorage.getItem(`trackup_banner_${user.id}`);
        if (direct) return direct;
      }
      const profiles = JSON.parse(localStorage.getItem('trackup_mock_profiles') || '{}');
      if (user?.id && profiles[user.id]?.banner_url) {
        return profiles[user.id].banner_url;
      }
      const sessionStr = localStorage.getItem('trackup_mock_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.banner_url) return session.banner_url;
      }
    } catch {
      // Safe fallback on storage/quota errors
    }
    return null;
  };

  const [activeBannerUrl, setActiveBannerUrl] = useState<string | null>(() => {
    return profile?.banner_url || getCachedBanner();
  });

  useEffect(() => {
    if (profile?.banner_url) {
      setActiveBannerUrl(profile.banner_url);
      try {
        if (user?.id) {
          localStorage.setItem(`trackup_banner_${user.id}`, profile.banner_url);
        }
      } catch {}
    } else if (profile && profile.banner_url === null) {
      setActiveBannerUrl(null);
      try {
        if (user?.id) {
          localStorage.removeItem(`trackup_banner_${user.id}`);
        }
      } catch {}
    } else {
      const cached = getCachedBanner();
      if (cached) {
        setActiveBannerUrl(cached);
      }
    }
  }, [profile?.banner_url, profile, user?.id]);

  const effectiveBanner = activeBannerUrl || profile?.banner_url || getCachedBanner();

  // Cached avatar retrieval for resilient hydration on mobile browsers / hard-refreshes
  const getCachedAvatar = (): string | null => {
    try {
      if (typeof window === 'undefined') return null;
      if (user?.id) {
        const direct = localStorage.getItem(`trackup_avatar_${user.id}`);
        if (direct) return direct;
      }
      const profiles = JSON.parse(localStorage.getItem('trackup_mock_profiles') || '{}');
      if (user?.id && profiles[user.id]?.avatar_url) {
        return profiles[user.id].avatar_url;
      }
      const sessionStr = localStorage.getItem('trackup_mock_session');
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        if (session?.avatar_url) return session.avatar_url;
      }
    } catch {
      // Safe fallback on storage/quota errors
    }
    return null;
  };

  const [activeAvatarUrl, setActiveAvatarUrl] = useState<string | null>(() => {
    return profile?.avatar_url || getCachedAvatar();
  });

  useEffect(() => {
    if (profile?.avatar_url) {
      setActiveAvatarUrl(profile.avatar_url);
      try {
        if (user?.id) {
          localStorage.setItem(`trackup_avatar_${user.id}`, profile.avatar_url);
        }
      } catch {}
    } else if (profile && profile.avatar_url === null) {
      setActiveAvatarUrl(null);
      try {
        if (user?.id) {
          localStorage.removeItem(`trackup_avatar_${user.id}`);
        }
      } catch {}
    } else {
      const cached = getCachedAvatar();
      if (cached) {
        setActiveAvatarUrl(cached);
      }
    }
  }, [profile?.avatar_url, profile, user?.id]);

  const effectiveAvatar = activeAvatarUrl || profile?.avatar_url || getCachedAvatar();

  // Social metrics state (Followers & Following counts)
  const [socialStats, setSocialStats] = useState<{ followers: number; following: number }>({
    followers: 0,
    following: 0,
  });

  useEffect(() => {
    if (!user?.id) return;
    const loadSocial = async () => {
      try {
        const follows = getStoredFollows();
        let followers = follows.filter((f) => f.following_id === user.id).length;
        let following = follows.filter((f) => f.follower_id === user.id).length;

        const mockP = MOCK_COMMUNITY_PROFILES.find(
          (p) => p.id === user.id || p.username.toLowerCase() === user.username.toLowerCase()
        );
        if (mockP) {
          followers = Math.max(followers, mockP.follower_count || 0);
          following = Math.max(following, mockP.following_count || 0);
        }

        try {
          const [fRes, gRes] = await Promise.all([
            supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
            supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
          ]);
          if (fRes.count !== null && fRes.count !== undefined) followers = Math.max(followers, fRes.count);
          if (gRes.count !== null && gRes.count !== undefined) following = Math.max(following, gRes.count);
        } catch {}

        setSocialStats({ followers, following });
      } catch {}
    };
    loadSocial();
  }, [user?.id, user?.username]);

  // Dedicated Library Selector & Image Cropper state
  const [isLibrarySelectorOpen, setIsLibrarySelectorOpen] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Change Password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Dedicated Favorites Category State & URL Route Synchronization
  const [selectedFavoriteCategory, setSelectedFavoriteCategory] = useState<FavoriteCategory | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    if (user?.id) {
      fetchUserFavorites(user.id).then(setFavorites);
    }
  }, [user?.id]);

  useEffect(() => {
    const parseUrlCategory = () => {
      const hash = window.location.hash || '';
      const pathname = window.location.pathname || '';
      const target = hash.startsWith('#') ? hash.slice(1) : pathname;
      const match = target.match(/\/profile\/favorites\/(tv|movie|anime|reading)/i);
      if (match && match[1]) {
        setSelectedFavoriteCategory(match[1].toLowerCase() as FavoriteCategory);
      } else if (target.includes('/profile') && !target.includes('/favorites/')) {
        setSelectedFavoriteCategory(null);
      }
    };

    parseUrlCategory();
    window.addEventListener('popstate', parseUrlCategory);
    window.addEventListener('hashchange', parseUrlCategory);
    return () => {
      window.removeEventListener('popstate', parseUrlCategory);
      window.removeEventListener('hashchange', parseUrlCategory);
    };
  }, []);

  const handleSelectCategory = (cat: FavoriteCategory) => {
    setSelectedFavoriteCategory(cat);
    window.history.pushState({}, '', `#/profile/favorites/${cat}`);
  };

  const handleBackFromFavorites = () => {
    setSelectedFavoriteCategory(null);
    window.history.pushState({}, '', '#/profile');
    if (user?.id) {
      fetchUserFavorites(user.id).then(setFavorites);
    }
  };

  const { data: library = [] } = useUserLibrary(user?.id);

  if (!user) return null;

  if (selectedFavoriteCategory) {
    return (
      <CategoryFavoritesView
        userId={user.id}
        category={selectedFavoriteCategory}
        onBack={handleBackFromFavorites}
        onSelectTitle={onSelectTitle}
      />
    );
  }

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

    setActiveAvatarUrl(url);
    try {
      localStorage.setItem(`trackup_avatar_${user.id}`, url);
    } catch {}
    await updateProfile({ avatar_url: url });
    setUploading(false);
  };

  const handleOpenEditProfile = () => {
    setEditName(profile?.display_name || profile?.full_name || user.username || '');
    setEditUsername(profile?.username || user.username || '');
    setEditBannerUrl(effectiveBanner || null);
    setBannerTab('upload');
    setBannerUploadError(null);
    setEditError(null);
    setIsEditingProfile(true);
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so user can re-select the same file if needed
    e.target.value = '';

    setBannerUploadError(null);

    // Enforce 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      setBannerUploadError('Banner file size must be under 10MB');
      return;
    }

    const isVideo =
      file.type.startsWith('video/') ||
      file.name.toLowerCase().endsWith('.mp4') ||
      file.name.toLowerCase().endsWith('.webm');

    if (isVideo) {
      setBannerUploading(true);
      const { url, error } = await uploadBannerImage(file, user.id);
      if (error || !url) {
        setBannerUploadError(error || 'Failed to upload video banner');
        setBannerUploading(false);
        return;
      }

      setEditBannerUrl(url);
      setActiveBannerUrl(url);
      try {
        localStorage.setItem(`trackup_banner_${user.id}`, url);
      } catch {}
      await updateProfile({ banner_url: url });
      setBannerUploading(false);
      return;
    }

    // Static image / GIF: open interactive cropper modal
    const objectUrl = URL.createObjectURL(file);
    setCropperImageSrc(objectUrl);
    setPendingCropFile(file);
    setIsCropperOpen(true);
  };

  const handleConfirmCrop = async (croppedFile: File) => {
    setBannerUploading(true);
    setBannerUploadError(null);

    const { url, error } = await uploadBannerImage(croppedFile, user.id);
    if (error || !url) {
      setBannerUploadError(error || 'Failed to upload cropped banner');
      setBannerUploading(false);
      return;
    }

    setEditBannerUrl(url);
    setActiveBannerUrl(url);
    try {
      localStorage.setItem(`trackup_banner_${user.id}`, url);
    } catch {}
    await updateProfile({ banner_url: url });
    setBannerUploading(false);

    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }
    setPendingCropFile(null);
  };

  const handleCloseCropper = () => {
    if (cropperImageSrc) {
      URL.revokeObjectURL(cropperImageSrc);
      setCropperImageSrc(null);
    }
    setPendingCropFile(null);
    setIsCropperOpen(false);
  };

  const handleSelectBackdropUrl = async (url: string) => {
    setEditBannerUrl(url);
    setActiveBannerUrl(url);
    try {
      localStorage.setItem(`trackup_banner_${user.id}`, url);
    } catch {}
    await updateProfile({ banner_url: url });
  };

  const handleRemoveBanner = async () => {
    setEditBannerUrl(null);
    setActiveBannerUrl(null);
    try {
      localStorage.removeItem(`trackup_banner_${user.id}`);
    } catch {}
    await updateProfile({ banner_url: null });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);

    const cleanName = editName.trim();
    const cleanUsername = editUsername.trim().toLowerCase();

    if (!cleanName) {
      setEditError('Name cannot be empty.');
      return;
    }
    if (!cleanUsername) {
      setEditError('Username cannot be empty.');
      return;
    }
    if (cleanUsername.length < 3) {
      setEditError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setEditError('Username can only contain letters, numbers, underscores, periods, and hyphens.');
      return;
    }

    setSavingProfile(true);
    try {
      if (editBannerUrl) {
        setActiveBannerUrl(editBannerUrl);
        try {
          localStorage.setItem(`trackup_banner_${user.id}`, editBannerUrl);
        } catch {}
      } else if (editBannerUrl === null) {
        setActiveBannerUrl(null);
        try {
          localStorage.removeItem(`trackup_banner_${user.id}`);
        } catch {}
      }

      const res = await updateProfile({
        display_name: cleanName,
        full_name: cleanName,
        username: cleanUsername,
        banner_url: editBannerUrl,
      });

      if (res.error) {
        setEditError(res.error);
        return;
      }

      setIsEditingProfile(false);
    } catch (err: any) {
      setEditError(err?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
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
      {/* Profile Hero Header - Pro Max Left-Aligned Aesthetic */}
      <div
        data-testid="profile-hero-header"
        className="relative rounded-3xl overflow-hidden bg-surface border border-surface-elevated shadow-xl"
      >
        {/* 1. Distinct Full-Width Top Banner Block (Crisp image/video without heavy dark gradient) */}
        <div className="relative w-full h-48 sm:h-56 md:h-64 overflow-hidden bg-surface-elevated/40">
          {effectiveBanner ? (
            isVideoBanner(effectiveBanner) ? (
              <video
                autoPlay
                loop
                muted
                playsInline
                data-testid="profile-banner-video"
                className="w-full h-full object-cover"
                src={effectiveBanner}
              >
                <source
                  src={effectiveBanner}
                  type={effectiveBanner.toLowerCase().includes('.webm') ? 'video/webm' : 'video/mp4'}
                />
              </video>
            ) : (
              <img
                src={effectiveBanner}
                alt="Profile banner"
                data-testid="profile-banner-image"
                className="w-full h-full object-cover"
              />
            )
          ) : (
            <div
              data-testid="profile-banner-fallback"
              className="w-full h-full bg-gradient-to-r from-surface via-surface-elevated to-surface"
            />
          )}
        </div>

        {/* 2. Hero Content Section with Overlapping Avatar */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          {/* Avatar and Action Controls Row */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Left-Aligned Overlapping Circular Avatar */}
            <div className="relative group shrink-0 ml-1 sm:ml-0">
              <div
                data-testid="profile-avatar-container"
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-surface-elevated border-4 border-background shadow-2xl flex items-center justify-center relative ring-2 ring-accent/30"
              >
                {effectiveAvatar ? (
                  <img
                    src={effectiveAvatar}
                    alt={profile?.display_name || user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 sm:w-16 sm:h-16 text-accent" />
                )}

                {/* Hover upload overlay */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="avatar-upload-trigger"
                  aria-label="Upload profile picture"
                  className="absolute inset-0 bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-accent font-semibold text-xs gap-1 cursor-pointer rounded-full"
                >
                  <Camera className="w-5 h-5 sm:w-6 sm:h-6" />
                  <span className="text-[10px] sm:text-xs">{uploading ? 'Uploading...' : 'Change Photo'}</span>
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

            {/* Top-Right Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-end">
              <button
                type="button"
                onClick={handleOpenEditProfile}
                data-testid="edit-profile-btn"
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow-md cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={() => setIsChangePasswordOpen(true)}
                data-testid="change-password-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-all shadow-sm cursor-pointer"
                title="Change Password"
              >
                <Lock className="w-3.5 h-3.5 text-accent" />
                <span>Change Password</span>
              </button>
              <button
                type="button"
                onClick={() => setProfileModalOpen(true)}
                data-testid="open-settings-btn"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-all shadow-sm cursor-pointer"
                title="Preferences & Settings"
              >
                <span>Settings</span>
              </button>
            </div>
          </div>

          {/* 3. User Details: Left-aligned Display Name and @username */}
          <div className="text-left space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {profile?.display_name || user.username}
            </h1>
            <p className="text-sm font-mono text-accent">@{user.username}</p>

            {profile?.bio && (
              <p className="text-sm text-text-secondary mt-2 max-w-2xl leading-relaxed">
                {profile.bio}
              </p>
            )}

            {uploadError && (
              <p className="text-xs text-status-dropped mt-2 font-medium">{uploadError}</p>
            )}
          </div>

          {/* 4. Social Metrics: Followers & Following in a clean, left-aligned horizontal row */}
          <div className="flex flex-wrap items-center gap-5 sm:gap-6 mt-4 text-sm">
            <div className="flex items-center gap-1.5" data-testid="profile-followers-count">
              <span className="font-extrabold text-text-primary">{socialStats.followers}</span>
              <span className="text-text-muted text-xs">Followers</span>
            </div>
            <div className="flex items-center gap-1.5" data-testid="profile-following-count">
              <span className="font-extrabold text-text-primary">{socialStats.following}</span>
              <span className="text-text-muted text-xs">Following</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
              <Calendar className="w-3.5 h-3.5 text-accent" />
              <span>Joined {new Date().getFullYear()}</span>
            </div>
          </div>

          {/* 5. Premium Stat Cards: Watch Time, Episodes, Library, Chapters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-surface-elevated/70">
            {/* Watch Time Card */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 hover:border-accent/30 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Watch Time</span>
                <Clock className="w-4 h-4 text-accent" />
              </div>
              <p data-testid="global-watch-time" className="text-lg sm:text-xl font-extrabold text-accent font-mono">
                {formatWatchTime(combinedWatchTimeMinutes)}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Series & anime</p>
            </div>

            {/* Episodes Watched Card */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 hover:border-purple-500/30 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Episodes</span>
                <Tv className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
                {totalEpisodesWatched.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Watched total</p>
            </div>

            {/* Library Titles Card */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 hover:border-status-completed/30 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">In Library</span>
                <CheckCircle2 className="w-4 h-4 text-status-completed" />
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
                {library.length.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Tracked titles</p>
            </div>

            {/* Chapters Read Card */}
            <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated/80 hover:border-emerald-500/30 transition-all shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wider">Reading</span>
                <BookOpen className="w-4 h-4 text-emerald-400" />
              </div>
              <p className="text-lg sm:text-xl font-extrabold text-text-primary font-mono">
                {totalChaptersRead.toLocaleString()}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">Chapters read</p>
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

      {/* Category Favorites Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Favorite Collections
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Explore your top pinned titles across specialized media categories
            </p>
          </div>
          <span className="text-xs font-mono text-accent bg-accent/10 border border-accent/20 px-2.5 py-1 rounded-lg">
            {favorites.length} Pinned Total
          </span>
        </div>

        {/* 4 Clickable Category Tiles */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. TV Shows */}
          <button
            type="button"
            onClick={() => handleSelectCategory('tv')}
            data-testid="favorite-category-tv"
            className="group relative p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-purple-500/50 hover:bg-surface-elevated/70 text-left transition-all duration-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 group-hover:scale-110 transition-transform">
                <Tv className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                {filterFavoritesByCategory(favorites, 'tv').length}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-bold text-text-primary group-hover:text-purple-400 transition-colors">
                Favorite TV Shows
              </h3>
              <p className="text-xs text-text-muted mt-1 line-clamp-1">
                Top television series & shows
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-elevated flex items-center justify-between text-xs text-purple-400 font-semibold">
              <span>View Collection</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* 2. Movies */}
          <button
            type="button"
            onClick={() => handleSelectCategory('movie')}
            data-testid="favorite-category-movie"
            className="group relative p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-blue-500/50 hover:bg-surface-elevated/70 text-left transition-all duration-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 group-hover:scale-110 transition-transform">
                <Film className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                {filterFavoritesByCategory(favorites, 'movie').length}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-bold text-text-primary group-hover:text-blue-400 transition-colors">
                Favorite Movies
              </h3>
              <p className="text-xs text-text-muted mt-1 line-clamp-1">
                Top cinema & feature films
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-elevated flex items-center justify-between text-xs text-blue-400 font-semibold">
              <span>View Collection</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* 3. Anime */}
          <button
            type="button"
            onClick={() => handleSelectCategory('anime')}
            data-testid="favorite-category-anime"
            className="group relative p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/50 hover:bg-surface-elevated/70 text-left transition-all duration-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-accent/15 border border-accent/30 text-accent group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30">
                {filterFavoritesByCategory(favorites, 'anime').length}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-bold text-text-primary group-hover:text-accent transition-colors">
                Favorite Anime
              </h3>
              <p className="text-xs text-text-muted mt-1 line-clamp-1">
                Top anime series & movies
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-elevated flex items-center justify-between text-xs text-accent font-semibold">
              <span>View Collection</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          {/* 4. Manga & Manhwa */}
          <button
            type="button"
            onClick={() => handleSelectCategory('reading')}
            data-testid="favorite-category-reading"
            className="group relative p-5 rounded-2xl bg-surface border border-surface-elevated hover:border-cyan-500/50 hover:bg-surface-elevated/70 text-left transition-all duration-200 shadow-sm hover:shadow-xl hover:-translate-y-0.5 cursor-pointer flex flex-col justify-between"
          >
            <div className="flex items-start justify-between">
              <div className="p-3 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 group-hover:scale-110 transition-transform">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                {filterFavoritesByCategory(favorites, 'reading').length}
              </span>
            </div>
            <div className="mt-4">
              <h3 className="text-sm font-bold text-text-primary group-hover:text-cyan-400 transition-colors">
                Favorite Manga & Manhwa
              </h3>
              <p className="text-xs text-text-muted mt-1 line-clamp-1">
                Top Japanese Manga & Korean Manhwa
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-surface-elevated flex items-center justify-between text-xs text-cyan-400 font-semibold">
              <span>View Collection</span>
              <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
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

      {/* Edit Profile Modal (Name & Username) */}
      {isEditingProfile && (
        <div
          data-testid="edit-profile-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsEditingProfile(false)}
        >
          <div
            className="w-full max-w-lg max-h-[92vh] overflow-y-auto bg-surface border border-surface-elevated rounded-2xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-elevated">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Edit Profile</h2>
                  <p className="text-xs text-text-muted">Update your display name, username, and banner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(false)}
                data-testid="edit-profile-close-btn"
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              {editError && (
                <div
                  data-testid="edit-profile-error"
                  className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium"
                >
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Full Name / Display Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g. Elena Tracker"
                  data-testid="edit-profile-name-input"
                  className="w-full px-3.5 py-2.5 bg-surface-elevated border border-surface-elevated focus:border-accent rounded-xl text-text-primary text-sm focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1">
                  Username (@handle)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-sm font-mono">@</span>
                  <input
                    type="text"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    placeholder="username"
                    data-testid="edit-profile-username-input"
                    className="w-full pl-8 pr-3.5 py-2.5 bg-surface-elevated border border-surface-elevated focus:border-accent rounded-xl text-text-primary text-sm font-mono focus:outline-none transition-colors"
                  />
                </div>
                <p className="text-[11px] text-text-muted mt-1">
                  Used by friends to search and follow your profile.
                </p>
              </div>

              {/* Background Banner Section */}
              <div data-testid="edit-banner-section" className="pt-2 border-t border-surface-elevated space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-text-secondary">
                    Background Banner
                  </label>
                  {editBannerUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveBanner}
                      data-testid="remove-banner-btn"
                      className="text-[11px] font-medium text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    >
                      Reset to Default
                    </button>
                  )}
                </div>

                {/* Banner Preview */}
                <div
                  data-testid="edit-banner-preview"
                  className="relative w-full h-24 rounded-xl overflow-hidden border border-surface-elevated bg-surface-elevated flex items-center justify-center"
                >
                  {editBannerUrl ? (
                    <>
                      {isVideoBanner(editBannerUrl) ? (
                        <video
                          autoPlay
                          loop
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                          src={editBannerUrl}
                        />
                      ) : (
                        <img
                          src={editBannerUrl}
                          alt="Banner Preview"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-background/70 to-transparent pointer-events-none" />
                      <span className="absolute bottom-2 left-3 text-[10px] font-semibold text-text-primary px-2 py-0.5 rounded bg-background/70 backdrop-blur-sm pointer-events-none">
                        {isVideoBanner(editBannerUrl) ? 'Active Video Banner' : 'Active Banner'}
                      </span>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-surface via-surface-elevated to-surface text-text-muted text-xs">
                      <ImageIcon className="w-5 h-5 mb-1 text-text-muted/60" />
                      <span className="text-[11px]">Default Gradient Banner</span>
                    </div>
                  )}
                </div>

                {/* Dual Option Switcher Tabs */}
                <div className="flex items-center p-1 rounded-xl bg-surface-elevated border border-surface-elevated text-xs font-medium">
                  <button
                    type="button"
                    onClick={() => setBannerTab('upload')}
                    data-testid="banner-tab-upload"
                    className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      bannerTab === 'upload'
                        ? 'bg-accent text-background font-bold shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload Media</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerTab('library')}
                    data-testid="banner-tab-library"
                    className={`flex-1 py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      bannerTab === 'library'
                        ? 'bg-accent text-background font-bold shadow-sm'
                        : 'text-text-muted hover:text-text-primary'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" />
                    <span>Choose from Library</span>
                  </button>
                </div>

                {/* Option A: Upload Media (Images, GIFs, Videos with Pan & Zoom Cropping) */}
                {bannerTab === 'upload' && (
                  <div className="space-y-2">
                    <input
                      ref={bannerFileInputRef}
                      type="file"
                      accept="image/*, video/mp4, video/webm"
                      data-testid="banner-file-input"
                      className="hidden"
                      onChange={handleBannerFileChange}
                    />

                    <div
                      onClick={() => bannerFileInputRef.current?.click()}
                      data-testid="banner-upload-trigger"
                      className="p-4 border border-dashed border-surface-elevated hover:border-accent rounded-xl bg-surface-elevated/40 hover:bg-surface-elevated/70 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                    >
                      <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                        <Upload className="w-4 h-4" />
                      </div>
                      <div className="text-center">
                        <p className="text-xs font-semibold text-text-primary">
                          {bannerUploading ? 'Uploading Media...' : 'Click to Upload Image or Video'}
                        </p>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Pan, zoom & crop images, or upload animated GIFs & MP4/WebM videos (up to 10MB)
                        </p>
                      </div>
                    </div>

                    {bannerUploadError && (
                      <p data-testid="banner-upload-error" className="text-xs text-rose-400 font-medium">
                        {bannerUploadError}
                      </p>
                    )}
                  </div>
                )}

                {/* Option B: Choose from Library (Dedicated Full-Screen Selection Window) */}
                {bannerTab === 'library' && (
                  <div className="space-y-3">
                    <div className="p-4 rounded-2xl bg-surface-elevated/40 border border-surface-elevated space-y-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center shrink-0">
                          <Film className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-text-primary">
                            Cinematic Library Backdrops
                          </h4>
                          <p className="text-[11px] text-text-muted mt-0.5">
                            Open the dedicated high-resolution selector to pick from your tracked TV shows, movies, and anime.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsLibrarySelectorOpen(true)}
                        data-testid="browse-library-banner-btn"
                        className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        <Film className="w-4 h-4" />
                        <span>Browse My Library ({library.length} Titles)</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-surface-elevated flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  data-testid="edit-profile-cancel-btn"
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  data-testid="edit-profile-submit-btn"
                  className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover disabled:opacity-50 text-background font-bold text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  {savingProfile ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dedicated Library Backdrop Selector Window */}
      <BannerLibrarySelector
        isOpen={isLibrarySelectorOpen}
        onClose={() => setIsLibrarySelectorOpen(false)}
        onSelectBackdrop={handleSelectBackdropUrl}
        library={library}
        selectedBannerUrl={editBannerUrl}
      />

      {/* Image Cropper Modal */}
      <BannerCropperModal
        isOpen={isCropperOpen}
        imageSrc={cropperImageSrc}
        fileName={pendingCropFile?.name}
        fileType={pendingCropFile?.type}
        onClose={handleCloseCropper}
        onConfirmCrop={handleConfirmCrop}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
};
