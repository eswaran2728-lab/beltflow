import { AcademySettings } from '@/lib/types';

export const mockAcademySettings: AcademySettings = {
  id: 'as1',
  academyId: 'academy1',
  monthlyFee: 80,
  beltLevels: ['White', 'Yellow', 'Orange', 'Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'],
  martialArtStyle: 'Silambam',
  branches: [
    { id: 'b1', academyId: 'academy1', name: 'Sepang Main', address: 'Dewan Komuniti Sepang, 43900 Sepang, Selangor', phone: '03-87651234' },
    { id: 'b2', academyId: 'academy1', name: 'Nilai Branch', address: 'Kompleks Sukan Nilai, 71800 Nilai, Negeri Sembilan', phone: '06-7991234' },
  ],
  classes: [
    { id: 'c1', branchId: 'b1', name: 'Junior A', schedule: 'Tuesday & Friday, 7:00 PM - 9:00 PM', coachId: 'u2', beltLevels: ['White', 'Yellow', 'Orange'] },
    { id: 'c2', branchId: 'b2', name: 'Junior B', schedule: 'Wednesday & Saturday, 5:00 PM - 7:00 PM', coachId: 'u3', beltLevels: ['White', 'Yellow'] },
    { id: 'c3', branchId: 'b1', name: 'Senior A', schedule: 'Monday & Thursday, 8:00 PM - 10:00 PM', coachId: 'u2', beltLevels: ['Green', 'Blue', 'Purple', 'Brown', 'Red', 'Black'] },
    { id: 'c4', branchId: 'b1', name: 'Senior B', schedule: 'Tuesday & Friday, 8:00 PM - 10:00 PM', coachId: 'u3', beltLevels: ['Green', 'Blue', 'Purple'] },
  ],
  skills: [],
};
