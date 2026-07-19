import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';
import { sortBadges } from '../../utils/badgeArt';
import { ShieldIcon } from '../../utils/icons';
import BadgeFlipCard from '../common/BadgeFlipCard';

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
          {sortBadges(achievements).map((a) => (
            <BadgeFlipCard
              key={a.key}
              badge={{ ...a, max: a.tierCount || 0 }}
              flipped={flipped.has(a.key)}
              onToggle={() => toggleFlip(a.key)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default AchievementsScreen;
