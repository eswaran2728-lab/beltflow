'use client';
import { useState } from 'react';
import { Plus, Filter, CheckCircle, XCircle, DollarSign, Clock, AlertTriangle } from 'lucide-react';
import PaymentStatusBadge from '@/components/PaymentStatusBadge';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import StatCard from '@/components/StatCard';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getPayments, getStudents, getSettings, setPaymentStatus, addPayment } from '@/lib/db';
import { Payment, PaymentStatus, monthLabel } from '@/lib/types';

export default function PaymentsPage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: payments } = useLive(getPayments, ['payments']);
  const { data: students } = useLive(getStudents, ['students']);
  const { data: settings } = useLive(getSettings, ['academy_settings']);

  const [statusFilter, setStatusFilter] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState<Payment | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    studentId: '', month: monthLabel(), amount: '', method: 'Cash', status: 'Paid' as PaymentStatus,
  });

  const all = payments ?? [];
  const filtered = all.filter(p => !statusFilter || p.status === statusFilter);

  const paid = all.filter(p => p.status === 'Paid').length;
  const unpaid = all.filter(p => p.status === 'Unpaid').length;
  const overdue = all.filter(p => p.status === 'Overdue').length;
  const pending = all.filter(p => p.status === 'Pending Cash Approval').length;
  const totalRevenue = all.filter(p => p.status === 'Paid').reduce((s, p) => s + p.amount, 0);

  const approvePayment = (id: string) => setPaymentStatus(id, 'Paid', currentUser?.name);
  const rejectPayment = (id: string) => setPaymentStatus(id, 'Rejected');
  const markPaid = (id: string) => setPaymentStatus(id, 'Paid', currentUser?.name);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const student = students?.find(s => s.id === form.studentId);
    if (!student) { setError('Select a student.'); return; }
    setSaving(true);
    setError('');
    try {
      await addPayment({
        studentId: student.id, studentName: student.fullName,
        amount: parseFloat(form.amount) || settings?.monthlyFee || 0,
        month: form.month, status: form.status, method: form.method,
      });
      setShowAddModal(false);
      setForm({ studentId: '', month: monthLabel(), amount: '', method: 'Cash', status: 'Paid' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add payment.');
    } finally {
      setSaving(false);
    }
  };

  const statusOptions = ['', 'Paid', 'Unpaid', 'Overdue', 'Pending Cash Approval', 'Rejected'];

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Payments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage monthly fees and approvals</p>
        </div>
        {isStaff && (
          <Button onClick={() => setShowAddModal(true)} variant="primary">
            <Plus size={16} /> Add Payment
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard title="Total Revenue" value={`RM ${totalRevenue}`} icon={DollarSign} iconBg="bg-green-50 text-green-600" />
        <StatCard title="Paid" value={paid} icon={CheckCircle} iconBg="bg-green-50 text-green-600" />
        <StatCard title="Unpaid" value={unpaid} icon={XCircle} iconBg="bg-red-50 text-red-500" />
        <StatCard title="Overdue" value={overdue} icon={AlertTriangle} iconBg="bg-orange-50 text-orange-500" />
        <StatCard title="Pending Approval" value={pending} icon={Clock} iconBg="bg-yellow-50 text-yellow-600" />
      </div>

      {isStaff && pending > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h2 className="font-bold text-yellow-900 mb-3 flex items-center gap-2">
            <Clock size={16} /> Pending Cash Approvals ({pending})
          </h2>
          <div className="space-y-2">
            {all.filter(p => p.status === 'Pending Cash Approval').map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white rounded-xl p-3.5 border border-yellow-100 flex-wrap gap-3">
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
                    className="flex items-center gap-1.5 bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-red-700">
                    <XCircle size={13} /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between p-5 border-b border-gray-50 flex-wrap gap-3">
          <h2 className="font-bold text-gray-900">All Payments</h2>
          <div className="flex items-center gap-2">
            <Filter size={15} className="text-gray-400" />
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              {statusOptions.map(s => <option key={s} value={s}>{s || 'All Status'}</option>)}
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
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                {isStaff && <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.studentName}</td>
                  <td className="px-4 py-3 text-gray-500">{p.month}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">RM {p.amount}</td>
                  <td className="px-4 py-3">
                    <Badge label={p.method} color={p.method === 'FPX' ? 'blue' : 'gray'} />
                  </td>
                  <td className="px-4 py-3"><PaymentStatusBadge status={p.status} /></td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{p.receiptNumber || '—'}</td>
                  {isStaff && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {p.status === 'Pending Cash Approval' && (
                          <>
                            <button onClick={() => approvePayment(p.id)} className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded hover:bg-green-100 font-semibold">Approve</button>
                            <button onClick={() => rejectPayment(p.id)} className="text-xs bg-red-50 text-red-700 px-2 py-1 rounded hover:bg-red-100 font-semibold">Reject</button>
                          </>
                        )}
                        {p.status === 'Paid' && p.receiptNumber && (
                          <button onClick={() => setShowReceiptModal(p)} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded hover:bg-blue-100 font-semibold">Receipt</button>
                        )}
                        {(p.status === 'Unpaid' || p.status === 'Overdue') && (
                          <button onClick={() => markPaid(p.id)}
                            className="text-xs bg-gray-50 text-gray-700 px-2 py-1 rounded hover:bg-gray-100 font-semibold">Mark Paid</button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={isStaff ? 7 : 6} className="px-4 py-10 text-center text-gray-400">No payments found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showReceiptModal && (
        <Modal isOpen={!!showReceiptModal} onClose={() => setShowReceiptModal(null)} title="Payment Receipt">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <div className="border border-gray-100 rounded-xl p-5 text-left space-y-3 text-sm">
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Receipt No:</span><strong>{showReceiptModal.receiptNumber}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Student:</span><strong>{showReceiptModal.studentName}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Month:</span><strong>{showReceiptModal.month}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Amount:</span><strong>RM {showReceiptModal.amount}</strong></div>
              <div className="flex justify-between border-b pb-2"><span className="text-gray-500">Method:</span><strong>{showReceiptModal.method}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Paid Date:</span><strong>{showReceiptModal.paidDate}</strong></div>
            </div>
            <div className="text-xs text-gray-400">{settings?.name || 'BeltFlow'}</div>
            <Button onClick={() => setShowReceiptModal(null)} variant="secondary" className="w-full">Close</Button>
          </div>
        </Modal>
      )}

      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Payment Record">
        <form onSubmit={handleAdd} className="space-y-4">
          <SelectInput label="Student" value={form.studentId}
            onChange={e => setForm({...form, studentId: e.target.value})}
            options={[{ value: '', label: 'Select student...' },
              ...(students ?? []).map(s => ({ value: s.id, label: s.fullName }))]} />
          <FormInput label="Month" value={form.month} onChange={e => setForm({...form, month: e.target.value})} placeholder={monthLabel()} required />
          <FormInput label={`Amount (RM)${settings ? ` — default RM ${settings.monthlyFee}` : ''}`} type="number" value={form.amount}
            onChange={e => setForm({...form, amount: e.target.value})} placeholder={String(settings?.monthlyFee ?? 80)} />
          <div className="grid grid-cols-2 gap-4">
            <SelectInput label="Method" value={form.method}
              onChange={e => setForm({...form, method: e.target.value})}
              options={[{ value: 'Cash', label: 'Cash' }, { value: 'FPX', label: 'FPX' }]} />
            <SelectInput label="Status" value={form.status}
              onChange={e => setForm({...form, status: e.target.value as PaymentStatus})}
              options={['Paid', 'Unpaid', 'Overdue'].map(s => ({ value: s, label: s }))} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={saving}>{saving ? 'Saving...' : 'Add Payment'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowAddModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
