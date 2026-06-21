'use client';
import { useState } from 'react';
import { Trophy, Plus, Users, Calendar, MapPin, Clock, Download } from 'lucide-react';
import { mockStudents } from '@/data/students';
import Badge from '@/components/Badge';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import FormInput from '@/components/FormInput';
import SelectInput from '@/components/SelectInput';
import StatCard from '@/components/StatCard';
import {
  mockTournaments,
  mockTournamentRegistrations,
  mockTournamentResults,
  mockAthleteAchievements,
} from '@/data/tournaments';
import { Tournament, TournamentStatus } from '@/lib/types';

const statusColors: Record<TournamentStatus, 'gray' | 'green' | 'yellow' | 'navy' | 'red' | 'blue' | 'purple' | 'orange'> = {
  'Draft': 'gray', 'Open Registration': 'green', 'Registration Closed': 'yellow',
  'Completed': 'navy', 'Cancelled': 'red',
};

const defaultCategories = ['Single Stick', 'Double Stick', 'Sedikuchi', 'Maan Kombu', 'Kuthu Varisai', 'Silambam Sandai', 'Open Category', 'Custom Category'];

export default function TournamentsPage() {
  const [tournaments, setTournaments] = useState(mockTournaments);
  const [registrations, setRegistrations] = useState(mockTournamentRegistrations);
  const [selected, setSelected] = useState(mockTournaments[0]);
  const [tab, setTab] = useState<'overview' | 'registrations' | 'results' | 'reports'>('overview');
  const [showModal, setShowModal] = useState(false);
  const [showRegModal, setShowRegModal] = useState(false);
  const [form, setForm] = useState({ name: '', organizer: '', venue: '', date: '', registrationDeadline: '', notes: '' });
  const [regForm, setRegForm] = useState({ studentId: '', ageGroup: 'Under 15', category: 'Single Stick', remarks: '' });

  const selectedRegs = registrations.filter(r => r.tournamentId === selected?.id);
  const selectedResults = mockTournamentResults.filter(r => r.tournamentId === selected?.id);

  const totalRegistered = registrations.length;
  const upcoming = tournaments.filter(t => t.status === 'Open Registration' || t.status === 'Draft').length;
  const golds = mockTournamentResults.filter(r => r.medal === 'Gold').length;
  const silvers = mockTournamentResults.filter(r => r.medal === 'Silver').length;
  const bronzes = mockTournamentResults.filter(r => r.medal === 'Bronze').length;
  const totalPoints = mockAthleteAchievements.reduce((s, a) => s + a.points, 0);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const newT: Tournament = {
      id: `t${Date.now()}`, academyId: 'academy1', name: form.name,
      organizer: form.organizer, venue: form.venue, date: form.date,
      registrationDeadline: form.registrationDeadline, status: 'Draft',
      notes: form.notes, coachIds: [], categories: defaultCategories.slice(0, 5),
    };
    setTournaments([...tournaments, newT]);
    setSelected(newT);
    setShowModal(false);
    setForm({ name: '', organizer: '', venue: '', date: '', registrationDeadline: '', notes: '' });
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-gray-900">Tournaments</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage tournament registrations and results</p>
        </div>
        <Button onClick={() => setShowModal(true)} variant="primary">
          <Plus size={16} /> New Tournament
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <StatCard title="Tournaments" value={tournaments.length} icon={Trophy} iconBg="bg-yellow-50 text-yellow-600" />
        <StatCard title="Upcoming" value={upcoming} icon={Calendar} iconBg="bg-blue-50 text-blue-600" />
        <StatCard title="Athletes" value={totalRegistered} icon={Users} iconBg="bg-purple-50 text-purple-600" />
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">🥇 {golds}</p>
          <p className="text-xs text-gray-400 mt-1">Gold</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-gray-500">🥈 {silvers}</p>
          <p className="text-xs text-gray-400 mt-1">Silver</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">🥉 {bronzes}</p>
          <p className="text-xs text-gray-400 mt-1">Bronze</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Tournament list */}
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-700 text-sm uppercase tracking-wider">All Tournaments</h2>
          {tournaments.map(t => (
            <div key={t.id} onClick={() => setSelected(t)}
              className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${selected?.id === t.id ? 'border-yellow-400 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Trophy size={18} className="text-yellow-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{t.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Calendar size={11} /> {t.date}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 truncate"><MapPin size={11} /> {t.venue}</p>
                  <div className="mt-2">
                    <Badge label={t.status} color={statusColors[t.status]} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Tournament detail */}
        <div className="lg:col-span-2 space-y-4">
          {selected && (
            <>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
                  <div>
                    <h2 className="font-bold text-gray-900 text-lg leading-tight">{selected.name}</h2>
                    <p className="text-sm text-gray-500 mt-1">{selected.organizer}</p>
                  </div>
                  <Badge label={selected.status} color={statusColors[selected.status]} />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <div className="flex items-center gap-2"><Calendar size={14} className="text-gray-400" /><span className="text-gray-600">{selected.date}</span></div>
                  <div className="flex items-center gap-2"><Clock size={14} className="text-gray-400" /><span className="text-gray-600">Deadline: {selected.registrationDeadline}</span></div>
                  <div className="flex items-center gap-2 col-span-2"><MapPin size={14} className="text-gray-400" /><span className="text-gray-600">{selected.venue}</span></div>
                </div>
                {selected.notes && (
                  <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs text-gray-600">{selected.notes}</div>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {selected.categories.map(c => (
                    <span key={c} className="bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full font-medium">{c}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-1.5 bg-white rounded-xl border border-gray-100 p-1">
                {(['overview', 'registrations', 'results', 'reports'] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${tab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                    {t}
                  </button>
                ))}
              </div>

              {tab === 'overview' && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selectedRegs.length}</p>
                    <p className="text-xs text-gray-400 mt-1">Registered</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-green-600">{selectedRegs.filter(r => r.status === 'Confirmed').length}</p>
                    <p className="text-xs text-gray-400 mt-1">Confirmed</p>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-100 p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-600">{selectedResults.length}</p>
                    <p className="text-xs text-gray-400 mt-1">Results</p>
                  </div>
                </div>
              )}

              {tab === 'registrations' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="flex items-center justify-between p-4 border-b border-gray-50">
                    <h3 className="font-bold text-gray-900">Registered Athletes ({selectedRegs.length})</h3>
                    {selected.status === 'Open Registration' && (
                      <Button size="sm" onClick={() => setShowRegModal(true)}>
                        <Plus size={14} /> Register Student
                      </Button>
                    )}
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Age Group</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Coach</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedRegs.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{r.studentName}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{r.category}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{r.ageGroup}</td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{r.coachName}</td>
                            <td className="px-4 py-3">
                              <Badge label={r.status} color={r.status === 'Confirmed' ? 'green' : r.status === 'Registered' ? 'blue' : r.status === 'Completed' ? 'navy' : 'gray'} />
                            </td>
                          </tr>
                        ))}
                        {selectedRegs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No athletes registered yet.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {tab === 'results' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                  <div className="p-4 border-b border-gray-50">
                    <h3 className="font-bold text-gray-900">Tournament Results</h3>
                  </div>
                  {selectedResults.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <Trophy size={32} className="mx-auto mb-2 opacity-30" />
                      <p className="text-sm">{selected.status !== 'Completed' ? 'Results will appear after the tournament.' : 'No results recorded.'}</p>
                    </div>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Athlete</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Medal</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Points</th>
                          <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Position</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selectedResults.map(r => (
                          <tr key={r.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-900">{r.studentName}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{r.category}</td>
                            <td className="px-4 py-3">
                              <span className="text-lg">{r.medal === 'Gold' ? '🥇' : r.medal === 'Silver' ? '🥈' : r.medal === 'Bronze' ? '🥉' : '🏅'}</span>
                              <Badge label={r.medal} color={r.medal === 'Gold' ? 'gold' : r.medal === 'Silver' ? 'gray' : 'orange'} />
                            </td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{r.points}</td>
                            <td className="px-4 py-3 text-gray-500">#{r.position || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {tab === 'reports' && (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
                  <h3 className="font-bold text-gray-900">Tournament Reports</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {['Medal Tally', 'Club Ranking', 'Athlete Ranking', 'Participation Report'].map(report => (
                      <div key={report} className="flex items-center justify-between bg-gray-50 rounded-xl p-4">
                        <span className="text-sm font-medium text-gray-700">{report}</span>
                        <button className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold hover:text-blue-700">
                          <Download size={13} /> Export
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800 font-medium">Reports Export</p>
                    <p className="text-xs text-yellow-700 mt-1">PDF and Excel export coming soon. Connect to Supabase to enable full report generation.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Achievements summary */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-bold text-gray-900 mb-4">Athlete Achievement Hall</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mockAthleteAchievements.map(a => (
            <div key={a.id} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
              <span className="text-3xl">{a.badge}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{a.tournamentName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{a.category}</p>
                <p className="text-xs text-gray-400">{a.date} · {a.points} pts</p>
              </div>
              <Badge label={a.medal} color={a.medal === 'Gold' ? 'gold' : a.medal === 'Silver' ? 'gray' : 'orange'} />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-gray-50 flex gap-8 text-sm text-gray-600">
          <div><span className="text-gray-400">Total Points: </span><strong>{totalPoints}</strong></div>
          <div><span className="text-gray-400">🥇 Gold: </span><strong>{golds}</strong></div>
          <div><span className="text-gray-400">🥈 Silver: </span><strong>{silvers}</strong></div>
          <div><span className="text-gray-400">🥉 Bronze: </span><strong>{bronzes}</strong></div>
        </div>
      </div>

      {/* Create tournament modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Tournament" size="lg">
        <form onSubmit={handleCreate} className="space-y-4">
          <FormInput label="Tournament Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
            placeholder="Kejohanan Silambam Terbuka Daerah Sepang 2026" required />
          <FormInput label="Organizer" value={form.organizer} onChange={e => setForm({...form, organizer: e.target.value})}
            placeholder="Persatuan Silambam Malaysia Daerah Sepang" required />
          <FormInput label="Venue" value={form.venue} onChange={e => setForm({...form, venue: e.target.value})}
            placeholder="Dewan Komuniti Sepang" required />
          <div className="grid grid-cols-2 gap-4">
            <FormInput label="Tournament Date" type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
            <FormInput label="Registration Deadline" type="date" value={form.registrationDeadline} onChange={e => setForm({...form, registrationDeadline: e.target.value})} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 h-20 resize-none"
              placeholder="Additional notes..." />
          </div>
          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" className="flex-1">Create Tournament</Button>
            <Button type="button" variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
          </div>
        </form>
      </Modal>

      {/* Register student modal */}
      <Modal isOpen={showRegModal} onClose={() => setShowRegModal(false)} title="Register Student for Tournament">
        <div className="space-y-4">
          <SelectInput label="Student" value={regForm.studentId}
            onChange={e => setRegForm({...regForm, studentId: e.target.value})}
            options={[{ value: '', label: 'Select student...' }, ...mockStudents.map((s: { id: string; fullName: string }) => ({ value: s.id, label: s.fullName }))]} />
          <SelectInput label="Category" value={regForm.category}
            onChange={e => setRegForm({...regForm, category: e.target.value})}
            options={defaultCategories.map(c => ({ value: c, label: c }))} />
          <SelectInput label="Age Group" value={regForm.ageGroup}
            onChange={e => setRegForm({...regForm, ageGroup: e.target.value})}
            options={['Under 12', 'Under 15', 'Under 18', 'Open'].map(a => ({ value: a, label: a }))} />
          <FormInput label="Remarks (optional)" value={regForm.remarks} onChange={e => setRegForm({...regForm, remarks: e.target.value})} placeholder="Any special notes..." />
          <div className="flex gap-3 pt-2">
            <Button variant="primary" className="flex-1" onClick={() => {
              if (!regForm.studentId) return;
              const student = mockStudents.find((s: { id: string }) => s.id === regForm.studentId);
              if (!student) return;
              setRegistrations([...registrations, {
                id: `tr${Date.now()}`, tournamentId: selected.id,
                studentId: student.id, studentName: student.fullName,
                ageGroup: regForm.ageGroup, category: regForm.category,
                branch: student.branch, coachId: 'u2', coachName: 'Coach Mani',
                status: 'Registered', remarks: regForm.remarks,
              }]);
              setShowRegModal(false);
              setRegForm({ studentId: '', ageGroup: 'Under 15', category: 'Single Stick', remarks: '' });
            }}>Register</Button>
            <Button variant="secondary" onClick={() => setShowRegModal(false)}>Cancel</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
