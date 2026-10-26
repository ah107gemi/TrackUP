import React, { useState } from 'react';
import { Search, User as UserIcon, LogIn, LogOut, Menu } from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';
import { MobileNavDrawer } from './MobileNavDrawer';

export const TopUtilityBar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {
    setOmnisearchOpen,
    setAuthModalOpen,
    setProfileModalOpen,
    scrolledHeaderTitle,
  } = useUIStore();
  const { user, profile, signOut } = useAuth();

  const username = profile?.display_name || user?.username;

  return (
    <>
      <header className="h-16 px-4 md:px-8 border-b border-surface-elevated bg-surface/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
        {/* Left: Mobile Hamburger & Logo / Desktop Greeting or Scrolled Title */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          {/* Top-left Hamburger Menu for Mobile */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            data-testid="mobile-hamburger-trigger"
            aria-label="Open navigation menu"
            className="md:hidden p-2 -ml-2 rounded-xl text-text-secondary hover:text-text-primary hover:bg-surface-elevated transition-colors shrink-0"
          >
            <Menu className="w-5 h-5 text-accent" />
          </button>

          <div className="md:hidden flex items-center gap-2 min-w-0">
            <img
              src="/assets/trackup-logo.jpg"
              alt="TrackUp Logo"
              className="w-7 h-7 rounded-lg object-cover shrink-0"
            />
            {scrolledHeaderTitle ? (
              <span
                data-testid="mobile-scrolled-header-title"
                className="font-bold text-sm text-accent truncate max-w-[160px]"
              >
                {scrolledHeaderTitle}
              </span>
            ) : (
              <span className="font-bold text-base text-text-primary truncate">
                Track<span className="text-accent">Up</span>
              </span>
            )}
          </div>

          <div className="hidden md:block min-w-0">
            {scrolledHeaderTitle ? (
              <p
                data-testid="header-scrolled-title"
                className="text-base font-bold text-accent truncate max-w-lg transition-all"
              >
                {scrolledHeaderTitle}
              </p>
            ) : (
              <p data-testid="header-greeting" className="text-sm text-text-secondary truncate">
                {username ? (
                  <>
                    Hello <span className="text-text-primary font-semibold">{username}</span>, Let&apos;s{' '}
                    <span className="text-accent font-bold">TrackUp</span>
                  </>
                ) : (
                  <span>Hello Tracker</span>
                )}
              </p>
            )}
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

    {/* Slide-out Mobile Navigation Drawer */}
    <MobileNavDrawer
      isOpen={mobileMenuOpen}
      onClose={() => setMobileMenuOpen(false)}
    />
  </>
  );
};
