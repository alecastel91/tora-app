import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appConfirm } from '../../utils/dialogs';
import { FileTextIcon } from '../../utils/icons';
import useDocumentTemplates from '../../hooks/useDocumentTemplates';
import TemplatesSection, { TemplateNameField } from './TemplatesSection';

/**
 * Profile → Manage → Documents → Contract templates.
 * The member's contract templates: their own Word file (identical, blanks
 * filled from the booking), their own PDF (letterhead kept, clauses laid out
 * again), or clauses on TORA's plain page. Details: the clauses (basic /
 * PDF) or the blanks TORA recognised (Word).
 */
const ClausesEditor = ({ template, save, busy, placeholders }) => {
  const { t } = useLanguage();
  const [name, setName] = useState(template.name);
  const [draft, setDraft] = useState(template.template || {});
  useEffect(() => { setName(template.name); setDraft(template.template || {}); }, [template.id, template.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = name !== template.name || JSON.stringify(draft) !== JSON.stringify(template.template || {});
  const setSection = (i, patch) => setDraft((d) => ({ ...d, sections: d.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const removeSection = async (i) => { if (await appConfirm(t('contracts.removeClauseConfirm'), { confirmLabel: t('contracts.removeClause'), danger: true })) setDraft((d) => ({ ...d, sections: d.sections.filter((_, j) => j !== i) })); };
  const addSection = () => setDraft((d) => ({ ...d, sections: [...(d.sections || []), { heading: '', body: '' }] }));
  return (
    <div className="invoice-form">
      <TemplateNameField value={name} onChange={setName} />
      {draft.notes && <div className="agency-card"><p className="form-hint" style={{ margin: 0 }}>{t('templates.notes')}: {draft.notes}</p></div>}
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
      <p className="form-hint">{t('contracts.notLegalAdvice')}</p>
      <button className="btn btn-primary" disabled={busy || !dirty} onClick={() => save({ name, template: draft })}>{busy ? '…' : t('templates.save')}</button>
    </div>
  );
};

/** A Word template: what TORA will fill in, and how to change the wording. */
const WordDetails = ({ template, save, busy }) => {
  const { t } = useLanguage();
  const [name, setName] = useState(template.name);
  useEffect(() => setName(template.name), [template.id, template.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const fields = template.docx?.fields || [];
  const keys = [...new Set(fields.map((f) => f.key))];
  return (
    <div className="invoice-form">
      <TemplateNameField value={name} onChange={setName} />
      <h4 className="calendar-sync-sub">{t('contracts.blanksTitle')}</h4>
      {keys.length ? (
        <ul className="template-blanks">
          {keys.map((k) => <li key={k}><b>{t(`contracts.ph.${k}`)}</b> <span className="form-hint m-0">← {fields.filter((f) => f.key === k).map((f) => `"${f.text}"`).join(', ')}</span></li>)}
        </ul>
      ) : <p className="form-hint">{t('contracts.blanksNone')}</p>}
      <p className="form-hint">{t('contracts.docxEditHint')}</p>
      <p className="form-hint">{t('contracts.notLegalAdvice')}</p>
      <button className="btn btn-primary" disabled={busy || name === template.name} onClick={() => save({ name })}>{busy ? '…' : t('templates.save')}</button>
    </div>
  );
};

const ContractTemplateSection = ({ profile }) => {
  const store = useDocumentTemplates({ profileId: profile?.id, api: apiService.contractTemplates, toasts: { added: 'contracts.added', saved: 'contracts.saved', removed: 'contracts.removed', defaultSet: 'templates.defaultSet' } });
  if (!profile?.id) return null;
  return (
    <TemplatesSection
      ns="contracts" icon={<FileTextIcon />} store={store} profile={profile}
      renderDetails={(template, { save, busy }) => (template.kind === 'docx'
        ? <WordDetails template={template} save={save} busy={busy} />
        : <ClausesEditor template={template} save={save} busy={busy} placeholders={store.placeholders || []} />)}
    />
  );
};

export default ContractTemplateSection;
