import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  UserPlus,
  UserCheck,
  Star,
  Sparkles,
} from 'lucide-react';
import type { SocialProfile, ActivityFeedItem } from './types';
import {
  searchProfiles,
  getFollowingActivityFeed,
  followUser,
  unfollowUser,
} from './socialService';
import { useAuth } from '../auth/AuthContext';

interface SocialFeedViewProps {
  onSelectTitle?: (titleId: string) => void;
}

export const SocialFeedView: React.FC<SocialFeedViewProps> = ({ onSelectTitle }) => {
  const { user } = useAuth();
  const activeUserId = user?.id || 'local_tracker';

  const [searchQuery, setSearchQuery] = useState('');
  const [profiles, setProfiles] = useState<SocialProfile[]>([]);
  const [activities, setActivities] = useState<ActivityFeedItem[]>([]);
  const [feedMode, setFeedMode] = useState<'following' | 'all'>('following');

  const loadFeed = async () => {
    const feed = await getFollowingActivityFeed(activeUserId, feedMode);
    setActivities(feed);
  };

  const loadProfiles = async (q: string) => {
    const list = await searchProfiles(q, activeUserId);
    setProfiles(list);
  };

  useEffect(() => {
    loadFeed();
    loadProfiles(searchQuery);
  }, [activeUserId, feedMode]);

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    loadProfiles(val);
  };

  const handleToggleFollow = async (targetId: string, currentlyFollowing: boolean) => {
    if (currentlyFollowing) {
      await unfollowUser(activeUserId, targetId);
    } else {
      await followUser(activeUserId, targetId);
    }
    // Refresh both profiles and activities
    loadProfiles(searchQuery);
    loadFeed();
  };

  return (
    <div data-testid="social-feed-view" className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* Social Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-surface-elevated">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/15 border border-accent/30 text-accent text-xs font-semibold mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Social Graph & Activity</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-text-primary tracking-tight">
            Community & Following Feed
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1">
            Discover fellow cinephiles, follow friends, and compare ratings in real time.
          </p>
        </div>

        {/* Feed Mode Switcher */}
        <div className="flex items-center gap-1.5 bg-surface p-1 rounded-xl border border-surface-elevated shrink-0">
          <button
            onClick={() => setFeedMode('following')}
            data-testid="feed-tab-following"
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              feedMode === 'all'
                ? 'bg-accent text-background shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Explore All
          </button>
        </div>
      </div>

      {/* Community Member Search Section */}
      <div className="p-5 rounded-2xl bg-surface border border-surface-elevated space-y-4 shadow">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Find & Follow Community Members
          </h2>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by username, name, or interests (e.g. Elena, Anime, Nolan)..."
            data-testid="profile-search-input"
            className="w-full pl-10 pr-4 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none"
          />
        </div>

        {/* Member Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          {profiles.map((p) => (
            <div
              key={p.id}
              data-testid={`profile-card-${p.username}`}
              className="p-3.5 rounded-xl bg-surface-elevated/60 border border-surface-elevated flex items-center justify-between gap-3 group hover:border-accent/40 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={p.avatar_url || '/assets/trackup-logo.jpg'}
                  alt={p.display_name}
                  className="w-10 h-10 rounded-full object-cover shrink-0 border border-accent/30"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-text-primary truncate">{p.display_name}</p>
                  <p className="text-[11px] text-text-muted">@{p.username}</p>
                  <p className="text-[10px] text-text-secondary truncate mt-0.5">{p.bio}</p>
                </div>
              </div>

              {/* Follow Button */}
              <button
                type="button"
                onClick={() => handleToggleFollow(p.id, Boolean(p.is_following))}
                data-testid={`follow-toggle-${p.username}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1 shadow ${
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
                    <span>Follow</span>
                  </>
                )}
              </button>
            </div>
          ))}
        </div>
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
                    {/* User Avatar */}
                    <img
                      src={act.avatar_url || '/assets/trackup-logo.jpg'}
                      alt={act.display_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0 border border-accent/30"
                    />

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
    </div>
  );
};
