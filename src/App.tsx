import { useCallback, useEffect, useState } from 'react';
import { CustomizeModal } from './components/CustomizeModal';
import { GameCanvas } from './components/GameCanvas';
import { GameHUD } from './components/GameHUD';
import { LeaderboardsModal } from './components/LeaderboardsModal';
import { PauseModal, SummaryModal } from './components/MatchModals';
import { ProfileModal } from './components/ProfileModal';
import { SettingsModal } from './components/SettingsModal';
import { TitleScreen } from './components/TitleScreen';
import { TournamentsModal } from './components/TournamentsModal';
import { getLevelForXp } from './data/catalog';
import { soundEngine } from './engine/audio';
import {
  loadLocalProfile,
  loadSettings,
  saveLocalProfile,
  saveSettings,
  startMatchSession,
  submitValidatedMatch,
  syncProfile,
} from './services/gameverseApi';
import type {
  CosmeticItem,
  GameModeId,
  GameSettings,
  LiveHudState,
  PlayerProfile,
  ScreenState,
  ShotTelemetry,
  ValidatedMatchResponse,
} from './types/game';

const INITIAL_HUD: LiveHudState = {
  score: 0,
  baskets: 0,
  attempts: 0,
  misses: 0,
  streak: 0,
  maxStreak: 0,
  swishes: 0,
  threePointers: 0,
  timeRemaining: null,
  shotBanner: null,
  spotLabel: 'Arcade Spot',
  multiplier: 1,
  isMoneyBall: false,
};

const MODE_ORDER: GameModeId[] = [
  'timed_60',
  'classic',
  'timed_90',
  'three_point',
  'moving_hoop',
  'consecutive',
  'daily',
];

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('TITLE_MENU');
  const [selectedMode, setSelectedMode] = useState<GameModeId>('timed_60');
  const [activeTournamentId, setActiveTournamentId] = useState<string | undefined>(undefined);
  const [matchKey, setMatchKey] = useState(1);
  const [sessionToken, setSessionToken] = useState('');

  const [profile, setProfile] = useState<PlayerProfile>(() => loadLocalProfile());
  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [hud, setHud] = useState<LiveHudState>(INITIAL_HUD);

  const [activeModal, setActiveModal] = useState<
    'leaderboards' | 'tournaments' | 'customize' | 'profile' | 'settings' | null
  >(null);

  const [lastSummary, setLastSummary] = useState<{
    score: number;
    baskets: number;
    attempts: number;
    misses: number;
    maxStreak: number;
    swishes: number;
    threePointers: number;
    durationMs: number;
    dailySeed?: string;
    shots: ShotTelemetry[];
  } | null>(null);
  const [validationResult, setValidationResult] = useState<ValidatedMatchResponse | null>(null);
  const [submittingScore, setSubmittingScore] = useState(false);
  const [bonusClaimed, setBonusClaimed] = useState(false);

  // Sync audio settings with soundEngine
  useEffect(() => {
    soundEngine.setSettings(settings.sfxEnabled, settings.musicEnabled);
    saveSettings(settings);
  }, [settings]);

  // Initial sync with backend profile store
  useEffect(() => {
    syncProfile(profile).then((merged) => setProfile(merged));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startGame = useCallback(
    async (modeOverride?: GameModeId, tournamentId?: string) => {
      const targetMode = modeOverride ?? selectedMode;
      soundEngine.unlock();
      soundEngine.playClick();
      setSelectedMode(targetMode);
      setActiveTournamentId(tournamentId);
      setActiveModal(null);
      setLastSummary(null);
      setValidationResult(null);
      setBonusClaimed(false);
      setHud(INITIAL_HUD);
      setMatchKey((k) => k + 1);
      setScreen('PLAYING');

      const token = await startMatchSession(profile.gameverseId, targetMode);
      setSessionToken(token);
    },
    [profile.gameverseId, selectedMode],
  );

  const handleMatchEnd = useCallback(
    async (summary: {
      score: number;
      baskets: number;
      attempts: number;
      misses: number;
      maxStreak: number;
      swishes: number;
      threePointers: number;
      durationMs: number;
      dailySeed?: string;
      shots: ShotTelemetry[];
    }) => {
      setLastSummary(summary);
      setScreen('ROUND_SUMMARY');
      setSubmittingScore(true);

      if (summary.baskets > 0) {
        soundEngine.playVictory();
      }

      const res = await submitValidatedMatch(
        {
          sessionToken,
          gameverseId: profile.gameverseId,
          mode: selectedMode,
          score: summary.score,
          baskets: summary.baskets,
          attempts: summary.attempts,
          misses: summary.misses,
          maxStreak: summary.maxStreak,
          swishes: summary.swishes,
          threePointers: summary.threePointers,
          durationMs: summary.durationMs,
          dailySeed: summary.dailySeed,
          shots: summary.shots,
          tournamentId: activeTournamentId,
        },
        profile,
      );

      setProfile(res.profile);
      setValidationResult(res);
      setSubmittingScore(false);
    },
    [activeTournamentId, profile, selectedMode, sessionToken],
  );

  const handleFinishClassic = useCallback(() => {
    handleMatchEnd({
      score: hud.score,
      baskets: hud.baskets,
      attempts: hud.attempts,
      misses: hud.misses,
      maxStreak: hud.maxStreak,
      swishes: hud.swishes,
      threePointers: hud.threePointers,
      durationMs: 30000,
      shots: Array.from({ length: hud.attempts }, (_, i) => ({
        timestampOffsetMs: (i + 1) * 800,
        power: 0.7,
        angleDeg: 52,
        scored: i < hud.baskets,
        points: i < hud.baskets ? Math.floor(hud.score / Math.max(1, hud.baskets)) : 0,
        swish: i < hud.swishes,
        bankShot: false,
        bonusHit: false,
        threePointer: i < hud.threePointers,
      })),
    });
  }, [handleMatchEnd, hud]);

  // Keyboard navigation & Pause shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;

      if (e.key === 'Escape') {
        if (activeModal) {
          setActiveModal(null);
          return;
        }
        if (screen === 'PLAYING') {
          setScreen('PAUSED');
        } else if (screen === 'PAUSED') {
          setScreen('PLAYING');
        }
        return;
      }

      if (screen === 'TITLE_MENU' && !activeModal) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          startGame(selectedMode);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          e.preventDefault();
          const idx = MODE_ORDER.indexOf(selectedMode);
          setSelectedMode(MODE_ORDER[(idx + 1) % MODE_ORDER.length]);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          e.preventDefault();
          const idx = MODE_ORDER.indexOf(selectedMode);
          setSelectedMode(MODE_ORDER[(idx - 1 + MODE_ORDER.length) % MODE_ORDER.length]);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeModal, screen, selectedMode, startGame]);

  const handleEquipCosmetic = (category: CosmeticItem['category'], shortId: string) => {
    soundEngine.playClick();
    const updated: PlayerProfile = {
      ...profile,
      equipped: {
        ...profile.equipped,
        [category]: shortId,
      },
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    syncProfile(updated);
  };

  const handleSaveProfile = (updated: PlayerProfile) => {
    soundEngine.playClick();
    setProfile(updated);
    syncProfile(updated);
  };

  const handleClaimRewardedBonus = () => {
    if (bonusClaimed) return;
    setBonusClaimed(true);
    soundEngine.playVictory();
    const nextXp = profile.xp + 50;
    const lvl = getLevelForXp(nextXp).title;
    const updated: PlayerProfile = {
      ...profile,
      xp: nextXp,
      level: lvl,
      updatedAt: new Date().toISOString(),
    };
    saveLocalProfile(updated);
    setProfile(updated);
    syncProfile(updated);
    if (validationResult) {
      setValidationResult({
        ...validationResult,
        xpEarned: validationResult.xpEarned + 50,
        newXp: nextXp,
        newLevel: lvl,
      });
    }
  };

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#07090E] text-slate-100 select-none">
      {/* Persistent Isolated Canvas Engine (Runs Showcase on Title Screen, Interactive during Play) */}
      <div className="absolute inset-0">
        <GameCanvas
          mode={selectedMode}
          isPlaying={screen === 'PLAYING'}
          isPaused={screen === 'PAUSED' || activeModal !== null}
          showcaseMode={screen === 'TITLE_MENU'}
          equipped={profile.equipped}
          settings={settings}
          matchKey={matchKey}
          onHudUpdate={setHud}
          onMatchEnd={handleMatchEnd}
        />
      </div>

      {/* Title Screen */}
      {screen === 'TITLE_MENU' && (
        <TitleScreen
          selectedMode={selectedMode}
          profile={profile}
          onSelectMode={(m) => {
            soundEngine.playClick();
            setSelectedMode(m);
          }}
          onStartGame={(m) => startGame(m)}
          onOpenModal={(modal) => {
            soundEngine.playClick();
            setActiveModal(modal);
          }}
        />
      )}

      {/* Active Gameplay HUD */}
      {(screen === 'PLAYING' || screen === 'PAUSED') && (
        <GameHUD
          mode={selectedMode}
          hud={hud}
          settings={settings}
          personalBest={profile.stats.modeHighScores[selectedMode] ?? 0}
          onToggleAimGuide={() =>
            setSettings((s) => ({ ...s, aimGuideEnabled: !s.aimGuideEnabled }))
          }
          onToggleSfx={() => setSettings((s) => ({ ...s, sfxEnabled: !s.sfxEnabled }))}
          onToggleMusic={() => setSettings((s) => ({ ...s, musicEnabled: !s.musicEnabled }))}
          onPause={() => setScreen('PAUSED')}
          onFinishClassic={handleFinishClassic}
        />
      )}

      {/* Pause Modal */}
      {screen === 'PAUSED' && (
        <PauseModal
          mode={selectedMode}
          onResume={() => setScreen('PLAYING')}
          onRestart={() => startGame(selectedMode, activeTournamentId)}
          onQuitToTitle={() => setScreen('TITLE_MENU')}
        />
      )}

      {/* Round Summary Modal */}
      {screen === 'ROUND_SUMMARY' && lastSummary && (
        <SummaryModal
          mode={selectedMode}
          summary={lastSummary}
          validation={validationResult}
          submitting={submittingScore}
          bonusClaimed={bonusClaimed}
          onClaimRewardedBonus={handleClaimRewardedBonus}
          onPlayAgain={() => startGame(selectedMode, activeTournamentId)}
          onOpenLeaderboards={() => setActiveModal('leaderboards')}
          onBackToMenu={() => setScreen('TITLE_MENU')}
        />
      )}

      {/* Feature Drawers / Modals */}
      {activeModal === 'leaderboards' && (
        <LeaderboardsModal
          gameverseId={profile.gameverseId}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'tournaments' && (
        <TournamentsModal
          gameverseId={profile.gameverseId}
          onPlayTournament={(mode, tournamentId) => startGame(mode, tournamentId)}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'customize' && (
        <CustomizeModal
          profile={profile}
          onEquip={handleEquipCosmetic}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'profile' && (
        <ProfileModal
          profile={profile}
          onSaveProfile={handleSaveProfile}
          onClose={() => setActiveModal(null)}
        />
      )}

      {activeModal === 'settings' && (
        <SettingsModal
          settings={settings}
          onUpdateSettings={setSettings}
          onClose={() => setActiveModal(null)}
        />
      )}
    </main>
  );
}
