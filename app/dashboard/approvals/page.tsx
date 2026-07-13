'use client';
import { useState } from 'react';
import { CheckCircle, XCircle, Clock, Users, Link2, RefreshCw } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import SelectInput from '@/components/SelectInput';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import {
  getProfiles, getStudents, getGuardiansForStudent, setProfileStatus,
  linkGuardian, linkStudentProfile, PendingProfile,
} from '@/lib/db';
import { Relationship } from '@/lib/types';

export default function ApprovalsPage() {
  const { currentUser } = useAuth();
  const { data: profiles, refetch } = useLive(getProfiles, ['profiles']);
  const { data: students } = useLive(getStudents, ['students']);
  const [busy, setBusy] = useState('');

  if (currentUser?.role !== 'admin') {
    return <div className="flex flex-col items-center justify-center h-64 text-center"><XCircle size={40} className="text-red-300 mb-3" /><p className="text-gray-500 font-medium">Admin access only.</p></div>;
  }

  const all = profiles ?? [];
  const pending = all.filter(p => p.status === 'pending');
  const approved = all.filter(p => p.status === 'approved');
  const roleColor: Record<string, 'blue' | 'green' | 'purple' | 'navy'> = { admin: 'navy', coach: 'blue', parent: 'green', student: 'purple' };

  const act = async (id: string, status: 'approved' | 'rejected') => {
    setBusy(id);
    try { await setProfileStatus(id, status); await refetch(); } finally { setBusy(''); }
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Account Approvals</h1>
          <p className="text-gray-500 text-sm mt-0.5">Approve registrations and link parents/students to student records</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"><RefreshCw size={14} /> Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', count: pending.length, color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
          { label: 'Approved', count: approved.length, color: 'bg-green-50 text-green-700', dot: 'bg-green-400' },
          { label: 'Rejected', count: all.filter(p => p.status === 'rejected').length, color: 'bg-red-50 text-red-700', dot: 'bg-red-400' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-3`}>
            <div className={`w-3 h-3 rounded-full ${s.dot} flex-shrink-0`} />
            <div><p className="text-2xl font-extrabold">{s.count}</p><p className="text-xs font-medium opacity-80">{s.label}</p></div>
          </div>
        ))}
      </div>

      {pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Users size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No pending approvals</p>
          <p className="text-gray-400 text-sm mt-1">New registrations appear here in real time</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2"><Clock size={16} className="text-yellow-500" /><h2 className="font-bold text-gray-900">Pending Approval ({pending.length})</h2></div>
          <div className="divide-y divide-gray-50">
            {pending.map(u => (
              <div key={u.id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap"><p className="font-bold text-gray-900">{u.fullName}</p><Badge label={u.role} color={roleColor[u.role] || 'blue'} /></div>
                  <p className="text-sm text-gray-500 mt-0.5">{u.email}</p>
                  {u.phone && <p className="text-xs text-gray-400 mt-0.5">{u.phone}</p>}
                  {u.childName && <p className="text-xs text-blue-600 mt-1">Child: {u.childName}</p>}
                  {u.assignedClass && <p className="text-xs text-blue-600 mt-1">Class: {u.assignedClass}</p>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => act(u.id, 'approved')} disabled={busy === u.id} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 disabled:opacity-60"><CheckCircle size={15} />{busy === u.id ? '...' : 'Approve'}</button>
                  <button onClick={() => act(u.id, 'rejected')} disabled={busy === u.id} className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-100 disabled:opacity-60"><XCircle size={15} /> Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approved.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2"><CheckCircle size={16} className="text-green-500" /><h2 className="font-bold text-gray-900">Approved Users ({approved.length})</h2></div>
          <div className="divide-y divide-gray-50">
            {approved.map(u => (
              <ApprovedRow key={u.id} user={u} students={students ?? []} onRevoke={() => act(u.id, 'rejected')} busy={busy === u.id} onChanged={refetch} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovedRow({ user, students, onRevoke, busy, onChanged }: {
  user: PendingProfile; students: { id: string; fullName: string }[]; onRevoke: () => void; busy: boolean; onChanged: () => void;
}) {
  const [addStudentId, setAddStudentId] = useState('');
  const [rel, setRel] = useState<Relationship>('father');
  const [linked, setLinked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const roleColor: Record<string, 'blue' | 'green' | 'purple' | 'navy'> = { admin: 'navy', coach: 'blue', parent: 'green', student: 'purple' };

  const linkParent = async () => {
    if (!addStudentId) return;
    setSaving(true);
    try {
      await linkGuardian(user.id, addStudentId, rel, linked.length === 0);
      setLinked([...linked, students.find(s => s.id === addStudentId)?.fullName ?? '']);
      setAddStudentId('');
      onChanged();
    } finally { setSaving(false); }
  };

  const linkStudent = async () => {
    if (!addStudentId) return;
    setSaving(true);
    try { await linkStudentProfile(addStudentId, user.id); setLinked([students.find(s => s.id === addStudentId)?.fullName ?? '']); onChanged(); }
    finally { setSaving(false); }
  };

  const linkable = user.role === 'parent' || user.role === 'student';

  return (
    <div className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2"><p className="font-semibold text-gray-900 text-sm">{user.fullName}</p><Badge label={user.role} color={roleColor[user.role] || 'blue'} /></div>
        <p className="text-xs text-gray-400">{user.email}</p>
        {linked.length > 0 && <p className="text-xs text-green-600 mt-1 flex items-center gap-1"><Link2 size={11} /> Linked: {linked.join(', ')}</p>}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {linkable && (
          <>
            <select value={addStudentId} onChange={e => setAddStudentId(e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
              <option value="">{user.role === 'parent' ? 'Link child...' : 'Link student record...'}</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            {user.role === 'parent' && (
              <select value={rel} onChange={e => setRel(e.target.value as Relationship)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs bg-white">
                <option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Guardian</option>
              </select>
            )}
            <Button size="sm" onClick={user.role === 'parent' ? linkParent : linkStudent} disabled={!addStudentId || saving}>Link</Button>
          </>
        )}
        {user.role !== 'admin' && <button onClick={onRevoke} disabled={busy} className="text-xs text-red-500 hover:underline font-semibold">Revoke</button>}
      </div>
    </div>
  );
}
