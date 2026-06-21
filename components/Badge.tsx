import { clsx } from 'clsx';

interface BadgeProps {
  label: string;
  color?: 'green' | 'red' | 'yellow' | 'blue' | 'purple' | 'gray' | 'orange' | 'navy' | 'gold';
}

export default function Badge({ label, color = 'gray' }: BadgeProps) {
  return (
    <span className={clsx('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap', {
      'bg-green-100 text-green-800': color === 'green',
      'bg-red-100 text-red-800': color === 'red',
      'bg-yellow-100 text-yellow-800': color === 'yellow',
      'bg-blue-100 text-blue-800': color === 'blue',
      'bg-purple-100 text-purple-800': color === 'purple',
      'bg-gray-100 text-gray-700': color === 'gray',
      'bg-orange-100 text-orange-800': color === 'orange',
      'bg-[#0f172a] text-white': color === 'navy',
      'bg-[#f59e0b] text-white': color === 'gold',
    })}>
      {label}
    </span>
  );
}
