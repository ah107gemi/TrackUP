import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  User,
  Star,
  Sparkles,
  Loader2,
  X,
} from 'lucide-react';
import type { ActivityFeedItem } from './types';
import {
  searchUsers,
  type UserSearchResult,
} from '../profile/profileService';
import {
  getFollowingActivityFeed,
  followUser,
  unfollowUser,
} from './socialService';
import { useAuth } from '../auth/AuthContext';

interface FriendsPageProps {
  onSelectTitle?: (titleId: string) => void;
}

export const FriendsPage: React.FC<FriendsPageProps> = ({ onSelectTitle }) => {
  const { user } = useAuth();
  const activeUserId = user?.id || 'local_tracker';

  // Search & Debounce state
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [profiles, setProfiles] = useState<UserSearchResult[]>([]);

  // Feed state
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [feedMode, setFeedMode] = useState<'following' | 'all'>('following');

  // Selected Profile for "View Profile" modal
  const [selectedUserForModal, setSelectedUserForModal] = useState<UserSearchResult | null>(null);

  // 1. Debounce search query by 300ms
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // 2. Fetch users whenever debouncedQuery changes
  useEffect(() => {
    let mounted = true;

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const results = await searchUsers(debouncedQuery, activeUserId);
        if (mounted) {
          setProfiles(results);
        }
      } catch (err) {
        console.error('Error searching users:', err);
      } finally {
        if (mounted) {
          setIsSearching(false);
        }
      }
    };

    performSearch();

    return () => {
      mounted = false;
    };
  }, [debouncedQuery, activeUserId]);

  // 3. Load activity feed
  const loadFeed = async () => {
    const feed = await getFollowingActivityFeed(activeUserId, feedMode);
    setActivities(feed);
  };

  useEffect(() => {
    loadFeed();
  }, [activeUserId, feedMode]);

  // Handle follow / unfollow
  const handleToggleFollow = async (targetId: string, currentlyFollowing: boolean) => {
    if (currentlyFollowing) {
      await unfollowUser(activeUserId, targetId);
    } else {
      await followUser(activeUserId, targetId);
    }

    // Refresh current search results and feed
    setProfiles((prev) =>
      prev.map((p) => (p.id === targetId ? { ...p, is_following: !currentlyFollowing } : p))
    );
    loadFeed();
  };

  return (
    <div data-testid="social-feed-view" className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Social Header & Feed Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-surface-elevated">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Social Graph & Discovery</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Friends & Social
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Search community members, follow friends, and track viewing activity in real time.
          </p>
        </div>

        {/* Feed Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-surface-elevated shrink-0">
          <button
            onClick={() => setFeedMode('following')}
            data-testid="feed-tab-following"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              feedMode === 'following'
                ? 'bg-accent text-background shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Following
          </button>
          <button
            onClick={() => setFeedMode('all')}
            data-testid="feed-tab-all"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              feedMode === 'all'
                ? 'bg-accent text-background shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Explore All
          </button>
        </div>
      </div>

      {/* Find Friends & Member Search Section */}
      <div
        data-testid="friends-search-panel"
        className="p-5 sm:p-6 rounded-2xl bg-surface border border-surface-elevated space-y-5 shadow"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
              Find Friends & Community Members
            </h2>
          </div>
          {isSearching && (
            <span
              data-testid="friends-search-loading"
              className="flex items-center gap-1.5 text-xs text-accent font-medium animate-pulse"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Searching...</span>
            </span>
          )}
        </div>

        {/* Debounced Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by @username or name (e.g. @marcus_anime, Elena)..."
            data-testid="friends-search-input"
            aria-label="Search friends by username"
            className="w-full pl-10 pr-9 py-2.5 bg-surface-elevated border border-surface-elevated focus:border-accent rounded-xl text-text-primary text-sm focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-0.5 rounded cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Loading Skeletons */}
        {isSearching && profiles.length === 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="p-3.5 rounded-xl bg-surface-elevated/40 border border-surface-elevated flex items-center justify-between gap-3 animate-pulse"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-surface-elevated shrink-0" />
                  <div className="space-y-1.5">
                    <div className="w-24 h-3 rounded bg-surface-elevated" />
                    <div className="w-16 h-2.5 rounded bg-surface-elevated" />
                  </div>
                </div>
                <div className="w-20 h-7 rounded-lg bg-surface-elevated" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State: No Users Found */}
        {!isSearching && profiles.length === 0 && debouncedQuery.trim() !== '' && (
          <div
            data-testid="friends-search-empty"
            className="p-8 rounded-xl bg-surface-elevated/30 border border-surface-elevated text-center space-y-2.5"
          >
            <div className="w-10 h-10 rounded-full bg-surface-elevated mx-auto flex items-center justify-center text-text-muted">
              <Users className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-text-primary">
              No users found matching &quot;{debouncedQuery}&quot;
            </p>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Check for typos or try searching with a different username handle or display name.
            </p>
          </div>
        )}

        {/* Member Cards Grid */}
        {profiles.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            {profiles.map((p) => (
              <div
                key={p.id}
                data-testid={`profile-card-${p.username}`}
                className="p-4 rounded-xl bg-surface-elevated/60 border border-surface-elevated hover:border-accent/40 flex flex-col justify-between gap-3 group transition-all shadow-sm"
              >
                <div className="flex items-start gap-3 min-w-0">
                  {/* Avatar with fallback */}
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url}
                      alt={p.display_name}
                      className="w-11 h-11 rounded-full object-cover shrink-0 border border-accent/30 shadow-sm"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-surface-elevated border border-accent/30 flex items-center justify-center text-accent shrink-0 shadow-sm">
                      <User className="w-5 h-5" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-text-primary truncate">{p.display_name}</p>
                    <p className="text-xs font-mono text-accent">@{p.username}</p>
                    {p.bio && (
                      <p className="text-[11px] text-text-muted truncate mt-1 leading-snug">
                        {p.bio}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-elevated/60">
                  <button
                    type="button"
                    onClick={() => setSelectedUserForModal(p)}
                    data-testid={`view-profile-btn-${p.username}`}
                    className="px-3 py-1.5 rounded-lg border border-surface-elevated hover:border-accent/50 hover:bg-surface-elevated text-xs font-semibold text-text-secondary hover:text-text-primary transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span>View Profile</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleFollow(p.id, Boolean(p.is_following))}
                    data-testid={`follow-toggle-${p.username}`}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow cursor-pointer ${
                      p.is_following
                        ? 'bg-surface border border-accent text-accent hover:bg-rose-500/10 hover:border-rose-500 hover:text-rose-500'
                        : 'bg-accent text-background hover:bg-accent-hover'
                    }`}
                  >
                    {p.is_following ? (
                      <>
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Following</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>Add Friend</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Activity Feed Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
            {feedMode === 'following' ? 'Updates from People You Follow' : 'Community Activity Stream'}
          </h2>
          <span className="text-xs text-text-muted font-mono">{activities.length} Updates</span>
        </div>

        {activities.length === 0 ? (
          <div
            data-testid="activity-feed-empty"
            className="p-12 rounded-2xl bg-surface border border-surface-elevated text-center space-y-3"
          >
            <div className="w-12 h-12 rounded-full bg-accent/15 border border-accent/30 mx-auto flex items-center justify-center text-accent">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-text-primary">No updates in your feed yet</h3>
            <p className="text-xs text-text-muted max-w-sm mx-auto">
              Follow other members in the community above to see their latest ratings, reviews, and progress here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((act) => {
              const formattedDate = new Date(act.created_at).toLocaleTimeString(undefined, {
                hour: '2-digit',
                minute: '2-digit',
                month: 'short',
                day: 'numeric',
              });

              return (
                <div
                  key={act.id}
                  data-testid={`activity-feed-item-${act.id}`}
                  className="p-4 rounded-2xl bg-surface border border-surface-elevated hover:border-accent/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    {/* User Avatar with fallback */}
                    {act.avatar_url ? (
                      <img
                        src={act.avatar_url}
                        alt={act.display_name}
                        className="w-10 h-10 rounded-full object-cover shrink-0 border border-accent/30"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-surface-elevated border border-accent/30 flex items-center justify-center text-accent shrink-0">
                        <User className="w-5 h-5" />
                      </div>
                    )}

                    {/* Activity Text */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-text-primary">{act.display_name}</span>
                        <span className="text-xs text-text-muted">@{act.username}</span>
                        <span className="text-xs text-text-secondary font-medium">
                          {act.activity_type === 'rate_title' && 'rated'}
                          {act.activity_type === 'publish_review' && 'reviewed'}
                          {act.activity_type === 'watch_episode' && 'watched an episode of'}
                          {act.activity_type === 'read_chapter' && 'read chapter'}
                          {act.activity_type === 'complete_title' && 'completed'}
                        </span>
                        {act.metadata.chapter_number && (
                          <strong className="text-accent text-xs">
                            {act.metadata.chapter_number} of
                          </strong>
                        )}
                        <span
                          onClick={() => onSelectTitle && onSelectTitle(act.title_id)}
                          className="text-xs font-bold text-text-primary hover:text-accent transition-colors cursor-pointer"
                        >
                          {act.title_name}
                        </span>
                      </div>

                      {/* Excerpt or Rating details */}
                      <div className="flex items-center gap-2 mt-1">
                        {act.metadata.rating && (
                          <span className="text-xs font-mono font-bold text-accent flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 fill-accent" />
                            <span>{(act.metadata.rating / 2).toFixed(1)} ★</span>
                          </span>
                        )}
                        {act.metadata.review_excerpt && (
                          <p className="text-xs text-text-muted italic truncate max-w-md">
                            &quot;{act.metadata.review_excerpt}&quot;
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Media Poster & Timestamp */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <span className="text-[11px] font-mono text-text-muted">{formattedDate}</span>
                    {act.poster_url && (
                      <img
                        src={act.poster_url}
                        alt={act.title_name}
                        onClick={() => onSelectTitle && onSelectTitle(act.title_id)}
                        className="w-8 h-12 rounded-lg object-cover cursor-pointer hover:scale-105 transition-transform"
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* View Profile Modal */}
      {selectedUserForModal && (
        <div
          data-testid="user-profile-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setSelectedUserForModal(null)}
        >
          <div
            className="w-full max-w-md bg-surface border border-surface-elevated rounded-2xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-elevated">
              <h3 className="text-base font-bold text-text-primary">Member Profile</h3>
              <button
                type="button"
                onClick={() => setSelectedUserForModal(null)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4">
              {selectedUserForModal.avatar_url ? (
                <img
                  src={selectedUserForModal.avatar_url}
                  alt={selectedUserForModal.display_name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-accent/40"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-surface-elevated border-2 border-accent/40 flex items-center justify-center text-accent">
                  <User className="w-8 h-8" />
                </div>
              )}
              <div>
                <h4 className="text-lg font-bold text-text-primary">
                  {selectedUserForModal.display_name}
                </h4>
                <p className="text-xs font-mono text-accent">@{selectedUserForModal.username}</p>
              </div>
            </div>

            {selectedUserForModal.bio && (
              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated/40 p-3 rounded-xl border border-surface-elevated">
                {selectedUserForModal.bio}
              </p>
            )}

            <div className="pt-3 border-t border-surface-elevated flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedUserForModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  handleToggleFollow(selectedUserForModal.id, Boolean(selectedUserForModal.is_following));
                  setSelectedUserForModal((prev) =>
                    prev ? { ...prev, is_following: !prev.is_following } : null
                  );
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow cursor-pointer ${
                  selectedUserForModal.is_following
                    ? 'bg-surface border border-accent text-accent'
                    : 'bg-accent text-background hover:bg-accent-hover'
                }`}
              >
                {selectedUserForModal.is_following ? 'Following' : 'Add Friend'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
