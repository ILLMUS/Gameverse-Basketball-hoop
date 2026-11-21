import { ACHIEVEMENTS, COUNTRIES, getLevelForXp, LEVEL_THRESHOLDS } from '../data/catalog';
import type {
  GameModeId,
  GameSettings,
  LeaderboardEntry,
  LeaderboardPeriod,
  LeaderboardRegion,
  MatchResultPayload,
  PlayerProfile,
  Tournament,
  ValidatedMatchResponse,
} from '../types/game';
import { syncProfileToSupabase } from './supabaseAdapter';

const PROFILE_STORAGE_KEY = 'gameverse_hoops_profile_v1';
const SETTINGS_STORAGE_KEY = 'gameverse_hoops_settings_v1';

export const DEFAULT_SETTINGS: GameSettings = {
  sfxEnabled: true,
  musicEnabled: false,
  aimGuideEnabled: true,
  aimGuideLength: 'full',
  dragControlMode: 'auto',
  screenShakeEnabled: true,
};

function generateGameverseId(countryCode = 'SZ'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `GV-${countryCode}-${num}`;
}

export function createInitialLocalProfile(): PlayerProfile {
  const now = new Date().toISOString();
  return {
    gameverseId: generateGameverseId('SZ'),
    username: 'SwaziHooper',
    countryCode: 'SZ',
    countryName: 'Eswatini',
    region: 'eswatini',
    xp: 0,
    level: 'Rookie',
    stats: {
      matchesPlayed: 0,
      basketsScored: 0,
      totalAttempts: 0,
      totalPoints: 0,
      threePointersMade: 0,
      swishesMade: 0,
      highestScore: 0,
      longestStreak: 0,
      modeHighScores: {
        classic: 0,
        timed_60: 0,
        timed_90: 0,
        three_point: 0,
        moving_hoop: 0,
        consecutive: 0,
        daily: 0,
      },
    },
    equipped: {
      ballSkin: 'classic_leather',
      courtTheme: 'neon_arena',
      hoopDesign: 'pro_glass',
      netStyle: 'classic_nylon',
      shotEffect: 'clean_arc',
      avatarId: 'ace_striker',
    },
    unlockedItems: [
      'ball_classic_leather',
      'court_neon_arena',
      'court_street_court',
      'hoop_pro_glass',
      'net_classic_nylon',
      'effect_clean_arc',
      'avatar_ace_striker',
      'avatar_mbabane_flash',
    ],
    achievements: [],
    friends: ['GV-SZ-1042', 'GV-ZA-4410'],
    tournamentHistory: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function loadLocalProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PlayerProfile;
      if (parsed && parsed.gameverseId) return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  const fresh = createInitialLocalProfile();
  saveLocalProfile(fresh);
  return fresh;
}

export function saveLocalProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage errors
  }
}

export function loadSettings(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<GameSettings>) };
    }
  } catch {
    // Ignore
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export async function syncProfile(profile: PlayerProfile): Promise<PlayerProfile> {
  saveLocalProfile(profile);
  syncProfileToSupabase(profile).catch(() => {});
  try {
    const res = await fetch('/api/profile/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (res.ok) {
      const data = (await res.json()) as { profile: PlayerProfile };
      const merged: PlayerProfile = {
        ...profile,
        ...data.profile,
        xp: Math.max(profile.xp, data.profile.xp),
        stats: {
          ...profile.stats,
          ...data.profile.stats,
          highestScore: Math.max(profile.stats.highestScore, data.profile.stats.highestScore),
          longestStreak: Math.max(profile.stats.longestStreak, data.profile.stats.longestStreak),
        },
        unlockedItems: Array.from(new Set([...profile.unlockedItems, ...data.profile.unlockedItems])),
        achievements: Array.from(new Set([...profile.achievements, ...data.profile.achievements])),
      };
      saveLocalProfile(merged);
      return merged;
    }
  } catch {
    // Offline/local fallback
  }
  return profile;
}

export async function startMatchSession(gameverseId: string, mode: GameModeId): Promise<string> {
  try {
    const res = await fetch('/api/session/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameverseId, mode }),
    });
    if (res.ok) {
      const data = (await res.json()) as { sessionToken: string };
      return data.sessionToken;
    }
  } catch {
    // Fallback session token
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function submitValidatedMatch(
  payload: MatchResultPayload,
  currentProfile: PlayerProfile,
): Promise<ValidatedMatchResponse> {
  try {
    const res = await fetch('/api/scores/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const result = (await res.json()) as ValidatedMatchResponse;
      saveLocalProfile(result.profile);
      syncProfileToSupabase(result.profile).catch(() => {});
      return result;
    }
  } catch {
    // Fallback to deterministic local calculation if server unreachable
  }

  const prevLevel = currentProfile.level;
  const updated: PlayerProfile = {
    ...currentProfile,
    stats: {
      ...currentProfile.stats,
      matchesPlayed: currentProfile.stats.matchesPlayed + 1,
      basketsScored: currentProfile.stats.basketsScored + payload.baskets,
      totalAttempts: currentProfile.stats.totalAttempts + payload.attempts,
      totalPoints: currentProfile.stats.totalPoints + payload.score,
      threePointersMade: currentProfile.stats.threePointersMade + payload.threePointers,
      swishesMade: currentProfile.stats.swishesMade + payload.swishes,
      highestScore: Math.max(currentProfile.stats.highestScore, payload.score),
      longestStreak: Math.max(currentProfile.stats.longestStreak, payload.maxStreak),
      modeHighScores: {
        ...currentProfile.stats.modeHighScores,
        [payload.mode]: Math.max(
          currentProfile.stats.modeHighScores[payload.mode] ?? 0,
          payload.score,
        ),
      },
    },
    unlockedItems: [...currentProfile.unlockedItems],
    achievements: [...currentProfile.achievements],
    updatedAt: new Date().toISOString(),
  };

  const accuracy = payload.attempts > 0 ? (payload.baskets / payload.attempts) * 100 : 0;
  const unlockedAchievements: string[] = [];
  const unlockedCosmetics: string[] = [];

  const grantAch = (id: string) => {
    if (!updated.achievements.includes(id)) {
      updated.achievements.push(id);
      unlockedAchievements.push(id);
      const def = ACHIEVEMENTS.find((a) => a.id === id);
      if (def?.rewardItemId && !updated.unlockedItems.includes(def.rewardItemId)) {
        updated.unlockedItems.push(def.rewardItemId);
        unlockedCosmetics.push(def.rewardItemId);
      }
    }
  };

  if (updated.stats.basketsScored >= 1) grantAch('first_basket');
  if (payload.attempts >= 10 && accuracy >= 90) grantAch('sharpshooter');
  if (payload.maxStreak >= 10) grantAch('hot_streak');
  if (updated.stats.threePointersMade >= 20) grantAch('three_point_king');
  if ((payload.mode === 'timed_60' || payload.mode === 'timed_90') && payload.baskets >= 30) {
    grantAch('time_master');
  }
  if (payload.score >= 100) grantAch('court_legend');
  if (updated.stats.swishesMade >= 15) grantAch('swish_machine');

  const xpEarned = 25 + payload.baskets * 6 + payload.swishes * 3 + Math.round(payload.score * 0.5);
  updated.xp += xpEarned;
  const levelInfo = getLevelForXp(updated.xp);
  updated.level = levelInfo.title;

  for (const lvl of LEVEL_THRESHOLDS) {
    if (updated.xp >= lvl.minXp) {
      // Level cosmetic check handled cleanly in server, kept synced here
    }
  }

  saveLocalProfile(updated);
  return {
    validated: false,
    validationNote: 'Saved locally (offline fallback)',
    xpEarned,
    newXp: updated.xp,
    newLevel: updated.level,
    leveledUp: updated.level !== prevLevel,
    unlockedAchievements,
    unlockedCosmetics,
    profile: updated,
  };
}

export async function fetchLeaderboards(
  region: LeaderboardRegion,
  period: LeaderboardPeriod,
  mode: GameModeId | 'all',
  gameverseId: string,
): Promise<{
  entries: LeaderboardEntry[];
  dailyWinner: { username: string; countryCode: string; score: number; accuracy: number } | null;
}> {
  try {
    const params = new URLSearchParams({ region, period, mode, gameverseId });
    const res = await fetch(`/api/leaderboards?${params.toString()}`);
    if (res.ok) {
      return (await res.json()) as {
        entries: LeaderboardEntry[];
        dailyWinner: { username: string; countryCode: string; score: number; accuracy: number } | null;
      };
    }
  } catch {
    // Fallback
  }
  return { entries: [], dailyWinner: null };
}

export async function fetchTournaments(gameverseId: string): Promise<Tournament[]> {
  try {
    const res = await fetch(`/api/tournaments?gameverseId=${encodeURIComponent(gameverseId)}`);
    if (res.ok) {
      const data = (await res.json()) as { tournaments: Tournament[] };
      return data.tournaments;
    }
  } catch {
    // Fallback
  }
  return [];
}

export async function registerForTournament(
  tournamentId: string,
  gameverseId: string,
): Promise<boolean> {
  try {
    const res = await fetch('/api/tournaments/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tournamentId, gameverseId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function switchCountryOnProfile(profile: PlayerProfile, countryCode: string): PlayerProfile {
  const found = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[0];
  return {
    ...profile,
    countryCode: found.code,
    countryName: found.name,
    region: found.region,
    updatedAt: new Date().toISOString(),
  };
}
