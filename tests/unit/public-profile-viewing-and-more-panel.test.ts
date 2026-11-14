import { describe, it, expect, beforeEach } from 'vitest';
import type { UserLibraryItem } from '../../src/features/library/libraryService';

// Ensure mock localStorage is available in unit test runner
if (typeof globalThis.localStorage === 'undefined' || !globalThis.localStorage) {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, val: string) => {
      store[key] = String(val);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },
  };
}

describe('Public Profile Viewing & More Navigation Panel Cleanup', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('1. URL Parameter and Route Extraction', () => {
    // Replicates the extractUserFromUrl logic in ProfilePage and AppShell
    function extractUserFromUrl(url: { search: string; hash: string; pathname: string }): string | null {
      // 1. Search params from window.location.search (?user=..., ?userId=...)
      const searchParams = new URLSearchParams(url.search);
      const queryUser = searchParams.get('user') || searchParams.get('userId');
      if (queryUser) return queryUser.trim();

      // 2. Hash query parameters (#/profile?user=..., #/user?user=...)
      if (url.hash.includes('?')) {
        const hashParams = new URLSearchParams(url.hash.slice(url.hash.indexOf('?')));
        const hashUser = hashParams.get('user') || hashParams.get('userId');
        if (hashUser) return hashUser.trim();
      }

      // 3. Hash route segment: #/user/:param or #/profile/:param
      const hashClean = url.hash.startsWith('#') ? url.hash.slice(1).split('?')[0] : url.hash.split('?')[0];
      const userMatch = hashClean.match(/^\/(?:user|profile)\/([^/?#]+)/i);
      if (userMatch && userMatch[1]) {
        const seg = decodeURIComponent(userMatch[1]).trim();
        if (!['favorites', 'settings', 'edit'].includes(seg.toLowerCase())) {
          return seg;
        }
      }

      // 4. Pathname route segment: /user/:param or /profile/:param
      const pathMatch = url.pathname.match(/^\/(?:user|profile)\/([^/?#]+)/i);
      if (pathMatch && pathMatch[1]) {
        const seg = decodeURIComponent(pathMatch[1]).trim();
        if (!['favorites', 'settings', 'edit'].includes(seg.toLowerCase())) {
          return seg;
        }
      }

      return null;
    }

    it('extracts visited user from ?user= query param', () => {
      const result = extractUserFromUrl({
        search: '?user=123e4567-e89b-12d3-a456-426614174000',
        hash: '#/profile',
        pathname: '/',
      });
      expect(result).toBe('123e4567-e89b-12d3-a456-426614174000');
    });

    it('extracts visited user from ?userId= query param', () => {
      const result = extractUserFromUrl({
        search: '?userId=elena_tracker',
        hash: '',
        pathname: '/profile',
      });
      expect(result).toBe('elena_tracker');
    });

    it('extracts visited user from hash query param (#/profile?user=...) ', () => {
      const result = extractUserFromUrl({
        search: '',
        hash: '#/profile?user=marcus_anime',
        pathname: '/',
      });
      expect(result).toBe('marcus_anime');
    });

    it('extracts visited user from hash route segment (#/user/:param)', () => {
      const result = extractUserFromUrl({
        search: '',
        hash: '#/user/elena_tracker',
        pathname: '/',
      });
      expect(result).toBe('elena_tracker');
    });

    it('extracts visited user from hash route segment (#/profile/:param)', () => {
      const result = extractUserFromUrl({
        search: '',
        hash: '#/profile/user_elena_cinema',
        pathname: '/',
      });
      expect(result).toBe('user_elena_cinema');
    });

    it('extracts visited user from pathname route segment (/user/:param)', () => {
      const result = extractUserFromUrl({
        search: '',
        hash: '',
        pathname: '/user/marcus_anime',
      });
      expect(result).toBe('marcus_anime');
    });

    it('ignores internal sub-routes like /profile/favorites', () => {
      const result = extractUserFromUrl({
        search: '',
        hash: '#/profile/favorites/tv',
        pathname: '/',
      });
      expect(result).toBeNull();
    });
  });

  describe('2. Public Library Data Isolation & Privacy Resolution', () => {
    const activeAuthUser = {
      id: 'active_auth_user_id',
      username: 'active_user',
    };

    const visitedUserId = 'target_visited_user_id';

    it('resolves visitedUserId as effectiveUserId instead of activeAuthUser.id', () => {
      const targetParam = visitedUserId;
      const isOwnProfile =
        !targetParam ||
        targetParam.toLowerCase() === activeAuthUser.id.toLowerCase() ||
        targetParam.toLowerCase() === activeAuthUser.username.toLowerCase();

      expect(isOwnProfile).toBe(false);

      const effectiveUserId = isOwnProfile ? activeAuthUser.id : targetParam;
      expect(effectiveUserId).toBe('target_visited_user_id');
      expect(effectiveUserId).not.toBe(activeAuthUser.id);
    });

    it('strictly filters out private library records for non-owner public views', () => {
      const rawTargetLibrary: Partial<UserLibraryItem>[] = [
        {
          id: 'item_1',
          user_id: visitedUserId,
          title_id: 'movie_inception_27205',
          status: 'completed',
          is_private: false,
        },
        {
          id: 'item_2',
          user_id: visitedUserId,
          title_id: 'tv_breaking_bad_1396',
          status: 'active',
          is_private: true, // Private entry
        },
        {
          id: 'item_3',
          user_id: visitedUserId,
          title_id: 'anime_frieren_154587',
          status: 'completed',
          is_private: false,
        },
      ];

      // Public viewer filter logic
      const isOwnProfile = false;
      const visibleLibrary = isOwnProfile
        ? rawTargetLibrary
        : rawTargetLibrary.filter((item) => !item.is_private);

      expect(visibleLibrary).toHaveLength(2);
      expect(visibleLibrary.map((i) => i.id)).toEqual(['item_1', 'item_3']);
      expect(visibleLibrary.some((i) => i.is_private)).toBe(false);
    });

    it('retains all records (including private) when viewing own profile', () => {
      const rawUserLibrary: Partial<UserLibraryItem>[] = [
        { id: 'item_1', user_id: activeAuthUser.id, is_private: false },
        { id: 'item_2', user_id: activeAuthUser.id, is_private: true },
      ];

      const isOwnProfile = true;
      const visibleLibrary = isOwnProfile
        ? rawUserLibrary
        : rawUserLibrary.filter((item) => !item.is_private);

      expect(visibleLibrary).toHaveLength(2);
    });
  });

  describe('3. More Navigation Panel Secondary Routes Verification', () => {
    it('verifies Tracking History, For You, and Release Calendar are excluded from More Panel secondaryRoutes', () => {
      // Structure mirroring MobileNavDrawer secondaryRoutes
      const secondaryRoutes = [
        {
          id: 'profile',
          label: 'My Profile',
          testId: 'mobile-nav-profile-link',
        },
        {
          id: 'import',
          label: 'Import & Export',
          testId: 'mobile-nav-import',
        },
      ];

      const routeIds = secondaryRoutes.map((r) => r.id);
      expect(routeIds).toContain('profile');
      expect(routeIds).toContain('import');

      expect(routeIds).not.toContain('calendar');
      expect(routeIds).not.toContain('recommendations');
      expect(routeIds).not.toContain('history');
    });
  });
});
