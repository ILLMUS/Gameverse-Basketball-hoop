import { Award, CheckCircle2, Home, Play, RotateCcw, ShieldCheck, Sparkles, Trophy } from 'lucide-react';
import { ACHIEVEMENTS, COSMETICS, GAME_MODES, getLevelForXp } from '../data/catalog';
import type { GameModeId, ValidatedMatchResponse } from '../types/game';

interface PauseModalProps {
  mode: GameModeId;
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
}

export function PauseModal({ mode, onResume, onRestart, onQuitToTitle }: PauseModalProps) {
  const cfg = GAME_MODES[mode];
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-[#0D1320] border border-slate-800 p-6 shadow-2xl space-y-5">
        <div>
          <div className="text-xs font-medium text-sky-400">{cfg.name}</div>
          <h2 className="font-display text-3xl font-extrabold text-white mt-0.5">Game Paused</h2>
        </div>

        <div className="space-y-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Match</span>
          </button>

          <button
            type="button"
            onClick={onRestart}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Mode</span>
          </button>

          <button
            type="button"
            onClick={onQuitToTitle}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Back to Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface SummaryModalProps {
  mode: GameModeId;
  summary: {
    score: number;
    baskets: number;
    attempts: number;
    misses: number;
    maxStreak: number;
    swishes: number;
    threePointers: number;
  };
  validation: ValidatedMatchResponse | null;
  submitting: boolean;
  bonusClaimed: boolean;
  onClaimRewardedBonus: () => void;
  onPlayAgain: () => void;
  onOpenLeaderboards: () => void;
  onBackToMenu: () => void;
}

export function SummaryModal({
  mode,
  summary,
  validation,
  submitting,
  bonusClaimed,
  onClaimRewardedBonus,
  onPlayAgain,
  onOpenLeaderboards,
  onBackToMenu,
}: SummaryModalProps) {
  const cfg = GAME_MODES[mode];
  const accuracy = summary.attempts > 0 ? Math.round((summary.baskets / summary.attempts) * 100) : 0;
  const levelInfo = validation ? getLevelForXp(validation.newXp) : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl bg-[#0D1320] border border-slate-800 p-6 shadow-2xl space-y-5 my-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-emerald-400">
              {cfg.name} · Match Complete
            </div>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-white mt-0.5">
              Final Score: <span className="font-mono-tabular text-emerald-400">{summary.score}</span>
            </h2>
          </div>

          {validation?.validated && (
            <div className="flex items-center gap-1.5 text-xs text-sky-400 shrink-0 pt-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified</span>
            </div>
          )}
        </div>

        {/* Stat Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/80 border border-slate-800 rounded-xl p-4">
          <div>
            <div className="text-xs text-slate-400">Baskets</div>
            <div className="font-mono-tabular text-xl font-bold text-slate-100">
              {summary.baskets}/{summary.attempts}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Accuracy</div>
            <div className="font-mono-tabular text-xl font-bold text-sky-400">{accuracy}%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Best Streak</div>
            <div className="font-mono-tabular text-xl font-bold text-violet-400">
              {summary.maxStreak}x
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Clean Swishes</div>
            <div className="font-mono-tabular text-xl font-bold text-emerald-400">
              {summary.swishes}
            </div>
          </div>
        </div>

        {/* XP & Level Progress */}
        {submitting ? (
          <div className="text-sm text-slate-400 py-2">Validating shot telemetry & syncing XP...</div>
        ) : validation && levelInfo ? (
          <div className="space-y-3 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-200">
                {levelInfo.title} · <span className="font-mono-tabular">{validation.newXp} XP</span>
              </span>
              <span className="font-mono-tabular font-bold text-emerald-400">
                +{validation.xpEarned} XP
              </span>
            </div>

            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-violet-500 transition-all duration-300"
                style={{ width: `${levelInfo.progressPct}%` }}
              />
            </div>

            {validation.leveledUp && (
              <div className="flex items-center gap-2 text-xs font-semibold text-amber-300">
                <Sparkles className="w-4 h-4" />
                <span>Promoted to {validation.newLevel}!</span>
              </div>
            )}

            {validation.dailyRank !== undefined && (
              <div className="text-xs text-sky-300">
                Daily Challenge Rank Today: <span className="font-mono-tabular font-bold">#{validation.dailyRank}</span>
              </div>
            )}
          </div>
        ) : null}

        {/* Newly Unlocked Achievements & Cosmetics */}
        {validation &&
          (validation.unlockedAchievements.length > 0 || validation.unlockedCosmetics.length > 0) && (
            <div className="space-y-2 bg-emerald-950/35 border border-emerald-500/30 rounded-xl p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <Award className="w-4 h-4" />
                <span>New Unlocks Earned</span>
              </div>
              <div className="space-y-1 text-xs text-slate-200">
                {validation.unlockedAchievements.map((achId) => {
                  const def = ACHIEVEMENTS.find((a) => a.id === achId);
                  return (
                    <div key={achId} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Achievement: {def?.title ?? achId}</span>
                    </div>
                  );
                })}
                {validation.unlockedCosmetics.map((itemId) => {
                  const item = COSMETICS.find((c) => c.id === itemId);
                  return (
                    <div key={itemId} className="flex items-center gap-2 text-sky-300">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Gear Unlocked: {item?.name ?? itemId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        {/* Non-Intrusive Optional Rewarded Sponsor Bonus (Summary Screen Only) */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 border border-slate-800 px-4 py-3">
          <div>
            <div className="text-xs font-semibold text-slate-200">Gameverse Sponsor Bonus</div>
            <div className="text-[11px] text-slate-400">
              {bonusClaimed
                ? 'Sponsor XP boost claimed (+50 XP)'
                : 'Watch a brief Gameverse spotlight to claim +50 bonus XP'}
            </div>
          </div>
          <button
            type="button"
            disabled={bonusClaimed}
            onClick={onClaimRewardedBonus}
            className={`px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              bonusClaimed
                ? 'bg-slate-800 text-slate-500 cursor-default'
                : 'bg-violet-600 hover:bg-violet-500 text-white cursor-pointer'
            }`}
          >
            {bonusClaimed ? 'Claimed' : '+50 XP Boost'}
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Play Again</span>
          </button>

          <button
            type="button"
            onClick={onOpenLeaderboards}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Trophy className="w-4 h-4 text-amber-400" />
            <span>Standings</span>
          </button>

          <button
            type="button"
            onClick={onBackToMenu}
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
}
