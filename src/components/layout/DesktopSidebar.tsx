import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Film,
  BookOpen,
  CalendarDays,
  Sparkles,
  BarChart3,
  UploadCloud,
  Users,
  ChevronLeft,
  ChevronRight,
  User as UserIcon,
  Settings,
  LogIn,
} from 'lucide-react';
import { useUIStore, NavigationTab } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';

interface NavItem {
  id: NavigationTab;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'discover', label: 'Discover', icon: Compass },
  { id: 'watch', label: 'Watch Library', icon: Film },
  { id: 'read', label: 'Reading / Manga & Manhwa', icon: BookOpen },
  { id: 'calendar', label: 'Airing Calendar', icon: CalendarDays },
  { id: 'recommendations', label: 'Recommended', icon: Sparkles },
  { id: 'history', label: 'History & Stats', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: UserIcon },
  { id: 'import', label: 'Import / Export', icon: UploadCloud },
  { id: 'social', label: 'Community Feed', icon: Users },
];

export const DesktopSidebar: React.FC = () => {
  const {
    sidebarCollapsed,
    toggleSidebar,
    activeTab,
    setActiveTab,
    setAuthModalOpen,
    setProfileModalOpen,
  } = useUIStore();
  const { user, profile } = useAuth();

  return (
    <aside
      data-testid="desktop-sidebar"
      className={`hidden md:flex flex-col border-r border-surface-elevated bg-surface transition-all duration-300 ease-in-out z-30 select-none ${
        sidebarCollapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* Brand Header */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-surface-elevated">
        <div className="flex items-center gap-3 overflow-hidden">
          <img
            src="/assets/trackup-logo.jpg"
            alt="TrackUp Logo"
            className="w-11 h-11 rounded-xl object-cover shrink-0 shadow-lg border-2 border-accent/40"
          />
          {!sidebarCollapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-2xl tracking-tight text-text-primary leading-none">
                Track<span className="text-accent">Up</span>
              </span>
              <span className="text-xs text-text-muted font-medium mt-1">
                Track what you love.
              </span>
            </div>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-elevated transition-colors"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4 text-accent" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              data-testid={`sidebar-nav-${item.id}`}
              title={sidebarCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                isActive
                  ? 'bg-accent/10 text-accent border border-accent/20'
                  : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
              } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-accent' : ''}`} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User / Profile Footer */}
      <div className="p-3 border-t border-surface-elevated">
        {user ? (
          <div
            onClick={() => setProfileModalOpen(true)}
            className={`w-full flex items-center gap-3 p-2 rounded-xl hover:bg-surface-elevated transition-colors cursor-pointer ${
              sidebarCollapsed ? 'justify-center p-2' : ''
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 overflow-hidden">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.display_name || user.username}
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <UserIcon className="w-4 h-4 text-accent" />
              )}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium text-text-primary truncate">
                  {profile?.display_name || user.username}
                </p>
                <p className="text-xs text-text-muted truncate">@{user.username}</p>
              </div>
            )}
            {!sidebarCollapsed && <Settings className="w-4 h-4 text-text-muted" />}
          </div>
        ) : (
          <button
            onClick={() => setAuthModalOpen(true)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-text-primary bg-surface-elevated hover:bg-accent hover:text-background transition-colors ${
              sidebarCollapsed ? 'justify-center px-0' : ''
            }`}
          >
            <LogIn className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span>Sign In</span>}
          </button>
        )}
      </div>
    </aside>
  );
};
