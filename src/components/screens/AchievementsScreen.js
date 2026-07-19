import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { drawBadgeGlyph, drawBadgePips, BADGE_ACCENTS } from '../../utils/badgeArt';
import { ShieldIcon } from '../../utils/icons';

// Own achievements hub: 2-per-row grid of flip cards. Front = glyph +
// current tier + progress; hover (desktop) or tap (mobile) turns the card
// to reveal the description. Opened from the header shield icon.
const AchievementsScreen = ({ onClose }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [achievements, setAchievements] = useState(null);
  const [flipped, setFlipped] = useState(() => new Set());

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return undefined;
    apiService.getAchievements(user.id)
      .then((data) => { if (!cancelled) setAchievements(data.achievements || []); })
      .catch(() => { if (!cancelled) setAchievements([]); });
    return () => { cancelled = true; };
  }, [user?.id]);

  const toggleFlip = (key) => {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

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
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0c0c11] p-4">
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

        <div className="grid grid-cols-2 gap-3">
          {(achievements || []).map((a) => {
            const accent = BADGE_ACCENTS[a.key] || '#FFFFFF';
            const tiered = a.tierCount > 0;
            const pct = tiered && a.nextThreshold
              ? Math.min(100, Math.round((a.metricValue / a.nextThreshold) * 100))
              : a.earned ? 100 : 0;
            const glyphOpts = { level: a.level || 0, max: a.tierCount || 0, locked: !a.earned };
            return (
              <div
                key={a.key}
                className={`ach-card h-[196px] cursor-pointer select-none ${flipped.has(a.key) ? 'flipped' : ''}`}
                onClick={() => toggleFlip(a.key)}
              >
                <div className="ach-card-inner">
                  {/* front */}
                  <div className={`ach-face flex flex-col items-center justify-between rounded-2xl border bg-[#0c0c11] p-4 ${a.earned ? 'border-white/10' : 'border-white/5'}`}>
                    <span
                      className={`mt-2 block h-10 w-10 ${a.earned ? '' : 'opacity-70'}`}
                      dangerouslySetInnerHTML={{ __html: drawBadgeGlyph(a.key, glyphOpts) }}
                    />
                    <div className="text-center">
                      <div className="text-[9px] font-tech uppercase tracking-[0.18em]" style={{ color: a.earned ? accent : 'rgba(255,255,255,.35)' }}>
                        {t(`badges.${a.key}.name`)}
                      </div>
                      <div className={`mt-0.5 text-sm font-semibold ${a.earned ? 'text-white' : 'text-white/40'}`}>
                        {a.earned ? (a.tier || t('achievements.earned')) : t('achievements.locked')}
                      </div>
                    </div>
                    <div className="flex w-full flex-col items-center gap-1.5">
                      {tiered && (
                        <span dangerouslySetInnerHTML={{ __html: drawBadgePips(a.key, glyphOpts) }} />
                      )}
                      {tiered && a.nextThreshold ? (
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
                      {tiered && a.nextThreshold && (
                        <div className="flex items-baseline justify-between text-[9px] font-tech uppercase tracking-[0.15em] text-white/45">
                          <span>{t('achievements.progressTo', { tier: a.nextTierName })}</span>
                          <span className="text-white/70">{a.metricValue} / {a.nextThreshold}</span>
                        </div>
                      )}
                      {tiered && !a.nextThreshold && a.earned && (
                        <div className="text-[9px] font-tech uppercase tracking-[0.15em] text-white/45">
                          {t('achievements.maxTier')}
                        </div>
                      )}
                      {!tiered && (
                        <div className="text-[9px] font-tech uppercase tracking-[0.15em]" style={{ color: a.earned ? accent : 'rgba(255,255,255,.35)' }}>
                          {a.earned ? t('achievements.earned') : t('achievements.locked')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default AchievementsScreen;
