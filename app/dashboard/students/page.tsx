'use client';
import { useState } from 'react';
import { Plus, Search, Grid3X3, List, Users } from 'lucide-react';
import StudentCard from '@/components/StudentCard';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import Button from '@/components/Button';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import { mockStudents } from '@/data/students';
import { Student, BeltRank, StudentStatus } from '@/lib/types';
import Link from 'next/link';

const belts: BeltRank[] = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'];
const statusColors: Record<StudentStatus, 'green' | 'gray' | 'red'> = { Active: 'green', Inactive: 'gray', 'At Risk': 'red' };

export default function StudentsPage() {
  const [students, setStudents] = useState(mockStudents);
  const [search, setSearch] = useState('');
  const [beltFilter, setBeltFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    fullName: '', age: '', icNumber: '', parentName: '', parentPhone: '',
    beltRank: 'White' as BeltRank, branch: 'Sepang Main', classGroup: 'Junior A',
  });

  const filtered = students.filter(s => {
    const matchSearch = s.fullName.toLowerCase().includes(search.toLowerCase()) ||
      s.parentName.toLowerCase().includes(search.toLowerCase());
    const matchBelt = !beltFilter || s.beltRank === beltFilter;
    const matchStatus = !statusFilter || s.status === statusFilter;
    return matchSearch && matchBelt && matchStatus;
  });

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newStudent: Student = {
      id: `s${Date.now()}`, academyId: 'academy1',
      fullName: form.fullName, age: parseInt(form.age), icNumber: form.icNumber,
      parentName: form.parentName, parentPhone: form.parentPhone,
      beltRank: form.beltRank, joinDate: new Date().toISOString().split('T')[0],
      status: 'Active', branch: form.branch, classGroup: form.classGroup, missedClasses: 0,
    };
    setStudents([...students, newStudent]);
    setShowModal(false);
    setForm({ fullName: '', age: '', icNumber: '', parentName: '', parentPhone: '', beltRank: 'White', branch: 'Sepang Main', classGroup: 'Junior A' });
  };

  const tableColumns = [
    { key: 'name', header: 'Student', render: (s: Student) => (
      <Link href={`/dashboard/students/${s.id}`} className="font-semibold text-gray-900 hover:text-blue-600">{s.fullName}</Link>
    )},
    { key: 'age', header: 'Age', render: (s: Student) => <span className="text-gray-600">{s.age}</span> },
    { key: 'belt', header: 'Belt', render: (s: Student) => <Badge label={s.beltRank} color="navy" /> },
    { key: 'class', header: 'Class', render: (s: Student) => <span className="text-gray-600 text-xs">{s.classGroup} · {s.branch}</span> },
    { key: 'status', header: 'Status', render: (s: Student) => <Badge label={s.status} color={statusColors[s.status]} /> },
    { key: 'missed', header: 'Missed', render: (s: Student) => (
      <span className={s.missedClasses >= 3 ? 'text-red-600 font-semibold' : 'text-gray-500'}>{s.missedClasses}</span>
    )},
    { key: 'action', header: '', render: (s: Student) => (
      <Link href={`/dashboard/students/${s.id}`}><Button size="sm" variant="ghost">View</Button></Link>
    )},
  ];

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Students</h1>
          <p className="text-gray-500 text-sm">{filtered.length} of {students.length} students</p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <Plus size={16} /> Add Student
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text" placeholder="Search students or parents..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={beltFilter} onChange={e => setBeltFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Belts</option>
          {belts.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
          <option value="">All Status</option>
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
          <option value="At Risk">At Risk</option>
        </select>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button onClick={() => setView('grid')} className={`p-2 transition-colors ${view === 'grid' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            <Grid3X3 size={16} />
          </button>
          <button onClick={() => setView('list')} className={`p-2 transition-colors ${view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}>
            <List size={16} />
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(s => <StudentCard key={s.id} student={s} />)}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-16 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-40" />
              <p>No students found matching your filters.</p>
            </div>
          )}
        </div>
      ) : (
        <DataTable columns={tableColumns} data={filtered} emptyMessage="No students found." />
      )}

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Add New Student" size="lg">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <FormInput label="Full Name" value={form.fullName} onChange={e => setForm({...form, fullName: e.target.value})} placeholder="e.g. Arjun Subramaniam" required />
            </div>
            <FormInput label="Age" type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} placeholder="14" required />
            <FormInput label="IC / Passport Number" value={form.icNumber} onChange={e => setForm({...form, icNumber: e.target.value})} placeholder="100512-10-1234" required />
            <FormInput label="Parent Name" value={form.parentName} onChange={e => setForm({...form, parentName: e.target.value})} placeholder="Subramaniam Pillai" required />
            <FormInput label="Parent Phone" value={form.parentPhone} onChange={e => setForm({...form, parentPhone: e.target.value})} placeholder="012-3456789" required />
            <SelectInput label="Belt / Rank" value={form.beltRank}
              onChange={e => setForm({...form, beltRank: e.target.value as BeltRank})}
              options={belts.map(b => ({ value: b, label: b }))} />
            <SelectInput label="Branch" value={form.branch}
              onChange={e => setForm({...form, branch: e.target.value})}
              options={[{ value: 'Sepang Main', label: 'Sepang Main' }, { value: 'Nilai Branch', label: 'Nilai Branch' }]} />
            <SelectInput label="Class Group" value={form.classGroup}
              onChange={e => setForm({...form, classGroup: e.target.value})}
              options={['Junior A', 'Junior B', 'Senior A', 'Senior B'].map(c => ({ value: c, label: c }))} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1">Add Student</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

