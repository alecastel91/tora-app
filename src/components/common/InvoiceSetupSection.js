import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { FileTextIcon } from '../../utils/icons';
import useDocumentTemplates from '../../hooks/useDocumentTemplates';
import TemplatesSection, { TemplateNameField } from './TemplatesSection';

/**
 * Profile → Manage → Documents → Invoices.
 * The member's invoice templates: their own Word file (identical output),
 * their own PDF (layout kept, values rewritten), or TORA's basic layout. The
 * details of each hold the invoice profile — numbering, tax, currency — and,
 * for the basic layout, every printed block.
 */
const FIELD_GROUPS = [
  { title: 'issuer', keys: ['title', 'language', 'issuerName', 'issuerAddress', 'issuerTaxId', 'issuerRegistrationNo', 'issuerContact'] },
  { title: 'numbering', keys: ['numberPattern', 'nextSequence'] },
  { title: 'tax', keys: ['taxMode', 'taxRate', 'taxLabel', 'currencyDefault'] },
  { title: 'labels', keys: ['numberLabel', 'dateLabel', 'dueLabel', 'billToLabel', 'descriptionLabel', 'amountLabel', 'totalLabel'] },
  { title: 'payment', keys: ['paymentTerms', 'bankDetails', 'footerNote'] },
];
// A file template prints its own blocks; only these matter for it.
const FILE_GROUPS = [
  { title: 'numbering', keys: ['numberPattern', 'nextSequence'] },
  { title: 'tax', keys: ['taxMode', 'taxRate', 'currencyDefault'] },
  { title: 'issuer', keys: ['title', 'language', 'issuerName'] },
];
const MULTILINE = new Set(['issuerAddress', 'paymentTerms', 'bankDetails', 'footerNote']);
const TAX_MODES = ['none', 'added', 'included', 'reverse_charge'];

const InvoiceTemplateDetails = ({ template, save, busy }) => {
  const { t } = useLanguage();
  const [name, setName] = useState(template.name);
  const [draft, setDraft] = useState(template.profile || {});
  useEffect(() => { setName(template.name); setDraft(template.profile || {}); }, [template.id, template.updatedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = name !== template.name || JSON.stringify(draft) !== JSON.stringify(template.profile || {});
  const groups = template.kind === 'basic' ? FIELD_GROUPS : FILE_GROUPS;
  return (
    <div className="invoice-form">
      <TemplateNameField value={name} onChange={setName} />
      {template.kind !== 'basic' && <p className="form-hint">{t('invoices.detailsHint')}</p>}
      {groups.map((g) => (
        <div key={g.title} className="invoice-form-group">
          <h4 className="calendar-sync-sub">{t(`invoices.group.${g.title}`)}</h4>
          {g.keys.map((k) => (
            <div key={k} className="invoice-field">
              <label className="form-label">{t(`invoices.field.${k}`)}</label>
              {k === 'taxMode' ? (
                <select className="form-input" value={draft[k] || 'none'} onChange={(e) => set(k, e.target.value)}>
                  {TAX_MODES.map((m) => <option key={m} value={m}>{t(`invoices.taxMode.${m}`)}</option>)}
                </select>
              ) : MULTILINE.has(k) ? (
                <textarea className="form-input" rows={3} value={draft[k] || ''} onChange={(e) => set(k, e.target.value)} />
              ) : (
                <input type="text" className="form-input" value={draft[k] || ''} onChange={(e) => set(k, e.target.value)} />
              )}
            </div>
          ))}
        </div>
      ))}
      <p className="form-hint">{t('invoices.numberPatternHint')}</p>
      <button className="btn btn-primary" disabled={busy || !dirty} onClick={() => save({ name, profile: draft })}>{busy ? '…' : t('templates.save')}</button>
    </div>
  );
};

const InvoiceSetupSection = ({ profile }) => {
  const store = useDocumentTemplates({ profileId: profile?.id, api: apiService.invoiceTemplates, toasts: { added: 'invoices.added', saved: 'invoices.saved', removed: 'invoices.removed', defaultSet: 'templates.defaultSet' } });
  if (!profile?.id) return null;
  return (
    <TemplatesSection
      ns="invoices" icon={<FileTextIcon />} store={store} profile={profile}
      renderDetails={(template, { save, busy }) => <InvoiceTemplateDetails template={template} save={save} busy={busy} />}
    />
  );
};

export default InvoiceSetupSection;
