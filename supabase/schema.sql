-- Gameverse Basketball Hoops — Supabase PostgreSQL Schema & Row-Level Security
-- Run this SQL in your Supabase SQL Editor when enabling cloud Supabase persistence.

create table if not exists public.gameverse_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  gameverse_id text unique not null,
  username text not null check (char_length(username) between 2 and 24),
  avatar_id text not null default 'ace_striker',
  country_code text not null default 'SZ',
  country_name text not null default 'Eswatini',
  region text not null default 'eswatini' check (region in ('eswatini', 'southern_africa', 'international')),
  xp integer not null default 0 check (xp >= 0),
  level text not null default 'Rookie',
  stats jsonb not null default '{}'::jsonb,
  equipped jsonb not null default '{}'::jsonb,
  unlocked_items text[] not null default array['ball_classic_leather','court_neon_arena','court_street_court','hoop_pro_glass','net_classic_nylon','effect_clean_arc','avatar_ace_striker','avatar_mbabane_flash'],
  achievements text[] not null default array[]::text[],
  friends text[] not null default array[]::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hoops_match_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.gameverse_profiles(id) on delete cascade,
  gameverse_id text not null,
  mode text not null check (mode in ('classic', 'timed_60', 'timed_90', 'three_point', 'moving_hoop', 'consecutive', 'daily')),
  score integer not null check (score >= 0 and score <= 500),
  baskets integer not null check (baskets >= 0),
  attempts integer not null check (attempts >= 0),
  accuracy numeric(5,2) not null check (accuracy >= 0 and accuracy <= 100),
  longest_streak integer not null check (longest_streak >= 0),
  duration_ms integer not null check (duration_ms >= 0),
  daily_seed text,
  tournament_id text,
  validated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.hoops_tournament_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id text not null,
  user_id uuid references public.gameverse_profiles(id) on delete cascade,
  gameverse_id text not null,
  best_score integer not null default 0,
  accuracy numeric(5,2) not null default 0,
  registered_at timestamptz not null default now(),
  unique (tournament_id, gameverse_id)
);

-- Enable Row Level Security
alter table public.gameverse_profiles enable row level security;
alter table public.hoops_match_scores enable row level security;
alter table public.hoops_tournament_entries enable row level security;

-- Profiles: public read for leaderboards, self-only insert/update
create policy "Public read profiles" on public.gameverse_profiles
  for select using (true);

create policy "Users insert own profile" on public.gameverse_profiles
  for insert with check (auth.uid() = id);

create policy "Users update own profile" on public.gameverse_profiles
  for update using (auth.uid() = id);

-- Scores: public read, server-validated inserts via Edge Function / Service Role
create policy "Public read scores" on public.hoops_match_scores
  for select using (validated = true);

-- Tournaments: public read, authenticated registration
create policy "Public read tournament entries" on public.hoops_tournament_entries
  for select using (true);

create policy "Users register own tournament entry" on public.hoops_tournament_entries
  for insert with check (auth.uid() = user_id);
