import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Film,
  BookOpen,
  CalendarDays,
  Sparkles,
  Layers,
  User as UserIcon,
} from 'lucide-react';
import { useUIStore, NavigationTab } from '../../stores/uiStore';
import { useAuth } from '../../features/auth/AuthContext';

export const MobileBottomNav: React.FC = () => {
  const { activeTab, setActiveTab, setAuthModalOpen, setProfileModalOpen } = useUIStore();
  const { user } = useAuth();

  const handleProfileClick = () => {
    if (user) {
      setProfileModalOpen(true);
    } else {
      setAuthModalOpen(true);
    }
  };

  const navItems: { id: NavigationTab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'watch', label: 'Watch', icon: Film },
    { id: 'read', label: 'Read', icon: BookOpen },
    { id: 'calendar', label: 'Calendar', icon: CalendarDays },
    { id: 'recommendations', label: 'For You', icon: Sparkles },
    { id: 'import', label: 'Import', icon: Layers },
  ];

  return (
    <nav
      data-testid="mobile-bottom-nav"
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-lg border-t border-surface-elevated z-30 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-center justify-around w-full h-full px-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              data-testid={`mobile-nav-${item.id}`}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              className={`flex-1 min-w-0 h-full flex flex-col items-center justify-center py-1 px-0.5 rounded-lg transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent ${
                isActive
                  ? 'text-accent font-bold'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="text-[9px] mt-1 leading-none tracking-tighter truncate max-w-full">
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Profile / Sign In */}
        <button
          onClick={handleProfileClick}
          data-testid="mobile-nav-profile"
          aria-label={user ? 'Profile' : 'Sign In'}
          className="flex-1 min-w-0 h-full flex flex-col items-center justify-center py-1 px-0.5 rounded-lg text-text-muted hover:text-text-primary transition-colors touch-manipulation focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        >
          <UserIcon className="w-4 h-4 shrink-0" />
          <span className="text-[9px] mt-1 leading-none tracking-tighter truncate max-w-full">
            {user ? 'Profile' : 'Sign In'}
          </span>
        </button>
      </div>
    </nav>
  );
};
