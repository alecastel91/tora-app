import React, { useEffect, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { showToast } from '../../utils/toast';
import { formatFee } from '../../utils/dealStatus';
import useBusyAction from '../../hooks/useBusyAction';
import usePdfPreview from '../../hooks/usePdfPreview';
import { appAlert } from '../../utils/dialogs';
import { TemplatePicker, usableTemplates } from './TemplatesSection';
import DocModal from './DocModal';

// The deal's own currency, whatever it is (money.js formats only the three
// billing currencies TORA charges in).
const dealMoney = (n, cur) => `${formatFee(n)} ${cur}`;

/**
 * Issue an invoice for an accepted booking with one of the member's
 * templates (Profile → Manage → Documents → Invoices). The form sits next
 * to the PDF as it will be sent (desktop) or above an "Open preview" button
 * (mobile): pick the template (own, or one the member's agent / artist
 * shares), deposit / balance / full, adjust the amount or the number, and —
 * behind "Edit details" — the bill-to, the description and the dates, then
 * issue — it lands on the booking card, in the chat, and (if ticked) in the
 * booker's inbox.
 */
const FIELD_KEYS = ['billToName', 'billToAddress', 'description', 'issueDate', 'dueDate'];
const EMPTY_FIELDS = Object.fromEntries(FIELD_KEYS.map((k) => [k, '']));
const IssueInvoiceModal = ({ isOpen, deal, currentUser, onClose, onIssued }) => {
  const { t } = useLanguage();
  const [kind, setKind] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [number, setNumber] = useState('');
  const [send, setSend] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [fields, setFields] = useState(EMPTY_FIELDS);   // overrides; '' = what the booking says
  const [showDetails, setShowDetails] = useState(false);
  const [busy, run] = useBusyAction();
  const preview = usePdfPreview(); // meta: { number, amount, currency, defaults }
  // The booking card points to the setup page instead of showing an error.
  const orSetup = (e) => {
    if (e.code === 'TEMPLATE_NOT_FOUND') return dropGone();
    if (e.code !== 'INVOICE_PROFILE_MISSING') return false;
    setNeedsSetup(true); return true;
  };
  // The chosen template was deleted elsewhere: fall back to the next one.
  const dropGone = () => { const left = templates.filter((x) => x.id !== templateId); setTemplates(left); setTemplateId(left[0]?.id || null); if (!left.length) setNeedsSetup(true); return true; };

  const pay = deal?.payment || {};
  const paid = Number(pay.depositAmount) || 0;
  const fee = Number(deal?.currentFee) || 0;
  const defaults = { deposit: Math.round(fee * 50) / 100, final: Math.max(0, fee - paid), full: fee };
  const currency = deal?.currency || 'EUR';
  const givenFields = () => Object.fromEntries(FIELD_KEYS.filter((k) => fields[k].trim()).map((k) => [k, fields[k].trim()]));
  const body = () => ({ profileId: currentUser.id, dealId: deal.id, kind, templateId, ...(amount !== '' ? { amount: Number(amount) } : {}), ...(number.trim() ? { number: number.trim() } : {}), fields: givenFields() });
  // Changing the template or the kind starts the amount, number and details over.
  const startOver = () => { setAmount(''); setNumber(''); setFields(EMPTY_FIELDS); };
  const pickTemplate = (id) => { setTemplateId(id); startOver(); };
  const pickKind = (k) => { if (k !== kind) { setKind(k); startOver(); } };
  const setField = (k, v) => { setFields((f) => ({ ...f, [k]: v })); preview.markStale(); };

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;
    setKind(paid > 0 ? 'final' : 'deposit');
    startOver(); setShowDetails(false); preview.drop(); setNeedsSetup(false); setLoadError(false); setTemplateId(null); setTemplates([]);
    let cancelled = false;
    apiService.invoiceTemplates.list(currentUser.id)
      .then((r) => {
        if (cancelled) return;
        // Own templates, then the ones shared by the agent / the artist of this booking.
        const list = usableTemplates(r, { viewer: currentUser, artistId: deal?.bookedArtistId || deal?.artistId });
        setTemplates(list);
        if (!list.length) setNeedsSetup(true); else setTemplateId(list.some((x) => x.id === r.defaultId) ? r.defaultId : list[0].id);
      })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const build = (req) => preview.build(async () => {
    const { blobUrl, ...meta } = await apiService.previewInvoice(req);
    return { url: blobUrl, ...meta, number: meta.number ? decodeURIComponent(meta.number) : meta.number };
  });

  // Open straight onto the invoice as it will look, and rebuild it when the
  // template or the kind changes (amount / number edits wait for
  // "Update preview" so typing doesn't fire a request per keystroke).
  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id || !templateId) return;
    build({ profileId: currentUser.id, dealId: deal.id, kind, templateId })
      .catch((e) => { if (!orSetup(e)) appAlert(e.message || t('common.error')); });
  }, [isOpen, deal?.id, kind, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free the PDF blob when the modal closes (it stays mounted with isOpen=false).
  useEffect(() => { if (!isOpen) preview.drop(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !deal) return null;

  const doPreview = () => run(() => build(body()), { onError: orSetup });

  const doIssue = () => run(async () => {
    const r = await apiService.issueInvoice({ ...body(), send });
    showToast(r.emailed ? 'invoices.issuedAndSent' : 'invoices.issued');
    if (onIssued) onIssued(r.deal);
    onClose();
  }, { onError: orSetup });

  const ready = !needsSetup && !loadError && templateId;
  const m = preview.meta;
  const previewTitle = m ? t('invoices.previewLine', { number: m.number, amount: dealMoney(m.amount, m.currency || currency) }) : '';

  return (
    <DocModal
      className="invoice-modal"
      title={t('invoices.issueTitle')}
      subtitle={`${deal.eventName || deal.venueName} · ${t('invoices.feeLine', { fee: dealMoney(fee, currency) })}${paid > 0 ? ` · ${t('invoices.paidSoFar', { paid: dealMoney(paid, currency) })}` : ''}`}
      onClose={onClose}
      preview={ready ? { url: preview.url, title: previewTitle, fileName: m?.number ? `${m.number}.pdf` : '', building: preview.building, stale: preview.stale, onRefresh: doPreview, viewing: preview.viewing, setViewing: preview.setViewing } : null}
      actions={(
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
          {/* Once a PDF is up, the pane's own pill / button is the one way to rebuild it. */}
          {ready && !preview.url && <button className="btn btn-outline" disabled={busy || preview.building} onClick={doPreview}>{busy || preview.building ? '…' : t('invoices.updatePreview')}</button>}
          {ready && <button className="btn btn-primary" disabled={busy || preview.building || !preview.url} onClick={doIssue}>{busy ? '…' : t('invoices.issue')}</button>}
        </>
      )}
    >
      {loadError ? (
        <p className="form-hint">{t('common.error')}</p>
      ) : needsSetup ? (
        <div className="agency-card">
          <p className="m-0 text-sm text-white">{t('invoices.setupFirst')}</p>
          <p className="form-hint">{t('invoices.setupWhere')}</p>
        </div>
      ) : (
        <>
          <TemplatePicker templates={templates} templateId={templateId} onPick={pickTemplate} />

          <div className="invoice-kind-row">
            {['deposit', 'final', 'full'].map((k) => (
              <button key={k} type="button" className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => pickKind(k)}>
                {t(`invoices.kind.${k}`)}
              </button>
            ))}
          </div>
          <div className="invoice-fields">
            <div className="invoice-field">
              <label className="form-label">{t('invoices.amount')} ({currency})</label>
              <input type="number" min="0" step="0.01" className="form-input" placeholder={String(defaults[kind])} value={amount} onChange={(e) => { setAmount(e.target.value); preview.markStale(); }} />
            </div>
            <div className="invoice-field">
              <label className="form-label">{t('invoices.number')}</label>
              <input type="text" className="form-input" placeholder={m?.number || t('invoices.numberAuto')} value={number} onChange={(e) => { setNumber(e.target.value); preview.markStale(); }} maxLength={40} />
            </div>
          </div>
          <p className="form-hint">{t('invoices.numberHint')}</p>

          {/* Bill-to, description and dates: what the booking says unless written over. */}
          <button type="button" className="template-act invoice-details-toggle" onClick={() => setShowDetails((v) => !v)}>{showDetails ? t('templates.hideDetails') : t('invoices.editDetails')}</button>
          {showDetails && (
            <div className="invoice-details">
              <div className="invoice-fields">
                <div className="invoice-field">
                  <label className="form-label">{t('invoices.fieldBillTo')}</label>
                  <input type="text" className="form-input" placeholder={m?.defaults?.billToName || ''} value={fields.billToName} onChange={(e) => setField('billToName', e.target.value)} maxLength={120} />
                </div>
                <div className="invoice-field">
                  <label className="form-label">{t('invoices.fieldAddress')}</label>
                  <textarea className="form-input" rows={2} placeholder={m?.defaults?.billToAddress || ''} value={fields.billToAddress} onChange={(e) => setField('billToAddress', e.target.value)} maxLength={400} />
                </div>
                <div className="invoice-field is-wide">
                  <label className="form-label">{t('invoices.fieldDescription')}</label>
                  <textarea className="form-input" rows={2} placeholder={m?.defaults?.description || ''} value={fields.description} onChange={(e) => setField('description', e.target.value)} maxLength={600} />
                </div>
                <div className="invoice-field">
                  <label className="form-label">{t('invoices.fieldIssueDate')}</label>
                  <input type="date" className="form-input" value={fields.issueDate} onChange={(e) => setField('issueDate', e.target.value)} />
                </div>
                <div className="invoice-field">
                  <label className="form-label">{t('invoices.fieldDueDate')}</label>
                  <input type="date" className="form-input" placeholder={m?.defaults?.dueDate || ''} value={fields.dueDate} onChange={(e) => setField('dueDate', e.target.value)} />
                </div>
              </div>
              <p className="form-hint">{t('invoices.detailsEmptyHint')}</p>
            </div>
          )}

          <label className="settings-toggle mt-3">
            <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
            <span>{t('invoices.emailBooker')}</span>
          </label>
        </>
      )}
    </DocModal>
  );
};

export default IssueInvoiceModal;
