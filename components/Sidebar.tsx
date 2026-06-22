'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, Calendar, Award, BookOpen,
  CreditCard, Settings, Trophy, Receipt, X, Dumbbell,
  User, CheckSquare, MessageSquare, Bell, UserCheck
} from 'lucide-react';
import { clsx } from 'clsx';
import { UserRole } from '@/lib/auth';

type NavItem = { href: string; label: string; icon: React.ElementType; badge?: string };

const adminNav: NavItem[] = [
  { href: '/dashboard',             label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/dashboard/students',    label: 'Students',        icon: Users },
  { href: '/dashboard/attendance',  label: 'Attendance',      icon: CheckSquare },
  { href: '/dashboard/grading',     label: 'Belt Grading',    icon: Award },
  { href: '/dashboard/skills',      label: 'Skills',          icon: BookOpen },
  { href: '/dashboard/payments',    label: 'Payments',        icon: CreditCard },
  { href: '/dashboard/tournaments', label: 'Tournaments',     icon: Trophy },
  { href: '/dashboard/coach',       label: 'Coach Tools',     icon: Dumbbell },
  { href: '/dashboard/approvals',   label: 'Approvals',       icon: UserCheck, badge: '!' },
  { href: '/dashboard/settings',    label: 'Settings',        icon: Settings },
  { href: '/dashboard/billing',     label: 'Billing',         icon: Receipt, badge: 'Soon' },
];

const coachNav: NavItem[] = [
  { href: '/dashboard/coach',       label: 'Coach Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/students',    label: 'My Students',     icon: Users },
  { href: '/dashboard/attendance',  label: 'Attendance',      icon: CheckSquare },
  { href: '/dashboard/grading',     label: 'Grading',         icon: Award },
  { href: '/dashboard/skills',      label: 'Skill Progress',  icon: BookOpen },
  { href: '/dashboard/payments',    label: 'Cash Approvals',  icon: CreditCard },
  { href: '/dashboard/tournaments', label: 'Tournaments',     icon: Trophy },
  { href: '/dashboard/settings',    label: 'Announcements',   icon: Bell },
];

const parentNav: NavItem[] = [
  { href: '/dashboard/parent',      label: 'Parent Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/attendance',  label: 'Attendance',       icon: CheckSquare },
  { href: '/dashboard/skills',      label: 'Skills Progress',  icon: BookOpen },
  { href: '/dashboard/payments',    label: 'Payments',         icon: CreditCard },
  { href: '/dashboard/grading',     label: 'Grading',          icon: Award },
  { href: '/dashboard/tournaments', label: 'Tournaments',      icon: Trophy },
  { href: '/dashboard/settings',    label: 'Messages',         icon: MessageSquare },
];

const studentNav: NavItem[] = [
  { href: '/dashboard/student',     label: 'My Dashboard',    icon: LayoutDashboard },
  { href: '/dashboard/attendance',  label: 'Attendance',      icon: CheckSquare },
  { href: '/dashboard/skills',      label: 'My Skills',       icon: BookOpen },
  { href: '/dashboard/grading',     label: 'Grading',         icon: Award },
  { href: '/dashboard/tournaments', label: 'Tournaments',     icon: Trophy },
];

const roleNav: Record<UserRole, NavItem[]> = {
  admin:   adminNav,
  coach:   coachNav,
  parent:  parentNav,
  student: studentNav,
};

const roleColors: Record<UserRole, string> = {
  admin:   'bg-[#f59e0b] text-[#0f172a]',
  coach:   'bg-blue-500 text-white',
  parent:  'bg-green-500 text-white',
  student: 'bg-purple-500 text-white',
};

export default function Sidebar({ onClose, role = 'admin' }: { onClose?: () => void; role?: UserRole }) {
  const pathname = usePathname();
  const items = roleNav[role];
  const activeColor = roleColors[role];

  return (
    <aside className="h-full flex flex-col bg-[#0f172a] text-white w-64 flex-shrink-0">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f59e0b] tracking-tight">BeltFlow</h1>
          <p className="text-xs text-white/40 mt-0.5">Martial Arts Management</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors lg:hidden">
            <X size={18} />
          </button>
        )}
      </div>

      {/* Role badge */}
      <div className="px-4 py-2.5 border-b border-white/5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${activeColor}`}>
          <User size={11} />
          {role === 'admin' ? 'Admin' : role === 'coach' ? 'Coach / Master' : role === 'parent' ? 'Parent' : 'Student'}
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {items.map(item => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                active ? activeColor + ' shadow-sm' : 'text-white/65 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon size={17} />
              <span className="flex-1">{item.label}</span>
              {item.badge && (
                <span className="text-xs bg-white/10 text-white/50 px-1.5 py-0.5 rounded-md font-normal">{item.badge}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-white/30 text-center leading-relaxed">
          Persatuan Silambam Malaysia<br />Daerah Sepang
        </p>
      </div>
    </aside>
  );
}
