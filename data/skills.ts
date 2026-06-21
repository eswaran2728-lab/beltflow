import { Skill, StudentSkill } from '@/lib/types';

export const mockSkills: Skill[] = [
  { id: 'sk1', name: 'Basic Footwork', category: 'Foundation', description: 'Basic stance and movement patterns', order: 1 },
  { id: 'sk2', name: 'Single Stick Spinning', category: 'Foundation', description: 'Fundamental single stick rotation', order: 2 },
  { id: 'sk3', name: 'Double Stick Coordination', category: 'Intermediate', description: 'Synchronized dual stick movements', order: 3 },
  { id: 'sk4', name: 'Kuthu Varisai', category: 'Intermediate', description: 'Traditional combat sequences', order: 4 },
  { id: 'sk5', name: 'Sedikuchi', category: 'Intermediate', description: 'Short stick techniques', order: 5 },
  { id: 'sk6', name: 'Maan Kombu', category: 'Advanced', description: 'Deer horn techniques', order: 6 },
  { id: 'sk7', name: 'Katti Pidi', category: 'Advanced', description: 'Knife grip and defense', order: 7 },
  { id: 'sk8', name: 'Silambam Sandai', category: 'Advanced', description: 'Full combat sparring', order: 8 },
];

export const mockStudentSkills: StudentSkill[] = [
  { id: 'ss1', studentId: 's1', skillId: 'sk1', skillName: 'Basic Footwork', progress: 'Mastered', updatedAt: '2026-05-01' },
  { id: 'ss2', studentId: 's1', skillId: 'sk2', skillName: 'Single Stick Spinning', progress: 'Mastered', updatedAt: '2026-05-01' },
  { id: 'ss3', studentId: 's1', skillId: 'sk3', skillName: 'Double Stick Coordination', progress: 'Good', updatedAt: '2026-06-01' },
  { id: 'ss4', studentId: 's1', skillId: 'sk4', skillName: 'Kuthu Varisai', progress: 'Learning', updatedAt: '2026-06-01' },
  { id: 'ss5', studentId: 's1', skillId: 'sk5', skillName: 'Sedikuchi', progress: 'Not Started', updatedAt: '2026-06-01' },
  { id: 'ss6', studentId: 's1', skillId: 'sk6', skillName: 'Maan Kombu', progress: 'Not Started', updatedAt: '2026-06-01' },
  { id: 'ss7', studentId: 's2', skillId: 'sk1', skillName: 'Basic Footwork', progress: 'Mastered', updatedAt: '2026-05-15' },
  { id: 'ss8', studentId: 's2', skillId: 'sk2', skillName: 'Single Stick Spinning', progress: 'Good', updatedAt: '2026-05-15' },
  { id: 'ss9', studentId: 's2', skillId: 'sk3', skillName: 'Double Stick Coordination', progress: 'Learning', updatedAt: '2026-06-01' },
  { id: 'ss10', studentId: 's5', skillId: 'sk1', skillName: 'Basic Footwork', progress: 'Mastered', updatedAt: '2026-01-10' },
  { id: 'ss11', studentId: 's5', skillId: 'sk2', skillName: 'Single Stick Spinning', progress: 'Mastered', updatedAt: '2026-01-10' },
  { id: 'ss12', studentId: 's5', skillId: 'sk3', skillName: 'Double Stick Coordination', progress: 'Mastered', updatedAt: '2026-01-10' },
  { id: 'ss13', studentId: 's5', skillId: 'sk4', skillName: 'Kuthu Varisai', progress: 'Mastered', updatedAt: '2026-03-01' },
  { id: 'ss14', studentId: 's5', skillId: 'sk5', skillName: 'Sedikuchi', progress: 'Good', updatedAt: '2026-04-01' },
  { id: 'ss15', studentId: 's5', skillId: 'sk8', skillName: 'Silambam Sandai', progress: 'Learning', updatedAt: '2026-05-01' },
];
