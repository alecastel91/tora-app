import React from 'react';
import OverlayPortal from './OverlayPortal';
import AgentSeatPricing from './AgentSeatPricing';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';

// Shown when a free agent hits their roster cap. Presents the per-seat
// pricing (no fixed tiers) and routes to the subscription flow on the
// Premium screen via a global event App.js listens for.
const AgentUpgradeModal = ({ isOpen, onClose, rosterCount = 0 }) => {
  const { t } = useLanguage();
  const { billingCurrency } = useAppContext();
  if (!isOpen) return null;
  return (
    <OverlayPortal><div className="delete-modal-overlay" onClick={onClose}>
      <div
        className="delete-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', width: '95%' }}
      >
        <div className="delete-modal-content">
          <AgentSeatPricing
            rosterCount={rosterCount}
            currency={billingCurrency}
            onSubscribe={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('tora:open-premium'));
            }}
          />
        </div>
        <div className="delete-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div></OverlayPortal>
  );
};

export default AgentUpgradeModal;
