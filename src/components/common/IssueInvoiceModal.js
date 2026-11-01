import React, { useEffect, useState } from 'react';
import OverlayPortal from './OverlayPortal';
import apiService from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { showToast } from '../../utils/toast';
import { formatFee } from '../../utils/dealStatus';
import useBusyAction from '../../hooks/useBusyAction';
import { appAlert } from '../../utils/dialogs';
import { TemplateKindBadge } from './TemplatesSection';

// The deal's own currency, whatever it is (money.js formats only the three
// billing currencies TORA charges in).
const dealMoney = (n, cur) => `${formatFee(n)} ${cur}`;

/**
 * Issue an invoice for an accepted booking with one of the member's
 * templates (Profile → Manage → Documents → Invoices). Pick the template
 * and deposit / balance / full, see the PDF, adjust the amount or the
 * number, then issue: it lands on the booking card, in the chat, and (if
 * ticked) in the booker's inbox.
 */
const IssueInvoiceModal = ({ isOpen, deal, currentUser, onClose, onIssued }) => {
  const { t } = useLanguage();
  const [kind, setKind] = useState('deposit');
  const [amount, setAmount] = useState('');
  const [number, setNumber] = useState('');
  const [send, setSend] = useState(true);
  const [preview, setPreview] = useState(null); // { blobUrl, number, amount, currency }
  const [needsSetup, setNeedsSetup] = useState(false);
  const [building, setBuilding] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(null);
  const [busy, run] = useBusyAction();
  // The booking card points to the setup page instead of showing an error.
  const orSetup = (e) => { if (e.code !== 'INVOICE_PROFILE_MISSING') return false; setNeedsSetup(true); return true; };

  const pay = deal?.payment || {};
  const paid = Number(pay.depositAmount) || 0;
  const fee = Number(deal?.currentFee) || 0;
  const defaults = { deposit: Math.round(fee * 50) / 100, final: Math.max(0, fee - paid), full: fee };
  const currency = deal?.currency || 'EUR';
  const body = () => ({ profileId: currentUser.id, dealId: deal.id, kind, templateId, ...(amount !== '' ? { amount: Number(amount) } : {}), ...(number.trim() ? { number: number.trim() } : {}) });

  useEffect(() => {
    if (!isOpen || !currentUser?.id) return;
    setKind(paid > 0 ? 'final' : 'deposit');
    setAmount(''); setNumber(''); setPreview(null); setNeedsSetup(false); setTemplateId(null); setTemplates([]);
    let cancelled = false;
    apiService.invoiceTemplates.list(currentUser.id)
      .then((r) => { if (cancelled) return; setTemplates(r.templates || []); if (!r.templates?.length) setNeedsSetup(true); else setTemplateId(r.defaultId || r.templates[0].id); })
      .catch(() => { if (!cancelled) setNeedsSetup(true); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Open straight onto the invoice as it will look, and rebuild it when the
  // template or the kind changes (amount / number edits wait for
  // "Update preview" so typing doesn't fire a request per keystroke).
  useEffect(() => {
    if (!isOpen || !deal?.id || !currentUser?.id || !templateId) return;
    let cancelled = false;
    setPreview(null); setBuilding(true);
    apiService.previewInvoice({ profileId: currentUser.id, dealId: deal.id, kind, templateId })
      .then((p) => { if (!cancelled) setPreview({ ...p, number: p.number ? decodeURIComponent(p.number) : p.number }); })
      .catch((e) => { if (!cancelled && !orSetup(e)) appAlert(e.message || t('common.error')); })
      .finally(() => { if (!cancelled) setBuilding(false); });
    return () => { cancelled = true; };
  }, [isOpen, deal?.id, kind, templateId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Free the PDF blob when the preview changes, when the modal closes (it
  // stays mounted with isOpen=false), and on unmount.
  useEffect(() => () => { if (preview?.blobUrl) URL.revokeObjectURL(preview.blobUrl); }, [preview]);
  useEffect(() => { if (!isOpen && preview?.blobUrl) { URL.revokeObjectURL(preview.blobUrl); setPreview(null); } }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen || !deal) return null;

  const doPreview = () => run(async () => {
    const p = await apiService.previewInvoice(body());
    setPreview({ ...p, number: p.number ? decodeURIComponent(p.number) : p.number });
  }, { onError: orSetup });

  const doIssue = () => run(async () => {
    const r = await apiService.issueInvoice({ ...body(), send });
    showToast(r.emailed ? 'invoices.issuedAndSent' : 'invoices.issued');
    if (onIssued) onIssued(r.deal);
    onClose();
  }, { onError: orSetup });

  const selected = templates.find((x) => x.id === templateId);

  return (
    <OverlayPortal>
      <div className="delete-modal-overlay" onClick={onClose}>
        <div className="delete-modal invoice-modal" onClick={(e) => e.stopPropagation()}>
          <div className="delete-modal-content">
            <h2 className="modal-title">{t('invoices.issueTitle')}</h2>
            <p className="form-hint" style={{ marginTop: 0 }}>{deal.eventName || deal.venueName} · {t('invoices.feeLine', { fee: dealMoney(fee, currency) })}{paid > 0 ? ` · ${t('invoices.paidSoFar', { paid: dealMoney(paid, currency) })}` : ''}</p>

            {needsSetup ? (
              <div className="agency-card">
                <p className="m-0 text-sm text-white">{t('invoices.setupFirst')}</p>
                <p className="form-hint">{t('invoices.setupWhere')}</p>
              </div>
            ) : (
              <>
                {templates.length > 1 && (
                  <>
                    <label className="form-label">{t('templates.choose')}</label>
                    <div className="invoice-kind-row">
                      {templates.map((x) => (
                        <button key={x.id} type="button" className={`btn btn-sm ${templateId === x.id ? 'btn-primary' : 'btn-outline'}`} onClick={() => { if (x.id !== templateId) { setTemplateId(x.id); setAmount(''); setNumber(''); } }}>{x.name}</button>
                      ))}
                    </div>
                  </>
                )}
                {selected && <p className="form-hint template-line"><TemplateKindBadge kind={selected.kind} /> {t('invoices.styleLine')}</p>}
                <div className="invoice-kind-row">
                  {['deposit', 'final', 'full'].map((k) => (
                    <button key={k} type="button" className={`btn btn-sm ${kind === k ? 'btn-primary' : 'btn-outline'}`} onClick={() => { if (k === kind) return; setKind(k); setAmount(''); setNumber(''); }}>
                      {t(`invoices.kind.${k}`)}
                    </button>
                  ))}
                </div>
                <label className="form-label">{t('invoices.amount')} ({currency})</label>
                <input type="number" min="0" step="0.01" className="form-input" placeholder={String(defaults[kind])} value={amount} onChange={(e) => { setAmount(e.target.value); setPreview(null); }} />
                <label className="form-label">{t('invoices.number')}</label>
                <input type="text" className="form-input" placeholder={preview?.number || t('invoices.numberAuto')} value={number} onChange={(e) => { setNumber(e.target.value); setPreview(null); }} maxLength={40} />
                <p className="form-hint">{t('invoices.numberHint')}</p>

                {building && <p className="form-hint">{t('invoices.building')}</p>}
                {preview?.blobUrl && (
                  <div className="invoice-preview">
                    <iframe title="invoice preview" src={preview.blobUrl} />
                    <p className="form-hint">{t('invoices.previewLine', { number: preview.number, amount: dealMoney(preview.amount, preview.currency || currency) })}</p>
                  </div>
                )}

                <label className="settings-toggle mt-2">
                  <input type="checkbox" checked={send} onChange={(e) => setSend(e.target.checked)} />
                  <span>{t('invoices.emailBooker')}</span>
                </label>
              </>
            )}
          </div>
          <div className="delete-modal-actions">
            <button className="btn btn-outline" onClick={onClose}>{t('common.close')}</button>
            {!needsSetup && !preview && !building && templateId && <button className="btn btn-primary" disabled={busy} onClick={doPreview}>{busy ? '…' : t('invoices.updatePreview')}</button>}
            {!needsSetup && preview && <button className="btn btn-primary" disabled={busy} onClick={doIssue}>{busy ? '…' : t('invoices.issue')}</button>}
          </div>
        </div>
      </div>
    </OverlayPortal>
  );
};

export default IssueInvoiceModal;
