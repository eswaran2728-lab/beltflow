import { Subscription } from '@/lib/types';

export const mockSubscription: Subscription = {
  id: 'sub1',
  academyId: 'academy1',
  plan: 'Academy',
  status: 'Active',
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  monthlyAmount: 99,
  studentLimit: 150,
  features: [
    'Up to 150 students',
    'Full dashboard',
    'Cash payment approval',
    'Belt grading',
    'Skill tracking',
    'Coach tools',
    'Parent portal',
  ],
};
