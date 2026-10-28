import React, { useEffect } from 'react';
import {
  X,
  LayoutDashboard,
  Compass,
  Film,
  BookOpen,
  CalendarDays,
  Sparkles,
  Layers,
  Users,
  Search,
  LogIn,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { useUIStore, NavigationTab } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({ isOpen, onClose }) => {
  const {
    activeTab,
    setActiveTab,
    setSelectedTitleId,
    setOmnisearchOpen,
    setAuthModalOpen,
    setProfileModalOpen,
  } = useUIStore();
  const { user, profile, signOut } = useAuth();

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleNavClick = (tab: NavigationTab) => {
    setActiveTab(tab);
    setSelectedTitleId(null);
    onClose();
  };

  const navItems: { id: NavigationTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Home / Dashboard', icon: LayoutDashboard },
    { id: 'discover', label: 'Discover Catalog', icon: Compass },
    { id: 'watch', label: 'Watch Library', icon: Film },
    { id: 'read', label: 'Reading / Manga & Manhwa', icon: BookOpen },
    { id: 'calendar', label: 'Release Calendar', icon: CalendarDays },
    { id: 'recommendations', label: 'For You', icon: Sparkles },
    { id: 'profile', label: 'My Profile', icon: UserIcon },
    { id: 'social', label: 'Friends & Social', icon: Users },
    { id: 'import', label: 'Import & Export', icon: Layers },
  ];

  const displayName = profile?.display_name || user?.username || 'Tracker';

  return (
    <div
      data-testid="mobile-nav-drawer"
      className="fixed inset-0 z-50 flex md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation Menu"
    >
      {/* Backdrop */}
      <div
        data-testid="mobile-drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Panel */}
      <div className="relative w-72 max-w-[85vw] h-full bg-[#101014] border-r border-[#16161D] flex flex-col z-10 shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {/* Header */}
        <div className="p-4 border-b border-[#16161D] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/trackup-logo.jpg"
              alt="TrackUp Logo"
              className="w-11 h-11 rounded-xl object-cover shadow-lg border-2 border-accent/40"
            />
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight text-text-primary leading-none">
                Track<span className="text-accent">Up</span>
              </span>
              <span className="text-xs text-text-muted font-medium mt-1">
                Track what you love.
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            data-testid="mobile-menu-close"
            aria-label="Close navigation menu"
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-[#16161D] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile / Sign In Section */}
        <div className="p-4 border-b border-[#16161D] bg-[#16161D]/40">
          {user ? (
            <div className="flex items-center justify-between">
              <button
                onClick={() => {
                  setProfileModalOpen(true);
                  onClose();
                }}
                data-testid="mobile-nav-profile"
                className="flex items-center gap-2.5 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity"
              >
                <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 overflow-hidden">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={displayName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <UserIcon className="w-5 h-5 text-accent" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">
                    {displayName}
                  </p>
                  <p className="text-[11px] text-accent font-medium">View Profile</p>
                </div>
              </button>

              <button
                onClick={() => {
                  signOut();
                  onClose();
                }}
                data-testid="mobile-drawer-signout"
                title="Sign Out"
                aria-label="Sign out"
                className="p-2 rounded-lg text-text-muted hover:text-status-dropped hover:bg-status-dropped/10 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setAuthModalOpen(true);
                onClose();
              }}
              data-testid="mobile-nav-profile"
              className="w-full py-2.5 px-4 rounded-xl bg-accent hover:bg-accent-hover text-background font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
            >
              <LogIn className="w-4 h-4" />
              <span>Sign In to TrackUp</span>
            </button>
          )}
        </div>

        {/* Search Shortcut */}
        <div className="p-3">
          <button
            onClick={() => {
              setOmnisearchOpen(true);
              onClose();
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-[#16161D] text-text-muted hover:text-text-primary text-xs transition-colors"
          >
            <Search className="w-4 h-4 text-accent" />
            <span>Search titles...</span>
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                data-testid={item.id === 'profile' ? 'mobile-nav-profile-link' : `mobile-nav-${item.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-accent/15 text-accent font-bold border border-accent/30'
                    : 'text-text-secondary hover:text-text-primary hover:bg-[#16161D]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-accent' : 'text-text-muted'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-[#16161D] text-center">
          <p className="text-[10px] text-text-muted font-mono">TrackUp Mobile v0.2.0</p>
        </div>
      </div>
    </div>
  );
};
