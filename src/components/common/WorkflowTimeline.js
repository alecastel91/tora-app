import React, { useMemo } from 'react';
import { DOC_CATEGORY_KEYS, categoryStatus } from '../../utils/documentCategories';
import { summarizeDealPayment } from '../../utils/paymentSummary';
import { useLanguage } from '../../contexts/LanguageContext';

/**
 * Step 3 (documents) completes when each category is shared or skipped.
 * Step 4 (payment) ticks only when the artist has confirmed receipt.
 */
const WorkflowTimeline = ({ deal, onViewPaymentDetails }) => {
  const { t } = useLanguage();
  // Memo keyed on the JSONB blobs that drive every derivation. With many
  // deal cards on screen this avoids redoing reduces + date parsing on every
  // unrelated parent render.
  const view = useMemo(() => {
    if (!deal) return null;

    const allDocsResolved = DOC_CATEGORY_KEYS.every((k) => categoryStatus(deal.sharedDocuments, k) !== 'pending');
    const docTimestamps = DOC_CATEGORY_KEYS
      .map((k) => deal.sharedDocuments?.[k]?.sharedAt || deal.sharedDocuments?.[k]?.skippedAt)
      .filter(Boolean)
      .map((t) => new Date(t).getTime());
    const latestDocTs = docTimestamps.length ? new Date(Math.max(...docTimestamps)).toISOString() : null;

    const summary = summarizeDealPayment(deal);

    const steps = [
      { key: 'offerAccepted', label: 'Offer Accepted', completed: deal.status === 'ACCEPTED' || deal.status === 'COMPLETED', timestamp: deal.updatedAt },
      { key: 'contractSigned', label: t('bookings.stepContractSigned'), completed: deal.contract?.status === 'FULLY_SIGNED', timestamp: deal.contract?.fullySignedAt },
      { key: 'documentsShared', label: t('bookings.stepDocumentsShared'), completed: allDocsResolved, timestamp: allDocsResolved ? latestDocTs : null },
      { key: 'paymentReceived', label: t('bookings.stepPaymentReceived'), completed: summary.isFullyConfirmed, timestamp: deal.payment?.fullPaymentProof?.confirmedAt || (summary.isFullyConfirmed ? deal.payment?.fullPaymentDate : null) },
    ];
    const completedSteps = steps.filter((s) => s.completed).length;
    const showPaymentBar = !summary.isFullyConfirmed && (summary.markedDeposit > 0 || summary.fullPaymentMarked) && summary.totalFee > 0;
    const markedPct = showPaymentBar ? Math.min(100, Math.round((summary.totalMarked / summary.totalFee) * 100)) : 0;
    const confirmedPct = showPaymentBar ? Math.min(100, Math.round((summary.totalConfirmed / summary.totalFee) * 100)) : 0;

    return { steps, completedSteps, progressPercentage: (completedSteps / steps.length) * 100, showPaymentBar, markedPct, confirmedPct, summary };
  }, [deal]);

  if (!view) return null;
  const { steps, completedSteps, progressPercentage, showPaymentBar, markedPct, confirmedPct, summary } = view;
  const { confirmedDeposit, totalFee, currency, pendingConfirmation, remaining } = summary;

  // First not-yet-completed step is "current" — it gets the live crimson ring.
  const currentIndex = steps.findIndex((s) => !s.completed);

  return (
    <div className="workflow-timeline">
      {/* Horizontal stepper: nodes on a thin track that fills crimson as the deal advances */}
      <div className="grid grid-cols-4 pt-1">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const node = step.completed
            ? 'bg-infrared text-white'
            : isCurrent
              ? 'border border-infrared/70 text-infrared bg-[#131315] shadow-[0_0_10px_rgba(255,51,102,0.35)]'
              : 'border border-white/15 text-white/30 bg-white/[0.02]';
          return (
            <div key={step.key} className="relative flex flex-col items-center min-w-0">
              {/* track segment from the previous node's center to this node's edge */}
              {index > 0 && (
                <span
                  aria-hidden
                  className={`absolute top-[10px] h-[2px] rounded-full
                              ${steps[index - 1].completed ? 'bg-infrared' : 'bg-white/10'}`}
                  style={{ left: 'calc(-50% + 13px)', right: 'calc(50% + 13px)' }}
                />
              )}
              {/* node */}
              <span
                className={`relative z-[1] w-[22px] h-[22px] rounded-full flex items-center justify-center
                            text-[10px] font-semibold font-tech transition-colors ${node}`}
              >
                {step.completed ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              {/* label */}
              <span
                className={`mt-2 text-[8px] font-semibold uppercase tracking-[0.12em] font-tech text-center leading-[1.5] px-0.5
                            ${step.completed ? 'text-white/70' : isCurrent ? 'text-infrared/90' : 'text-white/30'}`}
              >
                {step.label}
              </span>
              {step.completed && step.timestamp && (
                <span className="mt-0.5 text-[8px] text-white/25 font-tech">
                  {new Date(step.timestamp).toLocaleDateString()}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Payment progress bar — two tracks. The lighter fill shows what the
          booker has marked paid; the darker fill (inside it) shows what the
          artist has confirmed receipt of. Step 4 ticks only when confirmed
          covers the fee. */}
      {showPaymentBar && (
        <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', fontSize: '12px' }}>
            <span style={{ color: '#bbb', fontWeight: 600 }}>{t('bookings.paymentProgress')}</span>
            <span style={{ color: '#888' }}>
              {confirmedDeposit} {currency} confirmed of {totalFee} {currency} ({confirmedPct}%)
            </span>
          </div>
          <div style={{ position: 'relative', height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
            {/* Marked-paid track (lighter) */}
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              width: `${markedPct}%`,
              background: 'rgba(80,200,120,0.35)',
              transition: 'width 0.3s ease',
            }} />
            {/* Confirmed track (darker, sits on top) */}
            <div style={{
              position: 'absolute', top: 0, left: 0, height: '100%',
              width: `${confirmedPct}%`,
              background: 'linear-gradient(90deg, rgba(80,200,120,1), rgba(80,200,120,0.85))',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#888', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
            {pendingConfirmation > 0 && (
              <span><strong style={{ color: 'rgba(80,200,120,0.85)' }}>{pendingConfirmation} {currency}</strong> awaiting confirmation</span>
            )}
            {remaining > 0 && (
              <span>· Remaining: <strong style={{ color: '#fff' }}>{remaining} {currency}</strong></span>
            )}
            {onViewPaymentDetails && (
              <button
                type="button"
                onClick={onViewPaymentDetails}
                style={{
                  marginLeft: 'auto',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  fontStyle: 'italic',
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.55)',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                }}
              >
                view details
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress caption */}
      <div className="text-center mt-3.5">
        {completedSteps === steps.length ? (
          <span className="text-[9px] font-semibold uppercase tracking-[0.2em] font-tech text-role-agent">
            All steps completed
          </span>
        ) : (
          <span className="text-[9px] font-medium uppercase tracking-[0.2em] font-tech text-white/25">
            {completedSteps} of {steps.length} completed
          </span>
        )}
      </div>
    </div>
  );
};

export default WorkflowTimeline;
