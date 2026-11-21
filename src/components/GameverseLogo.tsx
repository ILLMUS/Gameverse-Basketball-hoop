import type { AvatarId } from '../types/game';

export function GameverseLockup({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 select-none">
      <svg
        width={compact ? 34 : 46}
        height={compact ? 34 : 46}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="gvRimGrad" x1="6" y1="6" x2="42" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#22C55E" />
            <stop offset="55%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
        </defs>
        <circle cx="24" cy="24" r="21" fill="#0B1120" stroke="url(#gvRimGrad)" strokeWidth="2.5" />
        <path d="M9 24H39" stroke="#22C55E" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        <path d="M24 9V39" stroke="#38BDF8" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        <path d="M13 13C18.5 18.5 18.5 29.5 13 35" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
        <path d="M35 13C29.5 18.5 29.5 29.5 35 35" stroke="#8B5CF6" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <div className="leading-none">
        <div className="text-[11px] font-semibold tracking-[0.2em] text-emerald-400 uppercase">
          Gameverse Arcade
        </div>
        <div
          className={`font-display font-extrabold tracking-tight text-slate-50 ${
            compact ? 'text-xl' : 'text-3xl sm:text-4xl'
          }`}
        >
          Basketball Hoops
        </div>
      </div>
    </div>
  );
}

const AVATAR_STYLES: Record<AvatarId, { bg: string; ring: string; label: string }> = {
  ace_striker: { bg: 'from-emerald-500 to-violet-600', ring: 'border-emerald-400/60', label: 'AS' },
  mbabane_flash: { bg: 'from-sky-500 to-amber-500', ring: 'border-sky-400/60', label: 'MF' },
  neon_cyber: { bg: 'from-violet-600 to-emerald-500', ring: 'border-violet-400/60', label: 'CG' },
  court_architect: { bg: 'from-cyan-500 to-slate-800', ring: 'border-cyan-400/60', label: 'CA' },
  gold_mvp: { bg: 'from-amber-400 to-amber-700', ring: 'border-amber-300/80', label: 'MVP' },
};

export function AvatarBadge({
  avatarId,
  username,
  size = 'md',
}: {
  avatarId: AvatarId;
  username: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const style = AVATAR_STYLES[avatarId] ?? AVATAR_STYLES.ace_striker;
  const dims =
    size === 'lg' ? 'w-14 h-14 text-base' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';

  if (avatarId === 'ace_striker') {
    return (
      <div
        className={`${dims} rounded-xl overflow-hidden border ${style.ring} bg-slate-900 shrink-0 relative`}
      >
        <img
          src="/src/assets/images/player_avatar_ace_1795265393994.jpg"
          alt={`${username} avatar`}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="sr-only">{username}</span>
      </div>
    );
  }

  return (
    <div
      className={`${dims} rounded-xl bg-gradient-to-br ${style.bg} border ${style.ring} flex items-center justify-center font-display font-bold text-white shrink-0`}
      aria-label={`${username} avatar`}
    >
      {style.label}
    </div>
  );
}
