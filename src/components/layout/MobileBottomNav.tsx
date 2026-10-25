import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Film,
  BookOpen,
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
  ];

  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface/90 backdrop-blur-md border-t border-surface-elevated flex items-center justify-around px-2 z-30 pb-[env(safe-area-inset-bottom)]"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg transition-colors ${
              isActive ? 'text-accent' : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-medium mt-1">{item.label}</span>
          </button>
        );
      })}

      {/* Profile / Sign In */}
      <button
        onClick={handleProfileClick}
        className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-text-muted hover:text-text-secondary transition-colors"
      >
        <UserIcon className="w-5 h-5" />
        <span className="text-[10px] font-medium mt-1">{user ? 'Profile' : 'Sign In'}</span>
      </button>
    </nav>
  );
};
