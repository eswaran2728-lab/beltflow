import { PaymentStatus } from '@/lib/types';
import Badge from './Badge';

export default function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { color: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'orange' | 'navy' | 'gold'; label: string }> = {
    'Paid': { color: 'green', label: 'Paid' },
    'Unpaid': { color: 'red', label: 'Unpaid' },
    'Overdue': { color: 'orange', label: 'Overdue' },
    'Pending Cash Approval': { color: 'yellow', label: 'Pending Approval' },
    'Rejected': { color: 'red', label: 'Rejected' },
  };
  const cfg = map[status];
  return <Badge label={cfg.label} color={cfg.color} />;
}
