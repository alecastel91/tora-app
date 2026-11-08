import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * What a free member sees in place of a Premium feature: a headline, one
 * sentence, what the feature does, and the way to Premium. One layout for
 * Tour (Calendar, Matches, Kickstart) and Manage (Insights) so every locked
 * page reads the same.
 *
 * features: [{ icon: <Icon />, text }]
 * compact: tighter spacing for gates that sit under a tab row (Manage) so
 * the whole pitch fits one phone screen.
 */
const PremiumGate = ({ title, description, features = [], onUpgrade, compact = false }) => {
  const { t } = useLanguage();
  return (
    <div className={`tour-kickstart-content${compact ? ' premium-gate-compact' : ''}`}>
      <div className="coming-soon-placeholder tour-gate">
        <h2>{title}</h2>
        <p>{description}</p>
        {features.length > 0 && (
          <div className="feature-preview">
            <h4>{t('tour.premiumFeatures')}</h4>
            <ul className="feature-list">
              {features.map((f) => (
                <li key={f.text}>
                  <span className="feature-icon">{f.icon}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button className="btn btn-primary" onClick={() => onUpgrade && onUpgrade()}>
          {t('tour.upgradeToPremium')}
        </button>
      </div>
    </div>
  );
};

export default PremiumGate;
