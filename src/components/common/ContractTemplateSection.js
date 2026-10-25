import React, { useEffect, useRef, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert, appConfirm } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { FileTextIcon } from '../../utils/icons';

/**
 * Profile → Manage → Documents → Contract template.
 * Upload 2–5 past contracts; TORA extracts the clauses you always use into a
 * template with {{placeholders}} for the deal values. Review every section,
 * edit, save. New bookings are then drafted from it on the booking card.
 */
const ContractTemplateSection = ({ profile }) => {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [placeholders, setPlaceholders] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const profileId = profile?.id;

  useEffect(() => {
    if (!profileId) return;
    apiService.getContractTemplate(profileId).then((d) => { setSaved(d.template); setDraft(d.template); setPlaceholders(d.placeholders || []); }).catch(() => {});
  }, [profileId]);

  if (!profileId) return null;

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 5);
    e.target.value = '';
    if (!files.length) return;
    if (files.some((f) => f.type !== 'application/pdf' || f.size > 10 * 1024 * 1024)) { appAlert(t('invoices.pdfOnly')); return; }
    setBusy(true);
    try {
      const r = await apiService.learnContractTemplate(profileId, files);
      setDraft(r.template);
      showToast('contracts.learned');
    } catch (err) { appAlert(err.message || t('common.error')); } finally { setBusy(false); }
  };

  const save = async () => {
    if (busy || !draft) return;
    setBusy(true);
    try {
      const r = await apiService.saveContractTemplate(profileId, draft);
      setSaved(r.template); setDraft(r.template);
      showToast('contracts.saved');
    } catch (err) { appAlert(err.message || t('common.error')); } finally { setBusy(false); }
  };

  const setSection = (i, patch) => setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const removeSection = async (i) => { if (await appConfirm(t('contracts.removeClauseConfirm'), { confirmLabel: t('contracts.removeClause'), danger: true })) setDraft((d) => ({ ...d, sections: d.sections.filter((_, j) => j !== i) })); };
  const addSection = () => setDraft((d) => ({ ...d, sections: [...(d.sections || []), { heading: '', body: '' }] }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div className="dashboard-section contract-template">
      <div className="section-header"><h3><FileTextIcon /> {t('contracts.setupTitle')}</h3></div>
      <p className="form-hint" style={{ marginTop: 0 }}>{t('contracts.setupIntro')}</p>
      <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={onFiles} />
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? '…' : saved ? t('contracts.relearn') : t('contracts.uploadExamples')}</button>
        {!draft && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setDraft({ language: 'en', title: 'Performance Agreement', sections: [{ heading: '', body: '' }], signatureBlock: 'For {{artist}}: ____________  Date: ______\nFor {{booker}}: ____________  Date: ______', notes: '' })}>{t('invoices.startBlank')}</button>}
      </div>
      <p className="form-hint">{t('contracts.privacy')} {t('contracts.notLegalAdvice')}</p>

      {draft && (
        <div className="invoice-form">
          {draft.notes && <div className="agency-card"><p className="form-hint" style={{ margin: 0 }}>{t('contracts.aiNotes')}: {draft.notes}</p></div>}
          <div className="invoice-field">
            <label className="form-label">{t('contracts.title')}</label>
            <input type="text" className="form-input" value={draft.title || ''} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
          </div>
          {(draft.sections || []).map((s, i) => (
            <div key={i} className="contract-clause">
              <div className="flex items-center gap-2">
                <span className="contract-clause-no">{i + 1}.</span>
                <input type="text" className="form-input flex-1" placeholder={t('contracts.headingPlaceholder')} value={s.heading} onChange={(e) => setSection(i, { heading: e.target.value })} />
                <button type="button" className="btn btn-outline btn-sm" onClick={() => removeSection(i)} aria-label={t('contracts.removeClause')}>×</button>
              </div>
              <textarea className="form-input" rows={5} value={s.body} onChange={(e) => setSection(i, { body: e.target.value })} />
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm self-start" onClick={addSection}>{t('contracts.addClause')}</button>
          <div className="invoice-field">
            <label className="form-label">{t('contracts.signatureBlock')}</label>
            <textarea className="form-input" rows={3} value={draft.signatureBlock || ''} onChange={(e) => setDraft((d) => ({ ...d, signatureBlock: e.target.value }))} />
          </div>
          <p className="form-hint">{t('contracts.placeholdersHint')} {placeholders.map((p) => `{{${p}}}`).join(' ')}</p>
          <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{t('contracts.save')}</button>
        </div>
      )}
    </div>
  );
};

export default ContractTemplateSection;
