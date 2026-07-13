import { InvoiceStatus, INVOICE_LABEL } from '@/lib/types';
import Badge from './Badge';

const COLOR: Record<InvoiceStatus, 'green' | 'red' | 'yellow' | 'orange' | 'gray'> = {
  paid: 'green', unpaid: 'red', overdue: 'orange', pending_approval: 'yellow', waived: 'gray',
};

export default function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge label={INVOICE_LABEL[status]} color={COLOR[status]} />;
}
