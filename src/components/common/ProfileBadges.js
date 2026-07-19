import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../../contexts/LanguageContext';
import { drawBadgeGlyph, drawBadgePips, BADGE_ACCENTS, BADGE_TIER_COUNT } from '../../utils/badgeArt';

// Kept for callers that color by badge accent
export const BADGE_ACCENT = BADGE_ACCENTS;

// Minimal badge chips under the profile's role pill: hairline card, stroke
// glyph colored by tier metal, tiny pips. Tap → explainer modal.
const ProfileBadges = ({ badges }) => {
  const { t } = useLanguage();
  const [openBadge, setOpenBadge] = useState(null);

  const items = useMemo(() => (badges || []).map((b) => ({
    ...b,
    max: BADGE_TIER_COUNT[b.key] || 0,
  })), [badges]);

  if (items.length === 0) return null;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {items.map((badge) => (
          <button
            key={badge.key}
            type="button"
            aria-label={t(`badges.${badge.key}.name`)}
            onClick={(e) => { e.stopPropagation(); setOpenBadge(badge); }}
            className="profile-badge-chip flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-white/10 bg-[#0c0c11] px-3 py-2.5 transition-colors hover:border-white/25"
          >
            <span
              className="block h-6 w-6"
              dangerouslySetInnerHTML={{ __html: drawBadgeGlyph(badge.key, { level: badge.level, max: badge.max }) }}
            />
            {badge.max > 0 ? (
              <span dangerouslySetInnerHTML={{ __html: drawBadgePips(badge.key, { level: badge.level, max: badge.max }) }} />
            ) : (
              <span className="block h-2" />
            )}
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
            <span
              className="mx-auto block h-16 w-16"
              dangerouslySetInnerHTML={{ __html: drawBadgeGlyph(openBadge.key, { level: openBadge.level, max: openBadge.max }) }}
            />
            {openBadge.max > 0 && (
              <span className="mt-3 inline-block" dangerouslySetInnerHTML={{ __html: drawBadgePips(openBadge.key, { level: openBadge.level, max: openBadge.max }) }} />
            )}
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
