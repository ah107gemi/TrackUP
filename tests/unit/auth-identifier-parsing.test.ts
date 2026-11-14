import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isEmailIdentifier,
  signInWithIdentifier,
  resolveEmailFromUsername,
} from '../../src/features/auth/authService';
import { supabase } from '../../src/lib/supabase';

// Node.js mock localStorage for unit tests
const mockStore: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStore[key] || null,
  setItem: (key: string, val: string) => {
    mockStore[key] = String(val);
  },
  removeItem: (key: string) => {
    delete mockStore[key];
  },
  clear: () => {
    Object.keys(mockStore).forEach((k) => delete mockStore[k]);
  },
  key: (i: number) => Object.keys(mockStore)[i] || null,
  length: 0,
} as Storage;

describe('Auth Identifier Parsing & Anon Profile Resolution Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Robust Email vs. Username Detection (isEmailIdentifier)', () => {
    it('accurately identifies valid emails', () => {
      expect(isEmailIdentifier('user@example.com')).toBe(true);
      expect(isEmailIdentifier('alex.hunter+tracker@sub.domain.org')).toBe(true);
      expect(isEmailIdentifier('valid_user123@gmail.com')).toBe(true);
      expect(isEmailIdentifier('   spaces_around@domain.co   ')).toBe(true);
    });

    it('accurately identifies usernames and rejects non-emails', () => {
      expect(isEmailIdentifier('johndoe')).toBe(false);
      expect(isEmailIdentifier('@johndoe')).toBe(false);
      expect(isEmailIdentifier('@sarah_connor')).toBe(false);
      expect(isEmailIdentifier('master_tracker_prime')).toBe(false);
      expect(isEmailIdentifier('user123')).toBe(false);
      expect(isEmailIdentifier('')).toBe(false);
      expect(isEmailIdentifier('   ')).toBe(false);
    });
  });

  describe('2. signInWithIdentifier Execution Paths', () => {
    it('bypasses profile lookup entirely when input is an email and calls signInWithPassword', async () => {
      const signInSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: { user: { id: 'u1', email: 'test@example.com' }, session: {} } as any,
        error: null,
      });

      const profileFromSpy = vi.spyOn(supabase, 'from');

      const result = await signInWithIdentifier('  test@example.com  ', 'correct_password');

      expect(signInSpy).toHaveBeenCalledTimes(1);
      expect(signInSpy).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'correct_password',
      });
      // Crucial: Supabase profiles table query must NOT be invoked when identifier is an email
      expect(profileFromSpy).not.toHaveBeenCalled();
      expect(result.error).toBeNull();
      expect(result.resolvedEmail).toBe('test@example.com');
    });

    it('proceeds with username lookup when input is a username, resolving case-insensitively', async () => {
      // Mock local storage mock users
      localStorage.setItem(
        'trackup_mock_users',
        JSON.stringify([
          { id: 'u2', username: 'alex_hunter', email: 'alex@example.com' },
          { id: 'u3', username: 'Elena_Tracker', email: 'elena@domain.org' },
        ])
      );

      // Verify resolveEmailFromUsername directly
      const directResolved = await resolveEmailFromUsername('elena_tracker');
      expect(directResolved).toBe('elena@domain.org');

      const signInSpy = vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({
        data: { user: { id: 'u3', email: 'elena@domain.org' }, session: {} } as any,
        error: null,
      });

      // Test with @ prefix and case variations
      const result = await signInWithIdentifier('@elena_tracker', 'secretPass');

      expect(signInSpy).toHaveBeenCalledWith({
        email: 'elena@domain.org',
        password: 'secretPass',
      });
      expect(result.error).toBeNull();
      expect(result.resolvedEmail).toBe('elena@domain.org');
    });

    it('returns an appropriate error when username cannot be resolved to any email', async () => {
      const signInSpy = vi.spyOn(supabase.auth, 'signInWithPassword');

      const result = await signInWithIdentifier('non_existent_username_xyz', 'anyPassword');

      expect(signInSpy).not.toHaveBeenCalled();
      expect(result.error).toContain('No account found with username "non_existent_username_xyz"');
    });
  });

  describe('3. Supabase anon Role Migration & RLS Policies', () => {
    it('verifies migration grants anon SELECT access on public.profiles', () => {
      const migrationPath = path.resolve(
        __dirname,
        '../../supabase/migrations/20261114000001_allow_anon_profiles_read.sql'
      );
      expect(fs.existsSync(migrationPath)).toBe(true);

      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toContain('GRANT SELECT ON TABLE public.profiles TO anon');
      expect(sql).toContain('CREATE POLICY "Allow anon and authenticated to read profiles"');
      expect(sql).toContain('TO anon, authenticated');
    });
  });
});
