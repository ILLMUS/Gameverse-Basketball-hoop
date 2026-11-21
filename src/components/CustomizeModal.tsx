import { Check, Lock, Palette, X } from 'lucide-react';
import { useState } from 'react';
import { COSMETICS, getCosmeticShortId } from '../data/catalog';
import type { CosmeticItem, EquippedLoadout, PlayerProfile } from '../types/game';

interface CustomizeModalProps {
  profile: PlayerProfile;
  onEquip: (category: CosmeticItem['category'], shortId: string) => void;
  onClose: () => void;
}

const CATEGORIES: Array<{ id: CosmeticItem['category']; label: string }> = [
  { id: 'ballSkin', label: 'Basketballs' },
  { id: 'courtTheme', label: 'Courts' },
  { id: 'hoopDesign', label: 'Hoops' },
  { id: 'netStyle', label: 'Nets' },
  { id: 'shotEffect', label: 'Shot Effects' },
  { id: 'avatarId', label: 'Avatars' },
];

export function CustomizeModal({ profile, onEquip, onClose }: CustomizeModalProps) {
  const [tab, setTab] = useState<CosmeticItem['category']>('ballSkin');
  const items = COSMETICS.filter((c) => c.category === tab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-[#0D1320] border border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Palette className="w-5 h-5 text-sky-400" />
            <div>
              <h2 className="font-display text-2xl font-bold text-white leading-none">
                Locker & Customization
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Unlock courts, basketballs, hoops, nets, and trails through XP and achievements.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close customization"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-5 pt-3 pb-2 border-b border-slate-800/80 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-max">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setTab(cat.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  tab === cat.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 hover:text-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cosmetic Grid */}
        <div className="flex-1 overflow-y-auto gv-scroll p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => {
            const unlocked = profile.unlockedItems.includes(item.id);
            const shortId = getCosmeticShortId(item.id);
            const equippedVal = profile.equipped[item.category as keyof EquippedLoadout];
            const isEquipped = equippedVal === shortId;

            return (
              <div
                key={item.id}
                className={`rounded-xl border p-4 flex flex-col justify-between gap-3 transition-colors ${
                  isEquipped
                    ? 'bg-emerald-500/10 border-emerald-500/55'
                    : unlocked
                    ? 'bg-slate-900/75 border-slate-800'
                    : 'bg-slate-950/60 border-slate-800/60 opacity-80'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-11 h-11 rounded-xl shrink-0 border border-white/15"
                    style={{
                      background: `linear-gradient(135deg, ${item.previewPrimary}, ${item.previewSecondary})`,
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white">{item.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5 leading-snug">
                      {item.description}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="text-[11px] text-slate-400">{item.unlockRequirement}</span>
                  {unlocked ? (
                    <button
                      type="button"
                      onClick={() => onEquip(item.category, shortId)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                        isEquipped
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-100'
                      }`}
                    >
                      {isEquipped && <Check className="w-3.5 h-3.5" />}
                      <span>{isEquipped ? 'Equipped' : 'Equip'}</span>
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Locked</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
