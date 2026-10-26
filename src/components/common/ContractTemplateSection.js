import React, { useRef, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appConfirm } from '../../utils/dialogs';
import { FileTextIcon } from '../../utils/icons';
import { isYearlyViewer, openPremium } from '../../utils/subscription';
import useLearnedDocument from '../../hooks/useLearnedDocument';

/**
 * Profile → Manage → Documents → Contract template.
 * Upload 2–5 past contracts; TORA extracts the clauses you always use into a
 * template with {{placeholders}} for the deal values. Review every section,
 * edit, save. New bookings are then drafted from it on the booking card.
 */
const BLANK = { language: 'en', title: 'Performance Agreement', sections: [{ heading: '', body: '' }], signatureBlock: 'For {{artist}}: ____________  Date: ______\nFor {{booker}}: ____________  Date: ______', notes: '' };
const API = { get: (id) => apiService.getContractTemplate(id), learn: (id, files) => apiService.learnContractTemplate(id, files), save: (id, draft) => apiService.saveContractTemplate(id, draft) };

const ContractTemplateSection = ({ profile }) => {
  const { t } = useLanguage();
  const [placeholders, setPlaceholders] = useState([]);
  const fileRef = useRef(null);
  const profileId = profile?.id;
  const yearly = isYearlyViewer(profile);
  const { saved, draft, setDraft, busy, dirty, onFiles, save } = useLearnedDocument({
    profileId, api: API, pick: (r) => r.template, maxFiles: 5, toasts: { learned: 'contracts.learned', saved: 'contracts.saved' },
    onLoaded: (r) => setPlaceholders(r.placeholders || []),
  });

  if (!profileId) return null;

  const setSection = (i, patch) => setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const removeSection = async (i) => { if (await appConfirm(t('contracts.removeClauseConfirm'), { confirmLabel: t('contracts.removeClause'), danger: true })) setDraft((d) => ({ ...d, sections: d.sections.filter((_, j) => j !== i) })); };
  const addSection = () => setDraft((d) => ({ ...d, sections: [...(d.sections || []), { heading: '', body: '' }] }));

  return (
    <div className="dashboard-section contract-template">
      <div className="section-header"><h3><FileTextIcon /> {t('contracts.setupTitle')}</h3></div>
      <p className="form-hint" style={{ marginTop: 0 }}>{t('contracts.setupIntro')}</p>
      <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={onFiles} />
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => (yearly ? fileRef.current?.click() : openPremium())} title={yearly ? undefined : t('aiFeatures.yearlyOnly')}>{busy ? '…' : saved ? t('contracts.relearn') : t('contracts.uploadExamples')}</button>
        {!draft && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setDraft(BLANK)}>{t('invoices.startBlank')}</button>}
      </div>
      <p className="form-hint">{!yearly && <>{t('aiFeatures.yearlyOnly')} </>}{t('contracts.privacy')} {t('contracts.notLegalAdvice')}</p>

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
