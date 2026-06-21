import { Tournament, TournamentCategory, TournamentRegistration, TournamentResult, AthleteAchievement } from '@/lib/types';

export const mockTournaments: Tournament[] = [
  {
    id: 't1', academyId: 'academy1',
    name: 'Kejohanan Silambam Terbuka Daerah Sepang 2026',
    organizer: 'Persatuan Silambam Malaysia Daerah Sepang',
    venue: 'Dewan Komuniti Sepang, 43900 Sepang, Selangor',
    date: '2026-08-15', registrationDeadline: '2026-08-01',
    status: 'Open Registration',
    notes: 'Annual open tournament for all belt levels. Participants must be registered members.',
    coachIds: ['u2', 'u3'],
    categories: ['Single Stick', 'Double Stick', 'Sedikuchi', 'Kuthu Varisai', 'Silambam Sandai'],
  },
  {
    id: 't2', academyId: 'academy1',
    name: 'Pertandingan Silambam Peringkat Negeri Selangor 2026',
    organizer: 'Persatuan Silambam Malaysia Selangor',
    venue: 'Stadium MPSJ, Subang Jaya, Selangor',
    date: '2026-10-20', registrationDeadline: '2026-10-05',
    status: 'Draft',
    notes: 'State-level competition. Blue belt and above only.',
    coachIds: ['u2'],
    categories: ['Single Stick', 'Silambam Sandai', 'Open Category'],
  },
  {
    id: 't3', academyId: 'academy1',
    name: 'Kejohanan Silambam Zon Nilai 2025',
    organizer: 'Persatuan Silambam Malaysia Daerah Seremban',
    venue: 'Kompleks Sukan Nilai, Negeri Sembilan',
    date: '2025-11-10', registrationDeadline: '2025-10-25',
    status: 'Completed',
    notes: 'Zone-level tournament. Excellent performance by our team.',
    coachIds: ['u2', 'u3'],
    categories: ['Single Stick', 'Double Stick', 'Maan Kombu'],
  },
];

export const mockTournamentCategories: TournamentCategory[] = [
  { id: 'tc1', tournamentId: 't1', name: 'Single Stick', ageGroup: 'Under 12', maxParticipants: 20 },
  { id: 'tc2', tournamentId: 't1', name: 'Single Stick', ageGroup: 'Under 15', maxParticipants: 20 },
  { id: 'tc3', tournamentId: 't1', name: 'Single Stick', ageGroup: 'Under 18', maxParticipants: 20 },
  { id: 'tc4', tournamentId: 't1', name: 'Double Stick', ageGroup: 'Under 15', maxParticipants: 16 },
  { id: 'tc5', tournamentId: 't1', name: 'Sedikuchi', ageGroup: 'Open', maxParticipants: 16 },
  { id: 'tc6', tournamentId: 't1', name: 'Silambam Sandai', ageGroup: 'Under 18', maxParticipants: 12 },
  { id: 'tc7', tournamentId: 't3', name: 'Single Stick', ageGroup: 'Under 15', maxParticipants: 20 },
  { id: 'tc8', tournamentId: 't3', name: 'Double Stick', ageGroup: 'Under 18', maxParticipants: 16 },
  { id: 'tc9', tournamentId: 't3', name: 'Maan Kombu', ageGroup: 'Open', maxParticipants: 12 },
];

export const mockTournamentRegistrations: TournamentRegistration[] = [
  { id: 'tr1', tournamentId: 't1', studentId: 's1', studentName: 'Arjun Subramaniam', ageGroup: 'Under 15', category: 'Single Stick', branch: 'Sepang Main', coachId: 'u2', coachName: 'Coach Mani', status: 'Confirmed' },
  { id: 'tr2', tournamentId: 't1', studentId: 's1', studentName: 'Arjun Subramaniam', ageGroup: 'Under 15', category: 'Double Stick', branch: 'Sepang Main', coachId: 'u2', coachName: 'Coach Mani', status: 'Registered' },
  { id: 'tr3', tournamentId: 't1', studentId: 's2', studentName: 'Kavitha Rajendran', ageGroup: 'Under 15', category: 'Single Stick', branch: 'Sepang Main', coachId: 'u2', coachName: 'Coach Mani', status: 'Confirmed' },
  { id: 'tr4', tournamentId: 't1', studentId: 's5', studentName: 'Rajan Muthusamy', ageGroup: 'Under 18', category: 'Silambam Sandai', branch: 'Sepang Main', coachId: 'u2', coachName: 'Coach Mani', status: 'Confirmed' },
  { id: 'tr5', tournamentId: 't1', studentId: 's7', studentName: 'Sathish Kumar', ageGroup: 'Under 18', category: 'Single Stick', branch: 'Sepang Main', coachId: 'u3', coachName: 'Coach Siva', status: 'Registered' },
  { id: 'tr6', tournamentId: 't3', studentId: 's5', studentName: 'Rajan Muthusamy', ageGroup: 'Under 18', category: 'Single Stick', branch: 'Sepang Main', coachId: 'u2', coachName: 'Coach Mani', status: 'Completed' },
  { id: 'tr7', tournamentId: 't3', studentId: 's1', studentName: 'Arjun Subramaniam', ageGroup: 'Under 15', category: 'Double Stick', branch: 'Sepang Main', coachId: 'u2', coachName: 'Coach Mani', status: 'Completed' },
  { id: 'tr8', tournamentId: 't3', studentId: 's7', studentName: 'Sathish Kumar', ageGroup: 'Under 18', category: 'Double Stick', branch: 'Sepang Main', coachId: 'u3', coachName: 'Coach Siva', status: 'Completed' },
];

export const mockTournamentResults: TournamentResult[] = [
  { id: 'res1', registrationId: 'tr6', tournamentId: 't3', studentId: 's5', studentName: 'Rajan Muthusamy', category: 'Single Stick', medal: 'Gold', points: 10, position: 1 },
  { id: 'res2', registrationId: 'tr7', tournamentId: 't3', studentId: 's1', studentName: 'Arjun Subramaniam', category: 'Double Stick', medal: 'Silver', points: 7, position: 2 },
  { id: 'res3', registrationId: 'tr8', tournamentId: 't3', studentId: 's7', studentName: 'Sathish Kumar', category: 'Double Stick', medal: 'Bronze', points: 5, position: 3 },
];

export const mockAthleteAchievements: AthleteAchievement[] = [
  { id: 'ach1', studentId: 's5', tournamentId: 't3', tournamentName: 'Kejohanan Silambam Zon Nilai 2025', category: 'Single Stick', medal: 'Gold', date: '2025-11-10', points: 10, badge: '🥇' },
  { id: 'ach2', studentId: 's1', tournamentId: 't3', tournamentName: 'Kejohanan Silambam Zon Nilai 2025', category: 'Double Stick', medal: 'Silver', date: '2025-11-10', points: 7, badge: '🥈' },
  { id: 'ach3', studentId: 's7', tournamentId: 't3', tournamentName: 'Kejohanan Silambam Zon Nilai 2025', category: 'Double Stick', medal: 'Bronze', date: '2025-11-10', points: 5, badge: '🥉' },
];
