import React from 'react';
import {
  LayoutDashboard,
  Compass,
  Film,
  Users,
  User as UserIcon,
} from 'lucide-react';
import { useUIStore } from '../../stores/uiStore';

export const BottomNavBar: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    selectedTitleId,
    setSelectedTitleId,
    viewingPublicUser,
    setViewingPublicUser,
  } = useUIStore();

  const handleNavClick = (tab: 'dashboard' | 'discover' | 'watch' | 'social' | 'profile') => {
    if (selectedTitleId) setSelectedTitleId(null);
    if (viewingPublicUser) setViewingPublicUser(null);

    // If clicking Library and already on watch, allow toggling to read, or default to watch
    if (tab === 'watch') {
      if (activeTab === 'watch') {
        setActiveTab('read');
      } else {
        setActiveTab('watch');
      }
      return;
    }

    setActiveTab(tab);
  };

  const isHomeActive = activeTab === 'dashboard' && !selectedTitleId && !viewingPublicUser;
  const isDiscoverActive = activeTab === 'discover' && !selectedTitleId && !viewingPublicUser;
  const isLibraryActive = (activeTab === 'watch' || activeTab === 'read') && !selectedTitleId && !viewingPublicUser;
  const isSocialActive = activeTab === 'social' && !selectedTitleId && !viewingPublicUser;
  const isProfileActive = activeTab === 'profile' && !selectedTitleId && !viewingPublicUser;

  return (
    <nav
      data-testid="bottom-navigation-bar"
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#16161D] border-t border-[#1F1F29] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 transition-all shadow-2xl"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto px-1">
        {/* 1. Home */}
        <button
          onClick={() => handleNavClick('dashboard')}
          data-testid="bottom-nav-home"
          aria-label="Home"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all ${
            isHomeActive
              ? 'text-[#FFC400] font-bold scale-105'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <div className="relative">
            <LayoutDashboard className="w-5 h-5 transition-transform duration-200" />
            {isHomeActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFC400]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Home</span>
        </button>

        {/* 2. Discover */}
        <button
          onClick={() => handleNavClick('discover')}
          data-testid="bottom-nav-discover"
          aria-label="Discover"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all ${
            isDiscoverActive
              ? 'text-[#FFC400] font-bold scale-105'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <div className="relative">
            <Compass className="w-5 h-5 transition-transform duration-200" />
            {isDiscoverActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFC400]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Discover</span>
        </button>

        {/* 3. Library (Watch & Read) */}
        <button
          onClick={() => handleNavClick('watch')}
          data-testid="bottom-nav-library"
          aria-label="Library"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all ${
            isLibraryActive
              ? 'text-[#FFC400] font-bold scale-105'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <div className="relative">
            <Film className="w-5 h-5 transition-transform duration-200" />
            {isLibraryActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFC400]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">
            {activeTab === 'read' ? 'Reading' : 'Library'}
          </span>
        </button>

        {/* 4. Social */}
        <button
          onClick={() => handleNavClick('social')}
          data-testid="bottom-nav-social"
          aria-label="Social"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all ${
            isSocialActive
              ? 'text-[#FFC400] font-bold scale-105'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <div className="relative">
            <Users className="w-5 h-5 transition-transform duration-200" />
            {isSocialActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFC400]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Social</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => handleNavClick('profile')}
          data-testid="bottom-nav-profile"
          aria-label="Profile"
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all ${
            isProfileActive
              ? 'text-[#FFC400] font-bold scale-105'
              : 'text-text-muted hover:text-text-primary'
          }`}
        >
          <div className="relative">
            <UserIcon className="w-5 h-5 transition-transform duration-200" />
            {isProfileActive && (
              <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[#FFC400]" />
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNavBar;
