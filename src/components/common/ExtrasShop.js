import React, { useState } from 'react';
import ExtraPurchaseFlow from './ExtraPurchaseFlow';
import { extrasForRole } from '../../utils/extras';
import { useLanguage } from '../../contexts/LanguageContext';

// One-off extras: consumable top-ups for when a tier limit is hit.
const ExtrasShop = ({ user }) => {
  const { t } = useLanguage();
  const [buying, setBuying] = useState(null); // item being purchased

  if (!user || user.subscriptionTier === 'YEARLY') return null; // yearly is unlimited
  const items = extrasForRole(user.role);

  return (
    <div className="extras-shop">
      <h3 className="extras-title">{t('premium.extrasTitle')}</h3>
      <p className="extras-sub">{t('premium.extrasSub')}</p>

      {(user.extraLikes > 0 || user.extraConnections > 0 || user.extraOffers > 0) && (
        <p className="extras-balance">
          {t('premium.extrasBalance', {
            likes: user.extraLikes || 0,
            conn: user.extraConnections || 0,
            offers: user.extraOffers || 0,
          })}
        </p>
      )}

      <div className="extras-grid">
        {items.map((item) => (
          <button key={item.key} type="button" className="extras-card" onClick={() => setBuying(item)}>
            <span className="extras-card-label">{t(`premium.${item.labelKey}`)}</span>
            <span className="extras-card-price">{item.price}</span>
          </button>
        ))}
      </div>

      {buying && (
        <div className="message-modal-overlay" onClick={() => setBuying(null)}>
          <div className="message-modal-bottom" onClick={(e) => e.stopPropagation()}>
            <h2 className="message-modal-title">
              {t(`premium.${buying.labelKey}`)} · {buying.price}
            </h2>
            <ExtraPurchaseFlow item={buying} onClose={() => setBuying(null)} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtrasShop;
