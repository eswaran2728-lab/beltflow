'use client';
import { useState } from 'react';
import { Award, CreditCard, Calendar, BookOpen, Trophy, FileText, CheckCircle } from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { mockStudents } from '@/data/students';
import { mockPayments } from '@/data/payments';
import { mockAttendance } from '@/data/attendance';
import { mockStudentSkills } from '@/data/skills';
import { mockGradingEvents } from '@/data/grading';
import { mockAthleteAchievements } from '@/data/tournaments';
import { mockInstructorNotes } from '@/lib/mock-db';
import { SkillProgress } from '@/lib/types';

const progressColors: Record<SkillProgress, 'red' | 'gold' | 'blue' | 'green'> = {
  'Not Started': 'red', 'Learning': 'gold', 'Good': 'blue', 'Mastered': 'green',
};
const progressPct: Record<SkillProgress, number> = {
  'Not Started': 0, 'Learning': 33, 'Good': 66, 'Mastered': 100,
};

export default function ParentPortalPage() {
  const student = mockStudents[0]; // Arjun — logged-in parent's child
  const [tab, setTab] = useState<'overview' | 'attendance' | 'payments' | 'skills' | 'notes' | 'tournaments'>('overview');
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'FPX' | 'Cash'>('FPX');
  const [cashNote, setCashNote] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const payments = mockPayments.filter(p => p.studentId === student.id);
  const attendance = mockAttendance.filter(a => a.studentId === student.id);
  const skills = mockStudentSkills.filter(s => s.studentId === student.id);
  const notes = mockInstructorNotes.filter(n => n.studentId === student.id && !n.isPrivate);
  const achievements = mockAthleteAchievements.filter(a => a.studentId === student.id);
  const upcomingGrading = mockGradingEvents.filter(g => g.status === 'Upcoming' && g.students.includes(student.id));
  const presentCount = attendance.filter(a => a.present).length;
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;
  const currentMonthPayment = payments.find(p => p.month === 'June 2026');

  const tabs = ['overview', 'attendance', 'payments', 'skills', 'notes', 'tournaments'] as const;

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
        <p className="text-white/60 text-sm mb-1">Parent Portal</p>
        <h1 className="text-2xl font-extrabold">{student.fullName}</h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="bg-white/10 text-white/90 text-xs px-3 py-1 rounded-full font-semibold">{student.beltRank} Belt</span>
          <span className="text-white/60 text-sm">{student.classGroup} · {student.branch}</span>
          <Badge label={student.status} color={student.status === 'Active' ? 'green' : 'red'} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-white/10">
          <div><p className="text-2xl font-bold">{attendancePct}%</p><p className="text-white/50 text-xs">Attendance</p></div>
          <div><p className="text-2xl font-bold">{skills.filter(s => s.progress === 'Mastered').length}</p><p className="text-white/50 text-xs">Skills Mastered</p></div>
          <div><p className="text-2xl font-bold">{achievements.length}</p><p className="text-white/50 text-xs">Medals</p></div>
          <div><p className="text-2xl font-bold">{upcomingGrading.length}</p><p className="text-white/50 text-xs">Upcoming Grading</p></div>
        </div>
      </div>

      {currentMonthPayment && currentMonthPayment.status !== 'Paid' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="font-semibold text-orange-900">Payment Due — June 2026</p>
            <p className="text-sm text-orange-700">Monthly fee: RM {currentMonthPayment.amount}</p>
          </div>
          <Button variant="gold" onClick={() => setShowPayModal(true)}>
            <CreditCard size={15} /> Pay Now
          </Button>
        </div>
      )}

      <div className="flex gap-1 overflow-x-auto bg-white rounded-xl border border-gray-100 p-1">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar size={16} /> Attendance</h3>
            <div className="text-center mb-3">
              <p className="text-3xl font-extrabold text-gray-900">{attendancePct}%</p>
              <p className="text-xs text-gray-400">{presentCount} of {attendance.length} sessions</p>
            </div>
            <ProgressBar value={attendancePct} color={attendancePct >= 80 ? 'green' : attendancePct >= 60 ? 'gold' : 'red'} />
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Award size={16} /> Belt Progress</h3>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Award size={28} className="text-blue-600" />
              </div>
              <p className="font-bold text-gray-900">{student.beltRank} Belt</p>
              <p className="text-xs text-gray-400 mt-1">Current rank</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><CreditCard size={16} /> June 2026 Payment</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-900">RM {currentMonthPayment?.amount || 80}</p>
                <p className="text-xs text-gray-400">{currentMonthPayment?.month}</p>
              </div>
              {currentMonthPayment && <PaymentStatusBadge status={currentMonthPayment.status} />}
            </div>
            {currentMonthPayment?.status !== 'Paid' && (
              <button onClick={() => setShowPayModal(true)}
                className="w-full mt-3 bg-yellow-500 text-white text-sm font-semibold py-2 rounded-lg hover:bg-yellow-600">
                Pay Now
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Award size={16} /> Upcoming Grading</h3>
            {upcomingGrading.length === 0 ? (
              <p className="text-sm text-gray-400">No upcoming grading events.</p>
            ) : upcomingGrading.map(g => (
              <div key={g.id}>
                <p className="font-semibold text-gray-900 text-sm">{g.title}</p>
                <p className="text-xs text-gray-500 mt-1">{g.date} · {g.location}</p>
                <p className="text-xs text-gray-400">{g.examiner}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'attendance' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h3 className="font-bold text-gray-900">Attendance Record</h3>
            <p className="text-sm text-gray-500 mt-1">{attendancePct}% overall attendance</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendance.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{a.date}</td>
                  <td className="px-4 py-3"><Badge label={a.present ? 'Present' : 'Absent'} color={a.present ? 'green' : 'red'} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-900">Payment History</h3>
            <Button size="sm" variant="gold" onClick={() => setShowPayModal(true)}>
              <CreditCard size={14} /> Pay Monthly Fee
            </Button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{p.month}</td>
                    <td className="px-4 py-3 text-gray-700">RM {p.amount}</td>
                    <td className="px-4 py-3 text-gray-500">{p.method}</td>
                    <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'skills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><BookOpen size={16} /> Skills Progress</h3>
          <div className="space-y-4">
            {skills.map(skill => (
              <div key={skill.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-800">{skill.skillName}</span>
                  <Badge label={skill.progress} color={progressColors[skill.progress]} />
                </div>
                <ProgressBar value={progressPct[skill.progress]} color={progressColors[skill.progress]} />
              </div>
            ))}
            {skills.length === 0 && <p className="text-gray-400 text-sm">No skills tracked yet.</p>}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-3">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><FileText size={16} /> Instructor Notes</h3>
          {notes.map(n => (
            <div key={n.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-gray-900 text-sm">{n.coachName}</span>
                <span className="text-xs text-gray-400">{n.date}</span>
              </div>
              <p className="text-sm text-gray-600">{n.note}</p>
            </div>
          ))}
          {notes.length === 0 && <p className="text-gray-400 text-sm text-center py-8">No notes from instructors yet.</p>}
        </div>
      )}

      {tab === 'tournaments' && (
        <div className="space-y-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2"><Trophy size={16} /> Tournament History</h3>
          {achievements.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No tournament records yet.</p>
          ) : (
            <div className="space-y-3">
              {achievements.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4">
                  <span className="text-4xl">{a.badge}</span>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900">{a.tournamentName}</p>
                    <p className="text-sm text-gray-500">{a.category} · {a.date}</p>
                  </div>
                  <div className="text-right">
                    <Badge label={a.medal} color={a.medal === 'Gold' ? 'gold' : a.medal === 'Silver' ? 'gray' : 'orange'} />
                    <p className="text-xs text-gray-400 mt-1">{a.points} pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Payment Modal */}
      <Modal isOpen={showPayModal} onClose={() => { setShowPayModal(false); setSubmitted(false); }} title="Pay Monthly Fee">
        {submitted ? (
          <div className="text-center py-6">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900">
              {payMethod === 'FPX' ? 'Redirecting to FPX...' : 'Cash Payment Submitted!'}
            </h3>
            <p className="text-sm text-gray-500 mt-2">
              {payMethod === 'Cash' ? 'Your payment is pending approval from the coach or admin.' : 'You will be redirected to your bank portal.'}
            </p>
            <Button className="mt-6" variant="secondary" onClick={() => { setShowPayModal(false); setSubmitted(false); }}>Close</Button>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Student</span><strong>{student.fullName}</strong></div>
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-500">Month</span><strong>June 2026</strong></div>
              <div className="flex justify-between text-sm"><span className="text-gray-500">Amount</span><strong className="text-lg text-gray-900">RM 80.00</strong></div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Select Payment Method</p>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setPayMethod('FPX')}
                  className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all ${payMethod === 'FPX' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  🏦 Online Banking (FPX)
                </button>
                <button onClick={() => setPayMethod('Cash')}
                  className={`p-4 rounded-xl border-2 text-sm font-semibold transition-all ${payMethod === 'Cash' ? 'border-yellow-500 bg-yellow-50 text-yellow-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  💵 Cash Payment
                </button>
              </div>
            </div>
            {payMethod === 'FPX' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-blue-900">Online Banking via FPX</p>
                <p className="text-xs text-blue-700 mt-1">You will be redirected to your bank portal to complete payment securely. FPX integration coming soon.</p>
              </div>
            )}
            {payMethod === 'Cash' && (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-yellow-900">Cash Payment</p>
                  <p className="text-xs text-yellow-700 mt-1">Submit here to notify your coach. Payment will show as &ldquo;Pending Approval&rdquo; until confirmed.</p>
                </div>
                <textarea value={cashNote} onChange={e => setCashNote(e.target.value)}
                  placeholder="Notes (e.g. paid to Coach Mani on 22 June)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400 h-20 resize-none" />
              </div>
            )}
            <Button variant={payMethod === 'FPX' ? 'primary' : 'gold'} className="w-full" onClick={() => setSubmitted(true)}>
              {payMethod === 'FPX' ? 'Proceed to FPX Payment' : 'Submit Cash Payment'}
            </Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
