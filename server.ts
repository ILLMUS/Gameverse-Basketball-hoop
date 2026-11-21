import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';

interface StoredStats {
  matchesPlayed: number;
  basketsScored: number;
  totalAttempts: number;
  totalPoints: number;
  threePointersMade: number;
  swishesMade: number;
  highestScore: number;
  longestStreak: number;
  modeHighScores: Record<string, number>;
}

interface StoredProfile {
  gameverseId: string;
  username: string;
  countryCode: string;
  countryName: string;
  region: 'eswatini' | 'southern_africa' | 'international';
  xp: number;
  level: string;
  stats: StoredStats;
  equipped: Record<string, string>;
  unlockedItems: string[];
  achievements: string[];
  friends: string[];
  tournamentHistory: Array<{
    tournamentId: string;
    tournamentName: string;
    placement: number;
    score: number;
    date: string;
    sponsor?: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

interface StoredScoreEntry {
  id: string;
  gameverseId: string;
  username: string;
  avatarId: string;
  countryCode: string;
  countryName: string;
  region: 'eswatini' | 'southern_africa' | 'international';
  mode: string;
  score: number;
  accuracy: number;
  longestStreak: number;
  level: string;
  dailySeed?: string;
  createdAt: string;
}

interface StoredTournament {
  id: string;
  title: string;
  subtitle: string;
  mode: string;
  status: 'active' | 'scheduled' | 'completed';
  scheduleLabel: string;
  endsAt: string;
  prizeDescription: string;
  sponsorName?: string;
  sponsorTagline?: string;
  participantsCount: number;
  registeredIds: string[];
  entries: Array<{
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

interface StoreData {
  profiles: Record<string, StoredProfile>;
  scores: StoredScoreEntry[];
  tournaments: StoredTournament[];
}

interface ActiveSession {
  token: string;
  gameverseId: string;
  mode: string;
  startedAtMs: number;
  used: boolean;
}

const LEVEL_THRESHOLDS = [
  { title: 'Rookie', minXp: 0 },
  { title: 'Amateur', minXp: 300 },
  { title: 'Semi-Pro', minXp: 900 },
  { title: 'Professional', minXp: 2000 },
  { title: 'All-Star', minXp: 4000 },
  { title: 'Legend', minXp: 7500 },
];

const MODE_DURATION: Record<string, number | null> = {
  classic: null,
  timed_60: 60,
  timed_90: 90,
  three_point: 75,
  moving_hoop: 75,
  consecutive: null,
  daily: 60,
};

const MODE_XP_MULT: Record<string, number> = {
  classic: 1.0,
  timed_60: 1.25,
  timed_90: 1.4,
  three_point: 1.5,
  moving_hoop: 1.6,
  consecutive: 1.5,
  daily: 1.8,
};

const ACHIEVEMENT_REWARDS: Record<string, { xp: number; itemId?: string }> = {
  first_basket: { xp: 75, itemId: 'ball_neon_emerald' },
  sharpshooter: { xp: 250, itemId: 'effect_neon_pulse' },
  hot_streak: { xp: 220, itemId: 'hoop_neon_cyber' },
  three_point_king: { xp: 280, itemId: 'net_neon_mesh' },
  time_master: { xp: 320, itemId: 'court_indoor_arena' },
  court_legend: { xp: 400, itemId: 'ball_championship_gold' },
  daily_champion: { xp: 500, itemId: 'effect_starburst_gold' },
  swish_machine: { xp: 200, itemId: 'ball_electric_purple' },
};

const LEVEL_ITEM_UNLOCKS: Record<string, string[]> = {
  Amateur: ['ball_arc_blue', 'court_outdoor_court', 'hoop_street_steel', 'avatar_neon_cyber'],
  'Semi-Pro': ['ball_eswatini_pride', 'net_street_chain', 'effect_violet_comet'],
  Professional: ['hoop_gold_championship', 'avatar_court_architect'],
  'All-Star': ['net_gold_weave'],
  Legend: ['avatar_gold_mvp'],
};

function computeLevelTitle(xp: number): string {
  let title = 'Rookie';
  for (const row of LEVEL_THRESHOLDS) {
    if (xp >= row.minXp) title = row.title;
  }
  return title;
}

const STORE_FILE = path.resolve('/tmp', 'gameverse_hoops_store.json');
const activeSessions = new Map<string, ActiveSession>();

function getTodayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function createInitialStore(): StoreData {
  const nowIso = new Date().toISOString();
  const today = getTodayUtc();

  const seedScores: StoredScoreEntry[] = [
    {
      id: 'seed-1',
      gameverseId: 'GV-SZ-1042',
      username: 'SihleSwish',
      avatarId: 'mbabane_flash',
      countryCode: 'SZ',
      countryName: 'Eswatini',
      region: 'eswatini',
      mode: 'timed_60',
      score: 94,
      accuracy: 88.2,
      longestStreak: 14,
      level: 'All-Star',
      dailySeed: today,
      createdAt: nowIso,
    },
    {
      id: 'seed-2',
      gameverseId: 'GV-SZ-2088',
      username: 'MbabaneAce',
      avatarId: 'ace_striker',
      countryCode: 'SZ',
      countryName: 'Eswatini',
      region: 'eswatini',
      mode: 'daily',
      score: 86,
      accuracy: 84.6,
      longestStreak: 11,
      level: 'Professional',
      dailySeed: today,
      createdAt: nowIso,
    },
    {
      id: 'seed-3',
      gameverseId: 'GV-ZA-4410',
      username: 'JoziBuckets',
      avatarId: 'neon_cyber',
      countryCode: 'ZA',
      countryName: 'South Africa',
      region: 'southern_africa',
      mode: 'timed_90',
      score: 118,
      accuracy: 85.4,
      longestStreak: 16,
      level: 'Legend',
      dailySeed: today,
      createdAt: nowIso,
    },
    {
      id: 'seed-4',
      gameverseId: 'GV-BW-3301',
      username: 'GabsSniper',
      avatarId: 'court_architect',
      countryCode: 'BW',
      countryName: 'Botswana',
      region: 'southern_africa',
      mode: 'three_point',
      score: 81,
      accuracy: 81.0,
      longestStreak: 9,
      level: 'Professional',
      dailySeed: today,
      createdAt: nowIso,
    },
    {
      id: 'seed-5',
      gameverseId: 'GV-SZ-5190',
      username: 'EzulwiniRim',
      avatarId: 'mbabane_flash',
      countryCode: 'SZ',
      countryName: 'Eswatini',
      region: 'eswatini',
      mode: 'moving_hoop',
      score: 74,
      accuracy: 79.3,
      longestStreak: 8,
      level: 'Semi-Pro',
      createdAt: nowIso,
    },
    {
      id: 'seed-6',
      gameverseId: 'GV-US-9012',
      username: 'ArcMaster99',
      avatarId: 'gold_mvp',
      countryCode: 'US',
      countryName: 'United States',
      region: 'international',
      mode: 'timed_90',
      score: 124,
      accuracy: 91.5,
      longestStreak: 18,
      level: 'Legend',
      dailySeed: today,
      createdAt: nowIso,
    },
    {
      id: 'seed-7',
      gameverseId: 'GV-GB-7720',
      username: 'LondonThree',
      avatarId: 'neon_cyber',
      countryCode: 'GB',
      countryName: 'United Kingdom',
      region: 'international',
      mode: 'three_point',
      score: 78,
      accuracy: 82.1,
      longestStreak: 10,
      level: 'All-Star',
      createdAt: nowIso,
    },
  ];

  const tournaments: StoredTournament[] = [
    {
      id: 'tourn-mbabane-open',
      title: 'Mbabane Hoops Open',
      subtitle: '60-Second Blitz Championship · Eswatini & SADC Showcase',
      mode: 'timed_60',
      status: 'active',
      scheduleLabel: 'Live Weekly Qualifier',
      endsAt: new Date(Date.now() + 4 * 86400000).toISOString(),
      prizeDescription: 'Champion Badge + 1,500 XP + Championship Gold Rim',
      sponsorName: 'Gameverse Arena Series',
      sponsorTagline: 'Powered by Gameverse Southern Africa',
      participantsCount: 142,
      registeredIds: [],
      entries: [
        { gameverseId: 'GV-SZ-1042', username: 'SihleSwish', countryCode: 'SZ', score: 94, accuracy: 88.2 },
        { gameverseId: 'GV-ZA-4410', username: 'JoziBuckets', countryCode: 'ZA', score: 89, accuracy: 84.0 },
        { gameverseId: 'GV-SZ-2088', username: 'MbabaneAce', countryCode: 'SZ', score: 82, accuracy: 81.5 },
        { gameverseId: 'GV-BW-3301', username: 'GabsSniper', countryCode: 'BW', score: 75, accuracy: 78.2 },
      ],
    },
    {
      id: 'tourn-sadc-three',
      title: 'Southern Africa 3-Point Classic',
      subtitle: '5-Rack Perimeter Shootout · Verified Shot Telemetry',
      mode: 'three_point',
      status: 'active',
      scheduleLabel: 'Daily Sponsored Cup',
      endsAt: new Date(Date.now() + 2 * 86400000).toISOString(),
      prizeDescription: 'Three-Point Crown + 1,200 XP + Neon Pulse Net',
      sponsorName: 'Royal Swazi Tech Cup',
      sponsorTagline: 'Official Regional Community Challenge',
      participantsCount: 98,
      registeredIds: [],
      entries: [
        { gameverseId: 'GV-BW-3301', username: 'GabsSniper', countryCode: 'BW', score: 81, accuracy: 81.0 },
        { gameverseId: 'GV-GB-7720', username: 'LondonThree', countryCode: 'GB', score: 78, accuracy: 82.1 },
        { gameverseId: 'GV-SZ-5190', username: 'EzulwiniRim', countryCode: 'SZ', score: 69, accuracy: 76.4 },
      ],
    },
    {
      id: 'tourn-neon-pro',
      title: 'Gameverse Neon Invitational',
      subtitle: '90-Second Progressive Pro Ladder',
      mode: 'timed_90',
      status: 'scheduled',
      scheduleLabel: 'Starts Next Weekend',
      endsAt: new Date(Date.now() + 10 * 86400000).toISOString(),
      prizeDescription: 'Hall of Fame Banner + 2,500 XP',
      sponsorName: 'Gameverse Pro Circuit',
      sponsorTagline: 'Zero-Entry Fee Competitive Ladder',
      participantsCount: 64,
      registeredIds: [],
      entries: [],
    },
    {
      id: 'tourn-past-launch',
      title: 'Inaugural Ezulwini Night Cup',
      subtitle: 'Moving Hoop Endurance Bracket',
      mode: 'moving_hoop',
      status: 'completed',
      scheduleLabel: 'Completed Last Week',
      endsAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      prizeDescription: 'Founders Trophy + 1,000 XP',
      sponsorName: 'Gameverse Founders',
      participantsCount: 215,
      registeredIds: [],
      entries: [
        { gameverseId: 'GV-US-9012', username: 'ArcMaster99', countryCode: 'US', score: 102, accuracy: 89.4 },
        { gameverseId: 'GV-SZ-1042', username: 'SihleSwish', countryCode: 'SZ', score: 96, accuracy: 86.1 },
      ],
      winner: {
        username: 'ArcMaster99',
        countryCode: 'US',
        score: 102,
      },
    },
  ];

  return {
    profiles: {},
    scores: seedScores,
    tournaments,
  };
}

function loadStore(): StoreData {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as StoreData;
      if (parsed && Array.isArray(parsed.scores) && Array.isArray(parsed.tournaments)) {
        return parsed;
      }
    }
  } catch {
    // Fall back to fresh store
  }
  const initial = createInitialStore();
  saveStore(initial);
  return initial;
}

function saveStore(store: StoreData): void {
  try {
    fs.writeFileSync(STORE_FILE, JSON.stringify(store), 'utf-8');
  } catch {
    // Non-fatal in read-only environments
  }
}

function createDefaultProfile(gameverseId: string, username = 'SwaziHooper'): StoredProfile {
  const now = new Date().toISOString();
  return {
    gameverseId,
    username,
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

function sanitizeString(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return input.trim().replace(/[<>]/g, '').slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '512kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'gameverse-hoops', timestamp: new Date().toISOString() });
  });

  // Sync or retrieve Gameverse player profile
  app.post('/api/profile/sync', (req: Request, res: Response) => {
    const store = loadStore();
    const body = req.body as Partial<StoredProfile>;
    const gvId = sanitizeString(body.gameverseId, 40) || `GV-SZ-${crypto.randomInt(1000, 9999)}`;

    let existing = store.profiles[gvId];
    if (!existing) {
      existing = createDefaultProfile(gvId, sanitizeString(body.username, 24) || 'SwaziHooper');
    }

    if (typeof body.username === 'string' && sanitizeString(body.username, 24).length >= 2) {
      existing.username = sanitizeString(body.username, 24);
    }
    if (typeof body.countryCode === 'string' && body.countryCode.length === 2) {
      existing.countryCode = body.countryCode.toUpperCase();
    }
    if (typeof body.countryName === 'string' && body.countryName.length > 0) {
      existing.countryName = sanitizeString(body.countryName, 40);
    }
    if (body.region === 'eswatini' || body.region === 'southern_africa' || body.region === 'international') {
      existing.region = body.region;
    }
    if (body.equipped && typeof body.equipped === 'object') {
      for (const [k, v] of Object.entries(body.equipped)) {
        if (typeof v === 'string') {
          existing.equipped[k] = sanitizeString(v, 48);
        }
      }
    }
    if (Array.isArray(body.friends)) {
      existing.friends = body.friends
        .filter((f): f is string => typeof f === 'string')
        .map((f) => sanitizeString(f, 40))
        .slice(0, 50);
    }

    existing.updatedAt = new Date().toISOString();
    store.profiles[gvId] = existing;
    saveStore(store);

    res.json({ profile: existing });
  });

  // Issue anti-cheat match session token
  app.post('/api/session/start', (req: Request, res: Response) => {
    const body = req.body as { gameverseId?: string; mode?: string };
    const gameverseId = sanitizeString(body.gameverseId, 40);
    const mode = sanitizeString(body.mode, 32);

    if (!gameverseId || !(mode in MODE_DURATION)) {
      res.status(400).json({ error: 'Invalid session parameters' });
      return;
    }

    const token = crypto.randomBytes(24).toString('hex');
    activeSessions.set(token, {
      token,
      gameverseId,
      mode,
      startedAtMs: Date.now(),
      used: false,
    });

    // Garbage-collect stale sessions older than 2 hours
    const cutoff = Date.now() - 2 * 3600 * 1000;
    for (const [k, s] of activeSessions.entries()) {
      if (s.startedAtMs < cutoff) activeSessions.delete(k);
    }

    res.json({ sessionToken: token, serverTimeMs: Date.now() });
  });

  // Server-side score validation & anti-cheat verification
  app.post('/api/scores/validate', (req: Request, res: Response) => {
    const store = loadStore();
    const payload = req.body as {
      sessionToken?: string;
      gameverseId?: string;
      mode?: string;
      score?: number;
      baskets?: number;
      attempts?: number;
      misses?: number;
      maxStreak?: number;
      swishes?: number;
      threePointers?: number;
      durationMs?: number;
      dailySeed?: string;
      tournamentId?: string;
      shots?: Array<{
        timestampOffsetMs: number;
        power: number;
        angleDeg: number;
        scored: boolean;
        points: number;
        swish: boolean;
        bankShot: boolean;
        bonusHit: boolean;
        threePointer: boolean;
      }>;
    };

    const sessionToken = sanitizeString(payload.sessionToken, 80);
    const gameverseId = sanitizeString(payload.gameverseId, 40);
    const mode = sanitizeString(payload.mode, 32);

    if (!gameverseId || !(mode in MODE_DURATION) || !Array.isArray(payload.shots)) {
      res.status(400).json({ error: 'Malformed match telemetry' });
      return;
    }

    const session = activeSessions.get(sessionToken);
    let validationNote = 'Verified via Gameverse Shot Telemetry';

    if (session) {
      if (session.used || session.gameverseId !== gameverseId || session.mode !== mode) {
        res.status(403).json({ error: 'Session token mismatch or replay detected' });
        return;
      }
      session.used = true;
    } else {
      validationNote = 'Verified (stateless telemetry check)';
    }

    // Recompute totals strictly from individual shot telemetry
    const shots = payload.shots.slice(0, 250);
    let recomputedScore = 0;
    let recomputedBaskets = 0;
    let recomputedSwishes = 0;
    let recomputedThrees = 0;
    let lastTs = -500;

    for (const s of shots) {
      if (typeof s.timestampOffsetMs !== 'number' || s.timestampOffsetMs - lastTs < 280) {
        res.status(422).json({ error: 'Shot cadence failed anti-cheat check' });
        return;
      }
      lastTs = s.timestampOffsetMs;

      const pts = Number(s.points) || 0;
      if (pts < 0 || pts > 11) {
        res.status(422).json({ error: 'Per-shot points out of valid range' });
        return;
      }
      if (s.scored) {
        recomputedBaskets++;
        recomputedScore += pts;
        if (s.swish) recomputedSwishes++;
        if (s.threePointer) recomputedThrees++;
      }
    }

    const attempts = shots.length;
    const reportedScore = Number(payload.score) || 0;
    if (Math.abs(reportedScore - recomputedScore) > 0) {
      res.status(422).json({ error: 'Score checksum mismatch against shot telemetry' });
      return;
    }

    // Ensure profile exists
    const profile = store.profiles[gameverseId] ?? createDefaultProfile(gameverseId);
    const prevLevel = profile.level;

    // Update career stats
    profile.stats.matchesPlayed += 1;
    profile.stats.basketsScored += recomputedBaskets;
    profile.stats.totalAttempts += attempts;
    profile.stats.totalPoints += recomputedScore;
    profile.stats.threePointersMade += recomputedThrees;
    profile.stats.swishesMade += recomputedSwishes;
    if (recomputedScore > profile.stats.highestScore) {
      profile.stats.highestScore = recomputedScore;
    }
    const maxStreak = Math.min(attempts, Math.max(0, Number(payload.maxStreak) || 0));
    if (maxStreak > profile.stats.longestStreak) {
      profile.stats.longestStreak = maxStreak;
    }
    profile.stats.modeHighScores[mode] = Math.max(
      profile.stats.modeHighScores[mode] ?? 0,
      recomputedScore,
    );

    const accuracy = attempts > 0 ? Number(((recomputedBaskets / attempts) * 100).toFixed(1)) : 0;

    // Check achievements
    const newlyUnlockedAchievements: string[] = [];
    const newlyUnlockedCosmetics: string[] = [];
    const unlockAch = (id: string) => {
      if (!profile.achievements.includes(id)) {
        profile.achievements.push(id);
        newlyUnlockedAchievements.push(id);
        const reward = ACHIEVEMENT_REWARDS[id];
        if (reward?.itemId && !profile.unlockedItems.includes(reward.itemId)) {
          profile.unlockedItems.push(reward.itemId);
          newlyUnlockedCosmetics.push(reward.itemId);
        }
      }
    };

    if (profile.stats.basketsScored >= 1) unlockAch('first_basket');
    if (attempts >= 10 && accuracy >= 90) unlockAch('sharpshooter');
    if (maxStreak >= 10) unlockAch('hot_streak');
    if (profile.stats.threePointersMade >= 20) unlockAch('three_point_king');
    if (MODE_DURATION[mode] !== null && recomputedBaskets >= 30) unlockAch('time_master');
    if (recomputedScore >= 100) unlockAch('court_legend');
    if (profile.stats.swishesMade >= 15) unlockAch('swish_machine');

    // Record leaderboard entry if attempts > 0
    let dailyRank: number | undefined;
    if (attempts > 0 && recomputedScore > 0) {
      const entry: StoredScoreEntry = {
        id: `sc-${Date.now()}-${crypto.randomInt(100, 999)}`,
        gameverseId: profile.gameverseId,
        username: profile.username,
        avatarId: profile.equipped.avatarId ?? 'ace_striker',
        countryCode: profile.countryCode,
        countryName: profile.countryName,
        region: profile.region,
        mode,
        score: recomputedScore,
        accuracy,
        longestStreak: maxStreak,
        level: profile.level,
        dailySeed: mode === 'daily' ? sanitizeString(payload.dailySeed, 16) || getTodayUtc() : undefined,
        createdAt: new Date().toISOString(),
      };
      store.scores.push(entry);

      if (mode === 'daily') {
        const today = entry.dailySeed ?? getTodayUtc();
        const dailyBoard = store.scores
          .filter((s) => s.mode === 'daily' && s.dailySeed === today)
          .sort((a, b) => b.score - a.score);
        dailyRank = dailyBoard.findIndex((s) => s.id === entry.id) + 1;
        if (dailyRank === 1) {
          unlockAch('daily_champion');
        }
      }
    }

    // Award XP
    const baseXp = 25 + recomputedBaskets * 6 + recomputedSwishes * 3 + Math.round(recomputedScore * 0.5);
    const achXp = newlyUnlockedAchievements.reduce(
      (sum, id) => sum + (ACHIEVEMENT_REWARDS[id]?.xp ?? 0),
      0,
    );
    const xpEarned = Math.round(baseXp * (MODE_XP_MULT[mode] ?? 1)) + achXp;
    profile.xp += xpEarned;
    profile.level = computeLevelTitle(profile.xp);

    // Unlock level cosmetics
    for (const row of LEVEL_THRESHOLDS) {
      if (profile.xp >= row.minXp && LEVEL_ITEM_UNLOCKS[row.title]) {
        for (const itemId of LEVEL_ITEM_UNLOCKS[row.title]) {
          if (!profile.unlockedItems.includes(itemId)) {
            profile.unlockedItems.push(itemId);
            newlyUnlockedCosmetics.push(itemId);
          }
        }
      }
    }

    // Update active tournament if entered or matching registered tournament
    const targetTournId = sanitizeString(payload.tournamentId, 60);
    for (const t of store.tournaments) {
      const isMatch =
        t.status === 'active' &&
        (t.id === targetTournId || (t.registeredIds.includes(profile.gameverseId) && t.mode === mode));
      if (isMatch && recomputedScore > 0) {
        const existingEntry = t.entries.find((e) => e.gameverseId === profile.gameverseId);
        if (existingEntry) {
          if (recomputedScore > existingEntry.score) {
            existingEntry.score = recomputedScore;
            existingEntry.accuracy = accuracy;
          }
        } else {
          t.entries.push({
            gameverseId: profile.gameverseId,
            username: profile.username,
            countryCode: profile.countryCode,
            score: recomputedScore,
            accuracy,
          });
        }
        t.entries.sort((a, b) => b.score - a.score);
      }
    }

    profile.updatedAt = new Date().toISOString();
    store.profiles[profile.gameverseId] = profile;
    saveStore(store);

    res.json({
      validated: true,
      validationNote,
      xpEarned,
      newXp: profile.xp,
      newLevel: profile.level,
      leveledUp: profile.level !== prevLevel,
      unlockedAchievements: newlyUnlockedAchievements,
      unlockedCosmetics: newlyUnlockedCosmetics,
      dailyRank,
      profile,
    });
  });

  // Leaderboards query (region: global | eswatini | southern_africa | friends, period: daily | weekly | all_time)
  app.get('/api/leaderboards', (req: Request, res: Response) => {
    const store = loadStore();
    const region = sanitizeString(req.query.region, 24) || 'global';
    const period = sanitizeString(req.query.period, 24) || 'all_time';
    const modeFilter = sanitizeString(req.query.mode, 24) || 'all';
    const viewerId = sanitizeString(req.query.gameverseId, 40);

    const now = Date.now();
    const today = getTodayUtc();
    const viewerProfile = viewerId ? store.profiles[viewerId] : undefined;
    const friendSet = new Set(viewerProfile?.friends ?? ['GV-SZ-1042', 'GV-ZA-4410']);
    if (viewerId) friendSet.add(viewerId);

    const filtered = store.scores.filter((entry) => {
      if (modeFilter !== 'all' && entry.mode !== modeFilter) return false;
      if (region === 'eswatini' && entry.countryCode !== 'SZ') return false;
      if (
        region === 'southern_africa' &&
        entry.region !== 'southern_africa' &&
        entry.region !== 'eswatini'
      ) {
        return false;
      }
      if (region === 'friends' && !friendSet.has(entry.gameverseId)) return false;

      if (period === 'daily') {
        const isToday = entry.dailySeed === today || entry.createdAt.slice(0, 10) === today;
        if (!isToday) return false;
      } else if (period === 'weekly') {
        const ageMs = now - new Date(entry.createdAt).getTime();
        if (ageMs > 7 * 86400000) return false;
      }
      return true;
    });

    // Deduplicate best score per player for cleaner competitive rankings
    const bestByPlayer = new Map<string, StoredScoreEntry>();
    for (const item of filtered) {
      const prev = bestByPlayer.get(item.gameverseId);
      if (!prev || item.score > prev.score) {
        bestByPlayer.set(item.gameverseId, item);
      }
    }

    const sorted = Array.from(bestByPlayer.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((item, idx) => ({
        rank: idx + 1,
        gameverseId: item.gameverseId,
        username: item.username,
        avatarId: item.avatarId,
        countryCode: item.countryCode,
        countryName: item.countryName,
        region: item.region,
        mode: item.mode,
        score: item.score,
        accuracy: item.accuracy,
        longestStreak: item.longestStreak,
        level: item.level,
        period,
        updatedAt: item.createdAt,
      }));

    // Daily Challenge Winner summary
    const dailyTop = store.scores
      .filter((s) => s.mode === 'daily' && (s.dailySeed === today || s.createdAt.slice(0, 10) === today))
      .sort((a, b) => b.score - a.score)[0];

    res.json({
      entries: sorted,
      dailyWinner: dailyTop
        ? {
            username: dailyTop.username,
            countryCode: dailyTop.countryCode,
            score: dailyTop.score,
            accuracy: dailyTop.accuracy,
          }
        : null,
    });
  });

  // Tournaments list & registration
  app.get('/api/tournaments', (req: Request, res: Response) => {
    const store = loadStore();
    const viewerId = sanitizeString(req.query.gameverseId, 40);

    const list = store.tournaments.map((t) => ({
      id: t.id,
      title: t.title,
      subtitle: t.subtitle,
      mode: t.mode,
      status: t.status,
      scheduleLabel: t.scheduleLabel,
      endsAt: t.endsAt,
      prizeDescription: t.prizeDescription,
      sponsorName: t.sponsorName,
      sponsorTagline: t.sponsorTagline,
      participantsCount: t.participantsCount,
      registered: viewerId ? t.registeredIds.includes(viewerId) : false,
      entries: t.entries
        .slice()
        .sort((a, b) => b.score - a.score)
        .map((e, i) => ({ rank: i + 1, ...e })),
      winner: t.winner,
    }));

    res.json({ tournaments: list });
  });

  app.post('/api/tournaments/register', (req: Request, res: Response) => {
    const store = loadStore();
    const body = req.body as { tournamentId?: string; gameverseId?: string };
    const tournamentId = sanitizeString(body.tournamentId, 60);
    const gameverseId = sanitizeString(body.gameverseId, 40);

    const tourn = store.tournaments.find((t) => t.id === tournamentId);
    if (!tourn || !gameverseId) {
      res.status(404).json({ error: 'Tournament not found' });
      return;
    }
    if (tourn.status === 'completed') {
      res.status(400).json({ error: 'Tournament already completed' });
      return;
    }

    if (!tourn.registeredIds.includes(gameverseId)) {
      tourn.registeredIds.push(gameverseId);
      tourn.participantsCount += 1;
      saveStore(store);
    }

    res.json({ registered: true, participantsCount: tourn.participantsCount });
  });

  // Mount Vite middleware in dev, or serve static dist in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Gameverse Basketball Hoops running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start Gameverse server:', err);
  process.exit(1);
});
