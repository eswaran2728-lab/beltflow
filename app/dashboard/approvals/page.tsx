'use client';
import { useState } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Users, Link2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getStudents } from '@/lib/db';
import Badge from '@/components/Badge';

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  status: string;
  child_name: string | null;
  assigned_class: string | null;
  child_student_ids: string[] | null;
  student_id: string | null;
  created_at: string;
}

export default function ApprovalsPage() {
  const { currentUser } = useAuth();
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const { data: users, refetch } = useLive(async () => {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PendingUser[];
  }, ['profiles']);
  const { data: students } = useLive(getStudents, ['students']);

  const setStatus = async (id: string, status: 'approved' | 'rejected') => {
    setActionLoading(id);
    await supabase.from('profiles').update({ status }).eq('id', id);
    await refetch();
    setActionLoading(null);
  };

  const linkStudent = async (user: PendingUser, studentId: string) => {
    if (!studentId) return;
    setActionLoading(user.id);
    if (user.role === 'parent') {
      await supabase.from('profiles').update({ child_student_ids: [studentId] }).eq('id', user.id);
    } else if (user.role === 'student') {
      await supabase.from('profiles').update({ student_id: studentId }).eq('id', user.id);
    }
    await refetch();
    setActionLoading(null);
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <XCircle size={40} className="text-red-300 mb-3" />
        <p className="text-gray-500 font-medium">Admin access only.</p>
      </div>
    );
  }

  const all = users ?? [];
  const pending = all.filter(u => u.status === 'pending');
  const approved = all.filter(u => u.status === 'approved');
  const rejected = all.filter(u => u.status === 'rejected');

  const roleColor: Record<string, 'blue' | 'green' | 'purple' | 'navy'> = {
    admin: 'navy', coach: 'blue', parent: 'green', student: 'purple',
  };

  const linkedStudentName = (u: PendingUser) => {
    const id = u.role === 'parent' ? u.child_student_ids?.[0] : u.student_id;
    if (!id) return null;
    return students?.find(s => s.id === id)?.fullName ?? null;
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Account Approvals</h1>
          <p className="text-gray-500 text-sm mt-0.5">Approve registrations and link parents/students to student profiles</p>
        </div>
        <button onClick={() => refetch()}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Pending', count: pending.length, color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
          { label: 'Approved', count: approved.length, color: 'bg-green-50 text-green-700', dot: 'bg-green-400' },
          { label: 'Rejected', count: rejected.length, color: 'bg-red-50 text-red-700', dot: 'bg-red-400' },
        ].map(s => (
          <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-3`}>
            <div className={`w-3 h-3 rounded-full ${s.dot} flex-shrink-0`} />
            <div>
              <p className="text-2xl font-extrabold">{s.count}</p>
              <p className="text-xs font-medium opacity-80">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pending approvals */}
      {pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Users size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No pending approvals</p>
          <p className="text-gray-400 text-sm mt-1">New registrations will appear here in real time</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <Clock size={16} className="text-yellow-500" />
            <h2 className="font-bold text-gray-900">Pending Approval ({pending.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {pending.map(u => (
              <div key={u.id} className="p-5 flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-gray-900">{u.full_name}</p>
                    <Badge label={u.role} color={roleColor[u.role] || 'blue'} />
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5">{u.email}</p>
                  {u.phone && <p className="text-xs text-gray-400 mt-0.5">{u.phone}</p>}
                  {u.child_name && <p className="text-xs text-blue-600 mt-1">Child: {u.child_name}</p>}
                  {u.assigned_class && <p className="text-xs text-blue-600 mt-1">Class: {u.assigned_class}</p>}
                  <p className="text-xs text-gray-300 mt-1">{new Date(u.created_at).toLocaleString()}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setStatus(u.id, 'approved')} disabled={actionLoading === u.id}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                    <CheckCircle size={15} />
                    {actionLoading === u.id ? '...' : 'Approve'}
                  </button>
                  <button onClick={() => setStatus(u.id, 'rejected')} disabled={actionLoading === u.id}
                    className="flex items-center gap-1.5 bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-xl text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60">
                    <XCircle size={15} />
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approved users */}
      {approved.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            <h2 className="font-bold text-gray-900">Approved Users ({approved.length})</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {approved.map(u => {
              const linked = linkedStudentName(u);
              const linkable = u.role === 'parent' || u.role === 'student';
              return (
                <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{u.full_name}</p>
                      <Badge label={u.role} color={roleColor[u.role] || 'blue'} />
                    </div>
                    <p className="text-xs text-gray-400">{u.email}</p>
                    {linkable && linked && (
                      <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                        <Link2 size={11} /> Linked to {linked}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-wrap">
                    {linkable && (
                      <select
                        value={(u.role === 'parent' ? u.child_student_ids?.[0] : u.student_id) ?? ''}
                        onChange={e => linkStudent(u, e.target.value)}
                        disabled={actionLoading === u.id}
                        className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">{u.role === 'parent' ? 'Link child...' : 'Link student profile...'}</option>
                        {(students ?? []).map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                      </select>
                    )}
                    {u.role !== 'admin' && (
                      <button onClick={() => setStatus(u.id, 'rejected')} disabled={actionLoading === u.id}
                        className="text-xs text-red-500 hover:underline font-semibold">
                        Revoke
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
