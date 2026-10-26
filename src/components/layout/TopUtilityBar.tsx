import React from 'react';
import { Search, User as UserIcon, LogIn, LogOut } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';

export const TopUtilityBar: React.FC = () => {
  const { setOmnisearchOpen, setAuthModalOpen, setProfileModalOpen } = useUIStore();
  const { user, profile, signOut } = useAuth();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const name = profile?.display_name || user?.username || 'Tracker';

  return (
    <header className="h-16 px-4 md:px-8 border-b border-surface-elevated bg-surface/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
      {/* Greeting on desktop / mobile title */}
      <div className="flex items-center gap-3">
        <div className="md:hidden flex items-center gap-2">
          <img
            src="/assets/trackup-logo.jpg"
            alt="TrackUp Logo"
            className="w-7 h-7 rounded-lg object-cover"
          />
          <span className="font-bold text-base text-text-primary">
            Track<span className="text-accent">Up</span>
          </span>
        </div>
        <div className="hidden md:block">
          <p className="text-sm text-text-secondary">
            {getGreeting()},{' '}
            <span className="text-text-primary font-semibold">{name}</span> —{' '}
            <span className="text-accent italic">Ready to track what you love?</span>
          </p>
        </div>
      </div>

      {/* Right Controls: Omnisearch trigger + Auth action */}
      <div className="flex items-center gap-3">
        {/* Omnisearch trigger */}
        <button
          onClick={() => setOmnisearchOpen(true)}
          data-testid="omnisearch-trigger"
          aria-label="Search titles"
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-elevated hover:bg-surface-elevated/80 border border-surface-elevated text-text-secondary hover:text-text-primary transition-all text-sm group"
        >
          <Search className="w-4 h-4 text-accent group-hover:scale-110 transition-transform" />
          <span className="hidden sm:inline">Search movies, anime, manga...</span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-mono font-medium text-text-muted bg-surface rounded border border-surface-elevated">
            ⌘K
          </kbd>
        </button>

        {/* User / Sign In */}
        {user ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setProfileModalOpen(true)}
              data-testid="profile-button"
              aria-label="Open profile"
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-surface-elevated text-text-secondary hover:text-text-primary transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center">
                <UserIcon className="w-4 h-4 text-accent" />
              </div>
              <span className="hidden lg:inline text-xs font-medium text-text-primary">
                {profile?.display_name || user.username}
              </span>
            </button>
            <button
              onClick={() => signOut()}
              title="Sign Out"
              aria-label="Sign out"
              data-testid="signout-button"
              className="p-1.5 rounded-xl text-text-muted hover:text-status-dropped hover:bg-status-dropped/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            data-testid="auth-modal-trigger"
            className="px-3.5 py-1.5 rounded-xl bg-accent hover:bg-accent-hover text-background font-semibold text-xs transition-all shadow-md flex items-center gap-1.5"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>
        )}
      </div>
    </header>
  );
};
