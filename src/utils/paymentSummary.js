// Single source of truth for payment-state derivations on a deal.
// Both WorkflowTimeline and BookingsScreen (recap pill, history modal)
// were independently computing the same numbers and drifting — moving
// the math here keeps them in lock-step and fixes a subtle bug where the
// pill ignored depositHistory entirely.

export function summarizeDealPayment(deal) {
  const payment = deal?.payment || {};
  const totalFee = Number(deal?.currentFee) || 0;
  const currency = payment.currency || deal?.currency || '';
  const history = Array.isArray(payment.depositHistory) ? payment.depositHistory : [];

  const markedDeposit = history.length > 0
    ? history.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    : (Number(payment.depositAmount) || 0);
  const confirmedDeposit = history.reduce((s, e) => s + (e.confirmedAt ? (Number(e.amount) || 0) : 0), 0);

  const fullPaymentMarked = payment.status === 'FULLY_PAID';
  const fullPaymentConfirmed = !!payment.fullPaymentProof?.confirmedAt;
  const fullPaymentAmount = fullPaymentMarked
    ? Math.max(0, (Number(payment.amount) || totalFee) - markedDeposit)
    : 0;

  const totalMarked = markedDeposit + fullPaymentAmount;
  const totalConfirmed = confirmedDeposit + (fullPaymentConfirmed ? fullPaymentAmount : 0);

  const isFullyConfirmed = fullPaymentConfirmed
    || (totalFee > 0 && confirmedDeposit >= totalFee);

  return {
    totalFee,
    currency,
    history,
    markedDeposit,
    confirmedDeposit,
    fullPaymentMarked,
    fullPaymentConfirmed,
    fullPaymentAmount,
    totalMarked,
    totalConfirmed,
    pendingConfirmation: Math.max(0, totalMarked - totalConfirmed),
    remaining: Math.max(0, totalFee - totalMarked),
    isFullyConfirmed,
    hasAnyPayment: totalMarked > 0,
  };
}
