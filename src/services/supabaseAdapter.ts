// Optional Supabase Integration Adapter
// Automatically activates when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured.
// Otherwise, Gameverse seamlessly persists via the built-in Express API + local storage.

import type { PlayerProfile } from '../types/game';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && SUPABASE_URL.startsWith('https://'));
}

export function getBackendStatusSummary(): {
  mode: 'supabase' | 'local_express';
  label: string;
  details: string;
} {
  if (isSupabaseConfigured()) {
    return {
      mode: 'supabase',
      label: 'Supabase Cloud Connected',
      details: 'Gameverse authentication, profile persistence, and PostgreSQL leaderboards are routed to your Supabase project.',
    };
  }
  return {
    mode: 'local_express',
    label: 'Local Gameverse Server Mode',
    details:
      'Running with built-in Express server-side score validation and local profile persistence. Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to switch to cloud Supabase.',
  };
}

export async function syncProfileToSupabase(profile: PlayerProfile): Promise<boolean> {
  if (!isSupabaseConfigured() || !SUPABASE_URL || !SUPABASE_ANON_KEY) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/gameverse_profiles?on_conflict=gameverse_id`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        gameverse_id: profile.gameverseId,
        username: profile.username,
        avatar_id: profile.equipped.avatarId,
        country_code: profile.countryCode,
        country_name: profile.countryName,
        region: profile.region,
        xp: profile.xp,
        level: profile.level,
        stats: profile.stats,
        equipped: profile.equipped,
        unlocked_items: profile.unlockedItems,
        achievements: profile.achievements,
        friends: profile.friends,
        updated_at: new Date().toISOString(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
