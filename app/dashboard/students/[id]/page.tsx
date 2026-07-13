'use client';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle } from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import InvoiceStatusBadge from '@/components/InvoiceStatusBadge';
import Button from '@/components/Button';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import {
  getStudent, getInvoicesForStudent, getAttendanceForStudent, getGradingResults,
  getStudentSkills, getSkills, getNotes, getGuardiansForStudent, getCertificates, addNote,
} from '@/lib/db';
import { SKILL_LEVEL_LABEL, SKILL_LEVEL_PCT, SkillLevel, LIFECYCLE_LABEL, ATTENDANCE_LABEL, monthLabel } from '@/lib/types';
import { waLink, atRiskMessage } from '@/lib/wa';

const skillColor: Record<SkillLevel, 'red' | 'gold' | 'blue' | 'green'> = { not_started: 'red', learning: 'gold', good: 'blue', mastered: 'green' };
const tabs = ['Overview', 'Attendance', 'Payments', 'Skills', 'Grading', 'Notes', 'Certificates'];

export default function StudentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser } = useAuth();
  const sid = params.id as string;
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const [tab, setTab] = useState('Overview');
  const [noteText, setNoteText] = useState('');
  const [noteVis, setNoteVis] = useState<'staff' | 'parent_visible'>('parent_visible');
  const [savingNote, setSavingNote] = useState(false);

  const { data: student, loading } = useLive(() => getStudent(sid), ['students', 'grading_results'], [sid]);
  const { data: invoices } = useLive(() => getInvoicesForStudent(sid), ['invoices', 'payments'], [sid]);
  const { data: attendance } = useLive(() => getAttendanceForStudent(sid), ['attendance'], [sid]);
  const { data: gradings } = useLive(() => getGradingResults(), ['grading_results'], [sid]);
  const { data: studentSkills } = useLive(() => getStudentSkills(sid), ['student_skills'], [sid]);
  const { data: skills } = useLive(getSkills, ['skills']);
  const { data: notes, refetch: refetchNotes } = useLive(() => getNotes(sid), ['student_notes'], [sid]);
  const { data: guardians } = useLive(() => getGuardiansForStudent(sid), ['guardian_link'], [sid]);
  const { data: certs } = useLive(() => getCertificates(sid), ['certificates'], [sid]);

  if (loading) return <div className="max-w-4xl mx-auto text-center py-20"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500 text-sm">Loading...</p></div>;
  if (!student) return <div className="max-w-4xl mx-auto text-center py-20"><p className="text-gray-500">Student not found.</p><Button onClick={() => router.back()} variant="secondary" className="mt-4">Go Back</Button></div>;

  const present = (attendance ?? []).filter(a => a.status === 'present' || a.status === 'late').length;
  const pct = attendance && attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const myGradings = (gradings ?? []).filter(g => g.studentId === sid);
  const payer = (guardians ?? []).find(g => g.isPrimaryPayer) ?? (guardians ?? [])[0];

  const saveNote = async () => {
    if (!noteText.trim() || !currentUser) return;
    setSavingNote(true);
    try { await addNote(sid, currentUser.id, noteText.trim(), noteVis); setNoteText(''); await refetchNotes(); }
    finally { setSavingNote(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100"><ArrowLeft size={18} className="text-gray-600" /></button>
        <h1 className="text-xl font-bold text-gray-900">Student Profile</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="w-16 h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">{student.fullName[0]}</div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-gray-900">{student.fullName}</h2>
            <p className="text-gray-500 text-sm mt-1">{student.classNames.join(', ') || 'No class'} {student.age ? `· Age ${student.age}` : ''}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <Badge label={`${student.beltName} Belt`} color="navy" />
              <Badge label={LIFECYCLE_LABEL[student.lifecycle]} color={student.lifecycle === 'active' ? 'green' : student.lifecycle === 'trial' ? 'yellow' : 'gray'} />
            </div>
          </div>
          {isStaff && payer?.parentPhone && (
            <a href={waLink(payer.parentPhone, atRiskMessage(student.fullName, currentUser?.preferredLanguage ?? 'en'))} target="_blank" rel="noopener noreferrer">
              <Button size="sm" variant="gold"><MessageCircle size={14} /> WhatsApp Parent</Button>
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-50">
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{pct}%</p><p className="text-xs text-gray-400">Attendance</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{(invoices ?? []).filter(i => i.status === 'paid').length}</p><p className="text-xs text-gray-400">Paid Invoices</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{myGradings.filter(g => g.result === 'pass').length}</p><p className="text-xs text-gray-400">Gradings Passed</p></div>
          <div className="text-center"><p className="text-2xl font-bold text-gray-900">{certs?.length ?? 0}</p><p className="text-xs text-gray-400">Certificates</p></div>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto bg-white rounded-xl border border-gray-100 p-1">
        {tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>{t}</button>)}
      </div>

      {tab === 'Overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Personal</h3>
            {[['Full Name', student.fullName], ['Age', student.age ? `${student.age} years` : '—'], ['IC / MyKid', student.icOrMykid || '—'], ['Joined', student.joinedAt || '—']].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0"><span className="text-gray-500">{k}</span><span className="font-medium text-gray-900">{v}</span></div>
            ))}
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
            <h3 className="font-bold text-gray-900">Guardians</h3>
            {(guardians ?? []).length === 0 && <p className="text-sm text-gray-400">No guardians linked yet.</p>}
            {(guardians ?? []).map(g => (
              <div key={g.parentProfileId} className="flex justify-between text-sm border-b border-gray-50 pb-2 last:border-0">
                <span className="text-gray-500">{g.parentName} ({g.relationship}){g.isPrimaryPayer ? ' · payer' : ''}</span>
                <span className="font-medium text-gray-900">{g.parentPhone || '—'}</span>
              </div>
            ))}
            {isStaff && student.medicalNotes && <div className="mt-2 bg-red-50 border border-red-100 rounded-lg p-3 text-xs text-red-700"><strong>Medical:</strong> {student.medicalNotes}</div>}
          </div>
        </div>
      )}

      {tab === 'Attendance' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="p-5 border-b border-gray-50"><h3 className="font-bold text-gray-900">Attendance History</h3><p className="text-sm text-gray-500 mt-1">{present}/{attendance?.length ?? 0} sessions ({pct}%)</p><div className="mt-3"><ProgressBar value={pct} color={pct >= 80 ? 'green' : pct >= 60 ? 'gold' : 'red'} /></div></div>
          <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(attendance ?? []).map(a => <tr key={a.id}><td className="px-4 py-3 text-gray-700">{a.sessionDate}</td><td className="px-4 py-3"><Badge label={ATTENDANCE_LABEL[a.status]} color={a.status === 'present' ? 'green' : a.status === 'late' ? 'yellow' : a.status === 'excused' ? 'blue' : 'red'} /></td></tr>)}
              {(attendance ?? []).length === 0 && <tr><td colSpan={2} className="px-4 py-8 text-center text-gray-400">No attendance records</td></tr>}
            </tbody></table>
        </div>
      )}

      {tab === 'Payments' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {(invoices ?? []).map(i => <tr key={i.id}><td className="px-4 py-3 font-medium text-gray-900">{monthLabel(i.billingMonth)}</td><td className="px-4 py-3 text-gray-700">RM {i.net}</td><td className="px-4 py-3"><InvoiceStatusBadge status={i.status} /></td></tr>)}
              {(invoices ?? []).length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No invoices</td></tr>}
            </tbody></table>
        </div>
      )}

      {tab === 'Skills' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
          {(skills ?? []).length === 0 && <p className="text-gray-400 text-sm">No skills in the curriculum yet.</p>}
          {(skills ?? []).map(sk => {
            const lvl = (studentSkills ?? []).find(x => x.skillId === sk.id)?.level ?? 'not_started';
            return <div key={sk.id}><div className="flex items-center justify-between mb-1.5"><span className="text-sm font-medium text-gray-800">{sk.name}</span><Badge label={SKILL_LEVEL_LABEL[lvl]} color={skillColor[lvl]} /></div><ProgressBar value={SKILL_LEVEL_PCT[lvl]} color={skillColor[lvl]} /></div>;
          })}
        </div>
      )}

      {tab === 'Grading' && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">From</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">To</th><th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Result</th></tr></thead>
            <tbody className="divide-y divide-gray-50">
              {myGradings.map(g => <tr key={g.id}><td className="px-4 py-3"><Badge label={g.fromBeltName || '—'} color="gray" /></td><td className="px-4 py-3"><Badge label={g.toBeltName || '—'} color="navy" /></td><td className="px-4 py-3"><Badge label={g.result} color={g.result === 'pass' ? 'green' : g.result === 'fail' ? 'red' : 'yellow'} /></td></tr>)}
              {myGradings.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">No grading records</td></tr>}
            </tbody></table>
        </div>
      )}

      {tab === 'Notes' && (
        <div className="space-y-4">
          {isStaff && (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3">Add Note</h3>
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Performance or behaviour note..." className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-24 resize-none" />
              <div className="flex items-center gap-3 mt-3">
                <select value={noteVis} onChange={e => setNoteVis(e.target.value as 'staff' | 'parent_visible')} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                  <option value="parent_visible">Visible to parent</option><option value="staff">Staff only</option>
                </select>
                <Button size="sm" onClick={saveNote} disabled={savingNote || !noteText.trim()}>{savingNote ? 'Saving...' : 'Save Note'}</Button>
              </div>
            </div>
          )}
          <div className="space-y-3">
            {(notes ?? []).map(n => (
              <div key={n.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2"><span className="font-semibold text-gray-900 text-sm">{n.authorName}</span><div className="flex items-center gap-2">{n.visibility === 'staff' && <Badge label="Staff only" color="gray" />}<span className="text-xs text-gray-400">{n.createdAt.slice(0, 10)}</span></div></div>
                <p className="text-sm text-gray-600">{n.body}</p>
              </div>
            ))}
            {(notes ?? []).length === 0 && <p className="text-sm text-gray-400 text-center py-8">No notes yet.</p>}
          </div>
        </div>
      )}

      {tab === 'Certificates' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(certs ?? []).map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4">
              <p className="font-semibold text-gray-900 text-sm">{c.title}</p>
              <p className="text-xs text-gray-400 mt-1">{c.certNo} · {c.issuedAt}</p>
              <a href={`/verify/${c.verifyCode}`} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline mt-2 inline-block">Verify →</a>
            </div>
          ))}
          {(certs ?? []).length === 0 && <p className="text-gray-400 text-sm col-span-full text-center py-8">No certificates issued yet. They are auto-issued on grading pass and tournament medals.</p>}
        </div>
      )}
    </div>
  );
}
