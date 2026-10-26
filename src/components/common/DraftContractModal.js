import React, { useEffect, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import useBusyAction from '../../hooks/useBusyAction';

/**
 * Draft a contract for an accepted booking from the member's template.
 * Every clause is editable in place, or ask for a change in words and the
 * altered clauses come back highlighted for approval. "Continue to sign"
 * builds the PDF and hands it to the existing sign-and-send step via
 * onReady({ id, title, url }) — the same shape AddContractModal produces.
 */
const DraftContractModal = ({ isOpen, deal, currentUser, onClose, onReady }) => {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(null);
  const [instruction, setInstruction] = useState('');
  const [changed, setChanged] = useState([]);
  const [summary, setSummary] = useState('');
  const [saveToTemplate, setSaveToTemplate] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [busy, run] = useBusyAction();

  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id) return;
    let cancelled = false;
    setDraft(null); setChanged([]); setSummary(''); setInstruction(''); setNeedsSetup(false); setSaveToTemplate(false);
    apiService.draftContract(currentUser.id, deal.id)
      .then((r) => { if (!cancelled) setDraft(r.draft); })
      .catch((e) => { if (cancelled) return; if (e.code === 'CONTRACT_TEMPLATE_MISSING') setNeedsSetup(true); else appAlert(e.message || t('common.error')); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, currentUser?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !deal) return null;

  const setSection = (i, patch) => { setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) })); setChanged((c) => c.filter((n) => n !== i)); };

  const applyInstruction = () => instruction.trim() && draft && run(async () => {
    const r = await apiService.editContractDraft(currentUser.id, deal.id, draft.sections, instruction.trim());
    setDraft((d) => ({ ...d, sections: r.sections }));
    setChanged(r.changed || []); setSummary(r.summary || ''); setInstruction('');
  });

  const continueToSign = () => draft && run(async () => {
    const r = await apiService.renderContractDraft(currentUser.id, deal.id, { sections: draft.sections, title: draft.title, signatureBlock: draft.signatureBlock, saveToTemplate });
    onReady({ id: r.documentId, title: r.documentTitle, url: r.documentUrl, type: 'generated' });
    onClose();
  });

  return (
    <OverlayPortal>
      <div className="delete-modal-overlay" onClick={onClose}>
        <div className="delete-modal contract-draft-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-content">
            <h2 className="modal-title">{t('contracts.draftTitle')}</h2>
            <p className="form-hint" style={{ marginTop: 0 }}>{deal.eventName || deal.venueName}</p>

            {needsSetup ? (
              <div className="agency-card">
                <p className="m-0 text-sm text-white">{t('contracts.setupFirst')}</p>
                <p className="form-hint">{t('contracts.setupWhere')}</p>
              </div>
            ) : !draft ? (
              <p className="form-hint">{t('common.loading')}</p>
            ) : (
              <>
                <div className="invoice-field">
                  <label className="form-label">{t('contracts.title')}</label>
                  <input type="text" className="form-input" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
                </div>
                <div className="contract-draft-clauses">
                  {draft.sections.map((s, i) => (
                    <div key={i} className={`contract-clause${changed.includes(i) ? ' is-changed' : ''}`}>
                      <div className="flex items-center gap-2">
                        <span className="contract-clause-no">{i + 1}.</span>
                        <input type="text" className="form-input flex-1" value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} />
                        {changed.includes(i) && <span className="contract-changed-chip">{t('contracts.changed')}</span>}
                      </div>
                      <textarea className="form-input" rows={4} value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} />
                    </div>
                  ))}
                </div>
                {summary && <p className="form-hint">{summary}</p>}
                <div className="invoice-field">
                  <label className="form-label">{t('contracts.askForChange')}</label>
                  <div className="flex gap-2">
                    <input type="text" className="form-input flex-1" placeholder={t('contracts.askPlaceholder')} value={instruction} onChange={(e) => setInstruction(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyInstruction(); }} />
                    <button type="button" className="btn btn-outline" disabled={busy || !instruction.trim()} onClick={applyInstruction}>{busy ? '…' : t('contracts.apply')}</button>
                  </div>
                </div>
                <label className="settings-toggle mt-2">
                  <input type="checkbox" checked={saveToTemplate} onChange={(e) => setSaveToTemplate(e.target.checked)} />
                  <span>{t('contracts.saveToTemplate')}</span>
                </label>
                <p className="form-hint">{t('contracts.notLegalAdvice')}</p>
              </>
            )}
          </div>
          <div className="delete-modal-actions">
            <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
            {draft && !needsSetup && <button className="btn btn-primary" disabled={busy} onClick={continueToSign}>{busy ? '…' : t('contracts.continueToSign')}</button>}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default DraftContractModal;
