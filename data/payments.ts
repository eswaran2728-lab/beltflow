import { Payment } from '@/lib/types';

export const mockPayments: Payment[] = [
  { id: 'p1', studentId: 's1', studentName: 'Arjun Subramaniam', amount: 80, month: 'June 2026', status: 'Paid', method: 'FPX', paidDate: '2026-06-02', receiptNumber: 'RCP-2026-001' },
  { id: 'p2', studentId: 's2', studentName: 'Kavitha Rajendran', amount: 80, month: 'June 2026', status: 'Paid', method: 'Cash', paidDate: '2026-06-05', receiptNumber: 'RCP-2026-002', approvedBy: 'Coach Mani' },
  { id: 'p3', studentId: 's3', studentName: 'Vikram Chandran', amount: 80, month: 'June 2026', status: 'Overdue', method: 'Cash' },
  { id: 'p4', studentId: 's4', studentName: 'Priya Selvam', amount: 80, month: 'June 2026', status: 'Pending Cash Approval', method: 'Cash', notes: 'Paid to coach directly' },
  { id: 'p5', studentId: 's5', studentName: 'Rajan Muthusamy', amount: 80, month: 'June 2026', status: 'Paid', method: 'FPX', paidDate: '2026-06-01', receiptNumber: 'RCP-2026-003' },
  { id: 'p6', studentId: 's6', studentName: 'Divya Annamalai', amount: 80, month: 'June 2026', status: 'Unpaid', method: 'Cash' },
  { id: 'p7', studentId: 's7', studentName: 'Sathish Kumar', amount: 80, month: 'June 2026', status: 'Paid', method: 'FPX', paidDate: '2026-06-03', receiptNumber: 'RCP-2026-004' },
  { id: 'p8', studentId: 's8', studentName: 'Meena Balakrishnan', amount: 80, month: 'June 2026', status: 'Unpaid', method: 'Cash' },
  { id: 'p9', studentId: 's1', studentName: 'Arjun Subramaniam', amount: 80, month: 'May 2026', status: 'Paid', method: 'FPX', paidDate: '2026-05-02', receiptNumber: 'RCP-2026-005' },
  { id: 'p10', studentId: 's3', studentName: 'Vikram Chandran', amount: 80, month: 'May 2026', status: 'Overdue', method: 'Cash' },
];
