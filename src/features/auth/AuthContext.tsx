import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Database } from '../../types/database.types';
import { supabase } from '../../lib/supabase';

export type Profile = Database['public']['Tables']['profiles']['Row'];

export interface UserSession {
  id: string;
  email: string;
  username: string;
}

interface AuthContextType {
  user: UserSession | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (identifier: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const LOCAL_STORAGE_USERS_KEY = 'trackup_mock_users';
const LOCAL_STORAGE_SESSION_KEY = 'trackup_mock_session';
const LOCAL_STORAGE_PROFILES_KEY = 'trackup_mock_profiles';

interface MockUserRecord {
  id: string;
  email: string;
  passwordHash: string;
  username: string;
  displayName: string;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialize session and auth state listener
  useEffect(() => {
    let mounted = true;

    async function checkInitialSession() {
      try {
        // 1. Try live Supabase Auth getSession first
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session && session.user && mounted) {
          const u: UserSession = {
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
          };
          setUser(u);

          // fetch or create profile
          const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single();
          const cachedProfiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
          const cachedBanner = localStorage.getItem(`trackup_banner_${u.id}`) || cachedProfiles[u.id]?.banner_url;
          const cachedAvatar = localStorage.getItem(`trackup_avatar_${u.id}`) || cachedProfiles[u.id]?.avatar_url;

          if (p && mounted) {
            const resolvedProfile: Profile = {
              ...(p as Profile),
              banner_url: (p as Profile).banner_url || cachedBanner || null,
              avatar_url: (p as Profile).avatar_url || cachedAvatar || null,
            };
            setProfile(resolvedProfile);
            try {
              cachedProfiles[u.id] = resolvedProfile;
              localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(cachedProfiles));
              if (resolvedProfile.banner_url) {
                localStorage.setItem(`trackup_banner_${u.id}`, resolvedProfile.banner_url);
              }
              if (resolvedProfile.avatar_url) {
                localStorage.setItem(`trackup_avatar_${u.id}`, resolvedProfile.avatar_url);
              }
            } catch {}
          } else if (mounted) {
            const fallbackProfile: Profile = {
              id: u.id,
              username: u.username,
              display_name: session.user.user_metadata?.display_name || u.username,
              avatar_url: session.user.user_metadata?.avatar_url || cachedAvatar || null,
              banner_url: session.user.user_metadata?.banner_url || cachedBanner || null,
              bio: null,
              library_visibility: 'public',
              activity_visibility: 'public',
              rating_display_preference: 'stars_5',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            setProfile(fallbackProfile);
            try {
              cachedProfiles[u.id] = fallbackProfile;
              localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(cachedProfiles));
              if (fallbackProfile.avatar_url) {
                localStorage.setItem(`trackup_avatar_${u.id}`, fallbackProfile.avatar_url);
              }
            } catch {}
          }
          setLoading(false);
          return;
        }
      } catch {
        // Supabase offline / network error
      }

      // 2. Fallback: check localStorage mock session
      const savedSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
      if (savedSession && mounted) {
        try {
          const parsed = JSON.parse(savedSession) as UserSession;
          setUser(parsed);
          const profiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
          if (profiles[parsed.id]) {
            setProfile(profiles[parsed.id]);
          }
        } catch {
          localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
        }
      }

      if (mounted) setLoading(false);
    }

    checkInitialSession();

    // Subscribe to live auth state changes from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (session?.user) {
        const u: UserSession = {
          id: session.user.id,
          email: session.user.email || '',
          username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
        };
        setUser(u);
        const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        if (p && mounted) {
          const cachedProfiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
          const cachedBanner = localStorage.getItem(`trackup_banner_${u.id}`) || cachedProfiles[u.id]?.banner_url;
          const cachedAvatar = localStorage.getItem(`trackup_avatar_${u.id}`) || cachedProfiles[u.id]?.avatar_url;
          const resolvedProfile: Profile = {
            ...(p as Profile),
            banner_url: (p as Profile).banner_url || cachedBanner || null,
            avatar_url: (p as Profile).avatar_url || cachedAvatar || null,
          };
          setProfile(resolvedProfile);
          try {
            cachedProfiles[u.id] = resolvedProfile;
            localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(cachedProfiles));
            if (resolvedProfile.banner_url) {
              localStorage.setItem(`trackup_banner_${u.id}`, resolvedProfile.banner_url);
            }
            if (resolvedProfile.avatar_url) {
              localStorage.setItem(`trackup_avatar_${u.id}`, resolvedProfile.avatar_url);
            }
          } catch {}
        }
      } else if (event === 'SIGNED_OUT') {
        const hasMockSession = localStorage.getItem(LOCAL_STORAGE_SESSION_KEY);
        if (!hasMockSession) {
          setUser(null);
          setProfile(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (identifier: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    const cleanInput = identifier.trim();
    const cleanUsername = cleanInput.startsWith('@') ? cleanInput.slice(1).trim() : cleanInput;
    const isEmail = cleanInput.includes('@') && cleanInput.includes('.');

    // Lookup user in local storage to support username-based login
    const users: MockUserRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
    const mockMatch = users.find(
      (u) =>
        u.email.toLowerCase() === cleanInput.toLowerCase() ||
        u.username.toLowerCase() === cleanUsername.toLowerCase()
    );

    const targetEmail = isEmail ? cleanInput : (mockMatch?.email || null);

    // 1. Try Supabase Auth signInWithPassword if target email is available
    if (targetEmail) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: targetEmail,
          password,
        });

        if (!error && data?.user) {
          const u: UserSession = {
            id: data.user.id,
            email: data.user.email || targetEmail,
            username: mockMatch?.username || data.user.user_metadata?.username || cleanUsername || targetEmail.split('@')[0],
          };
          setUser(u);

          // Fetch or create profile
          const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single();
          if (p) {
            setProfile(p as Profile);
          } else {
            const newProfile: Profile = {
              id: u.id,
              username: u.username,
              display_name: data.user.user_metadata?.display_name || u.username,
              avatar_url: data.user.user_metadata?.avatar_url || null,
              banner_url: data.user.user_metadata?.banner_url || null,
              bio: null,
              library_visibility: 'public',
              activity_visibility: 'public',
              rating_display_preference: 'stars_5',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            await (supabase.from('profiles') as any).upsert(newProfile);
            setProfile(newProfile);
          }

          // Store session for persistence
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(u));
          setLoading(false);
          return { error: null };
        }

        if (error && !mockMatch) {
          setLoading(false);
          return { error: error.message };
        }
      } catch {
        // Offline / network failure -> proceed to mock auth fallback
      }
    }

    // 2. Mock auth fallback (supports username or email)
    if (!mockMatch || mockMatch.passwordHash !== password) {
      setLoading(false);
      return { error: 'Invalid email/username or password' };
    }

    const session: UserSession = {
      id: mockMatch.id,
      email: mockMatch.email,
      username: mockMatch.username,
    };

    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    setUser(session);

    const profiles: Record<string, Profile> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    if (profiles[mockMatch.id]) {
      setProfile(profiles[mockMatch.id]);
    }

    setLoading(false);
    return { error: null };
  };

  const signUp = async (
    email: string,
    password: string,
    username: string,
    displayName?: string
  ): Promise<{ error: string | null }> => {
    setLoading(true);
    const cleanEmail = email.trim();
    const cleanUsername = username.trim().startsWith('@') ? username.trim().slice(1) : username.trim();
    const cleanDisplayName = displayName?.trim() || cleanUsername;

    // Check unique username and email constraints locally first
    const users: MockUserRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
    if (users.some((u) => u.username.toLowerCase() === cleanUsername.toLowerCase())) {
      setLoading(false);
      return { error: 'Username is already taken' };
    }
    if (users.some((u) => u.email.toLowerCase() === cleanEmail.toLowerCase())) {
      setLoading(false);
      return { error: 'A user with this email already exists' };
    }

    // 1. Try Supabase Auth signUp
    try {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            username: cleanUsername,
            display_name: cleanDisplayName,
          },
        },
      });

      if (error) {
        if (!error.message.includes('fetch') && !error.message.includes('network')) {
          setLoading(false);
          return { error: error.message };
        }
      } else if (data?.user) {
        const u: UserSession = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          username: cleanUsername,
        };

        const newProfile: Profile = {
          id: u.id,
          username: cleanUsername,
          display_name: cleanDisplayName,
          avatar_url: null,
          banner_url: null,
          bio: null,
          library_visibility: 'public',
          activity_visibility: 'public',
          rating_display_preference: 'stars_5',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        // Upsert profile in Supabase
        await (supabase.from('profiles') as any).upsert({
          ...newProfile,
          full_name: cleanDisplayName,
        });
        setProfile(newProfile);

        // Always sync to mock user cache so credentials can log in via username or email
        if (!users.some((x) => x.email.toLowerCase() === cleanEmail.toLowerCase())) {
          users.push({
            id: u.id,
            email: cleanEmail,
            passwordHash: password,
            username: cleanUsername,
            displayName: cleanDisplayName,
          });
          localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
        }

        const profiles: Record<string, Profile> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
        profiles[u.id] = newProfile;
        localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));

        // Persist session
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(u));
        setUser(u);

        setLoading(false);
        return { error: null };
      }
    } catch {
      // Offline fallback
    }

    // 2. Mock auth fallback
    const newId = 'user_' + Math.random().toString(36).substring(2, 11);
    const newRecord: MockUserRecord = {
      id: newId,
      email: cleanEmail,
      passwordHash: password,
      username: cleanUsername,
      displayName: cleanDisplayName,
    };

    users.push(newRecord);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));

    const newProfile: Profile = {
      id: newId,
      username: cleanUsername,
      display_name: cleanDisplayName,
      avatar_url: null,
      banner_url: null,
      bio: null,
      library_visibility: 'public',
      activity_visibility: 'public',
      rating_display_preference: 'stars_5',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const profiles: Record<string, Profile> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    profiles[newId] = newProfile;
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));

    const session: UserSession = { id: newId, email: cleanEmail, username: cleanUsername };
    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    setUser(session);
    setProfile(newProfile);

    setLoading(false);
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    localStorage.removeItem(LOCAL_STORAGE_SESSION_KEY);
    setUser(null);
    setProfile(null);
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (!error) return { error: null };
    } catch {
      // ignore
    }
    return { error: null };
  };

  const updatePassword = async (newPassword: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'Not authenticated' };
    if (!newPassword || newPassword.length < 6) {
      return { error: 'Password must be at least 6 characters long.' };
    }

    const applyMockPassword = () => {
      const users: MockUserRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
      const userIdx = users.findIndex((u) => u.id === user.id || u.email === user.email);
      if (userIdx >= 0) {
        users[userIdx].passwordHash = newPassword;
        localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));
      }
      return { error: null };
    };

    if (user.id.startsWith('user_')) {
      return applyMockPassword();
    }

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        if (error.message?.toLowerCase().includes('fetch') || !window.navigator.onLine) {
          return applyMockPassword();
        }
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      if (err?.message?.toLowerCase().includes('fetch') || !window.navigator.onLine) {
        return applyMockPassword();
      }
      return { error: err?.message || 'Failed to update password.' };
    }
  };

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user || !profile) return { error: 'Not authenticated' };

    const formattedUpdates: Partial<Profile> = { ...updates };
    if (formattedUpdates.username) {
      formattedUpdates.username = formattedUpdates.username.trim().toLowerCase();
    }

    // Helper to persist updates locally in mock storage
    const applyMockUpdate = (): { error: string | null } => {
      const mockUsers: MockUserRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
      const mockProfiles: Record<string, Profile> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');

      if (formattedUpdates.username && formattedUpdates.username !== user.username) {
        const isTakenInUsers = mockUsers.some(
          (u) => u.id !== user.id && u.username.toLowerCase() === formattedUpdates.username!.toLowerCase()
        );
        const isTakenInProfiles = Object.values(mockProfiles).some(
          (p) => p.id !== user.id && p.username?.toLowerCase() === formattedUpdates.username!.toLowerCase()
        );

        if (isTakenInUsers || isTakenInProfiles) {
          return { error: 'Username is already taken. Please choose another.' };
        }
      }

      const updated: Profile = { ...profile, ...formattedUpdates, updated_at: new Date().toISOString() };
      mockProfiles[user.id] = updated;
      localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(mockProfiles));
      if (formattedUpdates.banner_url) {
        localStorage.setItem(`trackup_banner_${user.id}`, formattedUpdates.banner_url);
      } else if (formattedUpdates.banner_url === null) {
        localStorage.removeItem(`trackup_banner_${user.id}`);
      }
      if (formattedUpdates.avatar_url) {
        localStorage.setItem(`trackup_avatar_${user.id}`, formattedUpdates.avatar_url);
      } else if (formattedUpdates.avatar_url === null) {
        localStorage.removeItem(`trackup_avatar_${user.id}`);
      }
      setProfile(updated);

      if (formattedUpdates.username && formattedUpdates.username !== user.username) {
        const updatedUser: UserSession = { ...user, username: formattedUpdates.username };
        setUser(updatedUser);
        localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedUser));

        const userIdx = mockUsers.findIndex((u) => u.id === user.id);
        if (userIdx >= 0) {
          mockUsers[userIdx].username = formattedUpdates.username;
          if (formattedUpdates.display_name) mockUsers[userIdx].displayName = formattedUpdates.display_name;
          localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(mockUsers));
        }
      }

      return { error: null };
    };

    // If session is an offline mock user, bypass Supabase entirely
    if (user.id.startsWith('user_')) {
      return applyMockUpdate();
    }

    try {
      const dbPayload: Record<string, any> = {
        ...formattedUpdates,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('profiles')
        // @ts-expect-error dynamic typing
        .update(dbPayload)
        .eq('id', user.id);

      if (!error) {
        const updatedProfile: Profile = { ...profile, ...formattedUpdates, updated_at: new Date().toISOString() };
        setProfile(updatedProfile);
        try {
          const mockProfiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
          mockProfiles[user.id] = updatedProfile;
          localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(mockProfiles));
          if (formattedUpdates.banner_url) {
            localStorage.setItem(`trackup_banner_${user.id}`, formattedUpdates.banner_url);
          } else if (formattedUpdates.banner_url === null) {
            localStorage.removeItem(`trackup_banner_${user.id}`);
          }
          if (formattedUpdates.avatar_url) {
            localStorage.setItem(`trackup_avatar_${user.id}`, formattedUpdates.avatar_url);
          } else if (formattedUpdates.avatar_url === null) {
            localStorage.removeItem(`trackup_avatar_${user.id}`);
          }
        } catch {}
        if (formattedUpdates.username && formattedUpdates.username !== user.username) {
          const updatedUser: UserSession = { ...user, username: formattedUpdates.username };
          setUser(updatedUser);
          localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedUser));
        }
        return { error: null };
      }

      const errCode = (error as any)?.code;
      const errMsg = ((error as any)?.message || '').toLowerCase();
      if (
        errCode === '23505' ||
        errMsg.includes('unique') ||
        errMsg.includes('duplicate') ||
        errMsg.includes('already exists') ||
        errMsg.includes('profiles_username_key')
      ) {
        return { error: 'Username is already taken. Please choose another.' };
      }

      // If error was due to unrecognized column, retry without full_name
      if (errCode === 'PGRST204' || errMsg.includes('column') || (error as any)?.status === 400) {
        if ('full_name' in dbPayload) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { full_name, ...safePayload } = dbPayload;
          const retryRes = await supabase
            .from('profiles')
            // @ts-expect-error dynamic typing
            .update(safePayload)
            .eq('id', user.id);

          if (!retryRes.error) {
            const updatedProfile: Profile = { ...profile, ...formattedUpdates, updated_at: new Date().toISOString() };
            setProfile(updatedProfile);
            try {
              const mockProfiles = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
              mockProfiles[user.id] = updatedProfile;
              localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(mockProfiles));
              if (formattedUpdates.banner_url) {
                localStorage.setItem(`trackup_banner_${user.id}`, formattedUpdates.banner_url);
              } else if (formattedUpdates.banner_url === null) {
                localStorage.removeItem(`trackup_banner_${user.id}`);
              }
              if (formattedUpdates.avatar_url) {
                localStorage.setItem(`trackup_avatar_${user.id}`, formattedUpdates.avatar_url);
              } else if (formattedUpdates.avatar_url === null) {
                localStorage.removeItem(`trackup_avatar_${user.id}`);
              }
            } catch {}
            if (formattedUpdates.username && formattedUpdates.username !== user.username) {
              const updatedUser: UserSession = { ...user, username: formattedUpdates.username };
              setUser(updatedUser);
              localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(updatedUser));
            }
            return { error: null };
          }
          if (
            (retryRes.error as any)?.code === '23505' ||
            ((retryRes.error as any)?.message || '').toLowerCase().includes('unique')
          ) {
            return { error: 'Username is already taken. Please choose another.' };
          }
        }
      }

      // If network / fetch failed or offline, fall back to mock update
      if (errMsg.includes('failed to fetch') || errMsg.includes('network') || !window.navigator.onLine) {
        return applyMockUpdate();
      }

      return { error: (error as any)?.message || 'Failed to update profile.' };
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (err?.code === '23505' || msg.includes('unique') || msg.includes('duplicate')) {
        return { error: 'Username is already taken. Please choose another.' };
      }
      return applyMockUpdate();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
