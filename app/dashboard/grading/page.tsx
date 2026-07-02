'use client';
import { useState } from 'react';
import { Plus, Award } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import { useAuth } from '@/lib/auth-context';
import { useLive } from '@/lib/useLive';
import { getGradingEvents, getGradingRecords, getStudents, addGradingEvent, setGradingEventStudents, recordGradingResult } from '@/lib/db';
import { GradingResultType, BELT_LEVELS } from '@/lib/types';

export default function GradingPage() {
  const { currentUser } = useAuth();
  const isStaff = currentUser?.role === 'admin' || currentUser?.role === 'coach';
  const { data: events } = useLive(getGradingEvents, ['grading_events']);
  const { data: records } = useLive(() => getGradingRecords(), ['grading_records']);
  const { data: students } = useLive(getStudents, ['students']);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', date: '', location: '', examiner: '' });
  const [addStudentId, setAddStudentId] = useState('');

  const selectedEvent = (events ?? []).find(e => e.id === selectedId) ?? (events ?? [])[0] ?? null;
  const eventRecords = (records ?? []).filter(r => r.eventId === selectedEvent?.id);
  const eligibleStudents = (students ?? []).filter(s => selectedEvent?.studentIds.includes(s.id));
  const unregisteredStudents = (students ?? []).filter(s => !selectedEvent?.studentIds.includes(s.id));

  const handleAddEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await addGradingEvent(form);
      setShowModal(false);
      setForm({ title: '', date: '', location: '', examiner: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create event.');
    } finally {
      setSaving(false);
    }
  };

  const addStudentToEvent = async () => {
    if (!selectedEvent || !addStudentId) return;
    await setGradingEventStudents(selectedEvent.id, [...selectedEvent.studentIds, addStudentId]);
    setAddStudentId('');
  };

  const updateResult = async (studentId: string, result: GradingResultType) => {
    const student = students?.find(s => s.id === studentId);
    if (!student || !selectedEvent) return;
    const beltIdx = BELT_LEVELS.indexOf(student.beltRank);
    const targetBelt = beltIdx >= 0 && beltIdx < BELT_LEVELS.length - 1 ? BELT_LEVELS[beltIdx + 1] : student.beltRank;
    await recordGradingResult({
      eventId: selectedEvent.id, studentId, studentName: student.fullName,
      currentBelt: student.beltRank, targetBelt, result,
      examiner: selectedEvent.examiner, date: selectedEvent.date,
    });
  };

  const getResult = (studentId: string): GradingResultType | null =>
    eventRecords.find(r => r.studentId === studentId)?.result || null;

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Belt Grading</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage grading events and student results</p>
        </div>
        {isStaff && (
          <Button onClick={() => setShowModal(true)} variant="primary">
            <Plus size={16} /> New Grading Event
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Event list */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Grading Events</h2>
          {(events ?? []).map(event => (
            <div key={event.id}
              onClick={() => setSelectedId(event.id)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${selectedEvent?.id === event.id ? 'border-yellow-400 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${event.status === 'Upcoming' ? 'bg-indigo-50' : 'bg-green-50'}`}>
                  <Award size={18} className={event.status === 'Upcoming' ? 'text-indigo-600' : 'text-green-600'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm truncate">{event.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{event.date}</p>
                  <p className="text-xs text-gray-400">{event.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge label={event.status} color={event.status === 'Upcoming' ? 'blue' : 'green'} />
                    <span className="text-xs text-gray-400">{event.studentIds.length} students</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {(events ?? []).length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center text-gray-400 text-sm">
              No grading events yet.{isStaff ? ' Create your first event.' : ''}
            </div>
          )}
        </div>

        {/* Event detail */}
        <div className="lg:col-span-2">
          {selectedEvent ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="p-5 border-b border-gray-50">
                <h2 className="font-bold text-gray-900">{selectedEvent.title}</h2>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-sm">
                  <div><span className="text-gray-500">Date: </span><span className="font-medium">{selectedEvent.date}</span></div>
                  <div><span className="text-gray-500">Location: </span><span className="font-medium">{selectedEvent.location}</span></div>
                  <div className="col-span-2"><span className="text-gray-500">Examiner: </span><span className="font-medium">{selectedEvent.examiner}</span></div>
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                  <h3 className="font-semibold text-gray-900">Registered Students</h3>
                  {isStaff && selectedEvent.status === 'Upcoming' && unregisteredStudents.length > 0 && (
                    <div className="flex gap-2">
                      <select value={addStudentId} onChange={e => setAddStudentId(e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                        <option value="">Add student...</option>
                        {unregisteredStudents.map(s => <option key={s.id} value={s.id}>{s.fullName}</option>)}
                      </select>
                      <Button size="sm" onClick={addStudentToEvent} disabled={!addStudentId}>Add</Button>
                    </div>
                  )}
                </div>
                {eligibleStudents.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Award size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No students registered for this event.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibleStudents.map(student => {
                      const result = getResult(student.id);
                      const beltIdx = BELT_LEVELS.indexOf(student.beltRank);
                      const targetBelt = beltIdx >= 0 && beltIdx < BELT_LEVELS.length - 1 ? BELT_LEVELS[beltIdx + 1] : student.beltRank;
                      return (
                        <div key={student.id} className="flex items-center justify-between flex-wrap gap-3 bg-gray-50 rounded-xl p-4">
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{student.fullName}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge label={student.beltRank} color="gray" />
                              <span className="text-xs text-gray-400">→</span>
                              <Badge label={targetBelt} color="navy" />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {result && <Badge label={result} color={result === 'Pass' ? 'green' : result === 'Fail' ? 'red' : 'yellow'} />}
                            {isStaff && selectedEvent.status === 'Upcoming' && (
                              <div className="flex gap-1.5">
                                <button onClick={() => updateResult(student.id, 'Pass')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${result === 'Pass' ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-green-50'}`}>
                                  Pass
                                </button>
                                <button onClick={() => updateResult(student.id, 'Fail')}
                                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${result === 'Fail' ? 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-red-50'}`}>
                                  Fail
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {eventRecords.length > 0 && (
                <div className="px-5 pb-5">
                  <h3 className="font-semibold text-gray-900 mb-3">Results Summary</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-green-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-green-700">{eventRecords.filter(r => r.result === 'Pass').length}</p>
                      <p className="text-xs text-green-600">Passed</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-red-600">{eventRecords.filter(r => r.result === 'Fail').length}</p>
                      <p className="text-xs text-red-500">Failed</p>
                    </div>
                    <div className="bg-yellow-50 rounded-xl p-3 text-center">
                      <p className="text-2xl font-bold text-yellow-700">{eventRecords.filter(r => r.result === 'Pending').length}</p>
                      <p className="text-xs text-yellow-600">Pending</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex items-center justify-center py-20">
              <p className="text-gray-400">Select a grading event to view details</p>
            </div>
          )}
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Grading Event">
        <form onSubmit={handleAddEvent} className="space-y-4">
          <FormInput label="Event Title" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="Mid-Year Belt Grading 2026" required />
          <FormInput label="Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
          <FormInput label="Location / Venue" value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="Dewan Komuniti Sepang" required />
          <FormInput label="Chief Examiner" value={form.examiner} onChange={e => setForm({...form, examiner: e.target.value})} placeholder="Chief examiner name" required />
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1" disabled={saving}>{saving ? 'Creating...' : 'Create Event'}</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
