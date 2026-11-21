import type { GameModeId } from '../types/game';
import type { BonusTarget } from './physics';

export interface ShootingSpot {
  label: string;
  x: number;
  y: number;
  isThreePoint: boolean;
}

export const THREE_POINT_SPOTS: ShootingSpot[] = [
  { label: 'Left Corner 3', x: 190, y: 500, isThreePoint: true },
  { label: 'Left Wing 3', x: 255, y: 468, isThreePoint: true },
  { label: 'Top of Key 3', x: 325, y: 448, isThreePoint: true },
  { label: 'Deep Wing 3', x: 220, y: 486, isThreePoint: true },
  { label: 'Deep Corner 3', x: 165, y: 512, isThreePoint: true },
];

export const CLASSIC_SPOTS: ShootingSpot[] = [
  { label: 'Free Throw', x: 430, y: 492, isThreePoint: false },
  { label: 'Mid-Range Wing', x: 350, y: 486, isThreePoint: false },
  { label: 'Arc Perimeter', x: 270, y: 495, isThreePoint: true },
  { label: 'Deep Range', x: 195, y: 504, isThreePoint: true },
];

export function getTodayUtcDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// Mulberry32 deterministic PRNG for identical Daily Challenge conditions worldwide
export function createSeededRng(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DailyConditions {
  dateKey: string;
  windAccelX: number;
  hoopBaseY: number;
  movingSpeedOffset: number;
  spotOrder: ShootingSpot[];
  label: string;
}

export function getDailyConditions(dateKey = getTodayUtcDateKey()): DailyConditions {
  const rng = createSeededRng(`gameverse-hoops-${dateKey}`);
  const windDir = rng() > 0.5 ? 1 : -1;
  const windMag = Math.round(rng() * 48); // subtle cross-breeze up to 48 u/s^2
  const hoopBaseY = 250 + Math.round(rng() * 52);
  const movingSpeedOffset = rng() * Math.PI * 2;

  const pool = [...THREE_POINT_SPOTS, ...CLASSIC_SPOTS];
  const spotOrder: ShootingSpot[] = [];
  for (let i = 0; i < 6; i++) {
    const idx = Math.floor(rng() * pool.length);
    spotOrder.push(pool[idx]);
  }

  return {
    dateKey,
    windAccelX: windDir * windMag,
    hoopBaseY,
    movingSpeedOffset,
    spotOrder,
    label: windMag > 18 ? `${windDir > 0 ? 'Tailwind' : 'Headwind'} · Daily Seed` : 'Calm Arena · Daily Seed',
  };
}

export function pickNextSpot(
  mode: GameModeId,
  shotIndex: number,
  streak: number,
  daily?: DailyConditions,
): ShootingSpot {
  if (mode === 'three_point') {
    const rackIndex = Math.floor(shotIndex / 5) % THREE_POINT_SPOTS.length;
    return THREE_POINT_SPOTS[rackIndex];
  }

  if (mode === 'daily' && daily) {
    return daily.spotOrder[shotIndex % daily.spotOrder.length];
  }

  if (mode === 'timed_60') {
    if (streak >= 5) {
      return { label: 'Three-Point Arc', x: 255, y: 492, isThreePoint: true };
    }
    return { label: 'Arcade Spot', x: 345, y: 492, isThreePoint: false };
  }

  if (mode === 'timed_90') {
    // Progressive difficulty shifts further back as shots & streaks climb
    if (shotIndex < 4) return CLASSIC_SPOTS[0];
    if (shotIndex < 9) return CLASSIC_SPOTS[1];
    if (shotIndex < 15) return CLASSIC_SPOTS[2];
    return CLASSIC_SPOTS[3];
  }

  if (mode === 'moving_hoop') {
    return streak >= 4
      ? { label: 'Deep Moving Rim', x: 245, y: 492, isThreePoint: true }
      : { label: 'Mid Moving Rim', x: 345, y: 492, isThreePoint: false };
  }

  if (mode === 'consecutive') {
    const idx = Math.min(CLASSIC_SPOTS.length - 1, Math.floor(streak / 3));
    return CLASSIC_SPOTS[idx];
  }

  // Classic shooting mode cycles smoothly every 3 makes or stays comfortable
  const idx = Math.min(CLASSIC_SPOTS.length - 1, Math.floor(streak / 3));
  return CLASSIC_SPOTS[idx];
}

export function maybeSpawnBonusTarget(
  mode: GameModeId,
  shotIndex: number,
  hoopX: number,
  hoopY: number,
  rng: () => number,
): BonusTarget {
  const canSpawn =
    mode === 'timed_60' || mode === 'timed_90' || mode === 'moving_hoop' || mode === 'daily';
  if (!canSpawn || shotIndex < 2 || shotIndex % 3 !== 0) {
    return { active: false, x: 0, y: 0, radius: 24, pulse: 0, points: 2 };
  }

  const x = hoopX - 180 - rng() * 140;
  const y = hoopY - 95 - rng() * 65;
  return {
    active: true,
    x,
    y,
    radius: 25,
    pulse: 0,
    points: 2,
  };
}
