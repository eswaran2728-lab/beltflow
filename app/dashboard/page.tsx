'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, UserCheck, DollarSign, Calendar, Award, AlertTriangle, TrendingUp, Clock } from 'lucide-react';
import StatCard from '@/components/StatCard';
import InvoiceStatusBadge from '@/components/InvoiceStatusBadge';
import Badge from '@/components/Badge';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { ROLE_HOME } from '@/lib/auth';
import { useLive } from '@/lib/useLive';
import { getStudents, getInvoices, getGradingEvents, getClasses, getAtRiskMap, getAcademy, getBelts, getBranches } from '@/lib/db';
import { firstOfMonth, monthLabel } from '@/lib/types';

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const router = useRouter();

  const { data: students } = useLive(getStudents, ['students', 'enrollments', 'grading_results']);
  const { data: invoices } = useLive(getInvoices, ['invoices', 'payments']);
  const { data: gradingEvents } = useLive(getGradingEvents, ['grading_events']);
  const { data: classes } = useLive(getClasses, ['classes', 'class_coaches']);
  const { data: atRisk } = useLive(getAtRiskMap, ['attendance']);
  const { data: academy } = useLive(getAcademy, ['academies']);
  const { data: belts } = useLive(getBelts, ['belts']);
  const { data: branches } = useLive(getBranches, ['branches']);

  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') router.replace(ROLE_HOME[currentUser.role]);
  }, [currentUser, router]);
  if (currentUser && currentUser.role !== 'admin') return null;

  const thisMonth = firstOfMonth();
  const totalStudents = students?.length ?? 0;
  const activeStudents = students?.filter(s => s.lifecycle === 'active').length ?? 0;
  const monthlyRevenue = invoices?.filter(i => i.status === 'paid' && i.billingMonth === thisMonth)
    .reduce((sum, i) => sum + i.net, 0) ?? 0;
  const pendingApprovals = invoices?.filter(i => i.status === 'pending_approval') ?? [];
  const upcomingGrading = gradingEvents?.filter(g => new Date(g.eventDate) >= new Date(new Date().toDateString())) ?? [];
  const atRiskEntries = Object.entries(atRisk ?? {});
  const recentInvoices = invoices?.slice(0, 5) ?? [];
  const studentName = (id: string) => students?.find(s => s.id === id)?.fullName ?? '—';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Persatuan Silambam Malaysia — Daerah Sepang</p>
        </div>
        <span className="inline-flex items-center gap-1.5 bg-green-100 text-green-800 text-xs font-bold px-3 py-1.5 rounded-full">
          ✓ Live Data — Updates in Real Time
        </span>
      </div>

      <OnboardingChecklist
        hasAcademyInfo={!!academy?.description}
        hasBelts={(belts?.length ?? 0) > 0}
        hasBranchOrClass={(branches?.length ?? 0) > 0 || (classes?.length ?? 0) > 0}
        hasStudent={totalStudents > 0}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Students" value={totalStudents} icon={Users} iconBg="bg-blue-50 text-blue-600" subtitle="All members" />
        <StatCard title="Active Students" value={activeStudents} icon={UserCheck} iconBg="bg-green-50 text-green-600" subtitle="Currently training" />
        <StatCard title="Revenue This Month" value={`RM ${monthlyRevenue}`} icon={DollarSign} iconBg="bg-yellow-50 text-yellow-600" subtitle={monthLabel(thisMonth)} />
        <StatCard title="Classes" value={classes?.length ?? 0} icon={Calendar} iconBg="bg-teal-50 text-teal-600" subtitle="Configured" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="At Risk Students" value={atRiskEntries.length} icon={AlertTriangle} iconBg="bg-red-50 text-red-500" subtitle="3+ recent absences" />
        <StatCard title="Pending Payments" value={pendingApprovals.length} icon={Clock} iconBg="bg-orange-50 text-orange-500" subtitle="Awaiting approval" />
        <StatCard title="Upcoming Grading" value={upcomingGrading.length} icon={Award} iconBg="bg-indigo-50 text-indigo-600" subtitle={upcomingGrading[0]?.eventDate || 'None scheduled'} />
        <StatCard title="Unpaid Invoices" value={invoices?.filter(i => i.status === 'unpaid' || i.status === 'overdue').length ?? 0} icon={TrendingUp} iconBg="bg-purple-50 text-purple-600" subtitle="Outstanding" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between p-5 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Recent Invoices</h2>
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
                {recentInvoices.map(i => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{studentName(i.studentId)}</td>
                    <td className="px-4 py-3 text-gray-500">{monthLabel(i.billingMonth)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">RM {i.net}</td>
                    <td className="px-4 py-3"><InvoiceStatusBadge status={i.status} /></td>
                  </tr>
                ))}
                {recentInvoices.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No invoices yet. Generate them from the Payments page.</td></tr>
                )}
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
                  <p className="font-semibold text-gray-900 text-sm">{g.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{g.eventDate}</p>
                </div>
              </div>
            ))}
            {upcomingGrading.length === 0 && <p className="text-sm text-gray-400">No grading events scheduled.</p>}
            <Link href="/dashboard/grading" className="block mt-3 text-center text-sm text-blue-600 hover:underline font-medium">Manage Grading</Link>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Students at Risk</h2>
            {atRiskEntries.map(([sid, count]) => (
              <div key={sid} className="flex items-center justify-between mb-3">
                <div>
                  <Link href={`/dashboard/students/${sid}`} className="text-sm font-medium text-gray-900 hover:text-blue-600">{studentName(sid)}</Link>
                  <p className="text-xs text-red-500">{count} recent absences</p>
                </div>
                <Badge label="High Risk" color="red" />
              </div>
            ))}
            {atRiskEntries.length === 0 && <p className="text-sm text-gray-400">No at-risk students</p>}
            <Link href="/dashboard/attendance" className="block mt-3 text-center text-sm text-blue-600 hover:underline font-medium">View Attendance</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
