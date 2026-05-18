import React, { useMemo } from 'react';
import { DOC_CATEGORY_KEYS, categoryStatus } from '../../utils/documentCategories';
import { summarizeDealPayment } from '../../utils/paymentSummary';

/**
 * Step 3 (documents) completes when each category is shared or skipped.
 * Step 4 (payment) ticks only when the artist has confirmed receipt.
 */
const WorkflowTimeline = ({ deal }) => {
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
      { key: 'contractSigned', label: 'Contract Signed', completed: deal.contract?.status === 'FULLY_SIGNED', timestamp: deal.contract?.fullySignedAt },
      { key: 'documentsShared', label: 'Documents Shared', completed: allDocsResolved, timestamp: allDocsResolved ? latestDocTs : null },
      { key: 'paymentReceived', label: 'Payment Received', completed: summary.isFullyConfirmed, timestamp: deal.payment?.fullPaymentProof?.confirmedAt || (summary.isFullyConfirmed ? deal.payment?.fullPaymentDate : null) },
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

  return (
    <div className="workflow-timeline">
      {/* Overall Progress Bar */}
      <div className="workflow-progress-bar">
        <div className="workflow-progress-fill" style={{ width: `${progressPercentage}%` }} />
      </div>

      {/* Timeline Steps */}
      <div className="workflow-steps">
        {steps.map((step, index) => (
          <div key={step.key} className={`workflow-step ${step.completed ? 'completed' : 'pending'}`}>
            <div className="workflow-step-icon">
              {step.completed ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              ) : (
                <div className="workflow-step-number">{index + 1}</div>
              )}
            </div>

            <div className="workflow-step-label">{step.label}</div>

            {step.completed && step.timestamp && (
              <div className="workflow-step-timestamp">
                {new Date(step.timestamp).toLocaleDateString()}
              </div>
            )}

            {index < steps.length - 1 && (
              <div className={`workflow-connector ${step.completed && steps[index + 1].completed ? 'completed' : 'pending'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Payment progress bar — two tracks. The lighter fill shows what the
          booker has marked paid; the darker fill (inside it) shows what the
          artist has confirmed receipt of. Step 4 ticks only when confirmed
          covers the fee. */}
      {showPaymentBar && (
        <div style={{ marginTop: '14px', padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px', fontSize: '12px' }}>
            <span style={{ color: '#bbb', fontWeight: 600 }}>Payment progress</span>
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
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#888', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {pendingConfirmation > 0 && (
              <span><strong style={{ color: 'rgba(80,200,120,0.85)' }}>{pendingConfirmation} {currency}</strong> awaiting confirmation</span>
            )}
            {remaining > 0 && (
              <span>· Remaining: <strong style={{ color: '#fff' }}>{remaining} {currency}</strong></span>
            )}
          </div>
        </div>
      )}

      {/* Progress Text */}
      <div className="workflow-progress-text">
        {completedSteps === steps.length ? (
          <span className="workflow-complete">All steps completed!</span>
        ) : (
          <span>{completedSteps} of {steps.length} steps completed</span>
        )}
      </div>
    </div>
  );
};

export default WorkflowTimeline;
