import { Student } from '@/lib/types';
import Badge from './Badge';
import Link from 'next/link';

const beltColors: Record<string, string> = {
  White: 'bg-gray-100 text-gray-700',
  Yellow: 'bg-yellow-100 text-yellow-800',
  Orange: 'bg-orange-100 text-orange-800',
  Green: 'bg-green-100 text-green-800',
  Blue: 'bg-blue-100 text-blue-800',
  Purple: 'bg-purple-100 text-purple-800',
  Brown: 'bg-amber-100 text-amber-800',
  Red: 'bg-red-100 text-red-800',
  Black: 'bg-gray-900 text-white',
};

export default function StudentCard({ student }: { student: Student }) {
  const statusColor: Record<string, 'green' | 'gray' | 'red'> = {
    Active: 'green', Inactive: 'gray', 'At Risk': 'red',
  };
  return (
    <Link href={`/dashboard/students/${student.id}`}>
      <div className="bg-white border border-gray-100 rounded-xl p-4 hover:shadow-md hover:border-blue-100 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#0f172a] truncate">{student.fullName}</p>
            <p className="text-xs text-gray-400 mt-0.5">{student.classGroup} · {student.branch}</p>
          </div>
          <Badge label={student.status} color={statusColor[student.status]} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${beltColors[student.beltRank] || 'bg-gray-100 text-gray-700'}`}>
            {student.beltRank} Belt
          </span>
          <span className="text-xs text-gray-400">Age {student.age}</span>
          {student.missedClasses >= 3 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">⚠ High Risk</span>
          )}
        </div>
      </div>
    </Link>
  );
}
