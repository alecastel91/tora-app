import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { BADGE_ACCENT } from '../common/ProfileBadges';
import { drawBadgeSVG } from '../../utils/badgeArt';
import { ShieldIcon } from '../../utils/icons';

// Own achievements hub: the full badge catalog with earned tiers highlighted
// and progress toward the next tier. Opened from the header shield icon.
// Reuses the settings-screen overlay chrome (fixed, centered 760px column).
const AchievementsScreen = ({ onClose }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [achievements, setAchievements] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return undefined;
    apiService.getAchievements(user.id)
      .then((data) => { if (!cancelled) setAchievements(data.achievements || []); })
      .catch(() => { if (!cancelled) setAchievements([]); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const earnedCount = (achievements || []).filter((a) => a.earned).length;

  return (
    <div className="screen active settings-screen achievements-screen">
      <div className="settings-header">
        <button className="back-button" onClick={onClose}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1>{t('achievements.title')}</h1>
        <div style={{ width: '24px' }}></div>
      </div>

      <div className="settings-content">
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0c0c11] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-infrared/40 text-infrared [&>svg]:h-5 [&>svg]:w-5">
            <ShieldIcon />
          </span>
          <div>
            <div className="text-sm font-semibold text-white">
              {t('achievements.earnedCount', { earned: earnedCount, total: (achievements || []).length })}
            </div>
            <div className="text-xs text-white/45">{t('achievements.subtitle')}</div>
          </div>
        </div>

        {achievements === null && (
          <p className="py-8 text-center text-sm text-white/40">{t('common.loading')}</p>
        )}

        {(achievements || []).map((a) => {
          const accent = BADGE_ACCENT[a.key] || '#FFFFFF';
          const tiered = a.tierCount > 0;
          const pct = tiered && a.nextThreshold
            ? Math.min(100, Math.round((a.metricValue / a.nextThreshold) * 100))
            : a.earned ? 100 : 0;
          return (
            <div
              key={a.key}
              className={`mb-3 rounded-2xl border bg-[#0c0c11] p-4 ${a.earned ? 'border-white/10' : 'border-white/5 opacity-60'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`block h-[92px] w-[76px] shrink-0 ${a.earned ? '' : 'opacity-60 grayscale'}`}
                  dangerouslySetInnerHTML={{ __html: drawBadgeSVG(a.key, { tier: a.tier, level: a.level || 0, max: a.tierCount || 0 }) }}
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-tech uppercase tracking-[0.2em]" style={{ color: accent }}>
                    {t(`badges.${a.key}.name`)}
                  </div>
                  <div className="mt-0.5 text-base font-semibold text-white">
                    {a.earned
                      ? (a.tier || t('achievements.earned'))
                      : t('achievements.locked')}
                  </div>
                </div>
                {tiered && (
                  <span className="shrink-0 rounded-full border border-white/10 px-2.5 py-1 text-[10px] font-tech uppercase tracking-[0.12em] text-white/45">
                    {a.level}/{a.tierCount}
                  </span>
                )}
              </div>
              <p className="mb-0 mt-2 text-xs leading-relaxed text-white/50">
                {t(`badges.${a.key}.description`)}
              </p>
              {tiered && a.nextThreshold && (
                <div className="mt-3">
                  <div className="mb-1.5 flex justify-between text-[10px] font-tech uppercase tracking-[0.12em] text-white/40">
                    <span>{t('achievements.progressTo', { tier: a.nextTierName })}</span>
                    <span>{a.metricValue} / {a.nextThreshold}</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="h-full rounded-full bg-infrared/80" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
              {tiered && !a.nextThreshold && a.earned && (
                <div className="mt-3 text-[10px] font-tech uppercase tracking-[0.15em] text-white/40">
                  {t('achievements.maxTier')}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AchievementsScreen;
