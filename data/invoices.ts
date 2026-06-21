import { Invoice } from '@/lib/types';

export const mockInvoices: Invoice[] = [
  { id: 'inv1', academyId: 'academy1', subscriptionId: 'sub1', amount: 99, status: 'Paid', dueDate: '2026-06-01', paidDate: '2026-06-01', period: 'June 2026', invoiceNumber: 'INV-2026-006' },
  { id: 'inv2', academyId: 'academy1', subscriptionId: 'sub1', amount: 99, status: 'Paid', dueDate: '2026-05-01', paidDate: '2026-05-02', period: 'May 2026', invoiceNumber: 'INV-2026-005' },
  { id: 'inv3', academyId: 'academy1', subscriptionId: 'sub1', amount: 99, status: 'Paid', dueDate: '2026-04-01', paidDate: '2026-04-01', period: 'April 2026', invoiceNumber: 'INV-2026-004' },
  { id: 'inv4', academyId: 'academy1', subscriptionId: 'sub1', amount: 99, status: 'Paid', dueDate: '2026-03-01', paidDate: '2026-03-03', period: 'March 2026', invoiceNumber: 'INV-2026-003' },
  { id: 'inv5', academyId: 'academy1', subscriptionId: 'sub1', amount: 99, status: 'Paid', dueDate: '2026-02-01', paidDate: '2026-02-01', period: 'February 2026', invoiceNumber: 'INV-2026-002' },
  { id: 'inv6', academyId: 'academy1', subscriptionId: 'sub1', amount: 99, status: 'Paid', dueDate: '2026-01-01', paidDate: '2026-01-02', period: 'January 2026', invoiceNumber: 'INV-2026-001' },
];
