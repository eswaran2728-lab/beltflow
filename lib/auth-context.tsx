'use client';
import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { supabase, supabaseConfigured, SUPABASE_SETUP_MESSAGE } from './supabase';
import { AuthUser, UserRole } from './auth';

const NETWORK_ERROR_MESSAGE =
  'Cannot reach the BeltFlow server. Check your internet connection — if it is ' +
  'fine, the Supabase project this app points at is unavailable.';

/** True for transport-level failures (project down, offline, DNS gone). */
function isNetworkError(error: { message?: string; status?: number }): boolean {
  return !error.status || /fetch|network/i.test(error.message ?? '');
}

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  childName?: string;
  /** Branch the registration belongs to. Validated server-side by the signup trigger. */
  branchId?: string;
  /** Class within that branch; what a student is ultimately enrolled into. */
  classId?: string;
  preferredLanguage?: 'en' | 'ms' | 'ta';
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface ProfileRow {
  id: string;
  auth_user_id: string;
  academy_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  status: 'pending' | 'approved' | 'rejected';
  preferred_language: 'en' | 'ms' | 'ta' | null;
}

function toAuthUser(profile: ProfileRow): AuthUser {
  return {
    id: profile.id,
    authUserId: profile.auth_user_id,
    academyId: profile.academy_id,
    email: profile.email,
    name: profile.full_name,
    role: profile.role,
    phone: profile.phone ?? undefined,
    preferredLanguage: profile.preferred_language ?? 'en',
  };
}

async function fetchProfile(authUserId: string): Promise<ProfileRow | null> {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('auth_user_id', authUserId)
    .maybeSingle();
  return (data as ProfileRow | null) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (authUserId: string | undefined) => {
    if (!authUserId) {
      setCurrentUser(null);
      return;
    }
    const profile = await fetchProfile(authUserId);
    if (profile && profile.status === 'approved') {
      setCurrentUser(toAuthUser(profile));
    } else {
      setCurrentUser(null);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      await loadUser(session?.user?.id);
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        loadUser(session?.user?.id);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, [loadUser]);

  const login = async (email: string, password: string) => {
    if (!supabaseConfigured) return { success: false, error: SUPABASE_SETUP_MESSAGE };

    let data: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['data'];
    let error: Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>['error'];
    try {
      ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
    } catch {
      return { success: false, error: NETWORK_ERROR_MESSAGE };
    }
    if (error) {
      // supabase-js reports an unreachable project as a retryable fetch error
      // rather than throwing, and its message ("Failed to fetch") reads like a
      // credentials problem. Say what it actually is.
      return { success: false, error: isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error.message };
    }
    if (!data.user) {
      return { success: false, error: 'Wrong email or password.' };
    }

    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: 'Account not found. Contact admin.' };
    }
    if (profile.status === 'rejected') {
      await supabase.auth.signOut();
      return { success: false, error: 'Your registration was rejected. Contact admin.' };
    }
    if (profile.status !== 'approved') {
      await supabase.auth.signOut();
      return { success: false, error: 'Your account is pending admin approval. Please wait.' };
    }

    setCurrentUser(toAuthUser(profile));
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setCurrentUser(null);
  };

  const signup = async (data: SignupData) => {
    if (!supabaseConfigured) return { success: false, error: SUPABASE_SETUP_MESSAGE };

    // Profile is created server-side by a database trigger; the role is
    // validated there and every new account starts as "pending".
    let authData: Awaited<ReturnType<typeof supabase.auth.signUp>>['data'];
    let error: Awaited<ReturnType<typeof supabase.auth.signUp>>['error'];
    try {
      ({ data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.name,
            role: data.role,
            phone: data.phone || null,
            child_name: data.childName || null,
            branch_id: data.branchId || null,
            class_id: data.classId || null,
            preferred_language: data.preferredLanguage || 'en',
          },
        },
      }));
    } catch {
      return { success: false, error: NETWORK_ERROR_MESSAGE };
    }

    if (error) {
      return { success: false, error: isNetworkError(error) ? NETWORK_ERROR_MESSAGE : error.message };
    }
    if (!authData.user) {
      return { success: false, error: 'Signup failed.' };
    }

    // Must wait for admin approval before using the app
    await supabase.auth.signOut();
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, loading, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
