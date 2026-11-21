import { Crown, Trophy, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GAME_MODES } from '../data/catalog';
import { fetchLeaderboards } from '../services/gameverseApi';
import type {
  GameModeId,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardRegion,
} from '../types/game';
import { AvatarBadge } from './GameverseLogo';

interface LeaderboardsModalProps {
  gameverseId: string;
  onClose: () => void;
}

const REGIONS: Array<{ id: LeaderboardRegion; label: string }> = [
  { id: 'eswatini', label: 'Eswatini' },
  { id: 'southern_africa', label: 'Southern Africa' },
  { id: 'global', label: 'Global' },
  { id: 'friends', label: 'Friends' },
];

const PERIODS: Array<{ id: LeaderboardPeriod; label: string }> = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'all_time', label: 'All-Time' },
];

export function LeaderboardsModal({ gameverseId, onClose }: LeaderboardsModalProps) {
  const [region, setRegion] = useState<LeaderboardRegion>('eswatini');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [mode, setMode] = useState<GameModeId | 'all'>('all');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [dailyWinner, setDailyWinner] = useState<{
    username: string;
    countryCode: string;
    score: number;
    accuracy: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboards(region, period, mode, gameverseId).then((res) => {
      if (cancelled) return;
      setEntries(res.entries);
      setDailyWinner(res.dailyWinner);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [region, period, mode, gameverseId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0D1320] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="font-display text-2xl font-bold text-white">Gameverse Leaderboards</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close leaderboards"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Daily Winner Highlight */}
        {dailyWinner && (
          <div className="mx-5 mt-4 p-3.5 rounded-xl bg-emerald-950/35 border border-emerald-500/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Crown className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-medium text-emerald-300">Today’s Daily Challenge Leader</div>
                <div className="text-sm font-bold text-white">
                  {dailyWinner.username} · {dailyWinner.countryCode}
                </div>
              </div>
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-emerald-300">
              {dailyWinner.score} pts · {dailyWinner.accuracy}% acc
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="px-5 pt-4 pb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/70">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
            {REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setRegion(r.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  region === r.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-slate-800">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    period === p.id
                      ? 'bg-violet-500 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as GameModeId | 'all')}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 focus:outline-none focus:border-sky-500"
              aria-label="Filter by mode"
            >
              <option value="all">All Modes</option>
              {Object.values(GAME_MODES).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortLabel}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Standings Table */}
        <div className="flex-1 overflow-y-auto gv-scroll p-5">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading verified standings...</div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">
              No scores recorded for this filter yet. Play a match to claim #1!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] font-medium text-slate-400 border-b border-slate-800">
                    <th className="pb-2.5 pr-3">Rank</th>
                    <th className="pb-2.5 pr-3">Player</th>
                    <th className="pb-2.5 pr-3">Country</th>
                    <th className="pb-2.5 pr-3">Mode</th>
                    <th className="pb-2.5 pr-3 text-right">Accuracy</th>
                    <th className="pb-2.5 pr-3 text-right">Streak</th>
                    <th className="pb-2.5 text-right">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-sm">
                  {entries.map((row) => {
                    const isSelf = row.gameverseId === gameverseId;
                    return (
                      <tr
                        key={`${row.gameverseId}-${row.rank}`}
                        className={isSelf ? 'bg-emerald-500/10' : 'hover:bg-slate-900/50'}
                      >
                        <td className="py-3 pr-3 font-mono-tabular font-bold text-slate-200">
                          #{row.rank}
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-2.5">
                            <AvatarBadge avatarId={row.avatarId} username={row.username} size="sm" />
                            <div>
                              <div className="font-semibold text-slate-100">
                                {row.username} {isSelf ? '(You)' : ''}
                              </div>
                              <div className="text-[11px] text-slate-400">{row.level}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-300">
                          {row.countryName} ({row.countryCode})
                        </td>
                        <td className="py-3 pr-3 text-xs text-slate-400">
                          {row.mode === 'all' ? 'All' : GAME_MODES[row.mode]?.shortLabel ?? row.mode}
                        </td>
                        <td className="py-3 pr-3 text-right font-mono-tabular text-sky-400">
                          {row.accuracy.toFixed(1)}%
                        </td>
                        <td className="py-3 pr-3 text-right font-mono-tabular text-violet-400">
                          {row.longestStreak}x
                        </td>
                        <td className="py-3 text-right font-mono-tabular font-bold text-emerald-400">
                          {row.score}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
