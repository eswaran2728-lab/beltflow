'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from './supabase';
import { AuthUser, UserRole, saveSession, loadSession, clearSession } from './auth';

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  childName?: string;
  assignedClass?: string;
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Check existing session
    const session = loadSession();
    if (session) setCurrentUser(session);
    setLoaded(true);

    // Listen for Supabase auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearSession();
        setCurrentUser(null);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    // Check admin hardcoded credentials first
    const { mockLogin } = await import('./auth');
    const mockUser = mockLogin(email, password);
    if (mockUser) {
      saveSession(mockUser);
      setCurrentUser(mockUser);
      return { success: true };
    }

    // Try Supabase auth for real users
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { success: false, error: 'Wrong email or password.' };
    }

    // Get profile from Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', data.user.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      return { success: false, error: 'Account not found. Contact admin.' };
    }

    if (profile.status !== 'approved') {
      await supabase.auth.signOut();
      return { success: false, error: 'Your account is pending admin approval. Please wait.' };
    }

    const user: AuthUser = {
      id: data.user.id,
      email: data.user.email!,
      name: profile.full_name,
      role: profile.role as UserRole,
      phone: profile.phone,
      assignedClassIds: profile.assigned_class_ids,
      childStudentIds: profile.child_student_ids,
      studentId: profile.student_id,
    };

    saveSession(user);
    setCurrentUser(user);
    return { success: true };
  };

  const logout = async () => {
    await supabase.auth.signOut();
    clearSession();
    setCurrentUser(null);
  };

  const signup = async (data: SignupData) => {
    // Register with Supabase auth
    const { data: authData, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
    });

    if (error || !authData.user) {
      return { success: false, error: error?.message || 'Signup failed.' };
    }

    // Create profile with status = pending
    const { error: profileError } = await supabase.from('profiles').insert({
      auth_user_id: authData.user.id,
      full_name: data.name,
      email: data.email,
      phone: data.phone || null,
      role: data.role,
      status: 'pending',
      child_name: data.childName || null,
      assigned_class: data.assignedClass || null,
    });

    if (profileError) {
      return { success: false, error: 'Could not save profile. Try again.' };
    }

    // Sign out immediately — must wait for admin approval
    await supabase.auth.signOut();
    return { success: true };
  };

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
