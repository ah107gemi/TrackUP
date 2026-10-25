import React, { useState } from 'react';
import { X, User, Shield, Star, LogOut, Check } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from './AuthContext';
import type { PrivacyLevel } from '../../types/database.types';

export const ProfileModal: React.FC = () => {
  const { profileModalOpen, setProfileModalOpen } = useUIStore();
  const { user, profile, updateProfile, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [libraryVisibility, setLibraryVisibility] = useState<PrivacyLevel>(
    profile?.library_visibility || 'public'
  );
  const [ratingPref, setRatingPref] = useState<'stars_5' | 'points_10'>(
    profile?.rating_display_preference || 'stars_5'
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!profileModalOpen || !user) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await updateProfile({
      display_name: displayName,
      bio,
      library_visibility: libraryVisibility,
      rating_display_preference: ratingPref,
    });
    setLoading(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div
      data-testid="profile-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={() => setProfileModalOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-surface border border-surface-elevated rounded-2xl shadow-2xl p-6 sm:p-8 animate-in fade-in zoom-in-95 max-h-[90dvh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-surface-elevated">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center">
              <User className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-text-primary">Profile & Preferences</h2>
              <p className="text-xs text-text-muted">@{user.username} • {user.email}</p>
            </div>
          </div>
          <button
            onClick={() => setProfileModalOpen(false)}
            data-testid="profile-close-button"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Edit Form */}
        <form onSubmit={handleSave} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your full name"
              data-testid="profile-displayname-input"
              className="w-full px-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Bio / About Me
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others what you love to watch and read..."
              data-testid="profile-bio-input"
              className="w-full px-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm focus:border-accent focus:outline-none resize-none"
            />
          </div>

          {/* Privacy Level */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
              <Shield className="w-3.5 h-3.5 text-accent" />
              <span>Library Visibility (Row-Level Security)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['public', 'followers_only', 'private'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setLibraryVisibility(lvl)}
                  data-testid={`visibility-option-${lvl}`}
                  className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                    libraryVisibility === lvl
                      ? 'bg-accent/15 border-accent text-accent font-semibold'
                      : 'bg-surface-elevated border-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {lvl === 'public' && 'Public'}
                  {lvl === 'followers_only' && 'Followers Only'}
                  {lvl === 'private' && 'Private'}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Controls who can query your tracked titles via PostgreSQL RLS policies.
            </p>
          </div>

          {/* Rating Display */}
          <div>
            <label className="flex items-center gap-1.5 text-xs font-medium text-text-secondary mb-2">
              <Star className="w-3.5 h-3.5 text-accent" />
              <span>Rating Scale Preference</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRatingPref('stars_5')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  ratingPref === 'stars_5'
                    ? 'bg-accent/15 border-accent text-accent font-semibold'
                    : 'bg-surface-elevated border-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                5-Star (with half-stars)
              </button>
              <button
                type="button"
                onClick={() => setRatingPref('points_10')}
                className={`py-2 px-3 rounded-xl text-xs font-medium border text-center transition-all ${
                  ratingPref === 'points_10'
                    ? 'bg-accent/15 border-accent text-accent font-semibold'
                    : 'bg-surface-elevated border-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                10-Point Score (1–10)
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-surface-elevated flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                signOut();
                setProfileModalOpen(false);
              }}
              data-testid="profile-signout-button"
              className="px-4 py-2 rounded-xl text-xs font-medium text-status-dropped hover:bg-status-dropped/10 transition-colors flex items-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              data-testid="profile-save-button"
              className="px-5 py-2 rounded-xl bg-accent hover:bg-accent-hover text-background font-semibold text-xs transition-all shadow-md flex items-center gap-1.5 disabled:opacity-50"
            >
              {saved ? (
                <>
                  <Check className="w-3.5 h-3.5 text-background" />
                  <span>Saved!</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
