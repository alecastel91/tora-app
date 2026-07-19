import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { BADGE_ACCENTS, BADGE_TIER_COUNT, sortBadges } from '../../utils/badgeArt';
import { ShieldIcon } from '../../utils/icons';
import BadgeFlipCard from './BadgeFlipCard';

// Kept for callers that color by badge accent
export const BADGE_ACCENT = BADGE_ACCENTS;

// Quiet profile entry point: a small shield pill with the earned-badge
// count. Tap → overlay with the earned badges as flip cards (locked badges
// are simply absent here — only the owner's Achievements hub greys them).
const ProfileBadges = ({ badges }) => {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [flipped, setFlipped] = useState(() => new Set());

  const items = useMemo(() => sortBadges(badges).map((b) => ({
    ...b,
    earned: true,
    max: BADGE_TIER_COUNT[b.key] || 0,
  })), [badges]);

  if (items.length === 0) return null;

  const toggleFlip = (key) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <>
      <div className="mt-3 flex justify-center">
        <button
          type="button"
          aria-label={t('badges.sectionTitle')}
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          className="profile-badges-pill flex cursor-pointer items-center gap-1.5 rounded-full border border-white/12 bg-[#0c0c11] px-3 py-1.5 text-white/70 transition-colors hover:border-white/30 hover:text-white [&_svg]:h-3.5 [&_svg]:w-3.5"
        >
          <ShieldIcon />
          <span className="text-[10px] font-tech uppercase tracking-[0.15em]">
            {t('badges.sectionTitle')} · {items.length}
          </span>
        </button>
      </div>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-5"
          onClick={(e) => { e.stopPropagation(); setOpen(false); }}
        >
          <div
            className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#101015] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="m-0 text-base font-semibold text-white">{t('badges.sectionTitle')}</h3>
              <button
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-transparent text-white/70 hover:text-white"
                onClick={() => setOpen(false)}
                aria-label={t('common.close')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {items.map((b) => (
                <BadgeFlipCard
                  key={b.key}
                  badge={b}
                  flipped={flipped.has(b.key)}
                  onToggle={() => toggleFlip(b.key)}
                />
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ProfileBadges;
