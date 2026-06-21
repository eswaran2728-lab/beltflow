'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  AuthUser, UserRole,
  mockLogin, mockSignup, saveSession, loadSession, clearSession, DEMO_CREDENTIALS,
} from './auth';

interface SignupData {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone?: string;
  childName?: string;
  assignedClassIds?: string[];
}

interface AuthContextType {
  currentUser: AuthUser | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  signup: (data: SignupData) => Promise<{ success: boolean; error?: string }>;
  switchDemoUser: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const session = loadSession();
    if (session) setCurrentUser(session);
    setLoaded(true);
  }, []);

  const login = async (email: string, password: string) => {
    // TODO: Replace with supabase.auth.signInWithPassword() when connected
    const user = mockLogin(email, password);
    if (!user) return { success: false, error: 'Wrong email or password. Try the demo buttons below.' };
    saveSession(user);
    setCurrentUser(user);
    return { success: true };
  };

  const logout = () => {
    clearSession();
    setCurrentUser(null);
  };

  const signup = async (data: SignupData) => {
    // TODO: Replace with supabase.auth.signUp() when connected
    const user = mockSignup({
      name: data.name,
      email: data.email,
      role: data.role,
      phone: data.phone,
      assignedClassIds: data.assignedClassIds,
      childStudentIds: data.childName ? ['child-' + Date.now()] : undefined,
    });
    saveSession(user);
    setCurrentUser(user);
    return { success: true };
  };

  const switchDemoUser = (role: UserRole) => {
    const creds = DEMO_CREDENTIALS[role];
    const user = mockLogin(creds.email, creds.password);
    if (user) {
      saveSession(user);
      setCurrentUser(user);
    }
  };

  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ currentUser, isAuthenticated: !!currentUser, login, logout, signup, switchDemoUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
