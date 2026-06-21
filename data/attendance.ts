import { AttendanceRecord } from '@/lib/types';

export const mockAttendance: AttendanceRecord[] = [
  { id: 'a1', studentId: 's1', classId: 'c1', date: '2026-06-20', present: true },
  { id: 'a2', studentId: 's2', classId: 'c1', date: '2026-06-20', present: true },
  { id: 'a3', studentId: 's3', classId: 'c1', date: '2026-06-20', present: false },
  { id: 'a4', studentId: 's7', classId: 'c1', date: '2026-06-20', present: true },
  { id: 'a5', studentId: 's8', classId: 'c1', date: '2026-06-20', present: true },
  { id: 'a6', studentId: 's1', classId: 'c1', date: '2026-06-17', present: true },
  { id: 'a7', studentId: 's2', classId: 'c1', date: '2026-06-17', present: true },
  { id: 'a8', studentId: 's3', classId: 'c1', date: '2026-06-17', present: false },
  { id: 'a9', studentId: 's7', classId: 'c1', date: '2026-06-17', present: false },
  { id: 'a10', studentId: 's3', classId: 'c1', date: '2026-06-13', present: false },
  { id: 'a11', studentId: 's3', classId: 'c1', date: '2026-06-10', present: false },
  { id: 'a12', studentId: 's4', classId: 'c2', date: '2026-06-20', present: true },
  { id: 'a13', studentId: 's5', classId: 'c3', date: '2026-06-20', present: true },
  { id: 'a14', studentId: 's4', classId: 'c2', date: '2026-06-18', present: true },
  { id: 'a15', studentId: 's5', classId: 'c3', date: '2026-06-17', present: true },
];
