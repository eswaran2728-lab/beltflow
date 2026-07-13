'use client';
import { Trophy } from 'lucide-react';
import Badge from '@/components/Badge';
import StatCard from '@/components/StatCard';
import { useLive } from '@/lib/useLive';
import { getTournaments, getTournamentResults } from '@/lib/db';

const medalEmoji: Record<string, string> = { gold: '🥇', silver: '🥈', bronze: '🥉', participation: '🏅' };

export default function TournamentsPage() {
  const { data: tournaments } = useLive(getTournaments, ['tournaments']);
  const { data: results } = useLive(() => getTournamentResults(), ['tournament_results']);

  const golds = (results ?? []).filter(r => r.medal === 'gold').length;
  const silvers = (results ?? []).filter(r => r.medal === 'silver').length;
  const bronzes = (results ?? []).filter(r => r.medal === 'bronze').length;
  const points = (results ?? []).reduce((s, r) => s + r.points, 0);

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      <div><h1 className="text-2xl font-extrabold text-gray-900">Tournaments</h1><p className="text-gray-500 text-sm mt-0.5">Tournament results and medal tally</p></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard title="Total Points" value={points} icon={Trophy} iconBg="bg-yellow-50 text-yellow-600" />
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-yellow-600">🥇 {golds}</p><p className="text-xs text-gray-400 mt-1">Gold</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-gray-500">🥈 {silvers}</p><p className="text-xs text-gray-400 mt-1">Silver</p></div>
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-center"><p className="text-2xl font-bold text-orange-600">🥉 {bronzes}</p><p className="text-xs text-gray-400 mt-1">Bronze</p></div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="p-5 border-b border-gray-50"><h2 className="font-bold text-gray-900">Tournaments</h2></div>
        <div className="divide-y divide-gray-50">
          {(tournaments ?? []).map(t => (
            <div key={t.id} className="flex items-center gap-3 px-5 py-4">
              <div className="w-10 h-10 bg-yellow-50 rounded-xl flex items-center justify-center flex-shrink-0"><Trophy size={18} className="text-yellow-600" /></div>
              <div><p className="font-semibold text-gray-900 text-sm">{t.name}</p><p className="text-xs text-gray-400">{t.eventDate} · {t.location}</p></div>
            </div>
          ))}
          {(tournaments ?? []).length === 0 && <div className="px-5 py-10 text-center text-gray-400 text-sm">No tournaments recorded yet.</div>}
        </div>
      </div>

      {(results ?? []).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="font-bold text-gray-900 mb-4">Medal Hall</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(results ?? []).map(r => (
              <div key={r.id} className="flex items-center gap-4 bg-gray-50 rounded-xl p-4">
                <span className="text-3xl">{r.medal ? medalEmoji[r.medal] : '🎖️'}</span>
                <div className="flex-1 min-w-0"><p className="font-semibold text-gray-900 text-sm truncate">{r.studentName}</p><p className="text-xs text-gray-500">{r.eventCategory}</p><p className="text-xs text-gray-400">{r.points} pts</p></div>
                {r.medal && <Badge label={r.medal} color={r.medal === 'gold' ? 'gold' : r.medal === 'silver' ? 'gray' : 'orange'} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
