export type GameModeId =
  | 'classic'
  | 'timed_60'
  | 'timed_90'
  | 'three_point'
  | 'moving_hoop'
  | 'consecutive'
  | 'daily';

export type ScreenState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY';

export type PlayerLevelTitle =
  | 'Rookie'
  | 'Amateur'
  | 'Semi-Pro'
  | 'Professional'
  | 'All-Star'
  | 'Legend';

export type LeaderboardRegion = 'global' | 'eswatini' | 'southern_africa' | 'friends';
export type LeaderboardPeriod = 'daily' | 'weekly' | 'all_time';

export type DragControlMode = 'auto' | 'slingshot' | 'swipe';

export type BallSkinId =
  | 'classic_leather'
  | 'neon_emerald'
  | 'electric_purple'
  | 'arc_blue'
  | 'championship_gold'
  | 'eswatini_pride';

export type CourtThemeId =
  | 'neon_arena'
  | 'street_court'
  | 'indoor_arena'
  | 'outdoor_court';

export type HoopDesignId =
  | 'pro_glass'
  | 'neon_cyber'
  | 'street_steel'
  | 'gold_championship';

export type NetStyleId =
  | 'classic_nylon'
  | 'neon_mesh'
  | 'street_chain'
  | 'gold_weave';

export type ShotEffectId =
  | 'clean_arc'
  | 'neon_pulse'
  | 'violet_comet'
  | 'starburst_gold';

export type AvatarId =
  | 'ace_striker'
  | 'mbabane_flash'
  | 'neon_cyber'
  | 'court_architect'
  | 'gold_mvp';

export interface GameModeConfig {
  id: GameModeId;
  name: string;
  shortLabel: string;
  description: string;
  durationSeconds: number | null;
  missEndsRun: boolean;
  movingHoop: boolean;
  threePointSpots: boolean;
  hasBonusTargets: boolean;
  xpMultiplier: number;
  badgeText: string;
}

export interface EquippedLoadout {
  ballSkin: BallSkinId;
  courtTheme: CourtThemeId;
  hoopDesign: HoopDesignId;
  netStyle: NetStyleId;
  shotEffect: ShotEffectId;
  avatarId: AvatarId;
}

export interface PlayerStats {
  matchesPlayed: number;
  basketsScored: number;
  totalAttempts: number;
  totalPoints: number;
  threePointersMade: number;
  swishesMade: number;
  highestScore: number;
  longestStreak: number;
  modeHighScores: Record<GameModeId, number>;
}

export interface TournamentHistoryEntry {
  tournamentId: string;
  tournamentName: string;
  placement: number;
  score: number;
  date: string;
  sponsor?: string;
}

export interface PlayerProfile {
  gameverseId: string;
  username: string;
  countryCode: string;
  countryName: string;
  region: 'eswatini' | 'southern_africa' | 'international';
  xp: number;
  level: PlayerLevelTitle;
  stats: PlayerStats;
  equipped: EquippedLoadout;
  unlockedItems: string[];
  achievements: string[];
  friends: string[];
  tournamentHistory: TournamentHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ShotTelemetry {
  timestampOffsetMs: number;
  power: number;
  angleDeg: number;
  scored: boolean;
  points: number;
  swish: boolean;
  bankShot: boolean;
  bonusHit: boolean;
  threePointer: boolean;
}

export interface MatchResultPayload {
  sessionToken: string;
  gameverseId: string;
  mode: GameModeId;
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
  tournamentId?: string;
}

export interface ValidatedMatchResponse {
  validated: boolean;
  validationNote: string;
  xpEarned: number;
  newXp: number;
  newLevel: PlayerLevelTitle;
  leveledUp: boolean;
  unlockedAchievements: string[];
  unlockedCosmetics: string[];
  dailyRank?: number;
  profile: PlayerProfile;
}

export interface LeaderboardEntry {
  rank: number;
  gameverseId: string;
  username: string;
  avatarId: AvatarId;
  countryCode: string;
  countryName: string;
  region: 'eswatini' | 'southern_africa' | 'international';
  mode: GameModeId | 'all';
  score: number;
  accuracy: number;
  longestStreak: number;
  level: PlayerLevelTitle;
  period: LeaderboardPeriod;
  updatedAt: string;
}

export interface Tournament {
  id: string;
  title: string;
  subtitle: string;
  mode: GameModeId;
  status: 'active' | 'scheduled' | 'completed';
  scheduleLabel: string;
  endsAt: string;
  prizeDescription: string;
  sponsorName?: string;
  sponsorTagline?: string;
  participantsCount: number;
  registered: boolean;
  entries: Array<{
    rank: number;
    gameverseId: string;
    username: string;
    countryCode: string;
    score: number;
    accuracy: number;
  }>;
  winner?: {
    username: string;
    countryCode: string;
    score: number;
  };
}

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  xpReward: number;
  rewardItemId?: string;
  rewardLabel?: string;
}

export interface CosmeticItem {
  id: string;
  category: 'ballSkin' | 'courtTheme' | 'hoopDesign' | 'netStyle' | 'shotEffect' | 'avatarId';
  name: string;
  description: string;
  unlockRequirement: string;
  unlockLevel?: PlayerLevelTitle;
  unlockAchievementId?: string;
  previewPrimary: string;
  previewSecondary: string;
}

export interface GameSettings {
  sfxEnabled: boolean;
  musicEnabled: boolean;
  aimGuideEnabled: boolean;
  aimGuideLength: 'short' | 'full';
  dragControlMode: DragControlMode;
  screenShakeEnabled: boolean;
}

export interface LiveHudState {
  score: number;
  baskets: number;
  attempts: number;
  misses: number;
  streak: number;
  maxStreak: number;
  swishes: number;
  threePointers: number;
  timeRemaining: number | null;
  shotBanner: {
    text: string;
    subtext?: string;
    tone: 'emerald' | 'purple' | 'blue' | 'amber';
    id: number;
  } | null;
  spotLabel: string;
  multiplier: number;
  isMoneyBall: boolean;
}
