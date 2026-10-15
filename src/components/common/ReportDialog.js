import React, { useState } from 'react';
import OverlayPortal from './OverlayPortal';
import apiService from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { REPORT_REASONS, REPORT_TARGETS } from '../../utils/safety';

/**
 * The reason picker behind every Report in the app (App Review guideline 1.2).
 *
 * One dialog for profiles and posts, because a report with no reason is a
 * report nobody can triage: the News feed used to send a bare confirmation,
 * so every post arrived in the moderation queue filed as "other".
 */
const ReportDialog = ({ targetType = REPORT_TARGETS.PROFILE, targetId, name, title, intro, onClose }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [reason, setReason] = useState('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      // A post goes through the posts endpoint, not /reports: that is what
      // keeps the auto-hide counter, which pulls a post off the feed once
      // enough people report it without waiting for a human. It files the
      // same row in the moderation queue on the way through.
      if (targetType === REPORT_TARGETS.POST) {
        await apiService.reportPost(targetId, { profileId: user?.id, reason, note: note.trim() || undefined });
      } else {
        await apiService.sendReport({
          targetType,
          targetId,
          reason,
          note: note.trim() || undefined,
          reporterProfileId: user?.id,
        });
      }
      showToast('safety.reportSent');
      onClose();
    } catch (err) {
      appAlert(err.message || t('safety.reportFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OverlayPortal>
      <div className="modal-overlay" onClick={() => !busy && onClose()}>
        <div className="modal-content safety-report-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{title || t('safety.reportProfile')}</h2>
            <button className="modal-close" onClick={() => !busy && onClose()} aria-label={t('common.close')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="modal-body">
            <p className="form-hint" style={{ marginTop: 0 }}>{intro || t('safety.reportIntro', { name: name || t('safety.thisMember') })}</p>
            <div className="safety-reasons" role="radiogroup" aria-label={t('safety.reasonLabel')}>
              {REPORT_REASONS.map((r) => (
                <label key={r} className="checkbox-label">
                  <input type="radio" name="report-reason" checked={reason === r} onChange={() => setReason(r)} />
                  <span>{t(`safety.reason_${r}`)}</span>
                </label>
              ))}
            </div>
            <div className="form-group">
              <label>{t('safety.noteLabel')}</label>
              <textarea
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('safety.notePlaceholder')}
              />
            </div>
            <p className="form-hint">{t('safety.reportPrivacy')}</p>
          </div>
          <div className="modal-footer">
            <button className="btn btn-outline" onClick={onClose} disabled={busy}>{t('common.cancel')}</button>
            <button className="btn btn-primary" onClick={submit} disabled={busy}>
              {busy ? t('safety.sending') : t('safety.sendReport')}
            </button>
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default ReportDialog;
