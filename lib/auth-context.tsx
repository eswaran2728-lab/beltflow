'use client';
import { createContext, useContext, useCallback, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { AuthUser, UserRole } from './auth';

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  childName?: string;
  assignedClass?: string;
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { success: false, error: error?.message || 'Wrong email or password.' };
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
    // Profile is created server-side by a database trigger; the role is
    // validated there and every new account starts as "pending".
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.name,
          role: data.role,
          phone: data.phone || null,
          child_name: data.childName || null,
          assigned_class: data.assignedClass || null,
          preferred_language: data.preferredLanguage || 'en',
        },
      },
    });

    if (error || !authData.user) {
      return { success: false, error: error?.message || 'Signup failed.' };
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
