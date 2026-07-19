import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { drawBadgeSVG, BADGE_ACCENTS, BADGE_TIER_COUNT } from '../../utils/badgeArt';

// Kept for callers that colored by badge accent before the medal port
export const BADGE_ACCENT = BADGE_ACCENTS;

// Medal row under the profile's role pill. Tap a medal → explainer with the
// full ribboned medallion. Art comes from utils/badgeArt (lab v3 look).
const Medal = ({ badge, compact, className = '', onClick }) => {
  const svg = useMemo(
    () => drawBadgeSVG(badge.key, {
      tier: badge.tier,
      level: badge.level || 0,
      max: BADGE_TIER_COUNT[badge.key] || 0,
      compact,
    }),
    [badge.key, badge.tier, badge.level, compact]
  );
  return (
    <span
      className={className}
      onClick={onClick}
      style={{ filter: 'drop-shadow(0 6px 12px rgba(0,0,0,.6))' }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

const ProfileBadges = ({ badges }) => {
  const { t } = useLanguage();
  const [openBadge, setOpenBadge] = useState(null);

  if (!badges || badges.length === 0) return null;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-end justify-center gap-1.5">
        {badges.map((badge) => (
          <button
            key={badge.key}
            type="button"
            className="cursor-pointer border-none bg-transparent p-0 transition-transform hover:-translate-y-0.5"
            onClick={(e) => { e.stopPropagation(); setOpenBadge(badge); }}
            aria-label={t(`badges.${badge.key}.name`)}
          >
            <Medal badge={badge} compact className="block h-[62px] w-[68px]" />
          </button>
        ))}
      </div>

      {openBadge && createPortal(
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/75 p-6"
          onClick={(e) => { e.stopPropagation(); setOpenBadge(null); }}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#131315]/95 p-6 text-center backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <Medal badge={openBadge} className="mx-auto block h-[210px] w-[164px]" />
            <div className="mt-3 text-[10px] font-tech uppercase tracking-[0.2em]"
                 style={{ color: BADGE_ACCENTS[openBadge.key] || '#FFFFFF' }}>
              {t(`badges.${openBadge.key}.name`)}
            </div>
            {openBadge.tier && (
              <h3 className="m-0 mt-1 text-xl font-semibold text-white">{openBadge.tier}</h3>
            )}
            <p className="m-0 mt-2 text-sm leading-relaxed text-white/70">
              {t(`badges.${openBadge.key}.description`)}
            </p>
            <button className="btn btn-outline mt-4 w-full" onClick={() => setOpenBadge(null)}>
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
