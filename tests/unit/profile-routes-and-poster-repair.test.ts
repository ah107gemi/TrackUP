import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolvePosterUrl, resolveBackdropUrl } from '../../src/lib/imageUtils';
import { getProfileByUsername } from '../../src/features/profile/profileService';
import fs from 'fs';
import path from 'path';

// Mock localStorage for Node environment
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => {
    mockStorage[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  length: 0,
} as Storage;

describe('Profile Routes (RLS & ILIKE) and Poster Auto-Repair Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('1. Dynamic Poster Auto-Repair Utility (resolvePosterUrl)', () => {
    it('automatically repairs stale relative TMDB posters starting with a forward slash', () => {
      const staleRelativePath = '/1E5baAaEse26fej7uHcjOgEE2t2.jpg';
      const resolved = resolvePosterUrl(staleRelativePath);
      expect(resolved).toBe('https://image.tmdb.org/t/p/w500/1E5baAaEse26fej7uHcjOgEE2t2.jpg');
    });

    it('repairs raw filenames without leading slashes if they end with valid image extension', () => {
      const rawFilename = '8G2i63sTq1vW0bS8u6r5e71p.jpg';
      const resolved = resolvePosterUrl(rawFilename);
      expect(resolved).toBe('https://image.tmdb.org/t/p/w500/8G2i63sTq1vW0bS8u6r5e71p.jpg');
    });

    it('preserves existing absolute URLs (TMDB or AniList)', () => {
      const fullTmdb = 'https://image.tmdb.org/t/p/w500/a743b67R5AARn4yq1y9wD6oE1hQ.jpg';
      const fullAniList = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx154587.jpg';

      expect(resolvePosterUrl(fullTmdb)).toBe(fullTmdb);
      expect(resolvePosterUrl(fullAniList)).toBe(fullAniList);
    });

    it('preserves local assets starting with /assets/', () => {
      const localLogo = '/assets/trackup-logo.jpg';
      expect(resolvePosterUrl(localLogo)).toBe('/assets/trackup-logo.jpg');
    });

    it('falls back safely for null, undefined, empty, or string literal nulls', () => {
      expect(resolvePosterUrl(null)).toBe('/assets/trackup-logo.jpg');
      expect(resolvePosterUrl(undefined)).toBe('/assets/trackup-logo.jpg');
      expect(resolvePosterUrl('')).toBe('/assets/trackup-logo.jpg');
      expect(resolvePosterUrl('   ')).toBe('/assets/trackup-logo.jpg');
      expect(resolvePosterUrl('null')).toBe('/assets/trackup-logo.jpg');
      expect(resolvePosterUrl('undefined')).toBe('/assets/trackup-logo.jpg');
    });

    it('resolveBackdropUrl formats high-res w1280 TMDB backdrops for relative paths', () => {
      const relativeBackdrop = '/7h5gE2yP9U4m4gW8T0k.jpg';
      const resolved = resolveBackdropUrl(relativeBackdrop);
      expect(resolved).toBe('https://image.tmdb.org/t/p/w1280/7h5gE2yP9U4m4gW8T0k.jpg');
    });
  });

  describe('2. Case-Insensitive Profile Lookup (getProfileByUsername)', () => {
    it('resolves curated mock profiles with case-insensitivity (e.g., "Elena_Tracker")', async () => {
      // Curated profile is 'elena_tracker'
      const res = await getProfileByUsername('Elena_Tracker');
      expect(res).not.toBeNull();
      expect(res?.username.toLowerCase()).toBe('elena_tracker');
      expect(res?.display_name).toBe('Elena Rostova');
    });

    it('resolves profile even when query has leading @ handle symbol (e.g., "@MARCUS_ANIME")', async () => {
      const res = await getProfileByUsername('@MARCUS_ANIME');
      expect(res).not.toBeNull();
      expect(res?.username.toLowerCase()).toBe('marcus_anime');
    });

    it('resolves dynamic registered user stored in local mock profiles with case insensitivity (e.g., "Abdo")', async () => {
      const dynamicProfiles = {
        user_abdo_123: {
          id: 'user_abdo_123',
          username: 'abdo',
          display_name: 'Abdo Developer',
          avatar_url: 'https://example.com/avatar.jpg',
          bio: 'Anime & TV enthusiast',
        },
      };
      localStorage.setItem('trackup_mock_profiles', JSON.stringify(dynamicProfiles));

      // Query with mixed case 'Abdo'
      const res = await getProfileByUsername('Abdo');
      expect(res).not.toBeNull();
      expect(res?.id).toBe('user_abdo_123');
      expect(res?.username).toBe('abdo');
      expect(res?.display_name).toBe('Abdo Developer');
    });

    it('returns null safely when profile cannot be found', async () => {
      const res = await getProfileByUsername('non_existent_user_999999');
      expect(res).toBeNull();
    });
  });

  describe('3. Supabase SQL Migration Integrity Check', () => {
    it('verifies the existence of 20261031000002_unlock_profiles_rls_and_auth_trigger.sql with required policies and triggers', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../../supabase/migrations/20261031000002_unlock_profiles_rls_and_auth_trigger.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sqlContent = fs.readFileSync(migrationPath, 'utf8');

      // 1. RLS Enable
      expect(sqlContent).toContain('ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;');

      // 2. Permissive Read Policy for authenticated users
      expect(sqlContent).toContain('CREATE POLICY "Allow users to read all profiles"');
      expect(sqlContent).toContain('ON public.profiles FOR SELECT');

      // 3. Auth Trigger definition
      expect(sqlContent).toContain('CREATE OR REPLACE FUNCTION public.handle_new_user()');
      expect(sqlContent).toContain('CREATE TRIGGER on_auth_user_created');
      expect(sqlContent).toContain('AFTER INSERT ON auth.users');

      // 4. Case-insensitive username index
      expect(sqlContent).toContain('LOWER(username)');
    });
  });
});
