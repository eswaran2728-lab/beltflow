'use client';
import { useState } from 'react';
import { Users, Calendar } from 'lucide-react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getStudents, getClasses, getAtRiskMap } from '@/lib/db';
import { LIFECYCLE_LABEL, Lifecycle, DAY_NAMES } from '@/lib/types';

const lifecycleColor: Record<Lifecycle, 'green' | 'gray' | 'red' | 'yellow'> = { active: 'green', trial: 'yellow', frozen: 'gray', quit: 'red' };

export default function CoachDashboardPage() {
  const { currentUser } = useAuth();
  const { data: classes } = useLive(getClasses, ['classes', 'class_coaches']);
  const { data: students } = useLive(getStudents, ['students', 'enrollments']);
  const { data: atRisk } = useLive(getAtRiskMap, ['attendance']);
  const [selState, setSel] = useState('');

  // RLS already limits coach reads to their assigned classes' students,
  // but also filter the class list to those the coach is assigned to.
  const myClasses = (classes ?? []).filter(c => c.coachIds.includes(currentUser?.id ?? ''));
  const visibleClasses = myClasses.length ? myClasses : (classes ?? []);
  const selectedId = selState || visibleClasses[0]?.id || '';
  const selected = visibleClasses.find(c => c.id === selectedId);
  const roster = (students ?? []).filter(s => s.classIds.includes(selectedId));

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Coach Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome back, {currentUser?.name}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Link href="/dashboard/attendance" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all"><Calendar size={20} className="text-blue-500 mb-2" /><p className="font-semibold text-gray-900 text-sm">Mark Attendance</p></Link>
        <Link href="/dashboard/skills" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all"><Users size={20} className="text-green-500 mb-2" /><p className="font-semibold text-gray-900 text-sm">Skill Tracker</p></Link>
        <Link href="/dashboard/payments" className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-md transition-all"><Users size={20} className="text-yellow-500 mb-2" /><p className="font-semibold text-gray-900 text-sm">Cash Approvals</p></Link>
      </div>

      {visibleClasses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-500">No classes assigned to you yet.</p>
          <p className="text-sm mt-1">Ask the admin to assign you to a class in Settings.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 flex-wrap">
            {visibleClasses.map(c => (
              <button key={c.id} onClick={() => setSel(c.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${selectedId === c.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}><Users size={15} /> {c.name}</button>
            ))}
          </div>

          {selected && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-900">{selected.name}</p>
              <p className="text-xs text-blue-700 mt-0.5">{selected.dayOfWeek != null ? `${DAY_NAMES[selected.dayOfWeek]} ${selected.startTime ?? ''}–${selected.endTime ?? ''}` : selected.scheduleNote}</p>
              <p className="text-xs text-blue-600 mt-0.5">{roster.length} students</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-50"><h2 className="font-bold text-gray-900">Students in {selected?.name}</h2></div>
            <div className="divide-y divide-gray-50">
              {roster.map(s => (
                <Link key={s.id} href={`/dashboard/students/${s.id}`} className="flex items-center justify-between px-5 py-4 hover:bg-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600 text-sm">{s.fullName[0]}</div>
                    <div><p className="font-medium text-gray-900 text-sm">{s.fullName}</p><p className="text-xs text-gray-400">{s.beltName} Belt</p></div>
                    {atRisk?.[s.id] && <Badge label="At Risk" color="red" />}
                  </div>
                  <Badge label={LIFECYCLE_LABEL[s.lifecycle]} color={lifecycleColor[s.lifecycle]} />
                </Link>
              ))}
              {roster.length === 0 && <div className="px-5 py-10 text-center text-gray-400 text-sm">No students in this class yet.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
