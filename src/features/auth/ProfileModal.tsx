import React, { useState } from 'react';
import { X, User, Shield, Star, LogOut, Check, Heart, Settings, Trash2, Lock } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from './AuthContext';
import type { PrivacyLevel } from '../../types/database.types';
import { FavoritesShowcase } from '../favorites/FavoritesShowcase';
import { supabase } from '../../lib/supabase';
import { clearUserLibrary } from '../library/libraryService';
import { ChangePasswordModal } from './ChangePasswordModal';

interface ProfileModalProps {
  onSelectTitle?: (titleId: string) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ onSelectTitle }) => {
  const { profileModalOpen, setProfileModalOpen } = useUIStore();
  const { user, profile, updateProfile, signOut } = useAuth();

  const [activeTab, setActiveTab] = useState<'settings' | 'favorites'>('settings');
  const [displayName, setDisplayName] = useState(profile?.display_name || profile?.full_name || user?.username || '');
  const [username, setUsername] = useState(profile?.username || user?.username || '');
  const [modalError, setModalError] = useState<string | null>(null);
  const [bio, setBio] = useState(profile?.bio || '');
  const [libraryVisibility, setLibraryVisibility] = useState<PrivacyLevel>(
    profile?.library_visibility || 'public'
  );
  const [ratingPref, setRatingPref] = useState<'stars_5' | 'points_10'>(
    profile?.rating_display_preference || 'stars_5'
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);

  React.useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || profile.full_name || user?.username || '');
      setUsername(profile.username || user?.username || '');
      setBio(profile.bio || '');
      setLibraryVisibility(profile.library_visibility || 'public');
      setRatingPref(profile.rating_display_preference || 'stars_5');
    }
  }, [profile, user?.username]);

  if (!profileModalOpen || !user) return null;

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete your account? All your tracked data, reviews, and library will be erased. This action cannot be undone.'
    );
    if (!confirmed) return;

    try {
      setLoading(true);
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
      setProfileModalOpen(false);
      await signOut();
    } catch (err) {
      console.error('Error deleting account:', err);
      alert('Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();

    if (!cleanName) {
      setModalError('Display name cannot be empty.');
      return;
    }
    if (!cleanUsername) {
      setModalError('Username cannot be empty.');
      return;
    }
    if (cleanUsername.length < 3) {
      setModalError('Username must be at least 3 characters.');
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
      setModalError('Username can only contain letters, numbers, underscores, periods, and hyphens.');
      return;
    }

    setLoading(true);
    const res = await updateProfile({
      display_name: cleanName,
      full_name: cleanName,
      username: cleanUsername,
      bio,
      library_visibility: libraryVisibility,
      rating_display_preference: ratingPref,
    });
    setLoading(false);

    if (res.error) {
      setModalError(res.error);
      return;
    }

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
            aria-label="Close profile modal"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Navigation Tabs */}
        <div className="flex items-center gap-2 mt-4 p-1 bg-surface-elevated/60 rounded-xl border border-surface-elevated">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            data-testid="profile-tab-settings"
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'settings'
                ? 'bg-accent text-background shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            data-testid="profile-tab-favorites"
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'favorites'
                ? 'bg-accent text-background shadow'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Favorites Showcase</span>
          </button>
        </div>

        {/* Tab 1: Settings Form */}
        {activeTab === 'settings' ? (
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            {modalError && (
              <div
                data-testid="profile-modal-error"
                className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium"
              >
                {modalError}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Display Name / Full Name
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
                Username (@handle)
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Unique username"
                data-testid="profile-username-input"
                className="w-full px-3 py-2 bg-surface-elevated border border-surface-elevated rounded-xl text-text-primary text-sm font-mono focus:border-accent focus:outline-none"
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
            <div className="pt-4 border-t border-surface-elevated flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsChangePasswordOpen(true)}
                  data-testid="modal-change-password-btn"
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:text-text-primary bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 text-accent" />
                  <span>Change Password</span>
                </button>
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
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  data-testid="delete-account-btn"
                  className="px-3 py-2 rounded-xl text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Account</span>
                </button>
              </div>

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
        ) : (
          /* Tab 2: Favorites Showcase */
          <div className="mt-5 space-y-4">
            <FavoritesShowcase
              userId={user.id}
              onSelectTitle={(id) => {
                setProfileModalOpen(false);
                if (onSelectTitle) onSelectTitle(id);
              }}
            />
          </div>
        )}
      </div>

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </div>
  );
};
