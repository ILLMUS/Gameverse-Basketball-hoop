import {
  Award,
  Calendar,
  Flame,
  Palette,
  Play,
  Settings,
  Timer,
  Trophy,
  User,
  Zap,
} from 'lucide-react';
import { GAME_MODES, getLevelForXp } from '../data/catalog';
import { getDailyConditions } from '../engine/modes';
import type { GameModeId, PlayerProfile } from '../types/game';
import { AvatarBadge, GameverseLockup } from './GameverseLogo';

interface TitleScreenProps {
  selectedMode: GameModeId;
  profile: PlayerProfile;
  onSelectMode: (mode: GameModeId) => void;
  onStartGame: (mode?: GameModeId) => void;
  onOpenModal: (modal: 'leaderboards' | 'tournaments' | 'customize' | 'profile' | 'settings') => void;
}

const MODE_ORDER: GameModeId[] = [
  'timed_60',
  'classic',
  'timed_90',
  'three_point',
  'moving_hoop',
  'consecutive',
  'daily',
];

function ModeIcon({ mode }: { mode: GameModeId }) {
  switch (mode) {
    case 'timed_60':
    case 'timed_90':
      return <Timer className="w-4 h-4 text-emerald-400 shrink-0" />;
    case 'three_point':
      return <Zap className="w-4 h-4 text-violet-400 shrink-0" />;
    case 'moving_hoop':
      return <Flame className="w-4 h-4 text-sky-400 shrink-0" />;
    case 'consecutive':
      return <Award className="w-4 h-4 text-amber-400 shrink-0" />;
    case 'daily':
      return <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />;
    default:
      return <Play className="w-4 h-4 text-slate-300 shrink-0" />;
  }
}

export function TitleScreen({
  selectedMode,
  profile,
  onSelectMode,
  onStartGame,
  onOpenModal,
}: TitleScreenProps) {
  const activeMode = GAME_MODES[selectedMode];
  const levelInfo = getLevelForXp(profile.xp);
  const dailyInfo = getDailyConditions();

  return (
    <div className="relative z-10 w-full h-full flex flex-col justify-between p-4 sm:p-8 lg:p-10 bg-gradient-to-r from-[#07090E]/92 via-[#07090E]/74 to-[#07090E]/35 overflow-y-auto gv-scroll">
      {/* Top Row: Lockup + Player Profile Trigger */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <GameverseLockup />

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => onOpenModal('profile')}
            className="flex items-center gap-3 bg-[#0D1320]/90 hover:bg-[#141D30] border border-slate-800 rounded-xl px-3.5 py-2 transition-colors text-left cursor-pointer"
          >
            <AvatarBadge avatarId={profile.equipped.avatarId} username={profile.username} size="sm" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-100 truncate max-w-[140px]">
                {profile.username}
              </div>
              <div className="text-xs text-slate-400 font-mono-tabular">
                {levelInfo.title} · {profile.xp} XP · {profile.countryCode}
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onOpenModal('settings')}
            className="p-2.5 rounded-xl bg-[#0D1320]/90 hover:bg-[#141D30] border border-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
            aria-label="Game Settings"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Focal Content: Left Title/Action Zone + Mode Selector */}
      <div className="my-auto py-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-end max-w-6xl w-full">
        {/* Left Hero Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <div className="text-xs font-medium text-sky-400">
              {activeMode.badgeText} · Personal Best{' '}
              <span className="font-mono-tabular text-slate-200">
                {profile.stats.modeHighScores[selectedMode] ?? 0} pts
              </span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-[0.98] text-balance">
              {activeMode.name}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
              {activeMode.description}
              {selectedMode === 'daily' && (
                <span className="block mt-1.5 text-xs text-emerald-300">
                  Today’s Conditions ({dailyInfo.dateKey}): {dailyInfo.label}
                </span>
              )}
            </p>
          </div>

          {/* Primary Play CTA + Secondary Arcade Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => onStartGame(selectedMode)}
              className="flex items-center gap-2.5 px-7 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-base shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" />
              <span>Play Now</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('leaderboards')}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#0E1525]/95 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>Leaderboards</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('tournaments')}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#0E1525]/95 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Award className="w-4 h-4 text-violet-400" />
              <span>Tournaments</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('customize')}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#0E1525]/95 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Palette className="w-4 h-4 text-sky-400" />
              <span>Customize</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenModal('profile')}
              className="flex items-center gap-2 px-4 py-3.5 rounded-xl bg-[#0E1525]/95 hover:bg-slate-800 border border-slate-700/80 text-slate-100 font-semibold text-sm transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <User className="w-4 h-4 text-emerald-400" />
              <span>Profile</span>
            </button>
          </div>

          {/* Non-Gameplay Sponsored Event Banner */}
          <button
            type="button"
            onClick={() => onOpenModal('tournaments')}
            className="w-full max-w-md flex items-center justify-between gap-4 p-3 rounded-xl bg-[#0C1220]/90 hover:bg-[#111A2E] border border-slate-800 text-left transition-colors cursor-pointer"
          >
            <div>
              <div className="text-[11px] font-medium text-violet-400">
                Sponsored Cup · Gameverse Southern Africa
              </div>
              <div className="text-sm font-semibold text-slate-100">
                Mbabane Hoops Open — Live Qualifier
              </div>
            </div>
            <span className="text-xs font-semibold text-emerald-400 whitespace-nowrap shrink-0">
              View Cup →
            </span>
          </button>
        </div>

        {/* Right Mode Selection Grid */}
        <div className="lg:col-span-6 bg-[#0B101B]/88 border border-slate-800/90 rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-200">Select Game Mode</h2>
            <span className="text-xs text-slate-400">7 Arcade Modes</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {MODE_ORDER.map((modeId) => {
              const cfg = GAME_MODES[modeId];
              const isSelected = selectedMode === modeId;
              const best = profile.stats.modeHighScores[modeId] ?? 0;

              return (
                <button
                  key={modeId}
                  type="button"
                  onClick={() => onSelectMode(modeId)}
                  onDoubleClick={() => onStartGame(modeId)}
                  className={`flex items-center justify-between gap-2.5 p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-emerald-500/12 border-emerald-500/60 text-white'
                      : 'bg-slate-900/65 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <ModeIcon mode={modeId} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{cfg.shortLabel}</div>
                      <div className="text-[11px] text-slate-400 truncate">{cfg.badgeText}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono-tabular text-xs font-bold text-slate-200">{best}</div>
                    <div className="text-[10px] text-slate-500">Best</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Single Flat Control-Hint Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div>Drag & Release or Swipe to Shoot · Space / Enter to Play · Esc to Pause</div>
        <div className="font-mono-tabular text-slate-500">
          ID: {profile.gameverseId} · {profile.countryName}
        </div>
      </div>
    </div>
  );
}
