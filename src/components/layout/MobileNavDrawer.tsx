import React, { useEffect } from 'react';
import {
  X,
  LayoutDashboard,
  Compass,
  Film,
  BookOpen,
  CalendarDays,
  Sparkles,
  BarChart3,
  Layers,
  Users,
  Search,
  LogIn,
  LogOut,
  User as UserIcon,
  ChevronRight,
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
    setViewingPublicUser,
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

  // Lock body scroll when sheet is open
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
    setViewingPublicUser(null);
    onClose();
  };

  const displayName = profile?.display_name || user?.username || 'Tracker';

  // Secondary routes featured in the "More" Menu
  const secondaryRoutes: {
    id: NavigationTab;
    label: string;
    description: string;
    icon: React.ElementType;
    testId: string;
  }[] = [
    {
      id: 'profile',
      label: 'My Profile',
      description: 'Activity stats, showcase, and ratings',
      icon: UserIcon,
      testId: 'mobile-nav-profile-link',
    },
    {
      id: 'calendar',
      label: 'Release Calendar',
      description: 'Upcoming TV & anime broadcast dates',
      icon: CalendarDays,
      testId: 'mobile-nav-calendar',
    },
    {
      id: 'recommendations',
      label: 'For You',
      description: 'Personalized recommendations',
      icon: Sparkles,
      testId: 'mobile-nav-recommendations',
    },
    {
      id: 'history',
      label: 'Tracking History',
      description: 'Episodes watched and chapters read',
      icon: BarChart3,
      testId: 'mobile-nav-history',
    },
    {
      id: 'import',
      label: 'Import & Export',
      description: 'Letterboxd, IMDb, Trakt & MAL CSV sync',
      icon: Layers,
      testId: 'mobile-nav-import',
    },
  ];

  // Primary routes also available for complete navigation coverage
  const allRoutes: {
    id: NavigationTab;
    label: string;
    icon: React.ElementType;
    testId: string;
  }[] = [
    { id: 'watch', label: 'Watch Library', icon: Film, testId: 'mobile-nav-watch' },
    { id: 'read', label: 'Manga & Manhwa', icon: BookOpen, testId: 'mobile-nav-read' },
    { id: 'social', label: 'Friends & Community', icon: Users, testId: 'mobile-nav-social' },
    { id: 'dashboard', label: 'Home Dashboard', icon: LayoutDashboard, testId: 'mobile-nav-dashboard' },
    { id: 'discover', label: 'Discover Catalog', icon: Compass, testId: 'mobile-nav-discover' },
  ];

  return (
    <div
      data-testid="mobile-nav-drawer"
      className="fixed inset-0 z-50 flex flex-col justify-end md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="More Navigation Menu"
    >
      {/* Backdrop */}
      <div
        data-testid="mobile-drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
      />

      {/* Smooth Bottom Sheet Overlay */}
      <div className="relative w-full max-h-[85vh] bg-[#16161D] border-t border-[#1F1F29] rounded-t-3xl shadow-2xl flex flex-col z-10 overflow-hidden pt-2 pb-[max(1rem,env(safe-area-inset-bottom))] transition-transform duration-300 ease-out">
        {/* Drag Pill Handle */}
        <div className="w-12 h-1.5 bg-[#1F1F29] rounded-full mx-auto my-1.5 shrink-0" />

        {/* Sheet Header */}
        <div className="px-5 py-3 border-b border-[#1F1F29] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/trackup-logo.jpg"
              alt="TrackUp Logo"
              className="w-9 h-9 rounded-xl object-cover shadow-md border-2 border-accent/40"
            />
            <div>
              <span className="font-extrabold text-lg tracking-tight text-text-primary">
                Track<span className="text-accent">Up</span>
              </span>
              <span className="text-[11px] text-text-muted block font-medium">
                More Features & Secondary Routes
              </span>
            </div>
          </div>

          <button
            onClick={onClose}
            data-testid="mobile-menu-close"
            aria-label="Close navigation menu"
            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-[#1F1F29] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content Container */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {/* User Profile / Authentication Banner */}
          <div className="p-3.5 rounded-2xl bg-[#101014] border border-[#1F1F29] shadow-sm">
            {user ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setProfileModalOpen(true);
                    onClose();
                  }}
                  data-testid="mobile-nav-profile"
                  className="flex items-center gap-3 text-left min-w-0 flex-1 hover:opacity-80 transition-opacity"
                >
                  <div className="w-10 h-10 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center shrink-0 overflow-hidden">
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
                    <p className="text-sm font-bold text-text-primary truncate">
                      {displayName}
                    </p>
                    <p className="text-xs text-accent font-semibold flex items-center gap-1">
                      <span>View Profile & Showcases</span>
                      <ChevronRight className="w-3 h-3" />
                    </p>
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
                  className="p-2.5 rounded-xl text-text-muted hover:text-status-dropped hover:bg-status-dropped/10 transition-colors shrink-0"
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

          {/* Quick Omnisearch Trigger */}
          <button
            onClick={() => {
              setOmnisearchOpen(true);
              onClose();
            }}
            data-testid="mobile-drawer-search"
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#101014] border border-[#1F1F29] text-text-muted hover:text-text-primary text-xs transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-accent" />
              <span>Search movies, anime, manga...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-text-muted bg-[#16161D] rounded border border-[#1F1F29]">
              ⌘K
            </kbd>
          </button>

          {/* Secondary Routes Section */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2">
              Features & Tools
            </span>
            <div className="grid grid-cols-1 gap-1.5 pt-1">
              {secondaryRoutes.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavClick(item.id)}
                    data-testid={item.testId}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center justify-between p-3 rounded-2xl text-left transition-all ${
                      isActive
                        ? 'bg-accent/15 text-accent border border-accent/40 shadow-sm'
                        : 'bg-[#101014] hover:bg-[#1F1F29] border border-[#1F1F29] text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-accent text-background font-bold'
                            : 'bg-[#16161D] text-accent'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p
                          className={`text-xs font-bold truncate ${
                            isActive ? 'text-accent' : 'text-text-primary'
                          }`}
                        >
                          {item.label}
                        </p>
                        <p className="text-[11px] text-text-muted truncate">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-accent' : 'text-text-muted/50'
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* All Destinations Quick Links */}
          <div className="space-y-1.5 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted px-2">
              All Destinations
            </span>
            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {allRoutes.map((route) => {
                const Icon = route.icon;
                const isActive = activeTab === route.id;
                return (
                  <button
                    key={route.id}
                    onClick={() => handleNavClick(route.id)}
                    data-testid={route.testId}
                    className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-accent/20 text-accent font-bold border border-accent/30'
                        : 'bg-[#101014] hover:bg-[#1F1F29] text-text-secondary hover:text-text-primary border border-[#1F1F29]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0 text-accent" />
                    <span className="truncate">{route.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 pt-3 border-t border-[#1F1F29] flex items-center justify-between text-center">
          <p className="text-[10px] text-text-muted font-mono">TrackUp Mobile v0.2.0</p>
          <span className="text-[10px] text-accent font-semibold">Track what you love.</span>
        </div>
      </div>
    </div>
  );
};

export default MobileNavDrawer;
