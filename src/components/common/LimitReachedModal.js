import React, { useState } from 'react';
import ExtraPurchaseFlow from './ExtraPurchaseFlow';
import { extrasForKind } from '../../utils/extras';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Shared "limit reached" dialog (daily likes / monthly connections). Offers
 * the matching one-off extras right here — the highest-intent moment — plus
 * the Upgrade path to the full TORA Premium page.
 */
const LimitReachedModal = ({ type, data, onClose, onOpenPremium }) => {
  const { t } = useLanguage();
  const [buying, setBuying] = useState(null);

  const isLikes = type === 'likes';
  const title = isLikes ? t('search.dailyLikeLimitReached') : t('search.monthlyConnectionLimitReached');
  const message = isLikes ? t('search.dailyLikeLimitMessage') : t('search.monthlyConnectionLimitMessage');
  const usageLine = isLikes
    ? t('search.likesPerDay', { n: data?.limit })
    : t('search.connectionsPerMonth', { n: data?.limit });

  return (
    <div className="modal-overlay rep-request-modal" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{buying ? `${t(`premium.${buying.labelKey}`)} · ${buying.price}` : title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {buying ? (
            <ExtraPurchaseFlow item={buying} onClose={onClose} />
          ) : (
            <>
              <p className="limit-modal-message">{message}</p>
              <p className="limit-modal-usage">
                {t('search.currentPlan')} <strong>{data?.tier}</strong> · {usageLine}
              </p>

              <p className="limit-modal-extras-label">{t('premium.extrasTitle')}</p>
              <div className="extras-grid">
                {extrasForKind(type).map((item) => (
                  <button key={item.key} type="button" className="extras-card" onClick={() => setBuying(item)}>
                    <span className="extras-card-label">{t(`premium.${item.labelKey}`)}</span>
                    <span className="extras-card-price">{item.price}</span>
                  </button>
                ))}
              </div>

              <button
                className="btn btn-primary btn-full limit-modal-upgrade"
                onClick={() => { onClose(); if (onOpenPremium) onOpenPremium(); }}
              >
                {t('search.upgrade')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LimitReachedModal;
