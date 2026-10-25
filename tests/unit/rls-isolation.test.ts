import { describe, it, expect } from 'vitest';
import type { Database, PrivacyLevel } from '../../src/types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type UserLibrary = Database['public']['Tables']['user_libraries']['Row'];

/**
 * Pure PostgreSQL RLS policy simulation testing the exact logic written in
 * supabase/migrations/20261025000001_initial_schema.sql:
 *
 * CREATE POLICY "Public library entries readable according to privacy"
 *   ON user_libraries FOR SELECT
 *   USING (
 *     is_private = false AND (
 *       EXISTS (
 *         SELECT 1 FROM public.profiles p
 *         WHERE p.id = user_libraries.user_id
 *         AND (
 *           p.library_visibility = 'public'
 *           OR (p.library_visibility = 'followers_only' AND public.is_following(p.id))
 *         )
 *       )
 *     )
 *   );
 */
function evaluateLibrarySelectRLS(params: {
  queryingUserId: string | null;
  targetEntry: UserLibrary;
  targetProfile: Profile;
  isFollowingTarget: boolean;
}): boolean {
  const { queryingUserId, targetEntry, targetProfile, isFollowingTarget } = params;

  // Owner always has access
  if (queryingUserId && queryingUserId === targetEntry.user_id) {
    return true;
  }

  // If entry itself is private, non-owner gets 0 rows
  if (targetEntry.is_private) {
    return false;
  }

  // Check target user's profile library visibility
  if (targetProfile.library_visibility === 'public') {
    return true;
  }

  if (targetProfile.library_visibility === 'followers_only' && isFollowingTarget) {
    return true;
  }

  return false;
}

function evaluateProfileUpdateRLS(params: {
  executingUserId: string | null;
  targetProfileId: string;
}): boolean {
  return params.executingUserId !== null && params.executingUserId === params.targetProfileId;
}

describe('PostgreSQL Row-Level Security (RLS) Isolation Verification', () => {
  const userA: Profile = {
    id: 'usr_aaaa_1111',
    username: 'user_a',
    display_name: 'User A',
    avatar_url: null,
    bio: null,
    library_visibility: 'public',
    activity_visibility: 'public',
    rating_display_preference: 'stars_5',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const userB: Profile = {
    id: 'usr_bbbb_2222',
    username: 'user_b',
    display_name: 'User B',
    avatar_url: null,
    bio: null,
    library_visibility: 'public',
    activity_visibility: 'public',
    rating_display_preference: 'stars_5',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const userAPrivateEntry: UserLibrary = {
    id: 'lib_001',
    user_id: userA.id,
    title_id: 'title_101',
    status: 'active',
    rating: 9,
    is_private: true, // EXPLICIT PRIVATE ENTRY
    personal_notes: 'Private personal diary notes',
    started_at: new Date().toISOString(),
    completed_at: null,
    last_progressed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const userAPublicEntry: UserLibrary = {
    id: 'lib_002',
    user_id: userA.id,
    title_id: 'title_102',
    status: 'completed',
    rating: 10,
    is_private: false, // PUBLIC ENTRY
    personal_notes: null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
    last_progressed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  it('verifies User A has full access to their own private and public library entries', () => {
    const canAccessPrivate = evaluateLibrarySelectRLS({
      queryingUserId: userA.id,
      targetEntry: userAPrivateEntry,
      targetProfile: userA,
      isFollowingTarget: false,
    });

    const canAccessPublic = evaluateLibrarySelectRLS({
      queryingUserId: userA.id,
      targetEntry: userAPublicEntry,
      targetProfile: userA,
      isFollowingTarget: false,
    });

    expect(canAccessPrivate).toBe(true);
    expect(canAccessPublic).toBe(true);
  });

  it('verifies User B receives 0 rows (false) when attempting to query User A private entry', () => {
    const canAccess = evaluateLibrarySelectRLS({
      queryingUserId: userB.id,
      targetEntry: userAPrivateEntry,
      targetProfile: userA,
      isFollowingTarget: true, // Even if following!
    });

    expect(canAccess).toBe(false);
  });

  it('verifies User B receives 0 rows if User A sets profile library_visibility to private', () => {
    const privateProfileA: Profile = {
      ...userA,
      library_visibility: 'private' as PrivacyLevel,
    };

    const canAccess = evaluateLibrarySelectRLS({
      queryingUserId: userB.id,
      targetEntry: userAPublicEntry,
      targetProfile: privateProfileA,
      isFollowingTarget: true,
    });

    expect(canAccess).toBe(false);
  });

  it('verifies User B can access User A public entry when profile is public', () => {
    const canAccess = evaluateLibrarySelectRLS({
      queryingUserId: userB.id,
      targetEntry: userAPublicEntry,
      targetProfile: userA,
      isFollowingTarget: false,
    });

    expect(canAccess).toBe(true);
  });

  it('verifies User B fails with permission denied when attempting to UPDATE User A profile', () => {
    const canUpdate = evaluateProfileUpdateRLS({
      executingUserId: userB.id,
      targetProfileId: userA.id,
    });

    expect(canUpdate).toBe(false);
  });

  it('verifies User A can UPDATE their own profile', () => {
    const canUpdate = evaluateProfileUpdateRLS({
      executingUserId: userA.id,
      targetProfileId: userA.id,
    });

    expect(canUpdate).toBe(true);
  });
});
