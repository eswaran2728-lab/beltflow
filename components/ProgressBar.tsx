interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'blue' | 'green' | 'gold' | 'red' | 'purple';
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

export default function ProgressBar({ value, max = 100, color = 'blue', showLabel = true, size = 'md' }: ProgressBarProps) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  const colorMap = { blue: 'bg-blue-500', green: 'bg-green-500', gold: 'bg-[#f59e0b]', red: 'bg-red-500', purple: 'bg-purple-500' };
  const heightMap = { sm: 'h-1.5', md: 'h-2.5' };
  return (
    <div className="flex items-center gap-2 w-full">
      <div className={`flex-1 bg-gray-100 rounded-full ${heightMap[size]}`}>
        <div
          className={`${heightMap[size]} rounded-full transition-all duration-500 ${colorMap[color]}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {showLabel && <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{pct}%</span>}
    </div>
  );
}
