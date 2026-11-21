import { Database, Settings, X } from 'lucide-react';
import { getBackendStatusSummary } from '../services/supabaseAdapter';
import type { DragControlMode, GameSettings } from '../types/game';

interface SettingsModalProps {
  settings: GameSettings;
  onUpdateSettings: (next: GameSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onUpdateSettings, onClose }: SettingsModalProps) {
  const backendStatus = getBackendStatusSummary();

  const toggle = (key: keyof Pick<GameSettings, 'sfxEnabled' | 'musicEnabled' | 'aimGuideEnabled' | 'screenShakeEnabled'>) => {
    onUpdateSettings({ ...settings, [key]: !settings[key] });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="w-full max-w-lg rounded-2xl bg-[#0D1320] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Settings className="w-5 h-5 text-sky-400" />
            <h2 className="font-display text-2xl font-bold text-white">Game Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto gv-scroll">
          {/* Audio Toggles */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Audio</h3>
            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">Sound Effects</div>
                <div className="text-xs text-slate-400">Bounces, net swishes, rim clangs, buzzer</div>
              </div>
              <button
                type="button"
                onClick={() => toggle('sfxEnabled')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  settings.sfxEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.sfxEnabled ? 'On' : 'Off'}
              </button>
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">Arena Music</div>
                <div className="text-xs text-slate-400">Procedural synth groove loop</div>
              </div>
              <button
                type="button"
                onClick={() => toggle('musicEnabled')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  settings.musicEnabled
                    ? 'bg-violet-500 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.musicEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Aiming & Controls */}
          <div className="space-y-3 border-t border-slate-800 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Controls & Aiming
            </h3>

            <div className="flex items-center justify-between py-1.5">
              <div>
                <div className="text-sm font-semibold text-slate-100">Trajectory Aim Guide</div>
                <div className="text-xs text-slate-400">Disable for pro free-aim challenge</div>
              </div>
              <button
                type="button"
                onClick={() => toggle('aimGuideEnabled')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  settings.aimGuideEnabled
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.aimGuideEnabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            {settings.aimGuideEnabled && (
              <div className="flex items-center justify-between py-1.5">
                <div className="text-sm font-semibold text-slate-100">Guide Arc Length</div>
                <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-900 border border-slate-800">
                  {(['short', 'full'] as const).map((len) => (
                    <button
                      key={len}
                      type="button"
                      onClick={() => onUpdateSettings({ ...settings, aimGuideLength: len })}
                      className={`px-3 py-1 rounded text-xs font-semibold capitalize cursor-pointer ${
                        settings.aimGuideLength === len
                          ? 'bg-slate-700 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      {len}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="text-sm font-semibold text-slate-100">Drag / Swipe Input Style</div>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800">
                {(
                  [
                    { id: 'auto', label: 'Smart Auto' },
                    { id: 'slingshot', label: 'Pull Back' },
                    { id: 'swipe', label: 'Forward Swipe' },
                  ] as Array<{ id: DragControlMode; label: string }>
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateSettings({ ...settings, dragControlMode: opt.id })}
                    className={`py-2 px-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      settings.dragControlMode === opt.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-1.5">
              <div>
                <div className="text-sm font-semibold text-slate-100">Camera Impact Shake</div>
                <div className="text-xs text-slate-400">Subtle shake on rim clangs and clean swishes</div>
              </div>
              <button
                type="button"
                onClick={() => toggle('screenShakeEnabled')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                  settings.screenShakeEnabled
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.screenShakeEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          {/* Backend / Supabase Status */}
          <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-sky-400">
              <Database className="w-4 h-4" />
              <span>{backendStatus.label}</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">{backendStatus.details}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
