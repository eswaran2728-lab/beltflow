'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Users, CreditCard, CheckCircle, Award, Calendar } from 'lucide-react';
import Badge from '@/components/Badge';
import ProgressBar from '@/components/ProgressBar';
import InvoiceStatusBadge from '@/components/InvoiceStatusBadge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getMyChildren, getInvoicesForStudent, getAttendanceForStudent, getStudentSkills, getSkills, getNotes, getCertificates, submitPayment } from '@/lib/db';
import { SKILL_LEVEL_LABEL, SKILL_LEVEL_PCT, SkillLevel, monthLabel, Invoice } from '@/lib/types';

const skillColor: Record<SkillLevel, 'red' | 'gold' | 'blue' | 'green'> = { not_started: 'red', learning: 'gold', good: 'blue', mastered: 'green' };

export default function ParentPortalPage() {
  const { currentUser } = useAuth();
  const { data: children, loading } = useLive(getMyChildren, ['students', 'guardian_link', 'enrollments']);
  const [activeIdx, setActiveIdx] = useState(0);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const child = children?.[activeIdx];
  const { data: invoices, refetch: refetchInv } = useLive(() => child ? getInvoicesForStudent(child.id) : Promise.resolve([]), ['invoices', 'payments'], [child?.id]);
  const { data: attendance } = useLive(() => child ? getAttendanceForStudent(child.id) : Promise.resolve([]), ['attendance'], [child?.id]);
  const { data: studentSkills } = useLive(() => child ? getStudentSkills(child.id) : Promise.resolve([]), ['student_skills'], [child?.id]);
  const { data: skills } = useLive(getSkills, ['skills']);
  const { data: notes } = useLive(() => child ? getNotes(child.id) : Promise.resolve([]), ['student_notes'], [child?.id]);
  const { data: certs } = useLive(() => child ? getCertificates(child.id) : Promise.resolve([]), ['certificates'], [child?.id]);

  if (loading) return <div className="max-w-lg mx-auto text-center py-20"><div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" /><p className="text-gray-500 text-sm">Loading...</p></div>;
  if (!children || children.length === 0) return (
    <div className="max-w-lg mx-auto text-center py-20">
      <Users size={40} className="text-gray-300 mx-auto mb-4" />
      <h1 className="text-xl font-bold text-gray-900">No child linked yet</h1>
      <p className="text-gray-500 text-sm mt-2">Ask the academy admin to link your child&apos;s student record to your account in Approvals.</p>
    </div>
  );
  if (!child) return null;

  const present = (attendance ?? []).filter(a => a.status === 'present' || a.status === 'late').length;
  const pct = attendance && attendance.length ? Math.round((present / attendance.length) * 100) : 0;
  const dueInvoices = (invoices ?? []).filter(i => i.status === 'unpaid' || i.status === 'overdue');
  const visibleNotes = (notes ?? []).filter(n => n.visibility === 'parent_visible');

  const submit = async () => {
    if (!payInvoice || !currentUser) return;
    setSubmitting(true);
    try { await submitPayment(payInvoice.id, payInvoice.net, 'cash', currentUser.id); setDone(true); await refetchInv(); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      {children.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {children.map((c, i) => (
            <button key={c.id} onClick={() => setActiveIdx(i)} className={`px-4 py-2 rounded-xl border text-sm font-medium ${i === activeIdx ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-200'}`}>{c.fullName}</button>
          ))}
        </div>
      )}

      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-2xl p-6 text-white">
        <p className="text-white/60 text-sm mb-1">Parent Portal</p>
        <h1 className="text-2xl font-extrabold">{child.fullName}</h1>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <span className="bg-white/10 text-white/90 text-xs px-3 py-1 rounded-full font-semibold">{child.beltName} Belt</span>
          <span className="text-white/60 text-sm">{child.classNames.join(', ') || 'No class'}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/10">
          <div><p className="text-2xl font-bold">{pct}%</p><p className="text-white/50 text-xs">Attendance</p></div>
          <div><p className="text-2xl font-bold">{(studentSkills ?? []).filter(s => s.level === 'mastered').length}</p><p className="text-white/50 text-xs">Skills Mastered</p></div>
          <div><p className="text-2xl font-bold">{dueInvoices.length}</p><p className="text-white/50 text-xs">Fees Due</p></div>
        </div>
      </div>

      {dueInvoices.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
          {dueInvoices.map(i => (
            <div key={i.id} className="flex items-center justify-between flex-wrap gap-3">
              <div><p className="font-semibold text-orange-900">Payment Due — {monthLabel(i.billingMonth)}</p><p className="text-sm text-orange-700">RM {i.net}</p></div>
              <Button variant="gold" onClick={() => { setPayInvoice(i); setDone(false); }}><CreditCard size={15} /> Pay Now</Button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Calendar size={16} /> Attendance</h3>
          <div className="text-center mb-3"><p className="text-3xl font-extrabold text-gray-900">{pct}%</p><p className="text-xs text-gray-400">{present} of {attendance?.length ?? 0} sessions</p></div>
          <ProgressBar value={pct} color={pct >= 80 ? 'green' : pct >= 60 ? 'gold' : 'red'} />
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><Award size={16} /> Belt</h3>
          <div className="text-center"><div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2"><Award size={28} className="text-blue-600" /></div><p className="font-bold text-gray-900">{child.beltName} Belt</p></div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Payment History</h3>
        <table className="w-full text-sm"><thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Month</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th><th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Status</th></tr></thead>
          <tbody className="divide-y divide-gray-50">
            {(invoices ?? []).map(i => <tr key={i.id}><td className="px-3 py-2.5 font-medium text-gray-900">{monthLabel(i.billingMonth)}</td><td className="px-3 py-2.5 text-gray-700">RM {i.net}</td><td className="px-3 py-2.5"><InvoiceStatusBadge status={i.status} /></td></tr>)}
            {(invoices ?? []).length === 0 && <tr><td colSpan={3} className="px-3 py-6 text-center text-gray-400">No invoices yet.</td></tr>}
          </tbody></table>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="font-bold text-gray-900 mb-4">Skills Progress</h3>
        <div className="space-y-3">
          {(skills ?? []).map(sk => {
            const lvl = (studentSkills ?? []).find(x => x.skillId === sk.id)?.level ?? 'not_started';
            return <div key={sk.id}><div className="flex justify-between mb-1"><span className="text-sm text-gray-700">{sk.name}</span><Badge label={SKILL_LEVEL_LABEL[lvl]} color={skillColor[lvl]} /></div><ProgressBar value={SKILL_LEVEL_PCT[lvl]} color={skillColor[lvl]} size="sm" /></div>;
          })}
          {(skills ?? []).length === 0 && <p className="text-sm text-gray-400">No skills tracked yet.</p>}
        </div>
      </div>

      {(certs ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Certificates</h2>
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

      {visibleNotes.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 p-5">
          <h3 className="font-bold text-gray-900 mb-3">Instructor Notes</h3>
          <div className="space-y-3">{visibleNotes.map(n => <div key={n.id} className="border border-gray-100 rounded-lg p-3"><div className="flex justify-between mb-1"><span className="font-semibold text-gray-900 text-sm">{n.authorName}</span><span className="text-xs text-gray-400">{n.createdAt.slice(0, 10)}</span></div><p className="text-sm text-gray-600">{n.body}</p></div>)}</div>
        </div>
      )}

      <Modal isOpen={!!payInvoice} onClose={() => setPayInvoice(null)} title="Pay Monthly Fee">
        {done ? (
          <div className="text-center py-6">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900">Cash Payment Submitted!</h3>
            <p className="text-sm text-gray-500 mt-2">Pending approval from the coach or admin.</p>
            <Button className="mt-6" variant="secondary" onClick={() => setPayInvoice(null)}>Close</Button>
          </div>
        ) : payInvoice && (
          <div className="space-y-5">
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Student</span><strong>{child.fullName}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Month</span><strong>{monthLabel(payInvoice.billingMonth)}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Amount</span><strong className="text-lg text-gray-900">RM {payInvoice.net.toFixed(2)}</strong></div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-xs text-yellow-800">Submitting notifies your coach. It shows as &ldquo;Pending Approval&rdquo; until confirmed. FPX online payment is coming soon.</div>
            <Button variant="gold" className="w-full" onClick={submit} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Cash Payment'}</Button>
          </div>
        )}
      </Modal>
    </div>
  );
}
