import React, { useState } from 'react';
import Modal from './Modal';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAppContext } from '../../contexts/AppContext';
import apiService from '../../services/api';

const REASONS = ['border', 'changed', 'link', 'other'];

/**
 * "Something's wrong here?" from the Travel panel: a reason and an optional
 * note, sent to the TORA team's review page. Several members reporting a
 * change make the country read "check the official site" until confirmed.
 */
const TravelReportSheet = ({ isOpen, onClose, country, dealId }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [reason, setReason] = useState('border');
  const [note, setNote] = useState('');
  const [state, setState] = useState('idle'); // idle | sending | sent | failed

  const close = () => { onClose(); setState('idle'); setNote(''); };
  const send = async () => {
    if (state === 'sending' || !user?.id) return;
    setState('sending');
    try {
      await apiService.reportTravelRule({ profileId: user.id, dealId, country, reason, note });
      setState('sent');
    } catch {
      setState('failed');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={t('travel.report')}>
      {state === 'sent' ? (
        <div className="travel-report">
          <p className="permit-panel-lead">{t('travel.sent')}</p>
          <button type="button" className="btn btn-primary" onClick={close}>{t('common.close')}</button>
        </div>
      ) : (
        <div className="travel-report">
          <p className="permit-panel-text">{t('travel.reportLead', { country })}</p>
          <div className="travel-report-reasons" role="radiogroup" aria-label={t('travel.reasonLabel')}>
            {REASONS.map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={reason === r}
                className={`travel-report-reason${reason === r ? ' is-on' : ''}`}
                onClick={() => setReason(r)}
              >
                {t(`travel.reason.${r}`)}
              </button>
            ))}
          </div>
          <label className="travel-report-note">
            <span>{t('travel.noteLabel')}</span>
            <textarea rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <p className="permit-panel-foot">{t('travel.reportHint')}</p>
          {state === 'failed' && <p className="permit-panel-warn">{t('travel.failed')}</p>}
          <button type="button" className="btn btn-primary" disabled={state === 'sending'} onClick={send}>
            {state === 'sending' ? '...' : t('travel.send')}
          </button>
        </div>
      )}
    </Modal>
  );
};

export default TravelReportSheet;
