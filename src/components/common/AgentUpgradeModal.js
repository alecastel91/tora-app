import React from 'react';
import { openPremium } from '../../utils/subscription';
import OverlayPortal from './OverlayPortal';
import AgentPlanCard from './AgentPlanCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';

// Shown when a free agent tries to add a second artist. Presents the Agent
// plan and routes to checkout on the Premium screen via the global
// `tora:open-premium` event App.js listens for.
const AgentUpgradeModal = ({ isOpen, onClose }) => {
  const { t } = useLanguage();
  const { billingCurrency, user } = useAppContext();
  if (!isOpen) return null;
  return (
    <OverlayPortal><div className="delete-modal-overlay" onClick={onClose}>
      <div
        className="delete-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '560px', width: '95%' }}
      >
        <div className="delete-modal-content">
          <AgentPlanCard
            profile={user}
            currency={billingCurrency}
            onSelectPlan={() => {
              onClose();
              openPremium();
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
