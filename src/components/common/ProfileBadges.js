import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';

// Per-badge accent tint (chips stay quiet-premium: tinted border + text on
// the near-black chip base, no glow). Tier names are English brand terms;
// descriptions are translated.
export const BADGE_ACCENT = {
  founding: '#FF3366',
  yearly: '#FFD700',
  gigs: '#6B5FFF',
  events: '#FF5757',
  closer: '#00C875',
  globetrotter: '#4DA6FF',
  connector: '#00C875',
  resident: '#FFB800',
  ambassador: '#FF3366',
  crowd: '#FF8A00',
};

// Label on the chip: the tier name for tiered badges, the badge name for
// single-state ones.
export const badgeLabel = (badge, t) => badge.tier || t(`badges.${badge.key}.name`);

const ProfileBadges = ({ badges }) => {
  const { t } = useLanguage();
  const [openBadge, setOpenBadge] = useState(null);

  if (!badges || badges.length === 0) return null;

  return (
    <>
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {badges.map((badge) => {
          const accent = BADGE_ACCENT[badge.key] || '#FFFFFF';
          return (
            <button
              key={badge.key}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpenBadge(badge); }}
              className="flex items-center gap-1.5 rounded-lg border bg-[#0c0c11] px-2.5 py-1 font-tech text-[8px] font-medium uppercase tracking-[0.15em] cursor-pointer"
              style={{ borderColor: `${accent}66`, color: accent }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
              {badgeLabel(badge, t)}
            </button>
          );
        })}
      </div>

      {openBadge && createPortal(
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/70 p-6"
          onClick={(e) => { e.stopPropagation(); setOpenBadge(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#131315]/95 p-5 text-left backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 text-[10px] font-tech uppercase tracking-[0.2em]"
                 style={{ color: BADGE_ACCENT[openBadge.key] || '#FFFFFF' }}>
              {t(`badges.${openBadge.key}.name`)}
            </div>
            {openBadge.tier && (
              <h3 className="m-0 mb-2 text-xl font-semibold text-white">{openBadge.tier}</h3>
            )}
            <p className="m-0 text-sm leading-relaxed text-white/70">
              {t(`badges.${openBadge.key}.description`)}
            </p>
            <button
              className="btn btn-outline mt-4 w-full"
              onClick={() => setOpenBadge(null)}
            >
              {t('common.close')}
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default ProfileBadges;
