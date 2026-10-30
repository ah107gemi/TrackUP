import { supabase } from '../../lib/supabase';
import { MOCK_COMMUNITY_PROFILES, getStoredFollows } from '../social/socialService';

export interface UserSearchResult {
  id: string;
  username: string;
  display_name: string;
  full_name?: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_following?: boolean;
}

/**
 * Searches users from the Supabase profiles table using case-insensitive partial matching (.ilike()),
 * with a safety limit of 20 results and excluding the currently logged-in user.
 * Falls back safely to offline mock profiles when offline or during test runs.
 */
export async function searchUsers(
  query: string,
  currentUserId?: string
): Promise<UserSearchResult[]> {
  const cleanQuery = query.trim().replace(/^@/, '');

  // 1. Resolve currently logged-in user's ID
  let activeUserId = currentUserId;
  if (!activeUserId) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      activeUserId = authData?.user?.id;
    } catch {
      // Offline / fallback session check
      try {
        const storedSession = localStorage.getItem('trackup_mock_session');
        if (storedSession) {
          activeUserId = JSON.parse(storedSession)?.id;
        }
      } catch {
        // ignore
      }
    }
  }

  const isLocalSupabase =
    !import.meta.env.VITE_SUPABASE_URL ||
    import.meta.env.VITE_SUPABASE_URL.includes('127.0.0.1') ||
    import.meta.env.VITE_SUPABASE_URL.includes('localhost');

  const timeoutMs = isLocalSupabase ? 350 : 6000;

  let liveProfiles: any[] = [];
  let queryFailed = false;

  // 2. Query Supabase profiles table using case-insensitive .ilike()
  try {
    let q = supabase
      .from('profiles')
      .select('id, username, display_name, full_name, avatar_url, bio');

    if (activeUserId) {
      q = q.neq('id', activeUserId);
    }

    if (cleanQuery) {
      q = q.or(
        `username.ilike.%${cleanQuery}%,display_name.ilike.%${cleanQuery}%,full_name.ilike.%${cleanQuery}%`
      );
    }

    q = q.limit(20);

    const res = await Promise.race([
      q,
      new Promise<any>((_, reject) =>
        setTimeout(() => reject(new Error('Search query timed out')), timeoutMs)
      ),
    ]);

    if (!res.error && res.data && res.data.length > 0) {
      liveProfiles = res.data;
    } else {
      queryFailed = true;
    }
  } catch {
    queryFailed = true;
  }

  // Fallback for schemas without full_name column or syntax variations
  if (queryFailed && cleanQuery) {
    try {
      let qFallback = supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, bio');

      if (activeUserId) {
        qFallback = qFallback.neq('id', activeUserId);
      }

      qFallback = qFallback.ilike('username', `%${cleanQuery}%`).limit(20);

      const resFb = await Promise.race([
        qFallback,
        new Promise<any>((_, reject) =>
          setTimeout(() => reject(new Error('Search query timed out')), timeoutMs)
        ),
      ]);

      if (!resFb.error && resFb.data && resFb.data.length > 0) {
        liveProfiles = resFb.data;
      }
    } catch {
      // ignore
    }
  }

  // 3. Fallback map combining live results, curated mock profiles, and locally created users
  const allProfilesMap = new Map<string, UserSearchResult>();

  liveProfiles.forEach((sp: any) => {
    const resolvedUsername = sp.username || 'user';
    const resolvedDisplayName =
      (typeof sp.full_name === 'string' && sp.full_name.trim()) ||
      (typeof sp.display_name === 'string' && sp.display_name.trim()) ||
      resolvedUsername;

    allProfilesMap.set(sp.id, {
      id: sp.id,
      username: resolvedUsername,
      display_name: resolvedDisplayName,
      full_name: sp.full_name || null,
      avatar_url: sp.avatar_url || null,
      bio: sp.bio || null,
    });
  });

  // Seed with mock community profiles
  MOCK_COMMUNITY_PROFILES.forEach((p) => {
    if (!allProfilesMap.has(p.id)) {
      allProfilesMap.set(p.id, {
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url || null,
        bio: p.bio || null,
      });
    }
  });

  // Seed with dynamic registered users created in browser storage
  try {
    const dynamicProfiles: Record<string, any> = JSON.parse(
      localStorage.getItem('trackup_mock_profiles') || '{}'
    );
    Object.values(dynamicProfiles).forEach((p: any) => {
      if (p && p.id && !allProfilesMap.has(p.id)) {
        allProfilesMap.set(p.id, {
          id: p.id,
          username: p.username,
          display_name: p.display_name || p.full_name || p.username,
          full_name: p.full_name || null,
          avatar_url: p.avatar_url || null,
          bio: p.bio || null,
        });
      }
    });
  } catch {
    // ignore
  }

  // Filter by query and exclude active user
  const lowerQ = cleanQuery.toLowerCase();
  const follows = getStoredFollows();

  const results = Array.from(allProfilesMap.values()).filter((p) => {
    if (activeUserId && p.id === activeUserId) return false;
    if (!lowerQ) return true;
    return (
      p.username.toLowerCase().includes(lowerQ) ||
      p.display_name.toLowerCase().includes(lowerQ) ||
      (p.full_name && p.full_name.toLowerCase().includes(lowerQ)) ||
      (p.bio && p.bio.toLowerCase().includes(lowerQ))
    );
  });

  // Sort exact username match first
  results.sort((a, b) => {
    const aExact = a.username.toLowerCase() === lowerQ ? 1 : 0;
    const bExact = b.username.toLowerCase() === lowerQ ? 1 : 0;
    if (aExact !== bExact) return bExact - aExact;
    return a.username.localeCompare(b.username);
  });

  return results.slice(0, 20).map((p) => ({
    ...p,
    is_following: activeUserId
      ? follows.some((f) => f.follower_id === activeUserId && f.following_id === p.id)
      : false,
  }));
}
