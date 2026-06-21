'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Edit2, Save, X, MessageCircle } from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import Button from '@/components/Button';
import { mockStudents } from '@/data/students';
import { mockPayments } from '@/data/payments';
import { mockAttendance } from '@/data/attendance';
import { mockGradingRecords } from '@/data/grading';
import { mockStudentSkills } from '@/data/skills';
import { mockInstructorNotes } from '@/lib/mock-db';
import { mockAthleteAchievements } from '@/data/tournaments';
import { StudentStatus, BeltRank, SkillProgress } from '@/lib/types';

const skillProgressColor: Record<SkillProgress, 'red' | 'gold' | 'blue' | 'green'> = {
  'Not Started': 'red', 'Learning': 'gold', 'Good': 'blue', 'Mastered': 'green',
};
const skillProgressPct: Record<SkillProgress, number> = {
  'Not Started': 0, 'Learning': 33, 'Good': 66, 'Mastered': 100,
};
const beltColors: Record<string, string> = {
  White: 'bg-gray-100 text-gray-700', Yellow: 'bg-yellow-100 text-yellow-800',
  Orange: 'bg-orange-100 text-orange-800', Green: 'bg-green-100 text-green-800',
  Blue: 'bg-blue-100 text-blue-800', Purple: 'bg-purple-100 text-purple-800',
  Brown: 'bg-amber-100 text-amber-800', Red: 'bg-red-100 text-red-800',
  Black: 'bg-gray-900 text-white',
};

const tabs = ['Overview', 'Attendance', 'Payments', 'Grading', 'Skills', 'Notes', 'Tournaments'];

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Overview');
  const [editing, setEditing] = useState(false);

  const student = mockStudents.find(s => s.id === params.id);
  const [editData, setEditData] = useState(student || null);
  const [noteText, setNoteText] = useState('');

  if (!student || !editData) {
    return (
      <div className="max-w-4xl mx-auto text-center py-20">
        <p className="text-gray-500">Student not found.</p>
        <Button onClick={() => router.back()} variant="secondary" className="mt-4">Go Back</Button>
      </div>
    );
  }

  const payments = mockPayments.filter(p => p.studentId === student.id);
  const attendance = mockAttendance.filter(a => a.studentId === student.id);
  const gradingRecords = mockGradingRecords.filter(g => g.studentId === student.id);
  const skills = mockStudentSkills.filter(s => s.studentId === student.id);
  const notes = mockInstructorNotes.filter(n => n.studentId === student.id);
  const achievements = mockAthleteAchievements.filter(a => a.studentId === student.id);
  const presentCount = attendance.filter(a => a.present).length;
  const attendancePct = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;
  const statusColor: Record<StudentStatus, 'green' | 'gray' | 'red'> = { Active: 'green', Inactive: 'gray', 'At Risk': 'red' };

  const whatsappMsg = `Hi ${student.parentName}, we noticed ${student.fullName} missed a few classes. Hope everything is okay. We would love to see them back in training this week.`;

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <ArrowLeft size={18} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Student Profile</h1>
      </div>

      {/* Profile header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
            {student.fullName[0]}
          </div>
          <div className="flex-1 min-w-0">
            {editing ? (
              <input value={editData.fullName} onChange={e => setEditData({...editData, fullName: e.target.value})}
                className="text-xl font-bold border-b border-blue-400 focus:outline-none w-full" />
            ) : (
              <h2 className="text-xl font-bold text-gray-900">{editData.fullName}</h2>
            )}
            <p className="text-gray-500 text-sm mt-1">{student.classGroup} · {student.branch}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${beltColors[editData.beltRank] || 'bg-gray-100 text-gray-700'}`}>
                {editData.beltRank} Belt
              </span>
              <Badge label={student.status} color={statusColor[student.status]} />
              {student.missedClasses >= 3 && <Badge label="High Risk" color="red" />}
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {student.missedClasses >= 3 && (
              <a href={`https://wa.me/${student.parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="gold">
                  <MessageCircle size={14} /> WhatsApp Parent
                </Button>
              </a>
            )}
            {editing ? (
              <>
                <Button size="sm" variant="primary" onClick={() => setEditing(false)}><Save size={14} /> Save</Button>
                <Button size="sm" variant="secondary" onClick={() => { setEditData(student); setEditing(false); }}><X size={14} /></Button>
              </>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}><Edit2 size={14} /> Edit</Button>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-50">
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{attendancePct}%</p>
            <p className="text-xs text-gray-400">Attendance</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{payments.filter(p => p.status === 'Paid').length}</p>
            <p className="text-xs text-gray-400">Payments Made</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{gradingRecords.length}</p>
            <p className="text-xs text-gray-400">Gradings</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{achievements.length}</p>
            <p className="text-xs text-gray-400">Medals</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto bg-white rounded-xl border border-gray-100 p-1">
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}>
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Personal Information</h3>
            {[
              { label: 'Full Name', value: editData.fullName },
              { label: 'Age', value: `${editData.age} years` },
              { label: 'IC / Passport', value: editData.icNumber },
              { label: 'Join Date', value: editData.joinDate },
            ].map(f => (
              <div key={f.label} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <span className="text-gray-500">{f.label}</span>
                <span className="font-medium text-gray-900">{f.value}</span>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Parent / Contact</h3>
            {[
              { label: 'Parent Name', value: editData.parentName },
              { label: 'Parent Phone', value: editData.parentPhone },
              { label: 'Emergency Contact', value: editData.emergencyContact || 'Not set' },
              { label: 'Branch', value: editData.branch },
              { label: 'Class Group', value: editData.classGroup },
            ].map(f => (
              <div key={f.label} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <span className="text-gray-500">{f.label}</span>
                <span className="font-medium text-gray-900">{f.value}</span>
              </div>
            ))}
          </div>
          {student.missedClasses >= 3 && (
            <div className="lg:col-span-2 bg-red-50 border border-red-100 rounded-xl p-5">
              <h3 className="font-bold text-red-800 mb-2">AI Retention Alert</h3>
              <p className="text-sm text-red-600 mb-3">This student has missed {student.missedClasses} classes. Risk Level: <strong>High</strong></p>
              <div className="bg-white rounded-lg p-4 text-sm text-gray-700 border border-red-100">
                <p className="font-medium text-gray-900 mb-2">Suggested WhatsApp Message:</p>
                <p className="italic text-gray-600">&ldquo;{whatsappMsg}&rdquo;</p>
              </div>
              <a href={`https://wa.me/${student.parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-green-700 transition-colors">
                <MessageCircle size={15} /> Send WhatsApp
              </a>
            </div>
          )}
        </div>
      )}

      {activeTab === 'Attendance' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h3 className="font-bold text-gray-900">Attendance History</h3>
            <p className="text-sm text-gray-500 mt-1">{presentCount}/{attendance.length} sessions attended ({attendancePct}%)</p>
            <div className="mt-3">
              <ProgressBar value={attendancePct} color={attendancePct >= 80 ? 'green' : attendancePct >= 60 ? 'gold' : 'red'} />
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attendance.map(a => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{a.date}</td>
                  <td className="px-4 py-3 text-gray-500">{a.classId}</td>
                  <td className="px-4 py-3">
                    <Badge label={a.present ? 'Present' : 'Absent'} color={a.present ? 'green' : 'red'} />
                  </td>
                </tr>
              ))}
              {attendance.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No attendance records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Payments' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h3 className="font-bold text-gray-900">Payment History</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.month}</td>
                  <td className="px-4 py-3 text-gray-700">RM {p.amount}</td>
                  <td className="px-4 py-3 text-gray-500">{p.method}</td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.receiptNumber || '-'}</td>
                </tr>
              ))}
              {payments.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No payment records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Grading' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50"><h3 className="font-bold text-gray-900">Grading History</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">From</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">To</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Examiner</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {gradingRecords.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-700">{g.date}</td>
                  <td className="px-4 py-3"><Badge label={g.currentBelt} color="gray" /></td>
                  <td className="px-4 py-3"><Badge label={g.targetBelt} color="navy" /></td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{g.examiner}</td>
                  <td className="px-4 py-3"><Badge label={g.result} color={g.result === 'Pass' ? 'green' : g.result === 'Fail' ? 'red' : 'yellow'} /></td>
                </tr>
              ))}
              {gradingRecords.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No grading records</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'Skills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Skill Progress</h3>
          {skills.length === 0 && <p className="text-gray-400 text-sm">No skills tracked yet.</p>}
          <div className="space-y-4">
            {skills.map(skill => (
              <div key={skill.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-gray-800">{skill.skillName}</span>
                  <Badge label={skill.progress} color={skillProgressColor[skill.progress]} />
                </div>
                <ProgressBar value={skillProgressPct[skill.progress]} color={skillProgressColor[skill.progress]} />
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'Notes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4">Add Instructor Note</h3>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
              placeholder="Add a performance or behavioral note..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
            <Button className="mt-3" onClick={() => setNoteText('')}>Save Note</Button>
          </div>
          <div className="space-y-3">
            {notes.map(n => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 text-sm">{n.coachName}</span>
                  <div className="flex items-center gap-2">
                    {n.isPrivate && <Badge label="Private" color="gray" />}
                    <span className="text-xs text-gray-400">{n.date}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{n.note}</p>
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No instructor notes yet.</p>}
          </div>
        </div>
      )}

      {activeTab === 'Tournaments' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Tournament Achievements</h3>
          {achievements.length === 0 && <p className="text-gray-400 text-sm">No tournament records yet.</p>}
          <div className="space-y-3">
            {achievements.map(a => (
              <div key={a.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                <span className="text-3xl">{a.badge}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 text-sm">{a.tournamentName}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.category} · {a.date}</p>
                </div>
                <div className="text-right">
                  <Badge label={a.medal} color={a.medal === 'Gold' ? 'gold' : a.medal === 'Silver' ? 'gray' : 'orange'} />
                  <p className="text-xs text-gray-400 mt-1">{a.points} pts</p>
                </div>
              </div>
            ))}
          </div>
          {achievements.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-50 flex gap-6 text-sm">
              <div><span className="text-gray-500">Total Points: </span><strong>{achievements.reduce((s, a) => s + a.points, 0)}</strong></div>
              <div><span className="text-gray-500">Medals: </span><strong>{achievements.length}</strong></div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
