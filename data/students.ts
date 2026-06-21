import { Student } from '@/lib/types';

export const mockStudents: Student[] = [
  {
    id: 's1', academyId: 'academy1', fullName: 'Arjun Subramaniam', age: 14,
    icNumber: '100512-10-1234', parentName: 'Subramaniam Pillai', parentPhone: '012-3456789',
    emergencyContact: '013-9876543', beltRank: 'Blue', joinDate: '2023-01-15',
    status: 'Active', branch: 'Sepang Main', classGroup: 'Junior A', missedClasses: 1,
    notes: 'Strong footwork, needs improvement in stick coordination.',
  },
  {
    id: 's2', academyId: 'academy1', fullName: 'Kavitha Rajendran', age: 12,
    icNumber: '120304-10-5678', parentName: 'Rajendran Nair', parentPhone: '016-7654321',
    beltRank: 'Green', joinDate: '2023-03-10', status: 'Active',
    branch: 'Sepang Main', classGroup: 'Junior A', missedClasses: 0,
  },
  {
    id: 's3', academyId: 'academy1', fullName: 'Vikram Chandran', age: 16,
    icNumber: '080901-10-9012', parentName: 'Chandran Murugan', parentPhone: '019-1234567',
    beltRank: 'Purple', joinDate: '2022-06-20', status: 'At Risk',
    branch: 'Sepang Main', classGroup: 'Senior B', missedClasses: 4,
    notes: 'Missed multiple sessions. Parent contacted via WhatsApp.',
  },
  {
    id: 's4', academyId: 'academy1', fullName: 'Priya Selvam', age: 11,
    icNumber: '130605-10-3456', parentName: 'Selvam Krishnan', parentPhone: '011-2345678',
    beltRank: 'Yellow', joinDate: '2024-01-08', status: 'Active',
    branch: 'Nilai Branch', classGroup: 'Junior B', missedClasses: 2,
  },
  {
    id: 's5', academyId: 'academy1', fullName: 'Rajan Muthusamy', age: 18,
    icNumber: '060712-10-7890', parentName: 'Muthusamy Gopal', parentPhone: '017-8765432',
    beltRank: 'Brown', joinDate: '2021-09-01', status: 'Active',
    branch: 'Sepang Main', classGroup: 'Senior A', missedClasses: 0,
  },
  {
    id: 's6', academyId: 'academy1', fullName: 'Divya Annamalai', age: 13,
    icNumber: '110220-10-2345', parentName: 'Annamalai Sivam', parentPhone: '014-6543210',
    beltRank: 'Orange', joinDate: '2023-08-15', status: 'Inactive',
    branch: 'Nilai Branch', classGroup: 'Junior B', missedClasses: 6,
    notes: 'Inactive since October. Family relocation pending.',
  },
  {
    id: 's7', academyId: 'academy1', fullName: 'Sathish Kumar', age: 15,
    icNumber: '090418-10-6789', parentName: 'Kumar Pandian', parentPhone: '018-3456789',
    beltRank: 'Blue', joinDate: '2022-11-01', status: 'Active',
    branch: 'Sepang Main', classGroup: 'Senior B', missedClasses: 1,
  },
  {
    id: 's8', academyId: 'academy1', fullName: 'Meena Balakrishnan', age: 10,
    icNumber: '140815-10-1122', parentName: 'Balakrishnan Raju', parentPhone: '012-5678901',
    beltRank: 'White', joinDate: '2024-03-01', status: 'Active',
    branch: 'Sepang Main', classGroup: 'Junior B', missedClasses: 0,
  },
];
