import { create } from 'zustand';

export type NavigationTab =
  | 'dashboard'
  | 'discover'
  | 'watch'
  | 'read'
  | 'history'
  | 'import';

export type LibraryViewMode = 'grid' | 'compact' | 'list';

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  omnisearchOpen: boolean;
  setOmnisearchOpen: (open: boolean) => void;
  authModalOpen: boolean;
  setAuthModalOpen: (open: boolean) => void;
  profileModalOpen: boolean;
  setProfileModalOpen: (open: boolean) => void;
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  libraryViewMode: LibraryViewMode;
  setLibraryViewMode: (mode: LibraryViewMode) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  mobileDrawerOpen: false,
  setMobileDrawerOpen: (open) => set({ mobileDrawerOpen: open }),
  omnisearchOpen: false,
  setOmnisearchOpen: (open) => set({ omnisearchOpen: open }),
  authModalOpen: false,
  setAuthModalOpen: (open) => set({ authModalOpen: open }),
  profileModalOpen: false,
  setProfileModalOpen: (open) => set({ profileModalOpen: open }),
  activeTab: 'dashboard',
  setActiveTab: (tab) => set({ activeTab: tab }),
  libraryViewMode: 'grid',
  setLibraryViewMode: (mode) => set({ libraryViewMode: mode }),
}));
