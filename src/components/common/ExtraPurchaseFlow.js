import React, { useState } from 'react';
import StripeCheckout from './StripeCheckout';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * The checkout + success half of an extra purchase, shared by ExtrasShop and
 * LimitReachedModal so the purchase behavior can never drift between the two
 * surfaces. The parent owns the surrounding modal chrome.
 */
const ExtraPurchaseFlow = ({ item, onClose }) => {
  const { t } = useLanguage();
  const { user, reloadProfileData } = useAppContext();
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <>
        <p className="extras-success">{t('premium.extrasSuccess')}</p>
        <button className="btn btn-primary btn-full" onClick={onClose}>{t('common.gotIt')}</button>
      </>
    );
  }
  return (
    <StripeCheckout
      profileId={user?.id}
      extraItem={item.key}
      onSuccess={async () => {
        setDone(true);
        try { await reloadProfileData(); } catch { /* poll will catch up */ }
      }}
    />
  );
};

export default ExtraPurchaseFlow;
