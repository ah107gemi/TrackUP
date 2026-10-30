import { create } from 'zustand';
import {
  type LibraryFilterState,
  DEFAULT_LIBRARY_FILTERS,
  getInitialLibraryFilters,
  persistLibraryFilters,
  sanitizeFilterState,
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
  // Public Profile Discovery State
  viewingPublicUser: string | null;
  setViewingPublicUser: (username: string | null) => void;
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
  setActiveTab: (tab) => set({ activeTab: tab, selectedTitleId: null, scrolledHeaderTitle: null, viewingPublicUser: null }),
  selectedTitleId: null,
  setSelectedTitleId: (id) => set({ selectedTitleId: id, scrolledHeaderTitle: null }),
  viewingPublicUser: null,
  setViewingPublicUser: (username) => set({ viewingPublicUser: username, selectedTitleId: null, scrolledHeaderTitle: null }),
  libraryViewMode: 'grid',
  setLibraryViewMode: (mode) => set({ libraryViewMode: mode }),
  scrolledHeaderTitle: null,
  setScrolledHeaderTitle: (title) => set({ scrolledHeaderTitle: title }),

  watchLibraryFilters: getInitialLibraryFilters('watch'),
  setWatchLibraryFilters: (filters) => {
    try {
      const current = get().watchLibraryFilters || DEFAULT_LIBRARY_FILTERS;
      const updated = sanitizeFilterState({
        ...current,
        ...filters,
      });
      persistLibraryFilters(updated, 'watch');
      set({ watchLibraryFilters: updated });
    } catch {
      set({ watchLibraryFilters: { ...DEFAULT_LIBRARY_FILTERS } });
    }
  },

  readLibraryFilters: getInitialLibraryFilters('read'),
  setReadLibraryFilters: (filters) => {
    try {
      const current = get().readLibraryFilters || DEFAULT_LIBRARY_FILTERS;
      const updated = sanitizeFilterState({
        ...current,
        ...filters,
      });
      persistLibraryFilters(updated, 'read');
      set({ readLibraryFilters: updated });
    } catch {
      set({ readLibraryFilters: { ...DEFAULT_LIBRARY_FILTERS } });
    }
  },
}));
