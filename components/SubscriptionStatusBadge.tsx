import { SubscriptionStatus } from '@/lib/types';
import Badge from './Badge';

export default function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  const map: Record<SubscriptionStatus, { color: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'orange' | 'navy' | 'gold' }> = {
    'Trial': { color: 'blue' },
    'Active': { color: 'green' },
    'Past Due': { color: 'orange' },
    'Suspended': { color: 'red' },
    'Cancelled': { color: 'gray' },
  };
  return <Badge label={status} color={map[status].color} />;
}
