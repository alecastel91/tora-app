import React, { useRef } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { FileTextIcon } from '../../utils/icons';
import { isYearlyViewer, openPremium } from '../../utils/subscription';
import useLearnedDocument from '../../hooks/useLearnedDocument';

/**
 * Profile → Manage → Documents → Invoices.
 * Upload 1–3 past invoices; TORA reads them and proposes an invoice profile
 * (issuer block, numbering, tax line, bank details, wording, language). The
 * member checks every field, edits, saves. New invoices are then issued from
 * the booking card in exactly this style. Nothing here is public.
 */
const FIELD_GROUPS = [
  { title: 'issuer', keys: ['title', 'language', 'issuerName', 'issuerAddress', 'issuerTaxId', 'issuerRegistrationNo', 'issuerContact'] },
  { title: 'numbering', keys: ['numberPattern', 'nextSequence'] },
  { title: 'tax', keys: ['taxMode', 'taxRate', 'taxLabel', 'currencyDefault'] },
  { title: 'labels', keys: ['numberLabel', 'dateLabel', 'dueLabel', 'billToLabel', 'descriptionLabel', 'amountLabel', 'totalLabel'] },
  { title: 'payment', keys: ['paymentTerms', 'bankDetails', 'footerNote'] },
];
const MULTILINE = new Set(['issuerAddress', 'paymentTerms', 'bankDetails', 'footerNote']);
const TAX_MODES = ['none', 'added', 'included', 'reverse_charge'];
const BLANK = { language: 'en', title: 'Invoice', numberPattern: '{YYYY}-{SEQ:4}', nextSequence: '1', taxMode: 'none', currencyDefault: 'EUR' };
const API = { get: (id) => apiService.getInvoiceProfile(id), learn: (id, files) => apiService.learnInvoiceProfile(id, files), save: (id, draft) => apiService.saveInvoiceProfile(id, draft) };

const InvoiceSetupSection = ({ profile }) => {
  const { t } = useLanguage();
  const fileRef = useRef(null);
  const profileId = profile?.id;
  const yearly = isYearlyViewer(profile);
  const { saved, draft, setDraft, busy, dirty, onFiles, save } = useLearnedDocument({
    profileId, api: API, pick: (r) => r.profile, maxFiles: 3, toasts: { learned: 'invoices.learned', saved: 'invoices.saved' },
  });

  if (!profileId) return null;
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  return (
    <div className="dashboard-section invoice-setup">
      <div className="section-header">
        <h3><FileTextIcon /> {t('invoices.setupTitle')}</h3>
      </div>
      <p className="form-hint" style={{ marginTop: 0 }}>{t('invoices.setupIntro')}</p>
      <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={onFiles} />
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => (yearly ? fileRef.current?.click() : openPremium())} title={yearly ? undefined : t('aiFeatures.yearlyOnly')}>
          {busy ? '…' : saved ? t('invoices.relearn') : t('invoices.uploadExamples')}
        </button>
        {!draft && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setDraft(BLANK)}>{t('invoices.startBlank')}</button>}
      </div>
      <p className="form-hint">{!yearly && <>{t('aiFeatures.yearlyOnly')} </>}{t('invoices.privacy')}</p>

      {draft && (
        <div className="invoice-form">
          {FIELD_GROUPS.map((g) => (
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
          <button className="btn btn-primary" disabled={busy || !dirty} onClick={save}>{t('invoices.save')}</button>
        </div>
      )}
    </div>
  );
};

export default InvoiceSetupSection;
