'use client';
import { useState } from 'react';
import { Users, BookOpen, FileText, CheckCircle, XCircle, ClipboardList } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { mockStudents } from '@/data/students';
import { mockPayments } from '@/data/payments';
import { mockAttendance } from '@/data/attendance';

const classes = [
  { id: 'c1', name: 'Junior A', branch: 'Sepang Main', schedule: 'Tuesday & Friday, 7:00 PM - 9:00 PM', students: ['s1', 's2', 's7', 's8'] },
  { id: 'c3', name: 'Senior A', branch: 'Sepang Main', schedule: 'Monday & Thursday, 8:00 PM - 10:00 PM', students: ['s5'] },
];

const lessonPlan = {
  topic: 'Intermediate Stick Techniques',
  objectives: ['Review Basic Footwork', 'Practice Single Stick Spinning — 30 min', 'Introduce Double Stick Coordination — 20 min', 'Kuthu Varisai sequence revision — 30 min', 'Cool down and Q&A — 10 min'],
  notes: 'Focus on wrist flexibility for beginners. Advanced students can attempt Sedikuchi patterns.',
};

export default function CoachToolsPage() {
  const [selectedClass, setSelectedClass] = useState(classes[0]);
  const [tab, setTab] = useState<'students' | 'notes' | 'payments' | 'lesson'>('students');
  const [classNote, setClassNote] = useState('');
  const [notesSaved, setNotesSaved] = useState(false);
  const [payments, setPayments] = useState(mockPayments);

  const classStudents = mockStudents.filter(s => selectedClass.students.includes(s.id));
  const pendingPayments = payments.filter(p => p.status === 'Pending Cash Approval');

  const approvePayment = (id: string) => {
    setPayments(payments.map(p => p.id === id ? { ...p, status: 'Paid' as const, paidDate: new Date().toISOString().split('T')[0], approvedBy: 'Coach Mani', receiptNumber: `RCP-${Date.now()}` } : p));
  };

  const recentAttendance = mockAttendance.filter(a => selectedClass.students.includes(a.studentId));

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Coach Tools</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome back, Coach Mani</p>
      </div>

      {/* Class selector */}
      <div className="flex gap-3 flex-wrap">
        {classes.map(c => (
          <button key={c.id} onClick={() => setSelectedClass(c)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${selectedClass.id === c.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}>
            <Users size={15} /> {c.name} — {c.branch}
          </button>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-900">{selectedClass.name} · {selectedClass.branch}</p>
        <p className="text-xs text-blue-700 mt-0.5">{selectedClass.schedule}</p>
        <p className="text-xs text-blue-600 mt-0.5">{classStudents.length} students</p>
      </div>

      <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1">
        {(['students', 'lesson', 'notes', 'payments'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
            {t === 'lesson' ? "Today's Plan" : t}
          </button>
        ))}
      </div>

      {tab === 'students' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-4 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Students in {selectedClass.name}</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {classStudents.map(s => {
              const attended = recentAttendance.filter(a => a.studentId === s.id && a.present).length;
              const total = recentAttendance.filter(a => a.studentId === s.id).length;
              const pct = total > 0 ? Math.round((attended / total) * 100) : 0;
              return (
                <div key={s.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                      {s.fullName[0]}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{s.fullName}</p>
                      <p className="text-xs text-gray-400">{s.beltRank} Belt · {pct}% attendance</p>
                    </div>
                    {s.missedClasses >= 3 && <Badge label="At Risk" color="red" />}
                  </div>
                  <Badge label={s.status} color={s.status === 'Active' ? 'green' : s.status === 'At Risk' ? 'red' : 'gray'} />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'lesson' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <BookOpen size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900">Today&apos;s Lesson Plan</h2>
          </div>
          <div className="bg-blue-50 rounded-xl p-4 mb-4">
            <p className="font-semibold text-blue-900">{lessonPlan.topic}</p>
          </div>
          <h3 className="font-semibold text-gray-700 text-sm mb-3">Session Objectives</h3>
          <ol className="space-y-2">
            {lessonPlan.objectives.map((obj, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">{i + 1}</span>
                <span className="text-sm text-gray-700">{obj}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-yellow-800 mb-1">Coach Notes</p>
            <p className="text-xs text-yellow-700">{lessonPlan.notes}</p>
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
              <FileText size={16} /> Add Class Note
            </h2>
            <textarea value={classNote} onChange={e => { setClassNote(e.target.value); setNotesSaved(false); }}
              placeholder="Write class notes, observations, or reminders for today's session..."
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-28 resize-none" />
            <div className="flex items-center gap-3 mt-3">
              <Button onClick={() => { setNotesSaved(true); setTimeout(() => setNotesSaved(false), 2000); }}>
                Save Note
              </Button>
              {notesSaved && <span className="text-green-600 text-sm font-medium">Saved!</span>}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="font-bold text-gray-900 mb-4">Student Performance Notes</h2>
            <div className="space-y-3">
              {classStudents.map(s => (
                <div key={s.id} className="border border-gray-100 rounded-xl p-4">
                  <p className="font-semibold text-gray-900 text-sm mb-2">{s.fullName}</p>
                  <textarea placeholder={`Add performance note for ${s.fullName}...`}
                    className="w-full border border-gray-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 h-16 resize-none bg-gray-50" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'payments' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Pending Cash Payment Approvals</h2>
            <p className="text-sm text-gray-500 mt-0.5">You can approve cash payments submitted by parents</p>
          </div>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-2 text-green-400" />
              <p className="text-sm">No pending payments. All clear!</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {pendingPayments.map(p => (
                <div key={p.id} className="flex items-center justify-between px-5 py-4 flex-wrap gap-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{p.studentName}</p>
                    <p className="text-xs text-gray-500">{p.month} · RM {p.amount} · Cash</p>
                    {p.notes && <p className="text-xs text-yellow-700 mt-0.5">{p.notes}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approvePayment(p.id)}
                      className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700">
                      <CheckCircle size={13} /> Approve
                    </button>
                    <button className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 border border-red-100">
                      <XCircle size={13} /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
