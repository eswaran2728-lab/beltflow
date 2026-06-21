'use client';
import { Award, Calendar, BookOpen, Trophy, Lock } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import ProgressBar from '@/components/ProgressBar';
import Badge from '@/components/Badge';
import { mockStudents } from '@/data/students';
import { mockAttendance } from '@/data/attendance';
import { mockStudentSkills } from '@/data/skills';
import { mockAthleteAchievements } from '@/data/tournaments';

export default function StudentDashboard() {
  const { currentUser } = useAuth();

  if (!currentUser || currentUser.role !== 'student') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <Lock size={40} className="text-gray-300 mb-3" />
        <p className="text-gray-500 font-medium">Access restricted to students only.</p>
        <Link href="/auth/login" className="text-blue-600 text-sm mt-2 hover:underline">Go to Login</Link>
      </div>
    );
  }

  const studentId = currentUser.studentId || 'stu-rubisha';
  const student = mockStudents.find(s => s.id === studentId) || mockStudents[0];
  const attendance = mockAttendance.filter(a => a.studentId === studentId);
  const totalClasses = attendance.length;
  const presentCount = attendance.filter(a => a.present).length;
  const attendancePct = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;
  const skills = mockStudentSkills.filter(s => s.studentId === studentId);
  const masteredSkills = skills.filter(s => s.progress === 'Mastered').length;
  const achievements = mockAthleteAchievements.filter(a => a.studentId === studentId);

  const beltColors: Record<string, string> = {
    White: 'bg-gray-100 text-gray-800', Yellow: 'bg-yellow-100 text-yellow-800',
    Orange: 'bg-orange-100 text-orange-800', Green: 'bg-green-100 text-green-800',
    Blue: 'bg-blue-100 text-blue-800', Purple: 'bg-purple-100 text-purple-800',
    Brown: 'bg-amber-900 text-white', Red: 'bg-red-100 text-red-800', Black: 'bg-gray-900 text-white',
  };

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header card */}
      <div className="bg-gradient-to-br from-purple-900 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-extrabold flex-shrink-0">
            {student.fullName[0]}
          </div>
          <div>
            <h1 className="text-xl font-extrabold">{student.fullName}</h1>
            <p className="text-purple-200 text-sm mt-0.5">{student.classGroup} · {student.branch}</p>
            <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${beltColors[student.beltRank] || 'bg-white/20 text-white'}`}>
              {student.beltRank} Belt
            </span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Attendance', value: `${attendancePct}%`, icon: <Calendar size={18} className="text-blue-500" />, bg: 'bg-blue-50' },
          { label: 'Skills Mastered', value: `${masteredSkills}`, icon: <BookOpen size={18} className="text-green-500" />, bg: 'bg-green-50' },
          { label: 'Achievements', value: `${achievements.length}`, icon: <Trophy size={18} className="text-yellow-500" />, bg: 'bg-yellow-50' },
          { label: 'Belt Rank', value: student.beltRank, icon: <Award size={18} className="text-purple-500" />, bg: 'bg-purple-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className="mb-2">{s.icon}</div>
            <p className="text-lg font-extrabold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Attendance bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-bold text-gray-900">Attendance</h2>
          <span className="text-sm text-gray-500">{presentCount}/{totalClasses} classes</span>
        </div>
        <ProgressBar value={attendancePct} color={attendancePct >= 80 ? 'green' : attendancePct >= 60 ? 'gold' : 'red'} />
        <div className="flex justify-between text-xs text-gray-400 mt-1.5">
          <span>0%</span><span>{attendancePct}% attendance</span><span>100%</span>
        </div>
      </div>

      {/* Skills */}
      {skills.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">My Skills</h2>
          <div className="space-y-3">
            {skills.slice(0, 6).map(s => (
              <div key={s.id}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700 font-medium">{s.skillName}</span>
                  <Badge label={s.progress} color={s.progress === 'Mastered' ? 'green' : s.progress === 'Good' ? 'blue' : s.progress === 'Learning' ? 'gold' : 'red'} />
                </div>
                <ProgressBar
                  value={s.progress === 'Mastered' ? 100 : s.progress === 'Good' ? 66 : s.progress === 'Learning' ? 33 : 0}
                  color={s.progress === 'Mastered' ? 'green' : s.progress === 'Good' ? 'blue' : 'gold'}
                  size="sm"
                />
              </div>
            ))}
          </div>
          <Link href="/dashboard/skills" className="block text-center text-xs text-blue-600 font-semibold mt-4 hover:underline">
            View All Skills →
          </Link>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">My Achievements</h2>
          <div className="space-y-2">
            {achievements.map(a => (
              <div key={a.id} className="flex items-center gap-3 bg-yellow-50 rounded-xl px-4 py-3">
                <span className="text-2xl">{a.medal === 'Gold' ? '🥇' : a.medal === 'Silver' ? '🥈' : '🥉'}</span>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{a.tournamentName}</p>
                  <p className="text-xs text-gray-500">{a.category} · {a.date}</p>
                </div>
                <span className="ml-auto text-xs font-bold text-yellow-700">{a.medal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/dashboard/attendance', label: 'View Attendance', icon: <Calendar size={16} /> },
          { href: '/dashboard/grading', label: 'Belt Grading', icon: <Award size={16} /> },
          { href: '/dashboard/tournaments', label: 'Tournaments', icon: <Trophy size={16} /> },
          { href: '/dashboard/skills', label: 'All Skills', icon: <BookOpen size={16} /> },
        ].map(l => (
          <Link key={l.href} href={l.href}
            className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
            {l.icon}{l.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
