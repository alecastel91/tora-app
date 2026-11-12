import React, { useMemo } from 'react';
import { DOC_CATEGORY_KEYS } from '../../utils/documentCategories';
import { bookingStepsDone } from '../../utils/bookingStatus';
import { summarizeDealPayment } from '../../utils/paymentSummary';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Step 3 (documents) completes when each category is shared or skipped.
 * Step 4 (payment) ticks only when the artist has confirmed receipt.
 */
const WorkflowTimeline = ({ deal, onViewPaymentDetails }) => {
  const { t } = useLanguage();
  // Memo keyed on the deal: the reduces and date parsing below run once per
  // change, not on every parent render.
  const view = useMemo(() => {
    if (!deal) return null;

    const summary = summarizeDealPayment(deal);
    const done = bookingStepsDone(deal, summary);
    const docTimestamps = DOC_CATEGORY_KEYS
      .map((k) => deal.sharedDocuments?.[k]?.sharedAt || deal.sharedDocuments?.[k]?.skippedAt)
      .filter(Boolean)
      .map((t) => new Date(t).getTime());
    const latestDocTs = docTimestamps.length ? new Date(Math.max(...docTimestamps)).toISOString() : null;

    const steps = [
      { key: 'offerAccepted', label: t('bookings.stepOfferAccepted'), completed: done.offerAccepted, timestamp: deal.acceptedAt || deal.updatedAt },
      { key: 'contractSigned', label: t('bookings.stepContractSigned'), completed: done.contractSigned, timestamp: deal.contract?.fullySignedAt },
      { key: 'documentsShared', label: t('bookings.stepDocumentsShared'), completed: done.documentsShared, timestamp: done.documentsShared ? latestDocTs : null },
      { key: 'paymentReceived', label: t('bookings.stepPaymentReceived'), completed: done.paymentReceived, timestamp: deal.payment?.fullPaymentProof?.confirmedAt || (summary.isFullyConfirmed ? deal.payment?.fullPaymentDate : null) },
    ];
    const showPaymentBar = !summary.isFullyConfirmed && (summary.markedDeposit > 0 || summary.fullPaymentMarked) && summary.totalFee > 0;
    const markedPct = showPaymentBar ? Math.min(100, Math.round((summary.totalMarked / summary.totalFee) * 100)) : 0;
    const confirmedPct = showPaymentBar ? Math.min(100, Math.round((summary.totalConfirmed / summary.totalFee) * 100)) : 0;

    return { steps, showPaymentBar, markedPct, confirmedPct, summary };
  }, [deal]);

  if (!view) return null;
  const { steps, showPaymentBar, markedPct, confirmedPct, summary } = view;
  const { confirmedDeposit, totalFee, currency, pendingConfirmation, remaining } = summary;

  // First not-yet-completed step is "current" — it gets the live crimson ring.
  const currentIndex = steps.findIndex((s) => !s.completed);

  // Two tracks: the lighter fill is what the booker marked paid, the darker
  // fill (inside it) is what the artist confirmed. Step 4 ticks on confirmed.
  const paymentBar = showPaymentBar ? (
    <div className="pay-box">
      <div className="pay-box-head">
        <span>{t('bookings.paidOfTotal', { paid: confirmedDeposit, total: totalFee, currency, pct: confirmedPct })}</span>
        {onViewPaymentDetails && (
          <button type="button" onClick={onViewPaymentDetails} className="pay-box-link">{t('bookings.viewDetailsLink')}</button>
        )}
      </div>
      <div className="pay-box-track" aria-hidden>
        {/* marked paid by the booker (lighter), confirmed by the artist (on top) */}
        <span className="pay-box-marked" style={{ width: `${markedPct}%` }} />
        <span className="pay-box-confirmed" style={{ width: `${confirmedPct}%` }} />
      </div>
      {(pendingConfirmation > 0 || remaining > 0) && (
        <div className="pay-box-foot">
          {pendingConfirmation > 0 && <span><strong className="text-[#43E97B]">{pendingConfirmation} {currency}</strong> {t('bookings.awaitingConfirmationShort')}</span>}
          {remaining > 0 && <span>{t('bookings.remainingLabel')} <strong className="text-white">{remaining} {currency}</strong></span>}
        </div>
      )}
    </div>
  ) : null;

  return (
    <div className="workflow-timeline">
      {/* Ticked steps with their dates; the buttons for what is due now live
          in the booking page's Next step box. */}
      <ol className="flow-steps">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const state = step.completed ? 'done' : isCurrent ? 'now' : 'todo';
          return (
            <li key={step.key} className={`flow-step flow-${state}`}>
              <div className="flow-rail">
                <span className="flow-node">
                  {step.completed ? (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  ) : (
                    index + 1
                  )}
                </span>
              </div>
              <div className="flow-body">
                <div className="flow-label">{step.label}</div>
                {step.completed && step.timestamp && (
                  <div className="flow-date">{new Date(step.timestamp).toLocaleDateString(t('dateFormat.locale'))}</div>
                )}
                {step.key === 'paymentReceived' && paymentBar}
              </div>
            </li>
          );
        })}
      </ol>

        {/* Agreed payment deadlines (become binding on accept). Overdue =
            past the date with the corresponding amount still unconfirmed. */}
        {(deal.payment?.depositDeadline || deal.payment?.finalPaymentDeadline) && (() => {
          const today = new Date().toISOString().slice(0, 10);
          const rows = [];
          if (deal.payment.depositDeadline) {
            const overdue = deal.payment.depositDeadline < today && confirmedDeposit <= 0;
            rows.push({ key: 'deposit', label: t('offer.depositDeadline'), date: deal.payment.depositDeadline, overdue });
          }
          if (deal.payment.finalPaymentDeadline) {
            const overdue = deal.payment.finalPaymentDeadline < today && remaining > 0;
            rows.push({ key: 'final', label: t('offer.finalPaymentDeadline'), date: deal.payment.finalPaymentDeadline, overdue });
          }
          return (
            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '11px' }}>
              {rows.map((r) => (
                <span
                  key={r.key}
                  style={{
                    padding: '3px 8px', borderRadius: '99px',
                    border: `1px solid ${r.overdue ? 'rgba(255,51,102,0.6)' : 'rgba(255,255,255,0.14)'}`,
                    color: r.overdue ? '#FF3366' : 'rgba(255,255,255,0.6)',
                  }}
                >
                  {r.label}: {new Date(r.date + 'T00:00:00Z').toLocaleDateString(t('dateFormat.locale'), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
                  {r.overdue ? ` · ${t('bookings.overdue')}` : ''}
                </span>
              ))}
            </div>
          );
        })()}

    </div>
  );
};

export default WorkflowTimeline;
