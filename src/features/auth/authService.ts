import { supabase } from '../../lib/supabase';

const LOCAL_STORAGE_USERS_KEY = 'trackup_mock_users';

const timeoutMs = 4000;

const executeWithTimeout = async <T>(thenable: PromiseLike<T>, ms: number): Promise<T> => {
  return Promise.race([
    Promise.resolve(thenable),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Query timed out after ${ms}ms`)), ms)
    ),
  ]);
};

/**
 * Accurately determines if an identifier is an email address.
 * Robust check: contains '@', does not start with '@' (which denotes a username),
 * and has non-empty local-part and domain segments.
 */
export function isEmailIdentifier(identifier: string): boolean {
  const clean = identifier.trim();
  if (!clean || clean.startsWith('@')) return false;
  return clean.includes('@') && /^[^\s@]+@[^\s@]+$/i.test(clean);
}

/**
 * Resolves an email address from a given username by querying the Supabase `profiles` table.
 * Uses ILIKE for case-insensitive matching and falls back to local mock user storage if needed.
 */
export async function resolveEmailFromUsername(username: string): Promise<string | null> {
  const cleanUsername = username.trim().replace(/^@/, '');
  if (!cleanUsername) return null;

  // 1. Query Supabase profiles table using ILIKE for case-insensitive matching
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
      (u) => u.username.toLowerCase() === cleanUsername.toLowerCase()
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
 * If the identifier is an email, it bypasses profile lookup entirely and directly calls signInWithPassword.
 * If it is NOT an email, it proceeds with username-to-email resolution first.
 */
export async function signInWithIdentifier(
  identifier: string,
  password: string
): Promise<{ data?: any; error: string | null; resolvedEmail?: string }> {
  const cleanInput = identifier.trim();
  if (!cleanInput) {
    return { error: 'Please enter your email or username.' };
  }

  // 1. If it IS an email, bypass profile lookup entirely and directly authenticate
  if (isEmailIdentifier(cleanInput)) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanInput,
        password,
      });

      if (error) {
        return { error: error.message };
      }

      return { data, error: null, resolvedEmail: cleanInput };
    } catch (err: any) {
      return { error: err?.message || 'Failed to authenticate.' };
    }
  }

  // 2. If it is NOT an email, proceed with the username lookup
  const cleanUsername = cleanInput.startsWith('@') ? cleanInput.slice(1).trim() : cleanInput;
  const resolvedEmail = await resolveEmailFromUsername(cleanUsername);

  if (!resolvedEmail) {
    return { error: `No account found with username "${cleanInput}".` };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: resolvedEmail,
      password,
    });

    if (error) {
      return { error: error.message };
    }

    return { data, error: null, resolvedEmail };
  } catch (err: any) {
    return { error: err?.message || 'Failed to authenticate.' };
  }
}
