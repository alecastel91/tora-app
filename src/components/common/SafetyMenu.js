import React, { useEffect, useRef, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import apiService from '../../services/api';
import { useAppContext } from '../../contexts/AppContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { REPORT_REASONS, REPORT_TARGETS, BLOCK_EFFECT_KEYS } from '../../utils/safety';

/**
 * Report + block, the two controls App Review guideline 1.2 asks for on any
 * surface carrying user content. One component so the profile and the chat
 * offer the same thing in the same place: an overflow button, a reason
 * picker, and a block that spells out what it does before it happens.
 *
 * `targetType` is what Report acts on (a profile, or one message); blocking
 * always acts on the PERSON behind `profile`, never a single profile of theirs.
 */
const SafetyMenu = ({ profile, targetType = REPORT_TARGETS.PROFILE, targetId, onBlocked, className = '' }) => {
  const { t } = useLanguage();
  const { user } = useAppContext();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState('spam');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!profile?.id || profile.id === user?.id) return null;

  const submitReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await apiService.sendReport({
        targetType,
        targetId: targetId || profile.id,
        reason,
        note: note.trim() || undefined,
        reporterProfileId: user?.id,
      });
      setReporting(false); setNote(''); setReason('spam');
      showToast('safety.reportSent');
    } catch (err) {
      appAlert(err.message || t('safety.reportFailed'));
    } finally {
      setBusy(false);
    }
  };

  const block = async () => {
    setOpen(false);
    const ok = await appConfirm(
      `${t('safety.blockConfirmBody', { name: profile.name })}\n\n${BLOCK_EFFECT_KEYS.map((k) => `• ${t(`safety.${k}`)}`).join('\n')}`,
      { title: t('safety.blockConfirmTitle', { name: profile.name }), confirmLabel: t('safety.block'), danger: true },
    );
    if (!ok) return;
    try {
      await apiService.blockMember(profile.id);
      showToast('safety.blockDone', { name: profile.name });
      if (onBlocked) onBlocked();
    } catch (err) {
      appAlert(err.message || t('safety.blockFailed'));
    }
  };

  return (
    <div ref={wrapRef} className={`safety-menu ${className}`}>
      <button
        type="button"
        aria-label={t('safety.moreActions')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="safety-menu-trigger"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
        </svg>
      </button>

      {open && (
        <div className="safety-menu-list" role="menu">
          <button type="button" role="menuitem" onClick={() => { setOpen(false); setReporting(true); }}>
            {targetType === REPORT_TARGETS.MESSAGE ? t('safety.reportMessage') : t('safety.reportProfile')}
          </button>
          <button type="button" role="menuitem" className="is-danger" onClick={block}>
            {t('safety.blockMember', { name: profile.name })}
          </button>
        </div>
      )}

      {reporting && (
        <OverlayPortal>
          <div className="modal-overlay" onClick={() => !busy && setReporting(false)}>
            <div className="modal-content safety-report-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{targetType === REPORT_TARGETS.MESSAGE ? t('safety.reportMessage') : t('safety.reportProfile')}</h2>
                <button className="modal-close" onClick={() => !busy && setReporting(false)} aria-label={t('common.close')}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="modal-body">
                <p className="form-hint" style={{ marginTop: 0 }}>{t('safety.reportIntro', { name: profile.name })}</p>
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
              <div className="form-actions">
                <button className="btn btn-outline" onClick={() => setReporting(false)} disabled={busy}>{t('common.cancel')}</button>
                <button className="btn btn-primary" onClick={submitReport} disabled={busy}>
                  {busy ? t('safety.sending') : t('safety.sendReport')}
                </button>
              </div>
            </div>
          </div>
        </OverlayPortal>
      )}
    </div>
  );
};

export default SafetyMenu;
