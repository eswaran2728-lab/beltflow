'use client';
import { Bell, Menu, LogOut, Shield, Dumbbell, Users, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/auth';

const roleIcon: Record<UserRole, React.ReactNode> = {
  admin:   <Shield size={11} />,
  coach:   <Dumbbell size={11} />,
  parent:  <Users size={11} />,
  student: <User size={11} />,
};

const roleLabel: Record<UserRole, string> = {
  admin:   'Admin',
  coach:   'Coach',
  parent:  'Parent',
  student: 'Student',
};

const roleBadge: Record<UserRole, string> = {
  admin:   'bg-[#0f172a] text-white',
  coach:   'bg-blue-100 text-blue-800',
  parent:  'bg-green-100 text-green-800',
  student: 'bg-purple-100 text-purple-800',
};

export default function Topbar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 sticky top-0 z-30 flex-shrink-0">
      <div className="flex items-center gap-3">
        {onMenuClick && (
          <button onClick={onMenuClick} className="p-2 rounded-lg hover:bg-gray-100 transition-colors lg:hidden">
            <Menu size={20} className="text-gray-600" />
          </button>
        )}
        <span className="text-sm font-medium text-gray-500 hidden sm:block truncate max-w-xs">
          Persatuan Silambam Malaysia Daerah Sepang
        </span>
      </div>

      <div className="flex items-center gap-2">
        <button className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
          <Bell size={18} className="text-gray-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
        </button>

        {currentUser ? (
          <div className="flex items-center gap-2">
            {/* Role badge */}
            <span className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${roleBadge[currentUser.role]}`}>
              {roleIcon[currentUser.role]}
              {roleLabel[currentUser.role]}
            </span>
            {/* User name */}
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
              <div className="w-6 h-6 bg-[#0f172a] rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-white text-xs font-bold">{currentUser.name[0]}</span>
              </div>
              <span className="text-xs font-semibold text-gray-700 hidden sm:block max-w-[100px] truncate">
                {currentUser.name.split(' ')[0]}
              </span>
            </div>
            {/* Logout */}
            <button onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-red-50 hover:text-red-600 text-gray-400 transition-colors"
              title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <button onClick={() => router.push('/auth/login')}
            className="text-sm font-semibold text-blue-600 hover:underline px-2">
            Login
          </button>
        )}
      </div>
    </header>
  );
}
