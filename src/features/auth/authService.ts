import { supabase } from '../../lib/supabase';

const LOCAL_STORAGE_USERS_KEY = 'trackup_mock_users';

const isLocalSupabase =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('127.0.0.1') ||
  import.meta.env.VITE_SUPABASE_URL.includes('localhost');

const timeoutMs = isLocalSupabase ? 350 : 3000;

const executeWithTimeout = async <T>(thenable: PromiseLike<T>, ms: number): Promise<T> => {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    ),
  ]);
};

/**
 * Resolves an email address from a given username by querying the Supabase `profiles` table.
 * Falls back to local mock user storage if Supabase query fails or in offline/test mode.
 */
export async function resolveEmailFromUsername(username: string): Promise<string | null> {
  const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
  if (!cleanUsername) return null;

  // 1. Query Supabase profiles table
  try {
    const query = (supabase.from('profiles') as any)
      .select('id, username, email')
      .ilike('username', cleanUsername)
      .maybeSingle();

    const { data, error } = (await executeWithTimeout(query, timeoutMs)) as any;

    if (!error && data?.email) {
      return data.email;
    }
  } catch {
    // ignore network/offline/timeout error
  }

  // 2. Fallback to local mock user storage
  try {
    const users: Array<{ email: string; username: string }> = JSON.parse(
      localStorage.getItem(LOCAL_STORAGE_USERS_KEY) || '[]'
    );
    const match = users.find(
      (u) => u.username.toLowerCase() === cleanUsername
    );
    if (match?.email) {
      return match.email;
    }
  } catch {
    // ignore
  }

  return null;
}

/**
 * Authenticates with Supabase using either an Email address or a Username.
 * If a username is supplied, it is resolved to its associated email address first.
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<{ data?: any; error: string | null; resolvedEmail?: string }> {
  const cleanInput = identifier.trim();
  if (!cleanInput) {
    return { error: 'Please enter your email or username.' };
  }

  const isEmail = cleanInput.includes('@') && cleanInput.includes('.');
  let targetEmail = cleanInput;

  if (!isEmail) {
    const resolved = await resolveEmailFromUsername(cleanInput);
    if (!resolved) {
      return { error: `No account found with username "${cleanInput}".` };
    }
    targetEmail = resolved;
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { data, error: null, resolvedEmail: targetEmail };
  } catch (err: any) {
    return { error: err?.message || 'Failed to authenticate.' };
  }
}
