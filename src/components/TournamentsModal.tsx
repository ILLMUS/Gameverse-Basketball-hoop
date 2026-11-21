import { Award, Calendar, CheckCircle2, Play, Trophy, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { GAME_MODES } from '../data/catalog';
import { fetchTournaments, registerForTournament } from '../services/gameverseApi';
import type { GameModeId, Tournament } from '../types/game';

interface TournamentsModalProps {
  gameverseId: string;
  onPlayTournament: (mode: GameModeId, tournamentId: string) => void;
  onClose: () => void;
}

export function TournamentsModal({
  gameverseId,
  onPlayTournament,
  onClose,
}: TournamentsModalProps) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const list = await fetchTournaments(gameverseId);
    setTournaments(list);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [gameverseId]);

  const handleRegister = async (tournamentId: string) => {
    setBusyId(tournamentId);
    const ok = await registerForTournament(tournamentId, gameverseId);
    if (ok) {
      await load();
    }
    setBusyId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0D1320] border border-slate-800 shadow-2xl overflow-hidden">
        {/* Header with Sponsored Championship Backdrop */}
        <div className="relative px-5 py-5 border-b border-slate-800 overflow-hidden">
          <img
            src="/src/assets/images/sponsor_arena_banner_1795265394412.jpg"
            alt="Gameverse championship stage"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Award className="w-5 h-5 text-violet-400" />
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-none">
                  Tournaments & Sponsored Cups
                </h2>
                <p className="text-xs text-slate-300 mt-1">
                  Skill-based Gameverse competitions with server-verified shot telemetry. Zero wagering.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-900/80 transition-colors cursor-pointer"
              aria-label="Close tournaments"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tournament List */}
        <div className="flex-1 overflow-y-auto gv-scroll p-5 space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading tournament schedule...</div>
          ) : (
            tournaments.map((t) => {
              const modeCfg = GAME_MODES[t.mode];
              return (
                <div
                  key={t.id}
                  className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 sm:p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`font-semibold ${
                            t.status === 'active'
                              ? 'text-emerald-400'
                              : t.status === 'scheduled'
                              ? 'text-sky-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {t.status === 'active'
                            ? 'Live Competition'
                            : t.status === 'scheduled'
                            ? 'Scheduled'
                            : 'Completed'}
                        </span>
                        <span className="text-slate-600" aria-hidden="true">
                          ·
                        </span>
                        <span className="text-slate-300">{modeCfg?.name ?? t.mode}</span>
                        {t.sponsorName && (
                          <>
                            <span className="text-slate-600" aria-hidden="true">
                              ·
                            </span>
                            <span className="text-violet-300">Sponsor: {t.sponsorName}</span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-2xl font-bold text-white">{t.title}</h3>
                      <p className="text-xs text-slate-400">{t.subtitle}</p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {t.status !== 'completed' && !t.registered && (
                        <button
                          type="button"
                          disabled={busyId === t.id}
                          onClick={() => handleRegister(t.id)}
                          className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          {busyId === t.id ? 'Joining...' : 'Register Free'}
                        </button>
                      )}

                      {t.registered && t.status !== 'completed' && (
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 px-2">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Registered</span>
                        </div>
                      )}

                      {t.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => onPlayTournament(t.mode, t.id)}
                          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Qualifier</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metadata Line */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {t.scheduleLabel}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono-tabular">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {t.participantsCount} players
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-300">
                      <Trophy className="w-3.5 h-3.5" />
                      {t.prizeDescription}
                    </span>
                  </div>

                  {/* Winner Announcement or Live Top 3 */}
                  {t.winner ? (
                    <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 px-3.5 py-2.5 text-xs flex items-center justify-between">
                      <span className="text-amber-300 font-semibold">
                        Champion: {t.winner.username} ({t.winner.countryCode})
                      </span>
                      <span className="font-mono-tabular font-bold text-amber-200">
                        {t.winner.score} pts
                      </span>
                    </div>
                  ) : t.entries.length > 0 ? (
                    <div className="border-t border-slate-800 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {t.entries.slice(0, 3).map((e) => (
                        <div
                          key={e.gameverseId}
                          className="flex items-center justify-between rounded-lg bg-slate-950/60 px-3 py-2 text-xs"
                        >
                          <span className="font-medium text-slate-200 truncate">
                            #{e.rank} {e.username} ({e.countryCode})
                          </span>
                          <span className="font-mono-tabular font-bold text-emerald-400 ml-2">
                            {e.score}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
