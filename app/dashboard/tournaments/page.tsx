'use client';
import { useState } from 'react';
import { Trophy, Plus } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import StatCard from '@/components/StatCard';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getTournaments, getTournamentResults, getStudents, addTournament, recordTournamentResult } from '@/lib/db';
import { Medal } from '@/lib/types';

const medalEmoji: Record<string, string> = { gold: '🥇', silver: '🥈', bronze: '🥉', participation: '🏅' };

export default function TournamentsPage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: tournaments, refetch: refetchT } = useLive(getTournaments, ['tournaments']);
  const { data: results, refetch: refetchR } = useLive(() => getTournamentResults(), ['tournament_results']);
  const { data: students } = useLive(getStudents, ['students']);

  const [selId, setSelId] = useState<string | null>(null);
  const [showNewT, setShowNewT] = useState(false);
  const [showNewR, setShowNewR] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [tForm, setTForm] = useState({ name: '', date: '', venue: '', organizer: '' });
  const [rForm, setRForm] = useState({ studentId: '', eventCategory: '', medal: '' as Medal | '', points: '' });

  const selected = (tournaments ?? []).find(t => t.id === selId) ?? (tournaments ?? [])[0] ?? null;
  const selResults = (results ?? []).filter(r => r.tournamentId === selected?.id);

  const golds = (results ?? []).filter(r => r.medal === 'gold').length;
  const silvers = (results ?? []).filter(r => r.medal === 'silver').length;
  const bronzes = (results ?? []).filter(r => r.medal === 'bronze').length;
  const points = (results ?? []).reduce((s, r) => s + r.points, 0);

  const createTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true); setError('');
    try {
      await addTournament(currentUser.academyId, tForm.name, tForm.date, tForm.venue, tForm.organizer || undefined);
      setShowNewT(false); setTForm({ name: '', date: '', venue: '', organizer: '' });
      await refetchT();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not create tournament.'); }
    finally { setSaving(false); }
  };

  const addResult = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !rForm.studentId || !rForm.eventCategory) return;
    setSaving(true); setError('');
    try {
      await recordTournamentResult(selected.id, rForm.studentId, rForm.eventCategory, rForm.medal, parseInt(rForm.points) || 0);
      setShowNewR(false); setRForm({ studentId: '', eventCategory: '', medal: '', points: '' });
      await refetchR();
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not record result.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Tournaments</h1><p className="text-gray-500 text-sm mt-0.5">Tournament results and medal tally</p></div>
        {isStaff && <Button onClick={() => setShowNewT(true)} variant="primary"><Plus size={16} /> New Tournament</Button>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Points" value={points} icon={Trophy} iconBg="bg-yellow-50 text-yellow-600" />
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-yellow-600">🥇 {golds}</p><p className="text-xs text-gray-400 mt-1">Gold</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-gray-500">🥈 {silvers}</p><p className="text-xs text-gray-400 mt-1">Silver</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-orange-600">🥉 {bronzes}</p><p className="text-xs text-gray-400 mt-1">Bronze</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Tournaments</h2>
          {(tournaments ?? []).map(t => (
            <div key={t.id} onClick={() => setSelId(t.id)} className={`bg-white rounded-xl border p-4 cursor-pointer ${selected?.id === t.id ? 'border-yellow-400 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0"><Trophy size={18} className="text-yellow-600" /></div>
                <div className="min-w-0"><p className="font-semibold text-gray-900 text-sm truncate">{t.name}</p><p className="text-xs text-gray-400 mt-0.5">{t.eventDate} · {t.location}</p></div>
              </div>
            </div>
          ))}
          {(tournaments ?? []).length === 0 && <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">No tournaments yet.{isStaff ? ' Create your first one.' : ''}</div>}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 border-b border-gray-50 flex items-center justify-between flex-wrap gap-3">
                <div><h2 className="font-bold text-gray-900">{selected.name}</h2><p className="text-sm text-gray-500 mt-1">{selected.eventDate} · {selected.location}</p></div>
                {isStaff && <Button size="sm" onClick={() => setShowNewR(true)}><Plus size={14} /> Add Result</Button>}
              </div>
              <div className="divide-y divide-gray-50">
                {selResults.map(r => (
                  <div key={r.id} className="flex items-center gap-4 px-5 py-4">
                    <span className="text-3xl">{r.medal ? medalEmoji[r.medal] : '🎖️'}</span>
                    <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 text-sm truncate">{r.studentName}</p><p className="text-xs text-gray-500">{r.eventCategory}</p></div>
                    <div className="text-right">{r.medal && <Badge label={r.medal} color={r.medal === 'gold' ? 'gold' : r.medal === 'silver' ? 'gray' : 'orange'} />}<p className="text-xs text-gray-400 mt-1">{r.points} pts</p></div>
                  </div>
                ))}
                {selResults.length === 0 && <div className="px-5 py-10 text-center text-gray-400 text-sm">No results recorded yet.</div>}
              </div>
            </div>
          ) : <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-20"><p className="text-gray-400">Select a tournament</p></div>}
        </div>
      </div>

      {(results ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Medal Hall — All Tournaments</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(results ?? []).map(r => (
              <div key={r.id} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                <span className="text-3xl">{r.medal ? medalEmoji[r.medal] : '🎖️'}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 text-sm truncate">{r.studentName}</p><p className="text-xs text-gray-500">{r.eventCategory}</p><p className="text-xs text-gray-400">{r.points} pts</p></div>
                {r.medal && <Badge label={r.medal} color={r.medal === 'gold' ? 'gold' : r.medal === 'silver' ? 'gray' : 'orange'} />}
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal isOpen={showNewT} onClose={() => setShowNewT(false)} title="Create Tournament">
        <form onSubmit={createTournament} className="space-y-4">
          <FormInput label="Tournament Name" value={tForm.name} onChange={e => setTForm({ ...tForm, name: e.target.value })} placeholder="Kejohanan Silambam Daerah Sepang 2026" required />
          <FormInput label="Date" type="date" value={tForm.date} onChange={e => setTForm({ ...tForm, date: e.target.value })} required />
          <FormInput label="Venue" value={tForm.venue} onChange={e => setTForm({ ...tForm, venue: e.target.value })} placeholder="Dewan Komuniti Sepang" required />
          <FormInput label="Organizer (optional)" value={tForm.organizer} onChange={e => setTForm({ ...tForm, organizer: e.target.value })} placeholder="PSMDS" />
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2"><Button type="submit" variant="primary" className="flex-1" disabled={saving}>{saving ? 'Creating...' : 'Create Tournament'}</Button><Button type="button" variant="secondary" onClick={() => setShowNewT(false)}>Cancel</Button></div>
        </form>
      </Modal>

      <Modal isOpen={showNewR} onClose={() => setShowNewR(false)} title="Record Tournament Result">
        <form onSubmit={addResult} className="space-y-4">
          <SelectInput label="Student" value={rForm.studentId} onChange={e => setRForm({ ...rForm, studentId: e.target.value })}
            options={[{ value: '', label: 'Select student...' }, ...(students ?? []).map(s => ({ value: s.id, label: s.fullName }))]} />
          <FormInput label="Category" value={rForm.eventCategory} onChange={e => setRForm({ ...rForm, eventCategory: e.target.value })} placeholder="e.g. Under 15 Single Stick" required />
          <div className="grid grid-cols-2 gap-4">
            <SelectInput label="Medal" value={rForm.medal} onChange={e => setRForm({ ...rForm, medal: e.target.value as Medal | '' })}
              options={[{ value: '', label: 'No medal' }, { value: 'gold', label: '🥇 Gold' }, { value: 'silver', label: '🥈 Silver' }, { value: 'bronze', label: '🥉 Bronze' }, { value: 'participation', label: '🏅 Participation' }]} />
            <FormInput label="Points" type="number" value={rForm.points} onChange={e => setRForm({ ...rForm, points: e.target.value })} placeholder="0" />
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2"><Button type="submit" variant="primary" className="flex-1" disabled={saving || !rForm.studentId}>{saving ? 'Saving...' : 'Save Result'}</Button><Button type="button" variant="secondary" onClick={() => setShowNewR(false)}>Cancel</Button></div>
        </form>
      </Modal>
    </div>
  );
}
