'use client';
import { useState } from 'react';
import { Plus, Filter, CheckCircle, XCircle, DollarSign, Clock, AlertTriangle, MessageCircle, FileText } from 'lucide-react';
import InvoiceStatusBadge from '@/components/InvoiceStatusBadge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import {
  getInvoices, getStudents, getPaymentsForInvoices, getGuardiansForStudent,
  generateInvoices, setInvoiceStatus, approvePayment, recordDirectPayment,
} from '@/lib/db';
import { Invoice, firstOfMonth, monthLabel } from '@/lib/types';
import { waLink, overdueMessage } from '@/lib/wa';

export default function PaymentsPage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: invoices, refetch } = useLive(getInvoices, ['invoices', 'payments']);
  const { data: students } = useLive(getStudents, ['students']);

  const [statusFilter, setStatusFilter] = useState('');
  const [busy, setBusy] = useState('');
  const [genMonth, setGenMonth] = useState(firstOfMonth());
  const [showGen, setShowGen] = useState(false);
  const [receipt, setReceipt] = useState<Invoice | null>(null);
  const [msg, setMsg] = useState('');

  const all = invoices ?? [];
  const filtered = all.filter(i => !statusFilter || i.status === statusFilter);
  const studentName = (id: string) => students?.find(s => s.id === id)?.fullName ?? '—';

  const totalRevenue = all.filter(i => i.status === 'paid').reduce((s, i) => s + i.net, 0);
  const paid = all.filter(i => i.status === 'paid').length;
  const pending = all.filter(i => i.status === 'pending_approval').length;
  const overdue = all.filter(i => i.status === 'overdue' || i.status === 'unpaid').length;

  const runGenerate = async () => {
    if (!currentUser) return;
    setBusy('gen'); setMsg('');
    try {
      const n = await generateInvoices(currentUser.academyId, genMonth);
      setMsg(`Generated ${n} invoice${n === 1 ? '' : 's'} for ${monthLabel(genMonth)}.`);
      setShowGen(false);
      await refetch();
    } catch (e) { setMsg(e instanceof Error ? e.message : 'Failed to generate.'); }
    finally { setBusy(''); }
  };

  const approve = async (inv: Invoice) => {
    if (!currentUser) return;
    setBusy(inv.id);
    try {
      const pays = await getPaymentsForInvoices([inv.id]);
      const claim = pays.find(p => !p.approvedAt) ?? pays[0];
      if (claim) await approvePayment(claim.id, inv.id, currentUser.id, 'PSMDS');
      else await recordDirectPayment(inv.id, inv.net, 'cash', currentUser.id, 'PSMDS');
      await refetch();
    } finally { setBusy(''); }
  };

  const markPaidDirect = async (inv: Invoice) => {
    if (!currentUser) return;
    setBusy(inv.id);
    try { await recordDirectPayment(inv.id, inv.net, 'cash', currentUser.id, 'PSMDS'); await refetch(); }
    finally { setBusy(''); }
  };

  const reject = async (inv: Invoice) => {
    setBusy(inv.id);
    try { await setInvoiceStatus(inv.id, 'unpaid'); await refetch(); }
    finally { setBusy(''); }
  };

  const remind = async (inv: Invoice) => {
    const gs = await getGuardiansForStudent(inv.studentId);
    const payer = gs.find(g => g.isPrimaryPayer) ?? gs[0];
    if (!payer?.parentPhone) { setMsg('No parent phone on file for this student.'); return; }
    const text = overdueMessage(studentName(inv.studentId), inv.net, monthLabel(inv.billingMonth), currentUser?.preferredLanguage ?? 'en');
    window.open(waLink(payer.parentPhone, text), '_blank');
  };

  const statusOptions = ['', 'unpaid', 'pending_approval', 'paid', 'overdue', 'waived'];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Invoices, cash approvals, and receipts</p>
        </div>
        {isStaff && <Button onClick={() => setShowGen(true)} variant="primary"><Plus size={16} /> Generate Invoices</Button>}
      </div>

      {msg && <p className="text-sm bg-blue-50 border border-blue-100 text-blue-800 rounded-lg px-3 py-2">{msg}</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={`RM ${totalRevenue}`} icon={DollarSign} iconBg="bg-green-50 text-green-600" />
        <StatCard title="Paid" value={paid} icon={CheckCircle} iconBg="bg-green-50 text-green-600" />
        <StatCard title="Pending Approval" value={pending} icon={Clock} iconBg="bg-yellow-50 text-yellow-600" />
        <StatCard title="Outstanding" value={overdue} icon={AlertTriangle} iconBg="bg-orange-50 text-orange-500" />
      </div>

      {isStaff && pending > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h2 className="font-bold text-yellow-900 mb-3 flex items-center gap-2"><Clock size={16} /> Pending Cash Approvals ({pending})</h2>
          <div className="space-y-2">
            {all.filter(i => i.status === 'pending_approval').map(i => (
              <div key={i.id} className="flex items-center justify-between bg-white rounded-xl p-3.5 border border-yellow-100 flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{studentName(i.studentId)}</p>
                  <p className="text-xs text-gray-500">{monthLabel(i.billingMonth)} · RM {i.net}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => approve(i)} disabled={busy === i.id} className="flex items-center gap-1.5 bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 disabled:opacity-60"><CheckCircle size={13} /> Approve</button>
                  <button onClick={() => reject(i)} disabled={busy === i.id} className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700 disabled:opacity-60"><XCircle size={13} /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-50 flex-wrap gap-3">
          <h2 className="font-bold text-gray-900">All Invoices</h2>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {statusOptions.map(s => <option key={s} value={s}>{s ? s.replace('_', ' ') : 'All Status'}</option>)}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                {isStaff && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(i => (
                <tr key={i.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{studentName(i.studentId)}</td>
                  <td className="px-4 py-3 text-gray-500">{monthLabel(i.billingMonth)}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">RM {i.net}{i.discount > 0 && <span className="text-xs text-green-600 ml-1">(−{i.discount})</span>}</td>
                  <td className="px-4 py-3"><InvoiceStatusBadge status={i.status} /></td>
                  {isStaff && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {i.status === 'pending_approval' && (
                          <><button onClick={() => approve(i)} disabled={busy === i.id} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-semibold">Approve</button>
                          <button onClick={() => reject(i)} disabled={busy === i.id} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-semibold">Reject</button></>
                        )}
                        {i.status === 'paid' && (
                          <button onClick={() => setReceipt(i)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-semibold flex items-center gap-1"><FileText size={11} /> Receipt</button>
                        )}
                        {(i.status === 'unpaid' || i.status === 'overdue') && (
                          <><button onClick={() => markPaidDirect(i)} disabled={busy === i.id} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 font-semibold">Mark Paid</button>
                          <button onClick={() => remind(i)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-semibold flex items-center gap-1"><MessageCircle size={11} /> Remind</button></>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={isStaff ? 5 : 4} className="px-4 py-10 text-center text-gray-400">No invoices. Generate invoices for this month to begin.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showGen} onClose={() => setShowGen(false)} title="Generate Monthly Invoices">
        <div className="space-y-4">
          <p className="text-sm text-gray-500">Creates unpaid invoices for every active and trial student for the selected month. Sibling discount (10%) is applied automatically when 2+ children share a primary payer. Existing invoices for the month are left untouched.</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Billing Month</label>
            <input type="month" value={genMonth.slice(0, 7)} onChange={e => setGenMonth(e.target.value + '-01')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={runGenerate} disabled={busy === 'gen'}>{busy === 'gen' ? 'Generating...' : 'Generate'}</Button>
            <Button variant="secondary" onClick={() => setShowGen(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>

      {receipt && (
        <Modal isOpen={!!receipt} onClose={() => setReceipt(null)} title="Payment Receipt">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto"><CheckCircle size={32} className="text-green-600" /></div>
            <div className="border border-gray-100 rounded-xl p-5 text-left space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Student:</span><strong>{studentName(receipt.studentId)}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Month:</span><strong>{monthLabel(receipt.billingMonth)}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Amount:</span><strong>RM {receipt.net}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Status:</span><strong className="text-green-600">Paid</strong></div>
            </div>
            <div className="text-xs text-gray-400">Persatuan Silambam Malaysia Daerah Sepang</div>
            <Button onClick={() => setReceipt(null)} variant="secondary" className="w-full">Close</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
