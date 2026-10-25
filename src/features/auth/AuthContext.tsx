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
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, displayName?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
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

  // Initialize session
  useEffect(() => {
    let mounted = true;

    async function checkSession() {
      try {
        // Try live Supabase Auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (session && session.user && mounted) {
          const u: UserSession = {
            id: session.user.id,
            email: session.user.email || '',
            username: session.user.user_metadata?.username || session.user.email?.split('@')[0] || 'user',
          };
          setUser(u);
          // fetch profile
          const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single();
          if (p && mounted) {
            setProfile(p as Profile);
          }
          setLoading(false);
          return;
        }
      } catch {
        // Supabase offline/mock fallback
      }

      // Fallback: check localStorage mock session
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

    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error && data?.user) {
        const u: UserSession = {
          id: data.user.id,
          email: data.user.email || '',
          username: data.user.user_metadata?.username || email.split('@')[0],
        };
        setUser(u);
        const { data: p } = await supabase.from('profiles').select('*').eq('id', u.id).single();
        if (p) setProfile(p as Profile);
        setLoading(false);
        return { error: null };
      }
    } catch {
      // Offline fallback handling below
    }

    // Mock auth fallback
    const users: MockUserRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
    const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());

    if (!existing || existing.passwordHash !== password) {
      setLoading(false);
      return { error: 'Invalid email or password' };
    }

    const session: UserSession = {
      id: existing.id,
      email: existing.email,
      username: existing.username,
    };

    localStorage.setItem(LOCAL_STORAGE_SESSION_KEY, JSON.stringify(session));
    setUser(session);

    const profiles: Record<string, Profile> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    if (profiles[existing.id]) {
      setProfile(profiles[existing.id]);
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
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName || username,
          },
        },
      });

      if (!error && data?.user) {
        const u: UserSession = {
          id: data.user.id,
          email: data.user.email || '',
          username,
        };
        setUser(u);
        const newProfile: Profile = {
          id: u.id,
          username,
          display_name: displayName || username,
          avatar_url: null,
          bio: null,
          library_visibility: 'public',
          activity_visibility: 'public',
          rating_display_preference: 'stars_5',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(newProfile);
        setLoading(false);
        return { error: null };
      }
    } catch {
      // Offline fallback handling below
    }

    // Mock auth fallback
    const users: MockUserRecord[] = JSON.parse(localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]');
    if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
      setLoading(false);
      return { error: 'A user with this email already exists' };
    }
    if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
      setLoading(false);
      return { error: 'Username is already taken' };
    }

    const newId = 'user_' + Math.random().toString(36).substring(2, 11);
    const newRecord: MockUserRecord = {
      id: newId,
      email,
      passwordHash: password,
      username,
      displayName: displayName || username,
    };

    users.push(newRecord);
    localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(users));

    const newProfile: Profile = {
      id: newId,
      username,
      display_name: displayName || username,
      avatar_url: null,
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

    const session: UserSession = { id: newId, email, username };
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

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user || !profile) return { error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('profiles')
        // @ts-expect-error dynamic typing
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (!error) {
        setProfile({ ...profile, ...updates, updated_at: new Date().toISOString() });
        return { error: null };
      }
    } catch {
      // ignore
    }

    // Mock update
    const updated: Profile = { ...profile, ...updates, updated_at: new Date().toISOString() };
    const profiles: Record<string, Profile> = JSON.parse(localStorage.getItem(LOCAL_STORAGE_PROFILES_KEY) || '{}');
    profiles[user.id] = updated;
    localStorage.setItem(LOCAL_STORAGE_PROFILES_KEY, JSON.stringify(profiles));
    setProfile(updated);
    return { error: null };
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
