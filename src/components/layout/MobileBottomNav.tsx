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
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/95 backdrop-blur-md border-t border-surface-elevated flex items-center justify-around px-1 z-30 pb-[env(safe-area-inset-bottom)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            data-testid={`mobile-nav-${item.id}`}
            className={`flex flex-col items-center justify-center py-1 px-1.5 rounded-lg transition-colors ${
              isActive ? 'text-accent font-bold' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="text-[9px] mt-1 leading-none truncate max-w-[46px]">{item.label}</span>
          </button>
        );
      })}

      {/* Profile / Sign In */}
      <button
        onClick={handleProfileClick}
        data-testid="mobile-nav-profile"
        className="flex flex-col items-center justify-center py-1 px-1.5 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
      >
        <UserIcon className="w-4 h-4" />
        <span className="text-[9px] mt-1 leading-none">{user ? 'Profile' : 'Sign In'}</span>
      </button>
    </nav>
  );
};
