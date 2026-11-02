import React, { useEffect, useRef, useState } from 'react';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { showToast } from '../../utils/toast';
import { formatFee } from '../../utils/dealStatus';
import useBusyAction from '../../hooks/useBusyAction';
import { appAlert } from '../../utils/dialogs';
import { TemplateKindBadge } from './TemplatesSection';
import DocModal from './DocModal';

// The deal's own currency, whatever it is (money.js formats only the three
// billing currencies TORA charges in).
const dealMoney = (n, cur) => `${formatFee(n)} ${cur}`;

/**
 * Issue an invoice for an accepted booking with one of the member's
 * templates (Profile → Manage → Documents → Invoices). The form sits next
 * to the PDF as it will be sent (desktop) or above an "Open preview" button
 * (mobile): pick the template and deposit / balance / full, adjust the
 * amount or the number, then issue — it lands on the booking card, in the
 * chat, and (if ticked) in the booker's inbox.
 */
const IssueInvoiceModal = ({ isOpen, deal, currentUser, onClose, onIssued }) => {
  const { t } = useLanguage();
  const [kind, setKind] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [number, setNumber] = useState('');
  const [send, setSend] = useState(true);
  const [preview, setPreview] = useState(null); // { blobUrl, number, amount, currency }
  const [stale, setStale] = useState(false);    // the form changed since the PDF was built
  const [needsSetup, setNeedsSetup] = useState(false);
  const [building, setBuilding] = useState(false);
  const [viewing, setViewing] = useState(false); // the preview PDF open full-screen
  const [loadError, setLoadError] = useState(false);
  // Every edit bumps this; a build that started before the last edit comes
  // back already stale instead of showing a PDF for the previous values.
  const editSeq = useRef(0);
  const invalidate = () => { editSeq.current += 1; setStale(true); };
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [busy, run] = useBusyAction();
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
  const body = () => ({ profileId: currentUser.id, dealId: deal.id, kind, templateId, ...(amount !== '' ? { amount: Number(amount) } : {}), ...(number.trim() ? { number: number.trim() } : {}) });

  const dropPreview = () => { setPreview((p) => { if (p?.blobUrl) URL.revokeObjectURL(p.blobUrl); return null; }); setStale(false); setViewing(false); };

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;
    setKind(paid > 0 ? 'final' : 'deposit');
    setAmount(''); setNumber(''); dropPreview(); setNeedsSetup(false); setLoadError(false); setTemplateId(null); setTemplates([]);
    let cancelled = false;
    apiService.invoiceTemplates.list(currentUser.id)
      .then((r) => { if (cancelled) return; setTemplates(r.templates || []); if (!r.templates?.length) setNeedsSetup(true); else setTemplateId(r.defaultId || r.templates[0].id); })
      .catch(() => { if (!cancelled) setLoadError(true); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const build = async (req) => {
    const at = editSeq.current;
    setBuilding(true);
    try {
      const p = await apiService.previewInvoice(req);
      setPreview((old) => { if (old?.blobUrl) URL.revokeObjectURL(old.blobUrl); return { ...p, number: p.number ? decodeURIComponent(p.number) : p.number }; });
      setStale(editSeq.current !== at);
    } finally { setBuilding(false); }
  };

  // Open straight onto the invoice as it will look, and rebuild it when the
  // template or the kind changes (amount / number edits wait for
  // "Update preview" so typing doesn't fire a request per keystroke).
  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id || !templateId) return;
    let cancelled = false;
    editSeq.current += 1;
    build({ profileId: currentUser.id, dealId: deal.id, kind, templateId })
      .catch((e) => { if (!cancelled && !orSetup(e)) appAlert(e.message || t('common.error')); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, kind, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free the PDF blob when the modal closes (it stays mounted with isOpen=false).
  useEffect(() => { if (!isOpen) dropPreview(); }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !deal) return null;

  const doPreview = () => run(() => build(body()), { onError: orSetup });

  const doIssue = () => run(async () => {
    const r = await apiService.issueInvoice({ ...body(), send });
    showToast(r.emailed ? 'invoices.issuedAndSent' : 'invoices.issued');
    if (onIssued) onIssued(r.deal);
    onClose();
  }, { onError: orSetup });

  const selected = templates.find((x) => x.id === templateId);
  const ready = !needsSetup && !loadError && templateId;
  const previewTitle = preview ? t('invoices.previewLine', { number: preview.number, amount: dealMoney(preview.amount, preview.currency || currency) }) : '';

  return (
    <DocModal
      className="invoice-modal"
      title={t('invoices.issueTitle')}
      subtitle={`${deal.eventName || deal.venueName} · ${t('invoices.feeLine', { fee: dealMoney(fee, currency) })}${paid > 0 ? ` · ${t('invoices.paidSoFar', { paid: dealMoney(paid, currency) })}` : ''}`}
      onClose={onClose}
      preview={ready ? { url: preview?.blobUrl || null, title: previewTitle, building, stale, onRefresh: doPreview, viewing, setViewing } : null}
      actions={(
        <>
          <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
          {ready && (!preview || stale) && <button className="btn btn-outline" disabled={busy || building} onClick={doPreview}>{busy || building ? '…' : t('invoices.updatePreview')}</button>}
          {ready && <button className="btn btn-primary" disabled={busy || building || !preview} onClick={doIssue}>{busy ? '…' : t('invoices.issue')}</button>}
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
          <label className="form-label">{t('templates.choose')}</label>
          {templates.length > 1 ? (
            <div className="invoice-kind-row">
              {templates.map((x) => (
                <button key={x.id} type="button" className={`btn btn-sm ${templateId === x.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => { if (x.id !== templateId) { setTemplateId(x.id); setAmount(''); setNumber(''); } }}>{x.name}</button>
              ))}
            </div>
          ) : selected && <p className="template-line mb-3"><strong className="text-white text-sm">{selected.name}</strong><TemplateKindBadge kind={selected.kind} /></p>}
          {templates.length > 1 && selected && <p className="template-line mb-3 -mt-1"><TemplateKindBadge kind={selected.kind} /></p>}

          <div className="invoice-kind-row">
            {['deposit', 'final', 'full'].map((k) => (
              <button key={k} type="button" className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => { if (k === kind) return; setKind(k); setAmount(''); setNumber(''); }}>
                {t(`invoices.kind.${k}`)}
              </button>
            ))}
          </div>
          <div className="invoice-fields">
            <div className="invoice-field">
              <label className="form-label">{t('invoices.amount')} ({currency})</label>
              <input type="number" min="0" step="0.01" className="form-input" placeholder={String(defaults[kind])} value={amount} onChange={(e) => { setAmount(e.target.value); invalidate(); }} />
            </div>
            <div className="invoice-field">
              <label className="form-label">{t('invoices.number')}</label>
              <input type="text" className="form-input" placeholder={preview?.number || t('invoices.numberAuto')} value={number} onChange={(e) => { setNumber(e.target.value); invalidate(); }} maxLength={40} />
            </div>
          </div>
          <p className="form-hint">{t('invoices.numberHint')}</p>

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
