import { create } from 'zustand';
import {
  type LibraryFilterState,
  getInitialLibraryFilters,
  persistLibraryFilters,
} from '../features/library/libraryFilterState';

export type NavigationTab =
  | 'dashboard'
  | 'discover'
  | 'watch'
  | 'read'
  | 'calendar'
  | 'recommendations'
  | 'history'
  | 'import'
  | 'social'
  | 'profile';

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
  selectedTitleId: string | null;
  setSelectedTitleId: (id: string | null) => void;
  libraryViewMode: LibraryViewMode;
  setLibraryViewMode: (mode: LibraryViewMode) => void;
  scrolledHeaderTitle: string | null;
  setScrolledHeaderTitle: (title: string | null) => void;
  // Preserved Library Filter State
  watchLibraryFilters: LibraryFilterState;
  setWatchLibraryFilters: (filters: Partial<LibraryFilterState>) => void;
  readLibraryFilters: LibraryFilterState;
  setReadLibraryFilters: (filters: Partial<LibraryFilterState>) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
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
  setActiveTab: (tab) => set({ activeTab: tab, selectedTitleId: null, scrolledHeaderTitle: null }),
  selectedTitleId: null,
  setSelectedTitleId: (id) => set({ selectedTitleId: id, scrolledHeaderTitle: null }),
  libraryViewMode: 'grid',
  setLibraryViewMode: (mode) => set({ libraryViewMode: mode }),
  scrolledHeaderTitle: null,
  setScrolledHeaderTitle: (title) => set({ scrolledHeaderTitle: title }),

  watchLibraryFilters: getInitialLibraryFilters('watch'),
  setWatchLibraryFilters: (filters) => {
    const updated: LibraryFilterState = {
      ...get().watchLibraryFilters,
      ...filters,
    };
    persistLibraryFilters(updated, 'watch');
    set({ watchLibraryFilters: updated });
  },

  readLibraryFilters: getInitialLibraryFilters('read'),
  setReadLibraryFilters: (filters) => {
    const updated: LibraryFilterState = {
      ...get().readLibraryFilters,
      ...filters,
    };
    persistLibraryFilters(updated, 'read');
    set({ readLibraryFilters: updated });
  },
}));
