'use client';
import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, Clock, RefreshCw, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import Badge from '@/components/Badge';

interface PendingUser {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  child_name: string;
  assigned_class: string;
  created_at: string;
}

export default function ApprovalsPage() {
  const { currentUser } = useAuth();
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    setUsers((data || []) as PendingUser[]);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const approve = async (id: string) => {
    setActionLoading(id);
    await supabase.from('profiles').update({ status: 'approved' }).eq('id', id);
    await fetchUsers();
    setActionLoading(null);
  };

  const reject = async (id: string) => {
    setActionLoading(id);
    await supabase.from('profiles').update({ status: 'rejected' }).eq('id', id);
    await fetchUsers();
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

  const pending = users.filter(u => u.status === 'pending');
  const approved = users.filter(u => u.status === 'approved');
  const rejected = users.filter(u => u.status === 'rejected');

  const roleColor: Record<string, 'blue' | 'green' | 'purple'> = {
    coach: 'blue', parent: 'green', student: 'purple',
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Account Approvals</h1>
          <p className="text-gray-500 text-sm mt-0.5">Approve or reject new registrations</p>
        </div>
        <button onClick={fetchUsers}
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
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <div className="w-8 h-8 border-2 border-gray-900 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading registrations...</p>
        </div>
      ) : pending.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Users size={36} className="text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No pending approvals</p>
          <p className="text-gray-400 text-sm mt-1">New registrations will appear here</p>
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
                  <button onClick={() => approve(u.id)} disabled={actionLoading === u.id}
                    className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition-colors disabled:opacity-60">
                    <CheckCircle size={15} />
                    {actionLoading === u.id ? '...' : 'Approve'}
                  </button>
                  <button onClick={() => reject(u.id)} disabled={actionLoading === u.id}
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
            {approved.map(u => (
              <div key={u.id} className="px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900 text-sm">{u.full_name}</p>
                    <Badge label={u.role} color={roleColor[u.role] || 'blue'} />
                  </div>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </div>
                <button onClick={() => reject(u.id)} disabled={actionLoading === u.id}
                  className="text-xs text-red-500 hover:underline font-semibold">
                  Revoke
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
