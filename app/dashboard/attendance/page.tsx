'use client';
import { useState } from 'react';
import { MessageCircle, CheckCircle, XCircle, AlertTriangle, Calendar } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getStudents, getAttendance, getClasses, getBranches, saveAttendance } from '@/lib/db';

export default function AttendancePage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';

  const { data: classes } = useLive(getClasses, ['classes']);
  const { data: branches } = useLive(getBranches, ['branches']);
  const { data: students } = useLive(getStudents, ['students']);
  const { data: history } = useLive(getAttendance, ['attendance']);

  const [selectedClassState, setSelectedClass] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [tab, setTab] = useState<'mark' | 'history'>(isStaff ? 'mark' : 'history');
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Default to the first class once loaded
  const selectedClass = selectedClassState || classes?.[0]?.id || '';
  const classStudents = (students ?? []).filter(s => s.classId === selectedClass);

  // Default everyone to present when the class roster changes (state adjusted during render)
  const rosterKey = `${selectedClass}:${classStudents.map(s => s.id).join(',')}`;
  const [prevRosterKey, setPrevRosterKey] = useState('');
  if (rosterKey !== prevRosterKey) {
    setPrevRosterKey(rosterKey);
    setAttendance(Object.fromEntries(classStudents.map(s => [s.id, true])));
    setSaved(false);
  }

  const presentCount = Object.values(attendance).filter(Boolean).length;
  const absentCount = Object.values(attendance).filter(v => !v).length;

  const handleSave = async () => {
    if (!selectedClass || classStudents.length === 0) return;
    setSaving(true);
    setError('');
    try {
      await saveAttendance(
        classStudents.map(s => ({
          studentId: s.id, classId: selectedClass, date, present: attendance[s.id] ?? true,
        })),
        currentUser?.id ?? null,
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save attendance.');
    } finally {
      setSaving(false);
    }
  };

  const atRiskStudents = (students ?? []).filter(s => s.missedClasses >= 3);
  const historyRecords = (history ?? []).slice(0, 25);
  const selectedClassInfo = classes?.find(c => c.id === selectedClass);
  const branchName = (branchId: string | null) => branches?.find(b => b.id === branchId)?.name ?? '';
  const studentName = (id: string) => students?.find(s => s.id === id)?.fullName ?? '—';
  const className = (id: string | null) => classes?.find(c => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-0.5">Track and manage class attendance</p>
      </div>

      {isStaff && (
        <div className="flex gap-2 bg-white rounded-xl border border-gray-100 p-1 w-fit">
          {(['mark', 'history'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t === 'mark' ? 'Mark Attendance' : 'History'}
            </button>
          ))}
        </div>
      )}

      {tab === 'mark' && isStaff && (
        <div className="space-y-4">
          {(classes ?? []).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              <Calendar size={36} className="mx-auto mb-3 opacity-40" />
              <p className="font-medium text-gray-500">No classes configured yet.</p>
              <p className="text-sm mt-1">Add branches and classes in <Link href="/dashboard/settings" className="text-blue-600 hover:underline">Settings</Link> first.</p>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                    <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                      {(classes ?? []).map(c => (
                        <option key={c.id} value={c.id}>{c.name}{branchName(c.branchId) ? ` — ${branchName(c.branchId)}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{presentCount}</p>
                      <p className="text-xs text-gray-400">Present</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-500">{absentCount}</p>
                      <p className="text-xs text-gray-400">Absent</p>
                    </div>
                  </div>
                </div>
                {selectedClassInfo?.schedule && (
                  <p className="text-xs text-gray-400 mt-3">Schedule: {selectedClassInfo.schedule}</p>
                )}
              </div>

              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Students ({classStudents.length})</h2>
                  <div className="flex gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setAttendance(Object.fromEntries(classStudents.map(s => [s.id, true])))}>
                      All Present
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => setAttendance(Object.fromEntries(classStudents.map(s => [s.id, false])))}>
                      All Absent
                    </Button>
                  </div>
                </div>
                <div className="divide-y divide-gray-50">
                  {classStudents.map(student => (
                    <div key={student.id} className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">
                          {student.fullName[0]}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{student.fullName}</p>
                          <p className="text-xs text-gray-400">{student.beltRank} Belt · Age {student.age}</p>
                        </div>
                        {student.missedClasses >= 3 && (
                          <Badge label="High Risk" color="red" />
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setAttendance({...attendance, [student.id]: true})}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${attendance[student.id] === true ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400 hover:bg-green-50'}`}>
                          <CheckCircle size={15} /> Present
                        </button>
                        <button onClick={() => setAttendance({...attendance, [student.id]: false})}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${attendance[student.id] === false ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-400 hover:bg-red-50'}`}>
                          <XCircle size={15} /> Absent
                        </button>
                      </div>
                    </div>
                  ))}
                  {classStudents.length === 0 && (
                    <div className="px-5 py-10 text-center text-gray-400">
                      No students assigned to this class yet. Assign a class when adding students.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 items-center">
                <Button onClick={handleSave} variant="primary" className="flex-1 sm:flex-none" disabled={saving || classStudents.length === 0}>
                  {saving ? 'Saving...' : 'Save Attendance'}
                </Button>
                {saved && <span className="text-green-600 font-medium text-sm self-center">Saved successfully!</span>}
                {error && <span className="text-red-600 text-sm self-center">{error}</span>}
              </div>
            </>
          )}

          {atRiskStudents.length > 0 && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-5">
              <h3 className="font-bold text-red-800 flex items-center gap-2 mb-3">
                <AlertTriangle size={16} /> Students at Risk — Auto Detected
              </h3>
              <div className="space-y-3">
                {atRiskStudents.map(s => {
                  const whatsappMsg = `Hi ${s.parentName}, we noticed ${s.fullName} missed a few classes. Hope everything is okay. We would love to see them back in training this week.`;
                  return (
                    <div key={s.id} className="bg-white rounded-xl p-4 border border-red-100">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="font-semibold text-gray-900">{s.fullName}</p>
                          <p className="text-xs text-red-600 mt-0.5">Missed {s.missedClasses} consecutive classes</p>
                          <p className="text-xs text-gray-500 mt-2 italic">
                            Suggested: &ldquo;{whatsappMsg}&rdquo;
                          </p>
                        </div>
                        {s.parentPhone && (
                          <a href={`https://wa.me/${s.parentPhone.replace(/\D/g, '')}?text=${encodeURIComponent(whatsappMsg)}`}
                            target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex-shrink-0">
                            <MessageCircle size={13} /> WhatsApp
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {(tab === 'history' || !isStaff) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50">
            <h2 className="font-bold text-gray-900">Attendance History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {historyRecords.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{studentName(r.studentId)}</td>
                    <td className="px-4 py-3 text-gray-500">{r.date}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{className(r.classId)}</td>
                    <td className="px-4 py-3">
                      <Badge label={r.present ? 'Present' : 'Absent'} color={r.present ? 'green' : 'red'} />
                    </td>
                  </tr>
                ))}
                {historyRecords.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-10 text-center text-gray-400">No attendance records yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
