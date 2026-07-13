'use client';
import { useState } from 'react';
import { Plus, Award } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getGradingEvents, getGradingResults, getStudents, getBelts, addGradingEvent, registerForGrading, setGradingResult } from '@/lib/db';
import { GradingResultType } from '@/lib/types';

export default function GradingPage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: events, refetch: refetchEvents } = useLive(getGradingEvents, ['grading_events']);
  const { data: results, refetch: refetchResults } = useLive(() => getGradingResults(), ['grading_results']);
  const { data: students } = useLive(getStudents, ['students']);
  const { data: belts } = useLive(getBelts, ['belts']);

  const [selId, setSelId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', eventDate: '', location: '', examiner: '', fee: '' });
  const [addStudentId, setAddStudentId] = useState('');

  const selected = (events ?? []).find(e => e.id === selId) ?? (events ?? [])[0] ?? null;
  const eventResults = (results ?? []).filter(r => r.gradingEventId === selected?.id);
  const registeredIds = eventResults.map(r => r.studentId);
  const unregistered = (students ?? []).filter(s => !registeredIds.includes(s.id));

  const nextBelt = (beltId: string | null) => {
    const sorted = [...(belts ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = sorted.findIndex(b => b.id === beltId);
    return idx >= 0 && idx < sorted.length - 1 ? sorted[idx + 1] : null;
  };

  const createEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setSaving(true);
    try { await addGradingEvent(currentUser.academyId, { name: form.name, eventDate: form.eventDate, location: form.location, examiner: form.examiner, fee: parseFloat(form.fee) || 0 }); setShowModal(false); setForm({ name: '', eventDate: '', location: '', examiner: '', fee: '' }); await refetchEvents(); }
    finally { setSaving(false); }
  };

  const register = async () => {
    if (!selected || !addStudentId) return;
    const student = students?.find(s => s.id === addStudentId);
    await registerForGrading(selected.id, addStudentId, student?.beltId ?? null, nextBelt(student?.beltId ?? null)?.id ?? null);
    setAddStudentId('');
    await refetchResults();
  };

  const grade = async (studentId: string, result: GradingResultType) => {
    if (!selected || !currentUser) return;
    await setGradingResult(selected.id, studentId, result, currentUser.id);
    await refetchResults();
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div><h1 className="text-2xl font-extrabold text-gray-900">Belt Grading</h1><p className="text-gray-500 text-sm mt-0.5">Passing a student auto-promotes their belt</p></div>
        {isStaff && <Button onClick={() => setShowModal(true)} variant="primary"><Plus size={16} /> New Grading Event</Button>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Events</h2>
          {(events ?? []).map(ev => (
            <div key={ev.id} onClick={() => setSelId(ev.id)} className={`bg-white rounded-xl border p-4 cursor-pointer ${selected?.id === ev.id ? 'border-yellow-400 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0"><Award size={18} className="text-indigo-600" /></div>
                <div className="min-w-0"><p className="font-semibold text-gray-900 text-sm truncate">{ev.name}</p><p className="text-xs text-gray-400 mt-0.5">{ev.eventDate}</p><p className="text-xs text-gray-400">{ev.location}</p></div>
              </div>
            </div>
          ))}
          {(events ?? []).length === 0 && <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">No grading events yet.</div>}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">{selected.name}</h2>
                <p className="text-sm text-gray-500 mt-1">{selected.eventDate} · {selected.location} · Examiner: {selected.examiner}</p>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="font-semibold text-gray-900">Registered Students</h3>
                  {isStaff && unregistered.length > 0 && (
                    <div className="flex gap-2">
                      <select value={addStudentId} onChange={e => setAddStudentId(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"><option value="">Add student...</option>{unregistered.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}</select>
                      <Button size="sm" onClick={register} disabled={!addStudentId}>Add</Button>
                    </div>
                  )}
                </div>
                {eventResults.length === 0 ? <div className="text-center py-10 text-gray-400"><Award size={32} className="mx-auto mb-2 opacity-40" /><p className="text-sm">No students registered.</p></div> : (
                  <div className="space-y-3">
                    {eventResults.map(r => (
                      <div key={r.id} className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-xl p-4">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{r.studentName}</p>
                          <div className="flex items-center gap-2 mt-1"><Badge label={r.fromBeltName || '—'} color="gray" /><span className="text-xs text-gray-400">→</span><Badge label={r.toBeltName || '—'} color="navy" /></div>
                        </div>
                        <div className="flex items-center gap-2">
                          {r.result !== 'registered' && <Badge label={r.result} color={r.result === 'pass' ? 'green' : r.result === 'fail' ? 'red' : 'yellow'} />}
                          {isStaff && (
                            <div className="flex gap-1.5">
                              <button onClick={() => grade(r.studentId, 'pass')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${r.result === 'pass' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-green-50'}`}>Pass</button>
                              <button onClick={() => grade(r.studentId, 'fail')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${r.result === 'fail' ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-red-50'}`}>Fail</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-20"><p className="text-gray-400">Select a grading event</p></div>}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Grading Event">
        <form onSubmit={createEvent} className="space-y-4">
          <FormInput label="Event Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Mid-Year Belt Grading 2026" required />
          <FormInput label="Date" type="date" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} required />
          <FormInput label="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="Dewan Komuniti Sepang" required />
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Examiner" value={form.examiner} onChange={e => setForm({ ...form, examiner: e.target.value })} placeholder="Chief examiner" required />
            <FormInput label="Fee (RM)" type="number" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })} placeholder="0" />
          </div>
          <div className="flex gap-3 pt-2"><Button type="submit" variant="primary" className="flex-1" disabled={saving}>{saving ? 'Creating...' : 'Create Event'}</Button><Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button></div>
        </form>
      </Modal>
    </div>
  );
}
