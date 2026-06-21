'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, DollarSign, Calendar, Award, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import StatCard from '@/components/StatCard';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import Badge from '@/components/Badge';
import Link from 'next/link';
import { mockStudents } from '@/data/students';
import { mockPayments } from '@/data/payments';
import { mockGradingEvents } from '@/data/grading';
import { mockAttendance } from '@/data/attendance';
import { useAuth } from '@/lib/auth-context';
import { ROLE_HOME } from '@/lib/auth';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.replace(ROLE_HOME[currentUser.role]);
    }
  }, [currentUser, router]);

  if (currentUser && currentUser.role !== 'admin') return null;
  const totalStudents = mockStudents.length;
  const activeStudents = mockStudents.filter(s => s.status === 'Active').length;
  const atRisk = mockStudents.filter(s => s.missedClasses >= 3);
  const monthlyRevenue = mockPayments
    .filter(p => p.status === 'Paid' && p.month === 'June 2026')
    .reduce((sum, p) => sum + p.amount, 0);
  const pendingCash = mockPayments.filter(p => p.status === 'Pending Cash Approval');
  const upcomingGrading = mockGradingEvents.filter(g => g.status === 'Upcoming');
  const recentPayments = mockPayments.slice(0, 5);
  const totalPresent = mockAttendance.filter(a => a.present).length;
  const attendanceRate = Math.round((totalPresent / mockAttendance.length) * 100);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Persatuan Silambam Malaysia Daerah Sepang</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full">
            ✓ Free MVP — All Features Unlocked
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={totalStudents} icon={Users} iconBg="bg-blue-50 text-blue-600" subtitle="Registered members" />
        <StatCard title="Active Students" value={activeStudents} icon={UserCheck} iconBg="bg-green-50 text-green-600" trend={{ value: 'from last month', positive: true }} />
        <StatCard title="Monthly Revenue" value={`RM ${monthlyRevenue}`} icon={DollarSign} iconBg="bg-yellow-50 text-yellow-600" subtitle="June 2026" />
        <StatCard title="Attendance Rate" value={`${attendanceRate}%`} icon={TrendingUp} iconBg="bg-purple-50 text-purple-600" subtitle="Last 30 days" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="At Risk Students" value={atRisk.length} icon={AlertTriangle} iconBg="bg-red-50 text-red-500" subtitle="Missed 3+ classes" />
        <StatCard title="Pending Cash" value={pendingCash.length} icon={Clock} iconBg="bg-orange-50 text-orange-500" subtitle="Awaiting approval" />
        <StatCard title="Upcoming Grading" value={upcomingGrading.length} icon={Award} iconBg="bg-indigo-50 text-indigo-600" subtitle={upcomingGrading[0]?.date || 'None scheduled'} />
        <StatCard title="Classes Today" value={3} icon={Calendar} iconBg="bg-teal-50 text-teal-600" subtitle="Junior A, Senior A, B" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Recent Payments</h2>
            <Link href="/dashboard/payments" className="text-sm text-blue-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentPayments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.studentName}</td>
                    <td className="px-4 py-3 text-gray-500">{p.month}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">RM {p.amount}</td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Upcoming Grading</h2>
            {upcomingGrading.map(g => (
              <div key={g.id} className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Award size={18} className="text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{g.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{g.date}</p>
                  <p className="text-xs text-gray-400">{g.students.length} students registered</p>
                </div>
              </div>
            ))}
            <Link href="/dashboard/grading" className="block mt-3 text-center text-sm text-blue-600 hover:underline font-medium">Manage Grading</Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Students at Risk</h2>
            {atRisk.map(s => (
              <div key={s.id} className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.fullName}</p>
                  <p className="text-xs text-red-500">{s.missedClasses} classes missed</p>
                </div>
                <Badge label="High Risk" color="red" />
              </div>
            ))}
            {atRisk.length === 0 && <p className="text-sm text-gray-400">No at-risk students</p>}
            <Link href="/dashboard/attendance" className="block mt-3 text-center text-sm text-blue-600 hover:underline font-medium">View Attendance</Link>
          </div>
        </div>
      </div>

      {pendingCash.length > 0 && (
        <div className="bg-white rounded-xl border border-orange-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-orange-50">
            <h2 className="font-bold text-gray-900 flex items-center gap-2">
              <Clock size={16} className="text-orange-500" /> Pending Cash Approvals
            </h2>
            <Link href="/dashboard/payments" className="text-sm text-blue-600 hover:underline font-medium">View all</Link>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingCash.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-orange-50 rounded-xl p-3.5">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{p.studentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{p.month} · RM {p.amount}</p>
                  {p.notes && <p className="text-xs text-orange-600 mt-0.5">{p.notes}</p>}
                </div>
                <button className="bg-green-600 text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-green-700 font-semibold ml-2">
                  Approve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
