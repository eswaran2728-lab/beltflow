export type UserRole = 'admin' | 'coach' | 'parent' | 'student';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone?: string;
  assignedClassIds?: string[];
  childStudentIds?: string[];
  studentId?: string;
}

const MOCK_USERS: (AuthUser & { password: string })[] = [
  {
    id: 'u-admin',
    email: 'eswaran2728@gmail.com',
    password: 'Eswaran0321@',
    role: 'admin',
    name: 'ESWARAN A/L Padmanathan',
  },
  {
    id: 'u-coach',
    email: 'coach@beltflow.com',
    password: 'coach123',
    role: 'coach',
    name: 'Master Vijay',
    assignedClassIds: ['sungai-pelek-kids', 'sungai-pelek-senior'],
  },
  {
    id: 'u-parent',
    email: 'parent@beltflow.com',
    password: 'parent123',
    role: 'parent',
    name: 'Parent of Rubisha',
    childStudentIds: ['stu-rubisha'],
  },
  {
    id: 'u-student',
    email: 'student@beltflow.com',
    password: 'student123',
    role: 'student',
    name: 'Rubisha',
    studentId: 'stu-rubisha',
  },
];

const STORAGE_KEY = 'beltflow_auth_user';

export function mockLogin(email: string, password: string): AuthUser | null {
  const found = MOCK_USERS.find(u => u.email === email && u.password === password);
  if (!found) return null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...user } = found;
  return user;
}

export function mockSignup(data: {
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  childStudentIds?: string[];
  assignedClassIds?: string[];
}): AuthUser {
  // TODO: Replace with supabase.auth.signUp() when Supabase is connected
  return {
    id: `u-${Date.now()}`,
    email: data.email,
    name: data.name,
    role: data.role,
    phone: data.phone,
    childStudentIds: data.childStudentIds,
    assignedClassIds: data.assignedClassIds,
  };
}

export function saveSession(user: AuthUser): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }
}

export function loadSession(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const DEMO_CREDENTIALS: Record<UserRole, { email: string; password: string }> = {
  admin:   { email: 'eswaran2728@gmail.com', password: 'Eswaran0321@' },
  coach:   { email: 'coach@beltflow.com',   password: 'coach123'   },
  parent:  { email: 'parent@beltflow.com',  password: 'parent123'  },
  student: { email: 'student@beltflow.com', password: 'student123' },
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:   'Admin',
  coach:   'Coach / Master',
  parent:  'Parent',
  student: 'Student',
};

export const ROLE_HOME: Record<UserRole, string> = {
  admin:   '/dashboard',
  coach:   '/dashboard/coach',
  parent:  '/dashboard/parent',
  student: '/dashboard/student',
};
