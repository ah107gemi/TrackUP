import React, { useRef, useState, useEffect, useMemo } from 'react';
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
  Star,
  Search,
  ArrowLeft,
  UserPlus,
  UserCheck,
  UserMinus,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useUIStore } from '../../stores/uiStore';
import { useUserLibrary } from '../library/useLibrary';
import { uploadAvatarImage } from '../../lib/avatarUpload';
import { uploadBannerImage, isVideoBanner } from '../../lib/bannerUpload';
import { BannerCropperModal } from './BannerCropperModal';
import { AvatarCropperModal } from './AvatarCropperModal';
import { BannerLibrarySelector } from './BannerLibrarySelector';
import {
  fetchUserFavorites,
  filterFavoritesByCategory,
  type FavoriteItem,
  type FavoriteCategory,
} from '../favorites/favoritesService';
import { CategoryFavoritesView } from '../favorites/CategoryFavoritesView';
import { formatWatchTime } from '../../lib/dateUtils';
import { resolvePosterUrl } from '../../lib/imageUtils';
import { supabase } from '../../lib/supabase';
import { clearUserLibrary } from '../library/libraryService';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import {
  getStoredFollows,
  followUser,
  unfollowUser,
  MOCK_COMMUNITY_PROFILES,
} from '../social/socialService';
import type { SocialProfile } from '../social/types';
import type { TrackingStatus } from '../../types/database.types';

export interface ProfilePageProps {
  userId?: string;
  userParam?: string;
  onSelectTitle?: (titleId: string) => void;
  onBack?: () => void;
}

/**
 * Extracts visited user identifier from URL parameters:
 *  - Query parameters: ?user=:id or ?userId=:id (from window.location.search or hash query)
 *  - Route patterns: #/user/:param or #/profile/:param or /user/:param or /profile/:param
 */
function extractUserFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  // 1. Search params from window.location.search (?user=..., ?userId=...)
  const searchParams = new URLSearchParams(window.location.search);
  const queryUser = searchParams.get('user') || searchParams.get('userId');
  if (queryUser) return queryUser.trim();

  // 2. Hash query parameters (#/profile?user=..., #/user?user=...)
  const hash = window.location.hash || '';
  if (hash.includes('?')) {
    const hashParams = new URLSearchParams(hash.slice(hash.indexOf('?')));
    const hashUser = hashParams.get('user') || hashParams.get('userId');
    if (hashUser) return hashUser.trim();
  }

  // 3. Hash route segment: #/user/:param or #/profile/:param
  const hashClean = hash.startsWith('#') ? hash.slice(1).split('?')[0] : hash.split('?')[0];
  const userMatch = hashClean.match(/^\/(?:user|profile)\/([^/?#]+)/i);
  if (userMatch && userMatch[1]) {
    const seg = decodeURIComponent(userMatch[1]).trim();
    if (!['favorites', 'settings', 'edit'].includes(seg.toLowerCase())) {
      return seg;
    }
  }

  // 4. Pathname route segment: /user/:param or /profile/:param
  const pathname = window.location.pathname || '';
  const pathMatch = pathname.match(/^\/(?:user|profile)\/([^/?#]+)/i);
  if (pathMatch && pathMatch[1]) {
    const seg = decodeURIComponent(pathMatch[1]).trim();
    if (!['favorites', 'settings', 'edit'].includes(seg.toLowerCase())) {
      return seg;
    }
  }

  return null;
}

export const ProfilePage: React.FC<ProfilePageProps> = ({
  userId: propUserId,
  userParam: propUserParam,
  onSelectTitle,
  onBack,
}) => {
  const { user, profile, updateProfile, signOut } = useAuth();
  const { setProfileModalOpen, setAuthModalOpen } = useUIStore();
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

  // URL route & parameter tracking
  const [urlUserParam, setUrlUserParam] = useState<string | null>(() => extractUserFromUrl());

  useEffect(() => {
    const handleUrlChange = () => {
      setUrlUserParam(extractUserFromUrl());
    };
    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  const rawTargetParam = propUserParam || propUserId || urlUserParam;
  const cleanTargetParam = rawTargetParam ? rawTargetParam.trim().replace(/^@/, '') : null;

  // Determine if viewing own profile
  const isOwnProfile = useMemo(() => {
    if (!cleanTargetParam) return true;
    if (!user) return false;
    const targetLower = cleanTargetParam.toLowerCase();
    if (user.id.toLowerCase() === targetLower) return true;
    if (user.username && user.username.toLowerCase() === targetLower) return true;
    if (profile?.username && profile.username.toLowerCase() === targetLower) return true;
    return false;
  }, [cleanTargetParam, user, profile?.username]);

  // Visited profile state
  const [visitedProfile, setVisitedProfile] = useState<SocialProfile | null>(null);
  const [isResolvingProfile, setIsResolvingProfile] = useState<boolean>(!isOwnProfile);
  const [profileNotFound, setProfileNotFound] = useState<boolean>(false);

  // Resolve visited public user profile
  useEffect(() => {
    if (isOwnProfile) {
      setVisitedProfile(null);
      setIsResolvingProfile(false);
      setProfileNotFound(false);
      return;
    }

    if (!cleanTargetParam) {
      setIsResolvingProfile(false);
      return;
    }

    let active = true;
    setIsResolvingProfile(true);
    setProfileNotFound(false);

    const resolveProfile = async () => {
      let resolved: SocialProfile | null = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanTargetParam);

      // 1. Supabase live profile query
      try {
        const isLocalSupabase =
          !import.meta.env.VITE_SUPABASE_URL ||
          import.meta.env.VITE_SUPABASE_URL.includes('127.0.0.1') ||
          import.meta.env.VITE_SUPABASE_URL.includes('localhost');
        const timeoutMs = isLocalSupabase ? 400 : 3000;

        let q = supabase
          .from('profiles')
          .select('id, username, display_name, full_name, avatar_url, banner_url, bio, library_visibility, activity_visibility, created_at');

        if (isUuid) {
          q = q.or(`id.eq.${cleanTargetParam},username.ilike.${cleanTargetParam}`);
        } else {
          q = q.ilike('username', cleanTargetParam);
        }

        const res: any = await Promise.race([
          q.maybeSingle(),
          new Promise<any>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
        ]);

        if (!res?.error && res?.data) {
          const p = res.data;
          resolved = {
            id: p.id,
            username: p.username || cleanTargetParam,
            display_name: p.display_name || p.full_name || p.username || cleanTargetParam,
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
        // Fallback to local fixtures
      }

      // 2. Curated mock community profiles
      if (!resolved) {
        const mockMatch = MOCK_COMMUNITY_PROFILES.find(
          (p) =>
            p.username.toLowerCase() === cleanTargetParam.toLowerCase() ||
            p.id.toLowerCase() === cleanTargetParam.toLowerCase()
        );
        if (mockMatch) {
          resolved = { ...mockMatch };
        }
      }

      // 3. Dynamically registered browser profiles from localStorage
      if (!resolved) {
        try {
          const dynamicProfiles: Record<string, any> = JSON.parse(
            localStorage.getItem('trackup_mock_profiles') || '{}'
          );
          const found = Object.values(dynamicProfiles).find(
            (p: any) =>
              p.username?.toLowerCase() === cleanTargetParam.toLowerCase() ||
              p.id?.toLowerCase() === cleanTargetParam.toLowerCase()
          );
          if (found) {
            resolved = {
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

      if (!active) return;

      if (resolved) {
        setVisitedProfile(resolved);
        setProfileNotFound(false);
      } else {
        setProfileNotFound(true);
      }
      setIsResolvingProfile(false);
    };

    resolveProfile();

    return () => {
      active = false;
    };
  }, [cleanTargetParam, isOwnProfile]);

  // Target User identity resolution: Uses visited user's ID for public viewing!
  const effectiveUserId = isOwnProfile
    ? user?.id
    : (visitedProfile?.id || (cleanTargetParam && /^[0-9a-f-]{36}$/i.test(cleanTargetParam) ? cleanTargetParam : undefined));
  const effectiveProfile = isOwnProfile ? profile : visitedProfile;
  const effectiveDisplayName = isOwnProfile
    ? (profile?.display_name || user?.username || 'Tracker')
    : (visitedProfile?.display_name || visitedProfile?.username || cleanTargetParam || 'Tracker');
  const effectiveUsername = isOwnProfile
    ? (user?.username || profile?.username || '')
    : (visitedProfile?.username || cleanTargetParam || '');
  const effectiveBio = isOwnProfile ? profile?.bio : visitedProfile?.bio;

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
    if (!isOwnProfile) return;
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
  }, [profile?.banner_url, profile, user?.id, isOwnProfile]);

  const effectiveBanner = isOwnProfile
    ? (activeBannerUrl || profile?.banner_url || getCachedBanner())
    : (visitedProfile?.banner_url || null);

  // Cached avatar retrieval for resilient hydration
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

  const setSafeAvatarUrl = (nextUrl: string | null | ((prev: string | null) => string | null)) => {
    setActiveAvatarUrl((prev) => {
      const resolved = typeof nextUrl === 'function' ? nextUrl(prev) : nextUrl;
      if (!resolved && prev) {
        return prev;
      }
      return resolved;
    });
  };

  useEffect(() => {
    if (!isOwnProfile) return;
    if (profile?.avatar_url) {
      setSafeAvatarUrl(profile.avatar_url);
      try {
        if (user?.id) {
          localStorage.setItem(`trackup_avatar_${user.id}`, profile.avatar_url);
        }
      } catch {}
    } else {
      const cached = getCachedAvatar();
      if (cached) {
        setSafeAvatarUrl(cached);
        if (user?.id && profile && !profile.avatar_url) {
          (async () => {
            try {
              await supabase
                .from('profiles')
                // @ts-expect-error dynamic typing
                .update({ avatar_url: cached, updated_at: new Date().toISOString() })
                .eq('id', user.id);
            } catch (err) {
              console.warn('[AvatarHydration] Silent healing failed:', err);
            }
          })();
        }
      }
    }
  }, [profile?.avatar_url, profile, user?.id, isOwnProfile]);

  const effectiveAvatar = isOwnProfile
    ? (activeAvatarUrl || profile?.avatar_url || getCachedAvatar())
    : (visitedProfile?.avatar_url || null);

  // Social metrics state (Followers & Following counts)
  const [socialStats, setSocialStats] = useState<{ followers: number; following: number }>({
    followers: 0,
    following: 0,
  });
  const [isFollowing, setIsFollowing] = useState(false);
  const [isHoveringFollow, setIsHoveringFollow] = useState(false);

  useEffect(() => {
    if (!effectiveUserId) return;
    const currentUserId = user?.id || 'guest_user';
    const loadSocial = async () => {
      try {
        const follows = getStoredFollows();
        let followers = follows.filter((f) => f.following_id === effectiveUserId).length;
        let following = follows.filter((f) => f.follower_id === effectiveUserId).length;
        const amFollowing = follows.some(
          (f) => f.follower_id === currentUserId && f.following_id === effectiveUserId
        );
        setIsFollowing(amFollowing);

        const mockP = MOCK_COMMUNITY_PROFILES.find(
          (p) => p.id === effectiveUserId || p.username.toLowerCase() === effectiveUsername.toLowerCase()
        );
        if (mockP) {
          followers = Math.max(followers, mockP.follower_count || 0);
          following = Math.max(following, mockP.following_count || 0);
        }

        try {
          const [fRes, gRes] = await Promise.all([
            supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('following_id', effectiveUserId),
            supabase.from('user_follows').select('id', { count: 'exact', head: true }).eq('follower_id', effectiveUserId),
          ]);
          if (fRes.count !== null && fRes.count !== undefined) followers = Math.max(followers, fRes.count);
          if (gRes.count !== null && gRes.count !== undefined) following = Math.max(following, gRes.count);
        } catch {}

        setSocialStats({ followers, following });
      } catch {}
    };
    loadSocial();
  }, [effectiveUserId, effectiveUsername, user?.id]);

  const handleToggleFollow = async () => {
    if (!user) {
      setAuthModalOpen(true);
      return;
    }
    if (!effectiveUserId) return;
    try {
      if (isFollowing) {
        await unfollowUser(user.id, effectiveUserId);
        setIsFollowing(false);
        setSocialStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
      } else {
        await followUser(user.id, effectiveUserId);
        setIsFollowing(true);
        setSocialStats((prev) => ({ ...prev, followers: prev.followers + 1 }));
      }
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  // Dedicated Library Selector & Image Cropper state
  const [isLibrarySelectorOpen, setIsLibrarySelectorOpen] = useState(false);
  const [isCropperOpen, setIsCropperOpen] = useState(false);
  const [cropperImageSrc, setCropperImageSrc] = useState<string | null>(null);
  const [pendingCropFile, setPendingCropFile] = useState<File | null>(null);

  // Avatar 1:1 Cropper state
  const [isAvatarCropperOpen, setIsAvatarCropperOpen] = useState(false);
  const [avatarCropperSrc, setAvatarCropperSrc] = useState<string | null>(null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);

  // Change Password state
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  // Dedicated Favorites Category State & URL Route Synchronization
  const [selectedFavoriteCategory, setSelectedFavoriteCategory] = useState<FavoriteCategory | null>(null);
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);

  useEffect(() => {
    if (effectiveUserId) {
      fetchUserFavorites(effectiveUserId).then(setFavorites);
    }
  }, [effectiveUserId]);

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
    if (effectiveUserId) {
      fetchUserFavorites(effectiveUserId).then(setFavorites);
    }
  };

  // FETCH USER LIBRARY: Fetches user_libraries data using the VISITED user's ID, NOT useAuth().user.id!
  const { data: rawLibrary = [] } = useUserLibrary(effectiveUserId);

  // Filter out private items when viewing someone else's profile
  const library = useMemo(() => {
    if (isOwnProfile) return rawLibrary;
    return rawLibrary.filter((item) => !item.is_private);
  }, [isOwnProfile, rawLibrary]);

  // Filter state for the Watched Shows & Movies showcase section
  const [libraryCategory, setLibraryCategory] = useState<'all' | 'watch' | 'read'>('all');
  const [libraryStatus, setLibraryStatus] = useState<TrackingStatus | 'all'>('all');
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');

  // Category segregation
  const tvSeriesItems = library.filter((i) => i.title.media_type === 'tv');
  const movieItems = library.filter((i) => i.title.media_type === 'movie');
  const animeItems = library.filter(
    (i) => i.title.media_type === 'anime_series' || i.title.media_type === 'anime_film'
  );
  const readingItems = library.filter(
    (i) => i.title.media_type === 'manga' || i.title.media_type === 'manhwa'
  );

  // Filtered titles for the public library showcase
  const filteredLibrary = useMemo(() => {
    return library.filter((item) => {
      if (!item || !item.title) return false;
      const type = item.title.media_type;

      if (libraryCategory === 'watch') {
        if (!['tv', 'movie', 'anime_series', 'anime_film'].includes(type)) return false;
      } else if (libraryCategory === 'read') {
        if (!['manga', 'manhwa'].includes(type)) return false;
      }

      if (libraryStatus !== 'all' && item.status !== libraryStatus) return false;

      if (librarySearchQuery.trim()) {
        const q = librarySearchQuery.toLowerCase().trim();
        const matchTitle = item.title.title?.toLowerCase().includes(q);
        const matchGenre = item.title.genres?.some((g) => g.toLowerCase().includes(q));
        if (!matchTitle && !matchGenre) return false;
      }

      return true;
    });
  }, [library, libraryCategory, libraryStatus, librarySearchQuery]);

  // Loading state when resolving public profile
  if (!isOwnProfile && isResolvingProfile) {
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

  // Not found state when visited profile doesn't exist
  if (!isOwnProfile && profileNotFound) {
    return (
      <div data-testid="public-profile-not-found" className="max-w-2xl mx-auto text-center py-16 space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-surface-elevated border border-surface-elevated flex items-center justify-center mx-auto text-accent">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">User Profile Not Found</h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto">
          The user &quot;{cleanTargetParam}&quot; could not be located in the community directory.
        </p>
        <button
          onClick={onBack || (() => { window.location.hash = '#/social'; })}
          data-testid="public-profile-back-btn"
          className="px-4 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow inline-flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Friends & Social</span>
        </button>
      </div>
    );
  }

  // Unauthenticated fallback when viewing own profile without an active session
  if (isOwnProfile && !user) {
    return (
      <div data-testid="profile-page" className="max-w-4xl mx-auto py-20 text-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-surface-elevated border border-surface-elevated flex items-center justify-center mx-auto text-accent">
          <User className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Sign In Required</h2>
        <p className="text-xs text-text-secondary max-w-sm mx-auto">
          Please sign in to view your profile, manage your tracking showcase, and update your personal settings.
        </p>
        <button
          onClick={() => setAuthModalOpen(true)}
          className="px-5 py-2.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs transition-all shadow-md inline-flex items-center gap-2 cursor-pointer"
        >
          <span>Sign In to TrackUp</span>
        </button>
      </div>
    );
  }

  if (selectedFavoriteCategory && effectiveUserId) {
    return (
      <CategoryFavoritesView
        userId={effectiveUserId}
        category={selectedFavoriteCategory}
        onBack={handleBackFromFavorites}
        onSelectTitle={onSelectTitle}
      />
    );
  }

  const handleDeleteAccount = async () => {
    if (!user) return;
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

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setUploadError(null);

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('Avatar file size must be under 10MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setAvatarCropperSrc(objectUrl);
    setPendingAvatarFile(file);
    setIsAvatarCropperOpen(true);
  };

  const handleConfirmAvatarCrop = async (croppedFile: File) => {
    if (!user) return;
    setUploading(true);
    setUploadError(null);

    const { url, error } = await uploadAvatarImage(croppedFile, user.id);
    if (error || !url) {
      setUploadError(error || 'Failed to upload cropped image');
      setUploading(false);
      return;
    }

    setSafeAvatarUrl(url);
    try {
      localStorage.setItem(`trackup_avatar_${user.id}`, url);
      const profiles = JSON.parse(localStorage.getItem('trackup_mock_profiles') || '{}');
      if (profiles[user.id]) {
        profiles[user.id].avatar_url = url;
        localStorage.setItem('trackup_mock_profiles', JSON.stringify(profiles));
      }
    } catch {}
    await updateProfile({ avatar_url: url });
    setUploading(false);
  };

  const handleCloseAvatarCropper = () => {
    setIsAvatarCropperOpen(false);
    if (avatarCropperSrc) {
      URL.revokeObjectURL(avatarCropperSrc);
      setAvatarCropperSrc(null);
    }
    setPendingAvatarFile(null);
  };

  const handleOpenEditProfile = () => {
    if (!user) return;
    setEditName(profile?.display_name || profile?.full_name || user.username || '');
    setEditUsername(profile?.username || user.username || '');
    setEditBannerUrl(effectiveBanner || null);
    setBannerTab('upload');
    setBannerUploadError(null);
    setEditError(null);
    setIsEditingProfile(true);
  };

  const handleBannerFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    setBannerUploadError(null);

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

    const objectUrl = URL.createObjectURL(file);
    setCropperImageSrc(objectUrl);
    setPendingCropFile(file);
    setIsCropperOpen(true);
  };

  const handleConfirmCrop = async (croppedFile: File) => {
    if (!user) return;
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
    if (!user) return;
    setEditBannerUrl(url);
    setActiveBannerUrl(url);
    try {
      localStorage.setItem(`trackup_banner_${user.id}`, url);
    } catch {}
    await updateProfile({ banner_url: url });
  };

  const handleRemoveBanner = async () => {
    if (!user) return;
    setEditBannerUrl(null);
    setActiveBannerUrl(null);
    try {
      localStorage.removeItem(`trackup_banner_${user.id}`);
    } catch {}
    await updateProfile({ banner_url: null });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
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

  // 3. Anime Metrics
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
  const readingTimeMinutes = Math.round(totalChaptersRead * 6);

  // Aggregate metrics
  const totalEpisodesWatched = tvEpisodesWatched + animeEpisodesWatched;
  const combinedWatchTimeMinutes = tvWatchTimeMinutes + animeWatchTimeMinutes;

  const isPrivateLibrary = !isOwnProfile && effectiveProfile?.library_visibility === 'private';

  return (
    <div data-testid="profile-page" className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Profile Hero Header */}
      <div
        data-testid="profile-hero-header"
        className="relative rounded-3xl overflow-hidden bg-surface border border-surface-elevated shadow-xl"
      >
        {/* Full-Width Top Banner Block */}
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

        {/* Hero Content Section with Overlapping Avatar */}
        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 -mt-12 sm:-mt-16 mb-4">
            {/* Circular Avatar */}
            <div className="relative group shrink-0 ml-1 sm:ml-0">
              <div
                data-testid="profile-avatar-container"
                className="w-24 h-24 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-surface-elevated border-4 border-background shadow-2xl flex items-center justify-center relative ring-2 ring-accent/30"
              >
                {effectiveAvatar ? (
                  <img
                    src={effectiveAvatar}
                    alt={effectiveDisplayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 sm:w-16 sm:h-16 text-accent" />
                )}

                {/* Owner-only hover upload overlay */}
                {isOwnProfile && user && (
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
                )}
              </div>

              {isOwnProfile && user && (
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  data-testid="avatar-file-input"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />
              )}
            </div>

            {/* Action Buttons: Owner actions OR Public follow/back actions */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-end">
              {isOwnProfile && user ? (
                <>
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
                </>
              ) : (
                <>
                  {onBack && (
                    <button
                      type="button"
                      onClick={onBack}
                      data-testid="public-profile-back-btn"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-all cursor-pointer shadow-sm"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleToggleFollow}
                    onMouseEnter={() => setIsHoveringFollow(true)}
                    onMouseLeave={() => setIsHoveringFollow(false)}
                    data-testid="follow-toggle-btn"
                    className={`inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
                      isFollowing
                        ? isHoveringFollow
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-surface-elevated text-text-primary border border-surface-elevated'
                        : 'bg-accent hover:bg-accent-hover text-background font-bold'
                    }`}
                  >
                    {isFollowing ? (
                      isHoveringFollow ? (
                        <>
                          <UserMinus className="w-3.5 h-3.5" />
                          <span>Unfollow</span>
                        </>
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5 text-accent" />
                          <span>Following</span>
                        </>
                      )
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Follow</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* User Details */}
          <div className="text-left space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
              {effectiveDisplayName}
            </h1>
            {effectiveUsername && (
              <p className="text-sm font-mono text-accent">@{effectiveUsername}</p>
            )}

            {effectiveBio && (
              <p className="text-sm text-text-secondary mt-2 max-w-2xl leading-relaxed">
                {effectiveBio}
              </p>
            )}

            {uploadError && (
              <p className="text-xs text-status-dropped mt-2 font-medium">{uploadError}</p>
            )}
          </div>

          {/* Social Metrics */}
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

          {/* Stat Cards: Watch Time, Episodes, Library, Chapters */}
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
              <p className="text-[10px] text-text-muted mt-0.5">{isOwnProfile ? 'Tracked titles' : 'Public titles'}</p>
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

      {/* Tracking Overview & Showcases */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-primary tracking-tight">
              Tracking Overview & Showcases
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              Breakdown for Series, Movies, Anime, and Manga/Manhwa.
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
              Explore top pinned titles across specialized media categories
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

      {/* Watched Shows, Movies & Reading Library Showcase */}
      <section data-testid="profile-library-section" className="space-y-6 pt-4 border-t border-surface-elevated/70">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-surface-elevated">
          <div>
            <h2 className="text-xl font-extrabold text-text-primary tracking-tight">
              {isOwnProfile ? 'My Library & Watched Titles' : `${effectiveDisplayName}'s Watched Titles & Library`}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {isOwnProfile
                ? 'All tracked movies, TV shows, anime, and manga in your collection.'
                : `Browse movies, TV shows, anime, and manga tracked by @${effectiveUsername}.`}
            </p>
          </div>

          {/* Category Switcher */}
          {!isPrivateLibrary && (
            <div className="inline-flex items-center gap-1 p-1 bg-surface rounded-xl border border-surface-elevated text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLibraryCategory('all')}
                data-testid="public-library-filter-all"
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  libraryCategory === 'all'
                    ? 'bg-accent text-background font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                All ({library.length})
              </button>
              <button
                type="button"
                onClick={() => setLibraryCategory('watch')}
                data-testid="public-library-filter-watch"
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  libraryCategory === 'watch'
                    ? 'bg-accent text-background font-bold shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Watch ({tvSeriesItems.length + movieItems.length + animeItems.length})
              </button>
              <button
                type="button"
                onClick={() => setLibraryCategory('read')}
                data-testid="public-library-filter-read"
                className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                  libraryCategory === 'read'
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
              @{effectiveUsername} has set their library visibility to private. Only approved activity is shared.
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
                    onClick={() => setLibraryStatus(st)}
                    data-testid={`public-status-filter-${st}`}
                    className={`px-3 py-1.5 rounded-xl border transition-all cursor-pointer capitalize shrink-0 ${
                      libraryStatus === st
                        ? 'bg-accent/15 border-accent text-accent font-bold shadow-sm'
                        : 'bg-surface border-surface-elevated text-text-muted hover:text-text-primary'
                    }`}
                  >
                    {st === 'active' ? 'Watching / Reading' : st}
                  </button>
                ))}
              </div>

              {/* Search Within Library */}
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search className="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={librarySearchQuery}
                  onChange={(e) => setLibrarySearchQuery(e.target.value)}
                  placeholder="Filter watched titles..."
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
                  {librarySearchQuery || libraryStatus !== 'all' || libraryCategory !== 'all'
                    ? 'No tracked titles match your active filters.'
                    : 'No public titles tracked in this library yet.'}
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
                      onClick={() => onSelectTitle?.(item.title_id)}
                      data-testid={`public-media-card-${item.id}`}
                      className="group relative rounded-2xl overflow-hidden bg-surface border border-surface-elevated hover:border-accent/40 transition-all duration-200 cursor-pointer shadow-md hover:-translate-y-1 flex flex-col"
                    >
                      {/* Poster Image Container */}
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#16161D]">
                        <img
                          src={resolvePosterUrl(item.title.poster_url || (item.title as any)?.poster_path) || '/assets/trackup-logo.jpg'}
                          alt={item.title.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = '/assets/trackup-logo.jpg';
                          }}
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

      {/* Account Settings & Danger Zone (Owner Only) */}
      {isOwnProfile && user && (
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
      )}

      {/* Edit Profile Modal (Name & Username) */}
      {isOwnProfile && isEditingProfile && (
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

              {/* Profile Picture Change Section */}
              <div
                data-testid="edit-avatar-section"
                className="flex items-center gap-4 p-3.5 rounded-2xl bg-surface-elevated/40 border border-surface-elevated"
              >
                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-surface-elevated border-2 border-accent shadow-md shrink-0 flex items-center justify-center">
                  {effectiveAvatar ? (
                    <img
                      src={effectiveAvatar}
                      alt="Profile Avatar"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <User className="w-7 h-7 text-accent" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-text-primary">Profile Picture</h4>
                  <p className="text-[11px] text-text-muted">
                    1:1 square photo with interactive circular cropping
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="edit-avatar-trigger"
                  className="px-3.5 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-text-primary text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
                >
                  <Camera className="w-3.5 h-3.5 text-accent" />
                  <span>{uploading ? 'Uploading...' : 'Change Photo'}</span>
                </button>
              </div>

              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                  {uploadError}
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

                {/* Option A: Upload Media */}
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

                {/* Option B: Choose from Library */}
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
      {isOwnProfile && (
        <BannerLibrarySelector
          isOpen={isLibrarySelectorOpen}
          onClose={() => setIsLibrarySelectorOpen(false)}
          onSelectBackdrop={handleSelectBackdropUrl}
          library={library}
          selectedBannerUrl={editBannerUrl}
        />
      )}

      {/* Image Cropper Modal */}
      {isOwnProfile && (
        <BannerCropperModal
          isOpen={isCropperOpen}
          imageSrc={cropperImageSrc}
          fileName={pendingCropFile?.name}
          fileType={pendingCropFile?.type}
          onClose={handleCloseCropper}
          onConfirmCrop={handleConfirmCrop}
        />
      )}

      {/* 1:1 Avatar Cropper Modal */}
      {isOwnProfile && (
        <AvatarCropperModal
          isOpen={isAvatarCropperOpen}
          imageSrc={avatarCropperSrc}
          fileName={pendingAvatarFile?.name}
          fileType={pendingAvatarFile?.type}
          onClose={handleCloseAvatarCropper}
          onConfirmCrop={handleConfirmAvatarCrop}
        />
      )}

      {/* Change Password Modal */}
      {isOwnProfile && (
        <ChangePasswordModal
          isOpen={isChangePasswordOpen}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}
    </div>
  );
};

export default ProfilePage;
