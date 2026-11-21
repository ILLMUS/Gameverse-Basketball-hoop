import { Award, CheckCircle2, Plus, Trash2, User, X } from 'lucide-react';
import { useState } from 'react';
import { ACHIEVEMENTS, COUNTRIES, getLevelForXp, LEVEL_THRESHOLDS } from '../data/catalog';
import { switchCountryOnProfile } from '../services/gameverseApi';
import type { PlayerProfile } from '../types/game';
import { AvatarBadge } from './GameverseLogo';

interface ProfileModalProps {
  profile: PlayerProfile;
  onSaveProfile: (updated: PlayerProfile) => void;
  onClose: () => void;
}

export function ProfileModal({ profile, onSaveProfile, onClose }: ProfileModalProps) {
  const [username, setUsername] = useState(profile.username);
  const [countryCode, setCountryCode] = useState(profile.countryCode);
  const [friendInput, setFriendInput] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const levelInfo = getLevelForXp(profile.xp);
  const careerAccuracy =
    profile.stats.totalAttempts > 0
      ? ((profile.stats.basketsScored / profile.stats.totalAttempts) * 100).toFixed(1)
      : '0.0';

  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = username.trim().slice(0, 24);
    if (cleanName.length < 2) return;
    let next = switchCountryOnProfile(profile, countryCode);
    next = { ...next, username: cleanName };
    onSaveProfile(next);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const handleAddFriend = () => {
    const clean = friendInput.trim().toUpperCase().slice(0, 32);
    if (!clean || profile.friends.includes(clean)) return;
    onSaveProfile({ ...profile, friends: [...profile.friends, clean] });
    setFriendInput('');
  };

  const handleRemoveFriend = (id: string) => {
    onSaveProfile({
      ...profile,
      friends: profile.friends.filter((f) => f !== id),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0D1320] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="font-display text-2xl font-bold text-white">Gameverse Player Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto gv-scroll p-5 space-y-6">
          {/* Identity & Gameverse Account Integration */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
            <form
              onSubmit={handleSaveIdentity}
              className="md:col-span-7 rounded-xl bg-slate-900/75 border border-slate-800 p-4 space-y-4"
            >
              <div className="flex items-center gap-3.5">
                <AvatarBadge
                  avatarId={profile.equipped.avatarId}
                  username={profile.username}
                  size="lg"
                />
                <div>
                  <div className="text-xs text-slate-400">Gameverse Player ID</div>
                  <div className="font-mono-tabular text-sm font-bold text-emerald-400">
                    {profile.gameverseId}
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    {levelInfo.title} · {profile.xp} XP
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Display Handle</span>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    minLength={2}
                    maxLength={24}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-medium text-slate-300">Country / Region</span>
                  <select
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-slate-400">
                  Shared across all Gameverse titles & leaderboards.
                </span>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
                >
                  {savedNotice ? 'Saved' : 'Update Profile'}
                </button>
              </div>
            </form>

            {/* Tier Progression Ladder */}
            <div className="md:col-span-5 rounded-xl bg-slate-900/75 border border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">Career Level Progression</span>
                <span className="font-mono-tabular text-sky-400">
                  {levelInfo.nextMinXp ? `${profile.xp} / ${levelInfo.nextMinXp} XP` : 'Max Tier'}
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 via-sky-400 to-violet-500"
                  style={{ width: `${levelInfo.progressPct}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {LEVEL_THRESHOLDS.map((lvl) => {
                  const reached = profile.xp >= lvl.minXp;
                  return (
                    <div
                      key={lvl.title}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] ${
                        reached
                          ? 'bg-slate-800/80 border-slate-700 text-white'
                          : 'bg-slate-950/50 border-slate-800/50 text-slate-500'
                      }`}
                    >
                      <div className="font-semibold truncate">{lvl.title}</div>
                      <div className="font-mono-tabular text-[10px] opacity-80">{lvl.minXp} XP</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Career Statistics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Matches', val: profile.stats.matchesPlayed },
              { label: 'Baskets', val: profile.stats.basketsScored },
              { label: 'Total Points', val: profile.stats.totalPoints },
              { label: 'Accuracy', val: `${careerAccuracy}%` },
              { label: 'High Score', val: profile.stats.highestScore },
              { label: 'Best Streak', val: `${profile.stats.longestStreak}x` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-slate-900/75 border border-slate-800 p-3.5"
              >
                <div className="text-xs text-slate-400">{stat.label}</div>
                <div className="font-mono-tabular text-xl font-bold text-white mt-0.5">
                  {stat.val}
                </div>
              </div>
            ))}
          </div>

          {/* Achievements */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Achievements</span>
              </h3>
              <span className="font-mono-tabular text-xs text-slate-400">
                {profile.achievements.length} / {ACHIEVEMENTS.length} Unlocked
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {ACHIEVEMENTS.map((ach) => {
                const unlocked = profile.achievements.includes(ach.id);
                return (
                  <div
                    key={ach.id}
                    className={`rounded-xl border p-3.5 flex items-start justify-between gap-3 ${
                      unlocked
                        ? 'bg-emerald-950/25 border-emerald-500/40'
                        : 'bg-slate-900/50 border-slate-800 opacity-75'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                        {unlocked && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
                        <span>{ach.title}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{ach.description}</p>
                      {ach.rewardLabel && (
                        <div className="text-[11px] text-sky-400 mt-1">
                          Reward: {ach.rewardLabel} · +{ach.xpReward} XP
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Friends Leaderboard Roster */}
          <div className="rounded-xl bg-slate-900/75 border border-slate-800 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-bold text-white">Gameverse Friends</div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Enter ID (e.g. GV-SZ-1042)"
                  value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={handleAddFriend}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {profile.friends.map((fid) => (
                <div
                  key={fid}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 font-mono-tabular text-xs text-slate-200"
                >
                  <span>{fid}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFriend(fid)}
                    className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    aria-label={`Remove friend ${fid}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
