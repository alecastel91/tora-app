import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { drawBadgeGlyph, drawBadgePips, BADGE_ACCENTS } from '../../utils/badgeArt';

/**
 * One badge as a 3D flip card. Front: glyph + name + tier + metric count +
 * pips/progress. Back: description + next-tier line. Hover flips on pointer
 * devices (CSS), tap toggles via the flipped prop.
 *
 * badge: { key, earned, tier?, level?, max?, metricValue?, nextThreshold?,
 *          nextTierName? } — progress fields only present on the owner's
 * achievements payload; public profiles pass earned badges without them.
 */
const BadgeFlipCard = ({ badge: a, flipped, onToggle }) => {
  const { t } = useLanguage();
  const accent = BADGE_ACCENTS[a.key] || '#FFFFFF';
  const tiered = (a.max || 0) > 0;
  const hasProgress = a.metricValue != null;
  const pct = tiered && a.nextThreshold
    ? Math.min(100, Math.round((a.metricValue / a.nextThreshold) * 100))
    : a.earned ? 100 : 0;
  const glyphOpts = { level: a.level || 0, max: a.max || 0, locked: !a.earned };

  return (
    <div
      className={`ach-card h-[196px] cursor-pointer select-none ${flipped ? 'flipped' : ''}`}
      onClick={onToggle}
    >
      <div className="ach-card-inner">
        {/* front */}
        <div className={`ach-face flex flex-col items-center justify-between rounded-2xl border bg-[#0c0c11] p-4 ${a.earned ? 'border-white/10' : 'border-white/5'}`}>
          <span
            className={`mt-1 block h-12 w-12 ${a.earned ? '' : 'opacity-70'}`}
            dangerouslySetInnerHTML={{ __html: drawBadgeGlyph(a.key, glyphOpts) }}
          />
          <div className="text-center">
            <div className="text-[9px] font-tech uppercase tracking-[0.18em]" style={{ color: a.earned ? accent : 'rgba(255,255,255,.35)' }}>
              {t(`badges.${a.key}.name`)}
            </div>
            <div className={`mt-0.5 text-sm font-semibold ${a.earned ? 'text-white' : 'text-white/40'}`}>
              {a.earned ? (a.tier || t('achievements.earned')) : t('achievements.locked')}
            </div>
            {tiered && hasProgress && a.metricValue > 1 && (
              <div className="mt-0.5 text-[10px] text-white/45">
                {t(`badges.${a.key}.count`, { n: a.metricValue })}
              </div>
            )}
          </div>
          <div className="flex w-full flex-col items-center gap-1.5">
            {tiered && (
              <span dangerouslySetInnerHTML={{ __html: drawBadgePips(a.key, glyphOpts) }} />
            )}
            {tiered && hasProgress && a.nextThreshold ? (
              <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full rounded-full bg-infrared/70" style={{ width: `${pct}%` }} />
              </div>
            ) : (
              <div className="h-0.5 w-full" />
            )}
          </div>
        </div>
        {/* back */}
        <div className="ach-face ach-back flex flex-col justify-between rounded-2xl border border-white/10 bg-[#111117] p-4">
          <p className="m-0 text-xs leading-relaxed text-white/70">
            {t(`badges.${a.key}.description`)}
          </p>
          <div>
            {tiered && hasProgress && a.nextThreshold && (
              <div className="flex items-baseline justify-between text-[9px] font-tech uppercase tracking-[0.15em] text-white/45">
                <span>{t('achievements.progressTo', { tier: a.nextTierName })}</span>
                <span className="text-white/70">{a.metricValue} / {a.nextThreshold}</span>
              </div>
            )}
            {tiered && hasProgress && !a.nextThreshold && a.earned && (
              <div className="text-[9px] font-tech uppercase tracking-[0.15em] text-white/45">
                {t('achievements.maxTier')}
              </div>
            )}
            {(!tiered || !hasProgress) && (
              <div className="text-[9px] font-tech uppercase tracking-[0.15em]" style={{ color: a.earned ? accent : 'rgba(255,255,255,.35)' }}>
                {a.earned ? (tiered ? a.tier : t('achievements.earned')) : t('achievements.locked')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BadgeFlipCard;
