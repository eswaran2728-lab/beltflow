'use client';
import { useState } from 'react';
import { Users, FileText, CheckCircle, XCircle, Calendar } from 'lucide-react';
import Link from 'next/link';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getStudents, getPayments, getAttendance, getClasses, getBranches, setPaymentStatus, addNote } from '@/lib/db';

export default function CoachToolsPage() {
  const { currentUser } = useAuth();
  const { data: classes } = useLive(getClasses, ['classes']);
  const { data: branches } = useLive(getBranches, ['branches']);
  const { data: students } = useLive(getStudents, ['students']);
  const { data: payments } = useLive(getPayments, ['payments']);
  const { data: attendance } = useLive(getAttendance, ['attendance']);

  const [selectedClassIdState, setSelectedClassId] = useState('');
  const [tab, setTab] = useState<'students' | 'notes' | 'payments'>('students');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [savedNoteFor, setSavedNoteFor] = useState<string | null>(null);

  // Default to the first class once loaded
  const selectedClassId = selectedClassIdState || classes?.[0]?.id || '';

  const selectedClass = classes?.find(c => c.id === selectedClassId) ?? null;
  const classStudents = (students ?? []).filter(s => s.classId === selectedClassId);
  const pendingPayments = (payments ?? []).filter(p => p.status === 'Pending Cash Approval');
  const recentAttendance = (attendance ?? []).filter(a => a.classId === selectedClassId);
  const branchName = selectedClass ? branches?.find(b => b.id === selectedClass.branchId)?.name ?? '' : '';

  const approvePayment = (id: string) => setPaymentStatus(id, 'Paid', currentUser?.name);
  const rejectPayment = (id: string) => setPaymentStatus(id, 'Rejected');

  const saveStudentNote = async (studentId: string) => {
    const text = noteDrafts[studentId]?.trim();
    if (!text || !currentUser) return;
    await addNote({ studentId, coachId: currentUser.id, coachName: currentUser.name, note: text });
    setNoteDrafts({ ...noteDrafts, [studentId]: '' });
    setSavedNoteFor(studentId);
    setTimeout(() => setSavedNoteFor(null), 2000);
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Coach Tools</h1>
        <p className="text-gray-500 text-sm mt-0.5">Welcome back, {currentUser?.name}</p>
      </div>

      {/* Class selector */}
      {(classes ?? []).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-500">No classes configured yet.</p>
          <p className="text-sm mt-1">Ask the admin to add classes in <Link href="/dashboard/settings" className="text-blue-600 hover:underline">Settings</Link>.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-3 flex-wrap">
            {(classes ?? []).map(c => (
              <button key={c.id} onClick={() => setSelectedClassId(c.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${selectedClassId === c.id ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300'}`}>
                <Users size={15} /> {c.name}
              </button>
            ))}
          </div>

          {selectedClass && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm font-semibold text-blue-900">{selectedClass.name}{branchName ? ` · ${branchName}` : ''}</p>
              {selectedClass.schedule && <p className="text-xs text-blue-700 mt-0.5">{selectedClass.schedule}</p>}
              <p className="text-xs text-blue-600 mt-0.5">{classStudents.length} students</p>
            </div>
          )}

          <div className="flex gap-1 bg-white rounded-xl border border-gray-100 p-1">
            {(['students', 'notes', 'payments'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'students' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-4 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">Students in {selectedClass?.name}</h2>
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
                          <p className="text-xs text-gray-400">{s.beltRank} Belt{total > 0 ? ` · ${pct}% attendance` : ''}</p>
                        </div>
                        {s.missedClasses >= 3 && <Badge label="At Risk" color="red" />}
                      </div>
                      <Badge label={s.status} color={s.status === 'Active' ? 'green' : s.status === 'At Risk' ? 'red' : 'gray'} />
                    </div>
                  );
                })}
                {classStudents.length === 0 && (
                  <div className="px-5 py-10 text-center text-gray-400 text-sm">No students assigned to this class yet.</div>
                )}
              </div>
            </div>
          )}

          {tab === 'notes' && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <FileText size={16} /> Student Performance Notes
              </h2>
              <div className="space-y-3">
                {classStudents.map(s => (
                  <div key={s.id} className="border border-gray-100 rounded-xl p-4">
                    <p className="font-semibold text-gray-900 text-sm mb-2">{s.fullName}</p>
                    <textarea
                      value={noteDrafts[s.id] ?? ''}
                      onChange={e => setNoteDrafts({ ...noteDrafts, [s.id]: e.target.value })}
                      placeholder={`Add performance note for ${s.fullName}...`}
                      className="w-full border border-gray-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 h-16 resize-none bg-gray-50" />
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" onClick={() => saveStudentNote(s.id)} disabled={!noteDrafts[s.id]?.trim()}>
                        Save Note
                      </Button>
                      {savedNoteFor === s.id && <span className="text-green-600 text-xs font-medium">Saved!</span>}
                    </div>
                  </div>
                ))}
                {classStudents.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-6">No students in this class.</p>
                )}
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
                        <button onClick={() => rejectPayment(p.id)}
                          className="flex items-center gap-1.5 bg-red-50 text-red-600 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 border border-red-100">
                          <XCircle size={13} /> Reject
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
