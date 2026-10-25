import React, { useEffect, useRef, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { appAlert } from '../../utils/dialogs';
import { showToast } from '../../utils/toast';
import { FileTextIcon } from '../../utils/icons';
import { isYearlyViewer } from '../../utils/subscription';

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

const InvoiceSetupSection = ({ profile }) => {
  const { t } = useLanguage();
  const [saved, setSaved] = useState(null);
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const profileId = profile?.id;
  const yearly = isYearlyViewer(profile);

  useEffect(() => {
    if (!profileId) return;
    apiService.getInvoiceProfile(profileId).then((d) => { setSaved(d.profile); setDraft(d.profile); }).catch(() => {});
  }, [profileId]);

  if (!profileId) return null;

  const onFiles = async (e) => {
    const files = [...(e.target.files || [])].slice(0, 3);
    e.target.value = '';
    if (!files.length) return;
    if (files.some((f) => f.type !== 'application/pdf' || f.size > 10 * 1024 * 1024)) { appAlert(t('invoices.pdfOnly')); return; }
    setBusy(true);
    try {
      const r = await apiService.learnInvoiceProfile(profileId, files);
      setDraft(r.profile);
      showToast('invoices.learned');
    } catch (err) {
      appAlert(err.message || t('common.error'));
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (busy || !draft) return;
    setBusy(true);
    try {
      const r = await apiService.saveInvoiceProfile(profileId, draft);
      setSaved(r.profile); setDraft(r.profile);
      showToast('invoices.saved');
    } catch (err) { appAlert(err.message || t('common.error')); } finally { setBusy(false); }
  };

  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return (
    <div className="dashboard-section invoice-setup">
      <div className="section-header">
        <h3><FileTextIcon /> {t('invoices.setupTitle')}</h3>
      </div>
      <p className="form-hint" style={{ marginTop: 0 }}>{t('invoices.setupIntro')}</p>
      <input ref={fileRef} type="file" accept="application/pdf" multiple style={{ display: 'none' }} onChange={onFiles} />
      <div className="flex flex-wrap gap-2 mb-3">
        <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => { if (!yearly) { window.dispatchEvent(new CustomEvent('tora:open-premium')); return; } fileRef.current?.click(); }} title={yearly ? undefined : t('aiFeatures.yearlyOnly')}>
          {busy ? '…' : saved ? t('invoices.relearn') : t('invoices.uploadExamples')}
        </button>
        {!draft && <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => setDraft({ language: 'en', title: 'Invoice', numberPattern: '{YYYY}-{SEQ:4}', nextSequence: '1', taxMode: 'none', currencyDefault: 'EUR' })}>{t('invoices.startBlank')}</button>}
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
