'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Bell, Menu, LogOut, Shield, Dumbbell, Users, User } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { UserRole } from '@/lib/auth';
import { useLive } from '@/lib/useLive';
import { getNotifications, markNotificationRead } from '@/lib/db';

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

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function NotificationBell() {
  const { data: notifications, refetch } = useLive(getNotifications, ['notifications']);
  const [open, setOpen] = useState(false);
  const unread = (notifications ?? []).filter(n => !n.readAt);

  const onOpen = () => setOpen(o => !o);
  const readOne = async (id: string) => { await markNotificationRead(id); await refetch(); };

  return (
    <div className="relative">
      <button onClick={onOpen} className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative">
        <Bell size={18} className="text-gray-600" />
        {unread.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full text-[10px] font-bold text-white flex items-center justify-center">
            {unread.length > 9 ? '9+' : unread.length}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-xl border border-gray-100 shadow-lg z-40">
            <div className="px-4 py-3 border-b border-gray-50 font-bold text-sm text-gray-900">Notifications</div>
            {(notifications ?? []).length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No notifications yet.</div>
            )}
            {(notifications ?? []).map(n => (
              <Link key={n.id} href={n.linkPath ?? '#'} onClick={() => { setOpen(false); if (!n.readAt) readOne(n.id); }}
                className={`block px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 ${!n.readAt ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{n.body}</p>
                    <p className="text-xs text-gray-300 mt-1">{timeAgo(n.createdAt)}</p>
                  </div>
                  {!n.readAt && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
        {currentUser && <NotificationBell />}

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
