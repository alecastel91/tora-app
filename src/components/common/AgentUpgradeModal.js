import React from 'react';
import AgentTierLadder from './AgentTierLadder';
import { useLanguage } from '../../contexts/LanguageContext';

const AgentUpgradeModal = ({ isOpen, onClose, currentTier }) => {
  const { t } = useLanguage();
  if (!isOpen) return null;
  return (
    <div className="delete-modal-overlay" onClick={onClose}>
      <div
        className="delete-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '720px', width: '95%' }}
      >
        <div className="delete-modal-content">
          <AgentTierLadder currentTier={currentTier} scrollable />
        </div>
        <div className="delete-modal-actions">
          <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
        </div>
      </div>
    </div>
  );
};

export default AgentUpgradeModal;
