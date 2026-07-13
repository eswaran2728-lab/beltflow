'use client';
import { Award, Calendar, BookOpen, Lock, User } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import ProgressBar from '@/components/ProgressBar';
import Badge from '@/components/Badge';
import { useLive } from '@/lib/useLive';
import { getMyStudentRecord, getAttendanceForStudent, getStudentSkills, getSkills, getCertificates } from '@/lib/db';
import { SKILL_LEVEL_LABEL, SKILL_LEVEL_PCT, SkillLevel } from '@/lib/types';

const skillColor: Record<SkillLevel, 'red' | 'gold' | 'blue' | 'green'> = { not_started: 'red', learning: 'gold', good: 'blue', mastered: 'green' };

export default function StudentDashboard() {
  const { currentUser } = useAuth();
  const pid = currentUser?.id ?? '';
  const { data: student, loading } = useLive(() => pid ? getMyStudentRecord(pid) : Promise.resolve(null), ['students'], [pid]);
  const { data: attendance } = useLive(() => student ? getAttendanceForStudent(student.id) : Promise.resolve([]), ['attendance'], [student?.id]);
  const { data: studentSkills } = useLive(() => student ? getStudentSkills(student.id) : Promise.resolve([]), ['student_skills'], [student?.id]);
  const { data: skills } = useLive(getSkills, ['skills']);
  const { data: certs } = useLive(() => student ? getCertificates(student.id) : Promise.resolve([]), ['certificates'], [student?.id]);

  if (currentUser && currentUser.role !== 'student') return <div className="flex flex-col items-center justify-center h-64 text-center"><Lock size={40} className="text-gray-300 mb-3" /><p className="text-gray-500 font-medium">Access restricted to students.</p><Link href="/auth/login" className="text-blue-600 text-sm mt-2 hover:underline">Go to Login</Link></div>;
  if (loading) return <div className="max-w-lg mx-auto text-center py-20"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500 text-sm">Loading...</p></div>;
  if (!student) return <div className="max-w-lg mx-auto text-center py-20"><User size={40} className="text-gray-300 mx-auto mb-4" /><h1 className="text-xl font-bold text-gray-900">No student record linked</h1><p className="text-gray-500 text-sm mt-2">Ask the admin to link your student record to your account.</p></div>;

  const present = (attendance ?? []).filter(a => a.status === 'present' || a.status === 'late').length;
  const pct = attendance && attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const mastered = (studentSkills ?? []).filter(s => s.level === 'mastered').length;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-extrabold flex-shrink-0">{student.fullName[0]}</div>
          <div>
            <h1 className="text-xl font-extrabold">{student.fullName}</h1>
            <p className="text-purple-200 text-sm mt-0.5">{student.classNames.join(', ') || 'No class'}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">{student.beltName} Belt</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'Attendance', value: `${pct}%`, icon: <Calendar size={18} className="text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Skills Mastered', value: `${mastered}`, icon: <BookOpen size={18} className="text-green-500" />, bg: 'bg-green-50' },
          { label: 'Certificates', value: `${certs?.length ?? 0}`, icon: <Award size={18} className="text-yellow-500" />, bg: 'bg-yellow-50' }].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}><div className="mb-2">{s.icon}</div><p className="text-lg font-extrabold text-gray-900">{s.value}</p><p className="text-xs text-gray-500 mt-0.5">{s.label}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3"><h2 className="font-bold text-gray-900">Attendance</h2><span className="text-sm text-gray-500">{present}/{attendance?.length ?? 0} classes</span></div>
        <ProgressBar value={pct} color={pct >= 80 ? 'green' : pct >= 60 ? 'gold' : 'red'} />
      </div>

      {(skills ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">My Skills</h2>
          <div className="space-y-3">
            {(skills ?? []).map(sk => {
              const lvl = (studentSkills ?? []).find(x => x.skillId === sk.id)?.level ?? 'not_started';
              return <div key={sk.id}><div className="flex justify-between mb-1"><span className="text-sm text-gray-700 font-medium">{sk.name}</span><Badge label={SKILL_LEVEL_LABEL[lvl]} color={skillColor[lvl]} /></div><ProgressBar value={SKILL_LEVEL_PCT[lvl]} color={skillColor[lvl]} size="sm" /></div>;
            })}
          </div>
        </div>
      )}

      {(certs ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">My Certificates</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(certs ?? []).map(c => (
              <Link key={c.id} href={`/certificate/${c.id}`} className="bg-yellow-50 rounded-xl px-4 py-3 hover:bg-yellow-100 transition-colors block">
                <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.certNo} · {c.issuedAt}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
