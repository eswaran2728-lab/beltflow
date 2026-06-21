// BeltFlow Mock Database
// TODO: When SUPABASE_READY = true, replace these exports with Supabase queries

export { mockStudents } from '@/data/students';
export { mockPayments } from '@/data/payments';
export { mockAttendance } from '@/data/attendance';
export { mockGradingEvents, mockGradingRecords } from '@/data/grading';
export { mockSkills, mockStudentSkills } from '@/data/skills';
export { mockUsers } from '@/data/users';
export { mockAcademySettings } from '@/data/academySettings';
export { mockSubscription } from '@/data/subscriptions';
export { mockInvoices } from '@/data/invoices';
export {
  mockTournaments,
  mockTournamentCategories,
  mockTournamentRegistrations,
  mockTournamentResults,
  mockAthleteAchievements,
} from '@/data/tournaments';

export const mockAcademy = {
  id: 'academy1',
  name: 'Persatuan Silambam Malaysia Daerah Sepang',
  description: 'Official Silambam association for Daerah Sepang, dedicated to preserving and promoting the ancient martial art of Silambam.',
  martialArtStyle: 'Silambam',
  phone: '03-87651234',
  email: 'sepang@silambam.my',
  address: 'Dewan Komuniti Sepang, 43900 Sepang, Selangor',
  subscriptionId: 'sub1',
};

export const mockInstructorNotes = [
  { id: 'n1', studentId: 's1', coachId: 'u2', coachName: 'Coach Mani', note: 'Great improvement in footwork this week. Ready for grading.', date: '2026-06-18', isPrivate: false },
  { id: 'n2', studentId: 's1', coachId: 'u2', coachName: 'Coach Mani', note: 'Needs to work on stick spinning speed before grading.', date: '2026-06-10', isPrivate: false },
  { id: 'n3', studentId: 's3', coachId: 'u2', coachName: 'Coach Mani', note: 'Parent has been informed about attendance issues. Monitoring situation.', date: '2026-06-15', isPrivate: true },
  { id: 'n4', studentId: 's5', coachId: 'u2', coachName: 'Coach Mani', note: 'Rajan is performing excellently. Recommend for state-level tournament.', date: '2026-06-01', isPrivate: false },
];
