'use client';
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { UserRole, DEMO_USERS, ROLE_HOME } from '@/lib/auth';

export default function DemoPage() {
  const { loginAsDemo } = useAuth();
  const router = useRouter();
  const params = useParams();
  const role = params.role as UserRole;

  useEffect(() => {
    const validRoles: UserRole[] = ['admin', 'coach', 'parent', 'student'];
    if (!validRoles.includes(role)) { router.push('/'); return; }
    loginAsDemo(role);
    router.push(ROLE_HOME[role]);
  }, [role, router, loginAsDemo]);

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white/60 text-sm">Loading demo...</p>
      </div>
    </div>
  );
}
