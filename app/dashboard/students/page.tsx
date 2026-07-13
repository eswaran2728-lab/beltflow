'use client';
import { useState } from 'react';
import { Plus, Search, Users, Download } from 'lucide-react';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getStudents, getBelts, getClasses, addStudent } from '@/lib/db';
import { downloadCsv } from '@/lib/csv';
import { Student, Lifecycle, LIFECYCLE_LABEL } from '@/lib/types';

const lifecycleColor: Record<Lifecycle, 'green' | 'gray' | 'red' | 'yellow'> = {
  active: 'green', trial: 'yellow', frozen: 'gray', quit: 'red',
};

export default function StudentsPage() {
  const { currentUser } = useAuth();
  const { data: students, loading } = useLive(getStudents, ['students', 'enrollments', 'grading_results']);
  const { data: belts } = useLive(getBelts, ['belts']);
  const { data: classes } = useLive(getClasses, ['classes']);

  const [search, setSearch] = useState('');
  const [beltFilter, setBeltFilter] = useState('');
  const [lifecycleFilter, setLifecycleFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '', icOrMykid: '', dateOfBirth: '', gender: 'male',
    beltId: '', lifecycle: 'trial' as Lifecycle, classId: '',
  });

  const filtered = (students ?? []).filter(s => {
    const q = search.toLowerCase();
    const matchSearch = s.fullName.toLowerCase().includes(q);
    const matchBelt = !beltFilter || s.beltId === beltFilter;
    const matchLife = !lifecycleFilter || s.lifecycle === lifecycleFilter;
    return matchSearch && matchBelt && matchLife;
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true); setError('');
    try {
      await addStudent(currentUser.academyId, {
        fullName: form.fullName, icOrMykid: form.icOrMykid,
        dateOfBirth: form.dateOfBirth || null, gender: form.gender,
        beltId: form.beltId || belts?.[0]?.id || null, lifecycle: form.lifecycle,
        classIds: form.classId ? [form.classId] : [],
      });
      setShowModal(false);
      setForm({ fullName: '', icOrMykid: '', dateOfBirth: '', gender: 'male', beltId: '', lifecycle: 'trial', classId: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add student.');
    } finally { setSaving(false); }
  };

  const columns = [
    { key: 'name', header: 'Student', render: (s: Student) => (
      <Link href={`/dashboard/students/${s.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{s.fullName}</Link>
    )},
    { key: 'age', header: 'Age', render: (s: Student) => <span className="text-gray-600">{s.age ?? '—'}</span> },
    { key: 'belt', header: 'Belt', render: (s: Student) => <Badge label={s.beltName} color="navy" /> },
    { key: 'class', header: 'Classes', render: (s: Student) => <span className="text-gray-600 text-xs">{s.classNames.join(', ') || '—'}</span> },
    { key: 'status', header: 'Status', render: (s: Student) => <Badge label={LIFECYCLE_LABEL[s.lifecycle]} color={lifecycleColor[s.lifecycle]} /> },
    { key: 'action', header: '', render: (s: Student) => (
      <Link href={`/dashboard/students/${s.id}`}><Button size="sm" variant="ghost">View</Button></Link>
    )},
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm">{filtered.length} of {students?.length ?? 0} students</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => downloadCsv('students.csv', filtered.map(s => ({
            Name: s.fullName, Age: s.age ?? '', Belt: s.beltName, Classes: s.classNames.join('; '),
            Status: LIFECYCLE_LABEL[s.lifecycle], 'IC/MyKid': s.icOrMykid, 'Joined': s.joinedAt,
          })))} disabled={filtered.length === 0}><Download size={16} /> Export CSV</Button>
          <Button onClick={() => setShowModal(true)} variant="primary"><Plus size={16} /> Add Student</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search students..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <select value={beltFilter} onChange={e => setBeltFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Belts</option>
          {(belts ?? []).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={lifecycleFilter} onChange={e => setLifecycleFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Status</option>
          {(['trial', 'active', 'frozen', 'quit'] as Lifecycle[]).map(l => <option key={l} value={l}>{LIFECYCLE_LABEL[l]}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-40" />
          <p>{loading ? 'Loading students...' : students?.length === 0 ? 'No students yet. Add your first student to get started.' : 'No students match your filters.'}</p>
        </div>
      ) : (
        <DataTable columns={columns} data={filtered} emptyMessage="No students found." />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Student" size="lg">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormInput label="Full Name" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Arjun Subramaniam" required />
            </div>
            <FormInput label="IC / MyKid" value={form.icOrMykid} onChange={e => setForm({ ...form, icOrMykid: e.target.value })} placeholder="130512-10-1234" />
            <FormInput label="Date of Birth" type="date" value={form.dateOfBirth} onChange={e => setForm({ ...form, dateOfBirth: e.target.value })} />
            <SelectInput label="Gender" value={form.gender} onChange={e => setForm({ ...form, gender: e.target.value })}
              options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]} />
            <SelectInput label="Belt / Rank" value={form.beltId} onChange={e => setForm({ ...form, beltId: e.target.value })}
              options={(belts ?? []).map(b => ({ value: b.id, label: b.name }))} />
            <SelectInput label="Status" value={form.lifecycle} onChange={e => setForm({ ...form, lifecycle: e.target.value as Lifecycle })}
              options={(['trial', 'active', 'frozen', 'quit'] as Lifecycle[]).map(l => ({ value: l, label: LIFECYCLE_LABEL[l] }))} />
            <SelectInput label="Class" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })}
              options={[{ value: '', label: classes?.length ? 'Select class...' : 'No classes — add in Settings' }, ...(classes ?? []).map(c => ({ value: c.id, label: c.name }))]} />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={saving}>{saving ? 'Adding...' : 'Add Student'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
