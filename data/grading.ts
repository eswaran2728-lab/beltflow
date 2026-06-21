import { GradingEvent, GradingRecord } from '@/lib/types';

export const mockGradingEvents: GradingEvent[] = [
  {
    id: 'ge1', academyId: 'academy1', title: 'Mid-Year Belt Grading 2026',
    date: '2026-07-15', location: 'Dewan Komuniti Sepang',
    examiner: 'Mahaguru Sri S. Arumugam',
    students: ['s1', 's2', 's4', 's7'], status: 'Upcoming',
  },
  {
    id: 'ge2', academyId: 'academy1', title: 'Year-End Grading 2025',
    date: '2025-12-10', location: 'Dewan Komuniti Sepang',
    examiner: 'Dato\' Mahaguru A. Sivakumar',
    students: ['s1', 's3', 's5'], status: 'Completed',
  },
];

export const mockGradingRecords: GradingRecord[] = [
  { id: 'gr1', eventId: 'ge2', studentId: 's1', studentName: 'Arjun Subramaniam', currentBelt: 'Green', targetBelt: 'Blue', result: 'Pass', examiner: 'Dato\' Mahaguru A. Sivakumar', date: '2025-12-10' },
  { id: 'gr2', eventId: 'ge2', studentId: 's3', studentName: 'Vikram Chandran', currentBelt: 'Blue', targetBelt: 'Purple', result: 'Pass', examiner: 'Dato\' Mahaguru A. Sivakumar', date: '2025-12-10' },
  { id: 'gr3', eventId: 'ge2', studentId: 's5', studentName: 'Rajan Muthusamy', currentBelt: 'Purple', targetBelt: 'Brown', result: 'Pass', examiner: 'Dato\' Mahaguru A. Sivakumar', date: '2025-12-10' },
];
