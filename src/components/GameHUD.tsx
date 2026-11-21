import { Crosshair, Flag, Pause, Volume2, VolumeX, Music } from 'lucide-react';
import { GAME_MODES } from '../data/catalog';
import type { GameModeId, GameSettings, LiveHudState } from '../types/game';

interface GameHUDProps {
  mode: GameModeId;
  hud: LiveHudState;
  settings: GameSettings;
  personalBest: number;
  onToggleAimGuide: () => void;
  onToggleSfx: () => void;
  onToggleMusic: () => void;
  onPause: () => void;
  onFinishClassic: () => void;
}

export function GameHUD({
  mode,
  hud,
  settings,
  personalBest,
  onToggleAimGuide,
  onToggleSfx,
  onToggleMusic,
  onPause,
  onFinishClassic,
}: GameHUDProps) {
  const modeCfg = GAME_MODES[mode];
  const accuracy = hud.attempts > 0 ? Math.round((hud.baskets / hud.attempts) * 100) : 0;
  const isClockUrgent = hud.timeRemaining !== null && hud.timeRemaining <= 10;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5">
      {/* Top Perimeter Arcade Scoreboard & Quick Controls */}
      <div className="flex items-start justify-between gap-3">
        {/* Left Scoreboard Cluster */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-5 bg-[#0B101B]/88 border border-slate-800/90 rounded-xl px-4 py-2.5 shadow-lg">
          <div>
            <div className="text-[11px] font-medium text-slate-400">Score</div>
            <div className="font-mono-tabular text-2xl sm:text-3xl font-bold text-emerald-400 leading-none">
              {hud.score}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" aria-hidden="true" />

          {hud.timeRemaining !== null ? (
            <div>
              <div className="text-[11px] font-medium text-slate-400">Clock</div>
              <div
                className={`font-mono-tabular text-2xl sm:text-3xl font-bold leading-none ${
                  isClockUrgent ? 'text-amber-400' : 'text-slate-100'
                }`}
              >
                {hud.timeRemaining.toFixed(1)}s
              </div>
            </div>
          ) : (
            <div>
              <div className="text-[11px] font-medium text-slate-400">Best</div>
              <div className="font-mono-tabular text-2xl sm:text-3xl font-bold text-slate-100 leading-none">
                {Math.max(personalBest, hud.score)}
              </div>
            </div>
          )}

          <div className="h-8 w-px bg-slate-800 hidden xs:block" aria-hidden="true" />

          <div className="hidden sm:block">
            <div className="text-[11px] font-medium text-slate-400">Accuracy</div>
            <div className="font-mono-tabular text-lg font-semibold text-sky-400 leading-tight">
              {hud.baskets}/{hud.attempts} · {accuracy}%
            </div>
          </div>

          <div className="hidden md:block">
            <div className="text-[11px] font-medium text-slate-400">Streak</div>
            <div className="font-mono-tabular text-lg font-semibold text-violet-400 leading-tight">
              {hud.streak}x {hud.multiplier > 1 ? `(+${hud.multiplier - 1})` : ''}
            </div>
          </div>
        </div>

        {/* Right Interactive Controls */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 bg-[#0B101B]/88 border border-slate-800/90 rounded-xl p-1.5 shadow-lg">
          {mode === 'classic' && hud.attempts > 0 && (
            <button
              type="button"
              onClick={onFinishClassic}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 border border-emerald-500/30 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Finish Practice & Save Stats"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Save Run</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleAimGuide}
            className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              settings.aimGuideEnabled
                ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/70'
            }`}
            title={settings.aimGuideEnabled ? 'Disable Aim Guide' : 'Enable Aim Guide'}
          >
            <Crosshair className="w-4 h-4" />
            <span className="hidden sm:inline">Guide</span>
          </button>

          <button
            type="button"
            onClick={onToggleSfx}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              settings.sfxEnabled
                ? 'text-emerald-300 hover:bg-slate-800/70'
                : 'text-slate-500 hover:bg-slate-800/70'
            }`}
            aria-label={settings.sfxEnabled ? 'Mute sound effects' : 'Enable sound effects'}
            title={settings.sfxEnabled ? 'SFX On' : 'SFX Off'}
          >
            {settings.sfxEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleMusic}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              settings.musicEnabled
                ? 'text-violet-300 bg-violet-500/15'
                : 'text-slate-500 hover:bg-slate-800/70'
            }`}
            aria-label={settings.musicEnabled ? 'Mute music' : 'Enable arena music'}
            title={settings.musicEnabled ? 'Music On' : 'Music Off'}
          >
            <Music className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onPause}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            aria-label="Pause game"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        </div>
      </div>

      {/* Transient Dynamic Shot Banner (Center-Top, never blocks court center) */}
      <div className="flex flex-col items-center pointer-events-none">
        {hud.shotBanner && (
          <div
            key={hud.shotBanner.id}
            className={`px-4 py-1.5 rounded-lg border text-center transition-opacity duration-150 ${
              hud.shotBanner.tone === 'emerald'
                ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300'
                : hud.shotBanner.tone === 'purple'
                ? 'bg-violet-950/90 border-violet-500/40 text-violet-300'
                : hud.shotBanner.tone === 'blue'
                ? 'bg-sky-950/90 border-sky-500/40 text-sky-300'
                : 'bg-amber-950/90 border-amber-500/40 text-amber-300'
            }`}
          >
            <div className="font-display text-xl sm:text-2xl font-extrabold tracking-wide leading-none">
              {hud.shotBanner.text}
            </div>
            {hud.shotBanner.subtext && (
              <div className="text-[11px] font-medium opacity-90 mt-0.5">{hud.shotBanner.subtext}</div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Quiet Context Line */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="bg-[#0B101B]/80 border border-slate-800/80 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <span className="font-semibold text-slate-200">{modeCfg.shortLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{hud.spotLabel}</span>
          {hud.isMoneyBall && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-amber-400">Money Ball (+2)</span>
            </>
          )}
        </div>

        <div className="hidden sm:block bg-[#0B101B]/80 border border-slate-800/80 rounded-lg px-3 py-1.5 text-slate-400">
          Drag & Release to Shoot · Esc Pause
        </div>
      </div>
    </div>
  );
}
