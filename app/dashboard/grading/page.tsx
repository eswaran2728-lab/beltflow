'use client';
import { useState } from 'react';
import { Plus, Award } from 'lucide-react';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import { mockGradingEvents, mockGradingRecords } from '@/data/grading';
import { mockStudents } from '@/data/students';
import { GradingEvent, GradingRecord, BeltRank, GradingResultType } from '@/lib/types';

const belts: BeltRank[] = ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'];

export default function GradingPage() {
  const [events, setEvents] = useState(mockGradingEvents);
  const [records, setRecords] = useState(mockGradingRecords);
  const [selectedEvent, setSelectedEvent] = useState(mockGradingEvents[0]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', location: '', examiner: '' });

  const eventRecords = records.filter(r => r.eventId === selectedEvent?.id);
  const eligibleStudents = mockStudents.filter(s => selectedEvent?.students.includes(s.id));

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const newEvent: GradingEvent = {
      id: `ge${Date.now()}`, academyId: 'academy1',
      title: form.title, date: form.date, location: form.location,
      examiner: form.examiner, students: [], status: 'Upcoming',
    };
    setEvents([...events, newEvent]);
    setShowModal(false);
    setForm({ title: '', date: '', location: '', examiner: '' });
  };

  const updateResult = (studentId: string, result: GradingResultType) => {
    const student = mockStudents.find(s => s.id === studentId);
    if (!student) return;
    const existing = records.find(r => r.eventId === selectedEvent.id && r.studentId === studentId);
    if (existing) {
      setRecords(records.map(r => r.id === existing.id ? { ...r, result } : r));
    } else {
      const beltIdx = belts.indexOf(student.beltRank);
      const newRecord: GradingRecord = {
        id: `gr${Date.now()}`, eventId: selectedEvent.id, studentId,
        studentName: student.fullName, currentBelt: student.beltRank,
        targetBelt: beltIdx < belts.length - 1 ? belts[beltIdx + 1] : student.beltRank,
        result, examiner: selectedEvent.examiner, date: selectedEvent.date,
      };
      setRecords([...records, newRecord]);
    }
  };

  const getResult = (studentId: string): GradingResultType | null => {
    return records.find(r => r.eventId === selectedEvent?.id && r.studentId === studentId)?.result || null;
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Belt Grading</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage grading events and student results</p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <Plus size={16} /> New Grading Event
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Event list */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">Grading Events</h2>
          {events.map(event => (
            <div key={event.id}
              onClick={() => setSelectedEvent(event)}
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
                    <span className="text-xs text-gray-400">{event.students.length} students</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
                <h3 className="font-semibold text-gray-900 mb-4">Registered Students</h3>
                {eligibleStudents.length === 0 ? (
                  <div className="text-center py-10 text-gray-400">
                    <Award size={32} className="mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No students registered for this event.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {eligibleStudents.map(student => {
                      const result = getResult(student.id);
                      const beltIdx = belts.indexOf(student.beltRank);
                      const targetBelt = beltIdx < belts.length - 1 ? belts[beltIdx + 1] : student.beltRank;
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
                            {selectedEvent.status === 'Upcoming' && (
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
          <FormInput label="Chief Examiner" value={form.examiner} onChange={e => setForm({...form, examiner: e.target.value})} placeholder="Mahaguru Sri S. Arumugam" required />
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1">Create Event</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
