'use client';
import { useState, useEffect } from 'react';
import { Clock, AlertTriangle, MessageCircle, Calendar, Download } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getStudents, getClasses, getAtRiskMap, getGuardiansForStudent, getOrCreateSession, getAttendanceForSession, markAttendance } from '@/lib/db';
import { AttendanceStatus, ATTENDANCE_LABEL, DAY_NAMES } from '@/lib/types';
import { waLink, atRiskMessage } from '@/lib/wa';
import { downloadCsv } from '@/lib/csv';

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-700', absent: 'bg-red-100 text-red-700',
  late: 'bg-yellow-100 text-yellow-700', excused: 'bg-blue-100 text-blue-700',
};

export default function AttendancePage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: classes } = useLive(getClasses, ['classes', 'class_coaches']);
  const { data: students } = useLive(getStudents, ['students', 'enrollments']);
  const { data: atRisk } = useLive(getAtRiskMap, ['attendance']);

  const [selectedClassState, setSelectedClass] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({});
  const [sessionId, setSessionId] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const selectedClass = selectedClassState || classes?.[0]?.id || '';
  const roster = (students ?? []).filter(s => s.classIds.includes(selectedClass));

  // Load existing session marks when class/date changes
  useEffect(() => {
    let alive = true;
    if (!selectedClass || !isStaff) return;
    (async () => {
      try {
        const sid = await getOrCreateSession(selectedClass, date);
        if (!alive) return;
        const existing = await getAttendanceForSession(sid);
        if (!alive) return;
        const base: Record<string, AttendanceStatus> = {};
        roster.forEach(s => { base[s.id] = 'present'; });
        existing.forEach(a => { base[a.studentId] = a.status; });
        setSessionId(sid);
        setMarks(base);
        setSaved(false);
      } catch { /* class may have no session yet */ }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, date, students?.length, isStaff]);

  const presentCount = Object.values(marks).filter(s => s === 'present' || s === 'late').length;
  const absentCount = Object.values(marks).filter(s => s === 'absent').length;

  const handleSave = async () => {
    if (!sessionId || roster.length === 0) return;
    setSaving(true); setError('');
    try {
      await markAttendance(roster.map(s => ({ sessionId, studentId: s.id, status: marks[s.id] ?? 'present' })), currentUser?.id ?? null);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save attendance.');
    } finally { setSaving(false); }
  };

  const studentName = (id: string) => students?.find(s => s.id === id)?.fullName ?? '—';
  const cls = classes?.find(c => c.id === selectedClass);

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Attendance</h1>
        <p className="text-gray-500 text-sm mt-0.5">Mark and track class attendance</p>
      </div>

      {!isStaff ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">Attendance marking is for coaches and admins.</div>
      ) : (classes ?? []).length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center text-gray-400">
          <Calendar size={36} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium text-gray-500">No classes configured yet.</p>
          <p className="text-sm mt-1">Add classes in <Link href="/dashboard/settings" className="text-blue-600 hover:underline">Settings</Link> first.</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class</label>
                <select value={selectedClass} onChange={e => setSelectedClass(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                  {(classes ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex items-end gap-3">
                <div className="text-center"><p className="text-2xl font-bold text-green-600">{presentCount}</p><p className="text-xs text-gray-400">Present</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-red-500">{absentCount}</p><p className="text-xs text-gray-400">Absent</p></div>
              </div>
            </div>
            {cls && (cls.scheduleNote || cls.dayOfWeek != null) && (
              <p className="text-xs text-gray-400 mt-3">Schedule: {cls.scheduleNote || (cls.dayOfWeek != null ? `${DAY_NAMES[cls.dayOfWeek]} ${cls.startTime ?? ''}` : '')}</p>
            )}
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Students ({roster.length})</h2>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => downloadCsv(`attendance-${cls?.name ?? 'class'}-${date}.csv`, roster.map(s => ({
                  Student: s.fullName, Date: date, Status: marks[s.id] ?? 'present',
                })))} disabled={roster.length === 0}><Download size={14} /> Export CSV</Button>
                <Button size="sm" variant="secondary" onClick={() => setMarks(Object.fromEntries(roster.map(s => [s.id, 'present'])))}>All Present</Button>
              </div>
            </div>
            <div className="divide-y divide-gray-50">
              {roster.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center font-bold text-gray-600 text-sm flex-shrink-0">{s.fullName[0]}</div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{s.fullName}</p>
                      <p className="text-xs text-gray-400">{s.beltName} Belt{s.age ? ` · Age ${s.age}` : ''}</p>
                    </div>
                    {atRisk?.[s.id] && <Badge label="At Risk" color="red" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(st => (
                      <button key={st} onClick={() => setMarks({ ...marks, [s.id]: st })}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${marks[s.id] === st ? STATUS_STYLE[st] : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>
                        {ATTENDANCE_LABEL[st]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {roster.length === 0 && <div className="px-5 py-10 text-center text-gray-400">No students enrolled in this class yet.</div>}
            </div>
          </div>

          <div className="flex gap-3 items-center">
            <Button onClick={handleSave} variant="primary" disabled={saving || roster.length === 0}>{saving ? 'Saving...' : 'Save Attendance'}</Button>
            {saved && <span className="text-green-600 font-medium text-sm">Saved successfully!</span>}
            {error && <span className="text-red-600 text-sm">{error}</span>}
          </div>

          {Object.keys(atRisk ?? {}).length > 0 && (
            <AtRiskPanel atRisk={atRisk!} studentName={studentName} lang={currentUser?.preferredLanguage ?? 'en'} />
          )}
        </>
      )}
    </div>
  );
}

function AtRiskPanel({ atRisk, studentName, lang }: { atRisk: Record<string, number>; studentName: (id: string) => string; lang: 'en' | 'ms' | 'ta' }) {
  return (
    <div className="bg-red-50 border border-red-100 rounded-xl p-5">
      <h3 className="font-bold text-red-800 flex items-center gap-2 mb-3"><AlertTriangle size={16} /> Students at Risk — Auto Detected</h3>
      <div className="space-y-2">
        {Object.entries(atRisk).map(([sid, count]) => (
          <AtRiskRow key={sid} studentId={sid} name={studentName(sid)} count={count} lang={lang} />
        ))}
      </div>
    </div>
  );
}

function AtRiskRow({ studentId, name, count, lang }: { studentId: string; name: string; count: number; lang: 'en' | 'ms' | 'ta' }) {
  const [phone, setPhone] = useState('');
  useEffect(() => {
    let alive = true;
    getGuardiansForStudent(studentId).then(gs => {
      if (!alive) return;
      const payer = gs.find(g => g.isPrimaryPayer) ?? gs[0];
      setPhone(payer?.parentPhone ?? '');
    }).catch(() => {});
    return () => { alive = false; };
  }, [studentId]);
  const msg = atRiskMessage(name, lang);
  return (
    <div className="bg-white rounded-xl p-4 border border-red-100 flex items-start justify-between gap-3 flex-wrap">
      <div>
        <Link href={`/dashboard/students/${studentId}`} className="font-semibold text-gray-900 hover:text-blue-600">{name}</Link>
        <p className="text-xs text-red-600 mt-0.5">{count} recent absences</p>
      </div>
      {phone ? (
        <a href={waLink(phone, msg)} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 flex-shrink-0">
          <MessageCircle size={13} /> WhatsApp
        </a>
      ) : <span className="text-xs text-gray-400 flex items-center gap-1"><Clock size={12} /> no parent phone</span>}
    </div>
  );
}
